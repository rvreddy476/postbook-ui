import { describe, expect, test } from "bun:test";
import type { HlsConfig, LoaderCallbacks, LoaderContext, LoaderStats } from "hls.js";

import {
  capIndex,
  DATA_SAVER_MAX_HEIGHT,
  levelPlanFor,
  parseMasterVariants,
  planLevels,
  preloadHlsStart,
  preloadRung,
  PreloadCache,
} from "@/features/reels/playback/hlsPreload";
import { makeFragmentLoader, makePlaylistLoader, SignedPlaylistRefresher, type LoaderCtor } from "@/features/reels/playback/hlsRefresh";
import { preloadTarget } from "@/features/reels/playback/useReelPreload";
import type { ReelItem } from "@/features/reels/model";

const MASTER = "https://api.test/v1/media/m2/hls";
const MASTER_BODY = [
  "#EXTM3U",
  "#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=426x240",
  "240p.m3u8",
  "#EXT-X-STREAM-INF:BANDWIDTH=1200000,RESOLUTION=854x480",
  "480p.m3u8",
  "#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720",
  "720p.m3u8",
].join("\n");
const CHILD_BODY = "#EXTM3U\n#EXTINF:6,\nhttps://cdn.test/m2/hls/480p_00000.ts?Signature=a\n#EXTINF:6,\nhttps://cdn.test/m2/hls/480p_00001.ts?Signature=a\n#EXT-X-ENDLIST";

describe("Data saver caps the reel's rung (the settings page promises 240p)", () => {
  const heights = [240, 480, 720, 1080];
  test("Auto stays adaptive but cannot climb above 240p", () => {
    expect(levelPlanFor("auto", heights, true)).toEqual({ level: -1, autoCap: 0 });
    expect(levelPlanFor("auto", heights, false)).toEqual({ level: -1, autoCap: -1 });
  });
  test("a fixed choice above the cap plays the cap; below it is kept", () => {
    expect(levelPlanFor("720p", heights, true)).toEqual({ level: 0, autoCap: 0 });
    expect(levelPlanFor("720p", heights, false)).toEqual({ level: 2, autoCap: -1 });
    expect(planLevels(0, [144, 240, 360], DATA_SAVER_MAX_HEIGHT)).toEqual({ level: 0, autoCap: 1 });
  });
  test("no rung at or below 240p: the lowest one", () => {
    expect(capIndex([720, 360, 480], 240)).toBe(1);
    expect(capIndex([], 240)).toBe(-1);
  });
});

describe("preloading the next reel", () => {
  test("parses the master's rungs", () => {
    expect(parseMasterVariants(MASTER_BODY, MASTER).map((v) => [v.height, v.url])).toEqual([
      [240, "https://api.test/v1/media/m2/240p.m3u8"],
      [480, "https://api.test/v1/media/m2/480p.m3u8"],
      [720, "https://api.test/v1/media/m2/720p.m3u8"],
    ]);
    expect(preloadRung(null, [240, 480, 720])).toBe(1);
    expect(preloadRung(720, [240, 480, 720])).toBe(2);
  });

  test("fetches master, one child and its first segment, with the cookie only to the API", async () => {
    const calls: { url: string; credentials?: RequestCredentials }[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({ url, credentials: init?.credentials });
      if (url === MASTER) return new Response(MASTER_BODY);
      if (url.endsWith("480p.m3u8")) return new Response(CHILD_BODY, { headers: { "X-HLS-Expires-At": "2026-11-17T12:10:00Z" } });
      return new Response(new Uint8Array([1, 2, 3]).buffer);
    }) as unknown as typeof fetch;
    const cache = new PreloadCache();
    const prev = process.env.NEXT_PUBLIC_API_BASE_URL;
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.test";
    try {
      const child = await preloadHlsStart(MASTER, (h) => preloadRung(null, h), { fetchImpl, cache });
      expect(child).toBe("https://api.test/v1/media/m2/480p.m3u8");
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
      else process.env.NEXT_PUBLIC_API_BASE_URL = prev;
    }
    expect(calls).toEqual([
      { url: MASTER, credentials: "include" },
      { url: "https://api.test/v1/media/m2/480p.m3u8", credentials: "include" },
      { url: "https://cdn.test/m2/hls/480p_00000.ts?Signature=a", credentials: "omit" },
    ]);
    expect(cache.rungFor(MASTER)).toBe("https://api.test/v1/media/m2/480p.m3u8");
  });

  test("the next player's loaders answer the preloaded requests from memory, once", async () => {
    const cache = new PreloadCache();
    cache.put(MASTER, { data: MASTER_BODY, durationMs: 40, ttfbMs: 30, expiresAt: null });
    cache.put("https://cdn.test/m2/hls/480p_00000.ts?Signature=a", { data: new ArrayBuffer(4), durationMs: 120, ttfbMs: 40, expiresAt: null });
    let network = 0;
    class Net {
      stats = { loading: { start: 0, first: 0, end: 0 } } as LoaderStats;
      context = null;
      constructor(_c: HlsConfig) {}
      load(ctx: LoaderContext, _cfg: unknown, cb: LoaderCallbacks<LoaderContext>) {
        network += 1;
        queueMicrotask(() => cb.onSuccess({ url: ctx.url, data: "net" }, this.stats, ctx, null));
      }
      abort() {}
      destroy() {}
    }
    const refresher = new SignedPlaylistRefresher();
    const PL = makePlaylistLoader(Net as unknown as LoaderCtor, refresher, cache);
    const FL = makeFragmentLoader(Net as unknown as LoaderCtor, refresher, cache);
    const run = (L: LoaderCtor, url: string, extra: object = {}) =>
      new Promise<{ data: unknown; stats: LoaderStats }>((resolve) => {
        const ctx = { url, responseType: "", type: "manifest", ...extra } as unknown as LoaderContext;
        new L({} as HlsConfig).load(ctx, {} as never, { onSuccess: (r, stats) => resolve({ data: r.data, stats }), onError: () => resolve({ data: null, stats: {} as LoaderStats }), onTimeout: () => undefined });
      });
    const master = await run(PL, MASTER);
    expect(master.data).toBe(MASTER_BODY);
    const seg = await run(FL, "https://cdn.test/m2/hls/480p_00000.ts?Signature=a", { frag: { baseurl: "https://api.test/v1/media/m2/480p.m3u8" } });
    expect(seg.data).toBeInstanceOf(ArrayBuffer);
    // the real download time is replayed, so ABR does not read a cache hit as infinite bandwidth
    expect(seg.stats.loading.end - seg.stats.loading.start).toBe(120);
    expect(network).toBe(0);
    await run(PL, MASTER);
    expect(network).toBe(1);
  });

  test("entries expire and nothing is preloaded under Data saver or for a locked reel", () => {
    let now = 0;
    const cache = new PreloadCache(() => now, 60_000);
    cache.put("https://x.test/a", { data: "a", durationMs: 1, ttfbMs: 1, expiresAt: null });
    now = 61_000;
    expect(cache.take("https://x.test/a")).toBeNull();
    const reel = { media: { hlsUrl: MASTER }, isProcessing: false } as unknown as ReelItem;
    expect(preloadTarget(reel, false)).toBe(MASTER);
    expect(preloadTarget(reel, true)).toBeNull();
    expect(preloadTarget({ ...reel, locked: { tierRequiredId: "t" } } as ReelItem, false)).toBeNull();
    expect(preloadTarget(undefined, false)).toBeNull();
  });
});
