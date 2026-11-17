import { beforeEach, describe, expect, test } from "bun:test";
import type { HlsConfig, LoaderCallbacks, LoaderContext, LoaderStats } from "hls.js";

import {
  fatalHlsAction,
  makeFragmentLoader,
  makePlaylistLoader,
  playlistUris,
  segmentKey,
  SignedPlaylistRefresher,
  type FetchedPlaylist,
  type LoaderCtor,
} from "@/features/reels/playback/hlsRefresh";
import { PreloadCache } from "@/features/reels/playback/hlsPreload";

/*
  The refresh path against a simulated media-service + CDN: a child
  playlist signs every segment for a 10-minute window and says when in
  X-HLS-Expires-At; a segment asked for after its window is a 403; a viewer
  whose access is withdrawn gets 403 on the next playlist fetch. The hls.js
  loader is a stand-in with XhrLoader's contract (single use, stats object,
  getResponseHeader).
*/

const WINDOW_MS = 10 * 60_000;
const SEGMENT_S = 6;
const CHILD = "https://api.test/v1/media/m1/hls/720p.m3u8";

class World {
  now = Date.UTC(2026, 10, 17, 12, 0, 0);
  revoked = false;
  segments = 20;
  playlistFetches = 0;
  /** Every URL a loader actually put on the wire. */
  wire: string[] = [];

  playlist(): FetchedPlaylist {
    this.playlistFetches += 1;
    if (this.revoked) return { status: 403, body: "", expiresAt: null };
    const expiresAt = this.now + WINDOW_MS;
    const lines = ["#EXTM3U", "#EXT-X-TARGETDURATION:6", "#EXT-X-PLAYLIST-TYPE:VOD"];
    for (let i = 0; i < this.segments; i += 1) lines.push(`#EXTINF:${SEGMENT_S},`, `https://cdn.test/m1/hls/720p_${String(i).padStart(5, "0")}.ts?Expires=${expiresAt}&Signature=s${expiresAt}`);
    lines.push("#EXT-X-ENDLIST");
    return { status: 200, body: lines.join("\n"), expiresAt };
  }

  /** The CDN: 200 while the URL's own Expires is in the future. */
  forbidden = 0;
  segment(url: string): number {
    const exp = Number(new URL(url).searchParams.get("Expires"));
    if (this.now < exp) return 200;
    this.forbidden += 1;
    return 403;
  }
}

let world: World;

function freshStats(): LoaderStats {
  return {
    aborted: false,
    loaded: 0,
    retry: 0,
    total: 0,
    chunkCount: 0,
    bwEstimate: 0,
    loading: { start: 0, first: 0, end: 0 },
    parsing: { start: 0, end: 0 },
    buffering: { start: 0, first: 0, end: 0 },
  };
}

/** XhrLoader's contract: one load per instance, the stats object hls.js holds, headers of the last response. */
class FakeXhrLoader {
  context: LoaderContext | null = null;
  stats: LoaderStats = freshStats();
  private headers: Record<string, string> = {};
  constructor(_config: HlsConfig) {}
  load(context: LoaderContext, _config: unknown, callbacks: LoaderCallbacks<LoaderContext>) {
    if (this.stats.loading.start) throw new Error("Loader can only be used once.");
    this.stats.loading.start = 1;
    this.context = context;
    const url = context.url;
    world.wire.push(url);
    queueMicrotask(() => {
      if (url.endsWith(".m3u8")) {
        const pl = world.playlist();
        this.headers = pl.expiresAt ? { "X-HLS-Expires-At": new Date(pl.expiresAt).toISOString() } : {};
        if (pl.status !== 200) callbacks.onError({ code: pl.status, text: "" }, context, null, this.stats);
        else callbacks.onSuccess({ url, data: pl.body }, this.stats, context, null);
        return;
      }
      const status = world.segment(url);
      if (status !== 200) callbacks.onError({ code: status, text: "Forbidden" }, context, null, this.stats);
      else callbacks.onSuccess({ url, data: new ArrayBuffer(8) }, this.stats, context, null);
    });
  }
  getResponseHeader(name: string) {
    return this.headers[name] ?? null;
  }
  abort() {}
  destroy() {}
}

