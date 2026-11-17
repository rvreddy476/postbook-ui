import { isApiUrl } from "./hlsAuth";
import { pickHlsLevel, type QualityPref } from "./playerPrefs";

/*
  Preloading the next reel (reels-46) and the Data saver cap.

  While one reel plays, the stage fetches the next reel's master playlist,
  one child playlist and that rung's first segment into a small in-memory
  cache. When the viewer swipes, the next player's hls.js loaders
  (hlsRefresh.ts) answer those three requests from the cache instead of the
  network, and the player starts on the rung that was preloaded. Entries
  live PRELOAD_TTL_MS, far inside the segment signing window, and are used
  once. Nothing is preloaded under Data saver.
*/

export const PRELOAD_TTL_MS = 60_000;
const MAX_ENTRIES = 12;
/** The Data saver page promises "Reels capped at 240p". */
export const DATA_SAVER_MAX_HEIGHT = 240;
/** Auto quality starts a preloaded reel at the highest rung at or below this. */
export const PRELOAD_AUTO_HEIGHT = 480;

export interface PreloadEntry {
  data: string | ArrayBuffer;
  /** How long the real download took, replayed into hls.js's stats. */
  durationMs: number;
  ttfbMs: number;
  expiresAt: number | null;
  storedAt: number;
}