const Base = FakeXhrLoader as unknown as LoaderCtor;
const config = {} as HlsConfig;

function newRefresher(onRevoked?: () => void) {
  return new SignedPlaylistRefresher({
    now: () => world.now,
    fetchPlaylist: async () => world.playlist(),
    onRevoked,
  });
}

type Outcome = { ok: true; url: string } | { ok: false; code: number };

function loadWith(Loader: LoaderCtor, url: string, baseurl: string): Promise<Outcome> {
  return new Promise((resolve) => {
    const loader = new Loader(config);
    const ctx = { url, responseType: "arraybuffer", type: "media-fragment", frag: { baseurl } } as unknown as LoaderContext;
    loader.load(ctx, {} as never, {
      onSuccess: (r) => resolve({ ok: true, url: r.url }),
      onError: (e) => resolve({ ok: false, code: e.code }),
      onTimeout: () => resolve({ ok: false, code: -1 }),
    });
  });
}

/** hls.js's own first load of the child playlist, through the pLoader (reads the expiry header). */
function loadPlaylist(Loader: LoaderCtor): Promise<string> {
  return new Promise((resolve, reject) => {
    const loader = new Loader(config);
    const ctx = { url: CHILD, responseType: "text", type: "level" } as unknown as LoaderContext;
    loader.load(ctx, {} as never, {
      onSuccess: (r) => resolve(String(r.data)),
      onError: (e) => reject(new Error(String(e.code))),
      onTimeout: () => reject(new Error("timeout")),
    });
  });
}

beforeEach(() => {
  world = new World();
});

describe("playlist parsing", () => {
  test("segment keys ignore the signature, URIs resolve against the playlist", () => {
    expect(segmentKey("https://cdn.test/a/1.ts?Policy=x&Signature=y")).toBe(segmentKey("https://cdn.test/a/1.ts?Policy=z"));
    expect(playlistUris('#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:6,\nseg1.ts?s=1\n', "https://cdn.test/a/hls/720p.m3u8")).toEqual([
      "https://cdn.test/a/hls/init.mp4",
      "https://cdn.test/a/hls/seg1.ts?s=1",
    ]);
  });
});

describe("a segment answered 403 refreshes the child playlist once and retries that segment", () => {
  test("no expiry header known: the 403 path alone keeps playback going at the same segment", async () => {
    const refresher = newRefresher();
    const FL = makeFragmentLoader(Base, refresher, new PreloadCache());
    const stale = world.playlist(); // what hls.js holds
    const urls = playlistUris(stale.body, CHILD);
    world.now += WINDOW_MS + 1000; // the signature ran out under a pause
    const out = await loadWith(FL, urls[7], CHILD);
    expect(out.ok).toBe(true);
    expect(refresher.refreshCount).toBe(1);
    // the old URL was tried, then the fresh one for the SAME segment, on a new single-use loader
    expect(world.wire).toHaveLength(2);
    expect(segmentKey(world.wire[1])).toBe(segmentKey(urls[7]));
    expect(world.wire[1]).not.toBe(urls[7]);
  });

  test("the refresh says 403: the viewer is revoked, the 403 goes back to hls.js, no retry", async () => {
    let revokedCalls = 0;
    const refresher = newRefresher(() => (revokedCalls += 1));
    const FL = makeFragmentLoader(Base, refresher, new PreloadCache());
    const urls = playlistUris(world.playlist().body, CHILD);
    world.now += WINDOW_MS + 1000;
    world.revoked = true;
    const out = await loadWith(FL, urls[3], CHILD);
    expect(out).toEqual({ ok: false, code: 403 });
    expect(revokedCalls).toBe(1);
    expect(refresher.revoked).toBe(true);
    // a later segment does not even reach the network
    const before = world.wire.length;
    expect(await loadWith(FL, urls[4], CHILD)).toEqual({ ok: false, code: 403 });
    expect(world.wire.length).toBe(before);
    expect(revokedCalls).toBe(1);
  });
});