/** hls.js asks for absolute URLs (loadSource normalises against the page), so the cache keys on them too. */
export function absoluteUrl(url: string): string {
  try {
    const base = typeof location !== "undefined" ? location.href : undefined;
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

export class PreloadCache {
  private readonly entries = new Map<string, PreloadEntry>();
  /** master URL → the child playlist URL preloaded for it. */
  private readonly rungs = new Map<string, { childUrl: string; storedAt: number }>();

  constructor(private readonly now: () => number = Date.now, private readonly ttlMs = PRELOAD_TTL_MS) {}

  put(rawUrl: string, entry: Omit<PreloadEntry, "storedAt">): void {
    const url = absoluteUrl(rawUrl);
    this.entries.delete(url);
    this.entries.set(url, { ...entry, storedAt: this.now() });
    while (this.entries.size > MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  /** The entry for `url`, once: a second request for it goes to the network. */
  take(rawUrl: string): PreloadEntry | null {
    const url = absoluteUrl(rawUrl);
    const entry = this.entries.get(url);
    if (!entry) return null;
    this.entries.delete(url);
    if (this.now() - entry.storedAt > this.ttlMs) return null;
    return entry;
  }

  has(rawUrl: string): boolean {
    const entry = this.entries.get(absoluteUrl(rawUrl));
    return !!entry && this.now() - entry.storedAt <= this.ttlMs;
  }

  setRung(masterUrl: string, childUrl: string): void {
    this.rungs.set(absoluteUrl(masterUrl), { childUrl: absoluteUrl(childUrl), storedAt: this.now() });
  }

  /** The child playlist preloaded for this master, while it is still in the cache. */
  rungFor(rawMasterUrl: string): string | null {
    const masterUrl = absoluteUrl(rawMasterUrl);
    const rung = this.rungs.get(masterUrl);
    if (!rung) return null;
    if (this.now() - rung.storedAt > this.ttlMs || !this.has(rung.childUrl)) {
      this.rungs.delete(masterUrl);
      return null;
    }
    return rung.childUrl;
  }

  clear(): void {
    this.entries.clear();
    this.rungs.clear();
  }
}

export const hlsPreloadCache = new PreloadCache();

/* ── rungs ──────────────────────────────────────────────── */

export interface MasterVariant {
  url: string;
  height: number;
  bandwidth: number;
}

/** The variants of a master playlist, absolute, in manifest order. */
export function parseMasterVariants(body: string, masterUrl: string): MasterVariant[] {
  const lines = body.split(/\r?\n/).map((l) => l.trim());
  const out: MasterVariant[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith("#EXT-X-STREAM-INF:")) continue;
    const res = /RESOLUTION=(\d+)x(\d+)/i.exec(line);
    const bw = /[:,]BANDWIDTH=(\d+)/i.exec(line);
    let j = i + 1;
    while (j < lines.length && (!lines[j] || lines[j].startsWith("#"))) j += 1;
    if (j >= lines.length) break;
    let url = lines[j];
    try {
      url = new URL(lines[j], masterUrl).href;
    } catch {
      /* keep as written */
    }
    out.push({ url, height: res ? Number(res[2]) : 0, bandwidth: bw ? Number(bw[1]) : 0 });
    i = j;
  }
  return out;
}

/** Index of the highest rung at or below `maxHeight`; the lowest rung when all are above; -1 when there are none. */
export function capIndex(heights: number[], maxHeight: number): number {
  if (heights.length === 0) return -1;
  let best = -1;
  let lowest = 0;
  heights.forEach((h, i) => {
    if (h <= maxHeight && (best === -1 || h > heights[best])) best = i;
    if (h < heights[lowest]) lowest = i;
  });
  return best === -1 ? lowest : best;
}

export interface LevelPlan {
  /** hls.nextLevel / currentLevel; -1 = auto. */
  level: number;
  /** hls.autoLevelCapping; -1 = no cap. */
  autoCap: number;
}

/**
  The quality preference (already turned into a level by pickHlsLevel) under
  an optional height cap. With Data saver on, Auto stays adaptive but cannot
  climb above the cap, and a fixed choice above it plays the cap.
*/
export function planLevels(preferred: number, heights: number[], capHeight: number | null): LevelPlan {
  if (capHeight === null || heights.length === 0) return { level: preferred, autoCap: -1 };
  const cap = capIndex(heights, capHeight);
  if (preferred < 0) return { level: -1, autoCap: cap };
  return { level: heights[preferred] > heights[cap] ? cap : preferred, autoCap: cap };
}

/** The viewer's quality preference on these rungs, under the Data saver cap when it is on. */
export function levelPlanFor(quality: QualityPref, heights: number[], dataSaver: boolean): LevelPlan {
  return planLevels(pickHlsLevel(quality, heights), heights, dataSaver ? DATA_SAVER_MAX_HEIGHT : null);
}

/* ── preload ────────────────────────────────────────────── */

export interface PreloadDeps {
  fetchImpl?: typeof fetch;
  cache?: PreloadCache;
  now?: () => number;
  signal?: AbortSignal;
}

async function timedFetch(fetchImpl: typeof fetch, url: string, kind: "text" | "bytes", signal?: AbortSignal) {
  const t0 = Date.now();
  const res = await fetchImpl(url, { credentials: isApiUrl(url) ? "include" : "omit", cache: "no-store", signal });
  const ttfb = Date.now() - t0;
  if (!res.ok) return null;
  const data = kind === "text" ? await res.text() : await res.arrayBuffer();
  return { data, ttfbMs: ttfb, durationMs: Date.now() - t0, expires: res.headers.get("X-HLS-Expires-At") };
}

/**
  Fetches master → one child playlist → its first segment into the cache.
  `pickHeight(heights)` chooses the rung from the master's heights (manifest
  order); the result is the child playlist URL, or null when nothing was
  preloaded. Failures are silent: the player simply loads from the network.
*/
export async function preloadHlsStart(rawMasterUrl: string, pickHeight: (heights: number[]) => number, deps: PreloadDeps = {}): Promise<string | null> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const cache = deps.cache ?? hlsPreloadCache;
  const masterUrl = absoluteUrl(rawMasterUrl);
  const ready = cache.rungFor(masterUrl);
  if (ready) return ready;
  try {
    const master = await timedFetch(fetchImpl, masterUrl, "text", deps.signal);
    if (!master || typeof master.data !== "string") return null;
    const variants = parseMasterVariants(master.data, masterUrl);
    if (variants.length === 0) return null;
    const index = pickHeight(variants.map((v) => v.height));
    const variant = variants[index >= 0 && index < variants.length ? index : 0];

    const child = await timedFetch(fetchImpl, variant.url, "text", deps.signal);
    if (!child || typeof child.data !== "string") return null;
    const first = child.data
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("#"));
    if (!first) return null;
    let segmentUrl = first;
    try {
      segmentUrl = new URL(first, variant.url).href;
    } catch {
      /* keep */
    }
    const segment = await timedFetch(fetchImpl, segmentUrl, "bytes", deps.signal);
    if (!segment || !(segment.data instanceof ArrayBuffer)) return null;

    const expiresAt = child.expires ? Date.parse(child.expires) : NaN;
    cache.put(masterUrl, { data: master.data, durationMs: master.durationMs, ttfbMs: master.ttfbMs, expiresAt: null });
    cache.put(variant.url, { data: child.data, durationMs: child.durationMs, ttfbMs: child.ttfbMs, expiresAt: Number.isFinite(expiresAt) ? expiresAt : null });
    cache.put(segmentUrl, { data: segment.data, durationMs: segment.durationMs, ttfbMs: segment.ttfbMs, expiresAt: null });
    cache.setRung(masterUrl, variant.url);
    return variant.url;
  } catch {
    return null;
  }
}

/**
  The rung a preload fetches: the viewer's fixed quality (capped under Data
  saver), or for Auto the highest rung at or below PRELOAD_AUTO_HEIGHT.
*/
export function preloadRung(preferredHeight: number | null, heights: number[]): number {
  if (heights.length === 0) return -1;
  if (preferredHeight === null) return capIndex(heights, PRELOAD_AUTO_HEIGHT);
  return capIndex(heights, preferredHeight);
}