describe("X-HLS-Expires-At: refresh about 30 s before the window closes", () => {
  test("the pLoader records the expiry; a segment inside the lead time is loaded from a refreshed URL, no 403 first", async () => {
    const refresher = newRefresher();
    const cache = new PreloadCache();
    const PL = makePlaylistLoader(Base, refresher, cache);
    const FL = makeFragmentLoader(Base, refresher, cache);
    const body = await loadPlaylist(PL);
    const urls = playlistUris(body, CHILD);
    expect(refresher.expiresAt(CHILD)).toBe(world.now + WINDOW_MS);

    world.now += WINDOW_MS - 20_000; // 20 s left: inside the 30 s lead
    const wireBefore = world.wire.length;
    const out = await loadWith(FL, urls[0], CHILD);
    expect(out.ok).toBe(true);
    expect(refresher.refreshCount).toBe(1);
    // one playlist fetch (by the refresher, not on the loader's wire) and one segment request, already fresh
    expect(world.wire.length - wireBefore).toBe(1);
    expect(world.wire.at(-1)).not.toBe(urls[0]);
  });

  test("a paused player makes no requests; the next segment after a 40-minute pause refreshes first", async () => {
    const refresher = newRefresher();
    const cache = new PreloadCache();
    const urls = playlistUris(await loadPlaylist(makePlaylistLoader(Base, refresher, cache)), CHILD);
    const fetchesAfterLoad = world.playlistFetches;
    world.now += 40 * 60_000;
    expect(world.playlistFetches).toBe(fetchesAfterLoad);
    expect(await loadWith(makeFragmentLoader(Base, refresher, cache), urls[5], CHILD)).toMatchObject({ ok: true });
    expect(world.playlistFetches).toBe(fetchesAfterLoad + 1);
  });

  test("a multi-hour video keeps playing across many windows, with one refresh per window and no 403 seen", async () => {
    world.segments = (3 * 3600) / SEGMENT_S; // a 3-hour rung: 1,800 segments
    const refresher = newRefresher();
    const cache = new PreloadCache();
    const FL = makeFragmentLoader(Base, refresher, cache);
    const urls = playlistUris(await loadPlaylist(makePlaylistLoader(Base, refresher, cache)), CHILD);
    let failures = 0;
    for (let i = 0; i < urls.length; i += 1) {
      world.now += SEGMENT_S * 1000; // real-time playback, segment by segment
      if (i === 900) world.now += 25 * 60_000; // a long pause halfway
      const out = await loadWith(FL, urls[i], CHILD);
      if (!out.ok) failures += 1;
    }
    expect(failures).toBe(0);
    // 3 h + 25 min of wall clock over 10-minute windows (refreshing 30 s early): about 21 refreshes
    expect(refresher.refreshCount).toBeGreaterThanOrEqual(18);
    expect(refresher.refreshCount).toBeLessThanOrEqual(24);
    // and the CDN never had to refuse an expired signature
    expect(world.forbidden).toBe(0);
  });
});

describe("what a fatal hls.js error means", () => {
  test("auth failures stop on 'unavailable', never the progressive file", () => {
    expect(fatalHlsAction({ type: "networkError", details: "fragLoadError", response: { code: 403 } }, false)).toBe("unavailable");
    expect(fatalHlsAction({ type: "networkError", details: "levelLoadError", response: { code: 404 } }, false)).toBe("unavailable");
    expect(fatalHlsAction({ type: "networkError", details: "manifestLoadError", response: { code: 401 } }, false)).toBe("unavailable");
    expect(fatalHlsAction({ type: "networkError", details: "fragLoadError", response: { code: 500 } }, true)).toBe("unavailable");
  });
  test("media errors recover; a missing master or a flaky network falls back to the file", () => {
    expect(fatalHlsAction({ type: "mediaError", details: "bufferStalledError" }, false)).toBe("recover-media");
    expect(fatalHlsAction({ type: "networkError", details: "manifestLoadError", response: { code: 404 } }, false)).toBe("fallback-file");
    expect(fatalHlsAction({ type: "networkError", details: "fragLoadTimeOut" }, false)).toBe("fallback-file");
    expect(fatalHlsAction({ type: "networkError", details: "fragLoadError", response: { code: 502 } }, false)).toBe("fallback-file");
  });
});
