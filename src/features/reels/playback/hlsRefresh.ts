import type { HlsConfig, Loader, LoaderCallbacks, LoaderConfiguration, LoaderContext, LoaderStats } from "hls.js";

import { hlsXhrSetup, isApiUrl } from "./hlsAuth";
import { hlsPreloadCache, type PreloadEntry } from "./hlsPreload";

/*
  Signed segment URLs that outlive their window (lv-27, lv-2 client side).

  media-service signs every segment URL in a child playlist for a short
  window (default 10 minutes, at most 15) and says when in the playlist's
  X-HLS-Expires-At header. A VOD playlist is never reloaded by hls.js, so a
  long video, or a short one after a pause, would ask for segments whose
  signature has expired and get 403.

  Mechanism: a custom hls.js fragment loader (fLoader) and playlist loader
  (pLoader) around hls.js's own XhrLoader. Chosen over `hls.loadSource(master)`
  + startPosition because, in hls.js 1.7, loadSource on an attached element
  detaches and re-attaches the MediaSource: the picture goes black, the
  buffer is dropped and play state has to be rebuilt every window. The
  loader route keeps the MediaSource, the buffer, the position and the
  play/pause state untouched; only the URL of the next segment changes.

  - The pLoader reads X-HLS-Expires-At from each child playlist and records
    the segment URLs it lists.
  - Before a segment loads, if its playlist is within REFRESH_LEAD_MS of
    expiry, the same child playlist route is fetched again (it re-runs the
    access check) and the segment is loaded from the fresh URL. A paused
    player makes no requests at all; it refreshes on the next segment it needs.
  - A segment answered 401/403 refreshes once and retries that one segment
    with its fresh URL.
  - A refresh answered 401/403/404/410 means the viewer lost access: the
    player is told (onRevoked) and stops on its "unavailable" state. It never
    falls back to the progressive file on an auth failure.

  Segment URLs are matched by origin + path (the query is the signature), so
  this works for CloudFront (one shared Policy/Signature/Key-Pair-Id query
  per rung) and per-segment signing (dev MinIO) alike.
*/

export const HLS_EXPIRES_HEADER = "X-HLS-Expires-At";
/** Refresh this long before the playlist's segments stop working. */
export const REFRESH_LEAD_MS = 30_000;

export type RefreshResult = "ok" | "revoked" | "error";

export interface FetchedPlaylist {
  status: number;
  body: string;
  expiresAt: number | null;
}

export type PlaylistFetcher = (url: string) => Promise<FetchedPlaylist>;

/** A status that means "this viewer may not have this video (any more)". */
export function isAccessDenied(status: number): boolean {
  return status === 401 || status === 403 || status === 404 || status === 410;
}

export function parseExpiresAt(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

/** origin + path: what stays the same when a segment is re-signed. */
export function segmentKey(url: string): string {
  let href = url;
  try {
    href = new URL(url).href;
  } catch {
    /* relative or odd: use as given */
  }
  const cut = href.search(/[?#]/);
  return cut < 0 ? href : href.slice(0, cut);
}

/** Every URI a media playlist lists (segments and EXT-X-MAP init segments), absolute. */
export function playlistUris(body: string, playlistUrl: string): string[] {
  const resolve = (u: string) => {
    try {
      return new URL(u, playlistUrl).href;
    } catch {
      return u;
    }
  };
  const out: string[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      const map = /^#EXT-X-MAP:.*\bURI="([^"]+)"/.exec(line);
      if (map) out.push(resolve(map[1]));
      continue;
    }
    out.push(resolve(line));
  }
  return out;
}

/** The browser fetch for a refresh: the cookie only to an API route, never cached. */
export const fetchPlaylistFromNetwork: PlaylistFetcher = async (url) => {
  const res = await fetch(url, { credentials: isApiUrl(url) ? "include" : "omit", cache: "no-store" });
  return {
    status: res.status,
    body: res.ok ? await res.text() : "",
    expiresAt: parseExpiresAt(res.headers.get(HLS_EXPIRES_HEADER)),
  };
};

export interface RefresherDeps {
  fetchPlaylist?: PlaylistFetcher;
  now?: () => number;
  leadMs?: number;
  /** The viewer lost access: stop and show "unavailable". Called once. */
  onRevoked?: () => void;
}

export class SignedPlaylistRefresher {
  private readonly fresh = new Map<string, string>();
  private readonly expiry = new Map<string, number>();
  private readonly inflight = new Map<string, Promise<RefreshResult>>();
  private readonly fetchPlaylist: PlaylistFetcher;
  private readonly now: () => number;
  private readonly leadMs: number;
  private readonly onRevoked?: () => void;
  revoked = false;
  /** How many times a child playlist was fetched again (for tests and diagnostics). */
  refreshCount = 0;

  constructor(deps: RefresherDeps = {}) {
    this.fetchPlaylist = deps.fetchPlaylist ?? fetchPlaylistFromNetwork;
    this.now = deps.now ?? Date.now;
    this.leadMs = deps.leadMs ?? REFRESH_LEAD_MS;
    this.onRevoked = deps.onRevoked;
  }

  /** A child playlist arrived (hls.js's own load, or a refresh): its URLs are now the newest. */
  noteLoaded(playlistUrl: string, body: string, expiresAt: number | null): void {
    for (const uri of playlistUris(body, playlistUrl)) this.fresh.set(segmentKey(uri), uri);
    if (expiresAt !== null) this.expiry.set(segmentKey(playlistUrl), expiresAt);
  }

  expiresAt(playlistUrl: string): number | null {
    return this.expiry.get(segmentKey(playlistUrl)) ?? null;
  }

  needsRefresh(playlistUrl: string): boolean {
    const at = this.expiresAt(playlistUrl);
    return at !== null && this.now() >= at - this.leadMs;
  }

  /** The newest URL known for a segment (the one hls.js holds may be expired). */
  currentUrl(segmentUrl: string): string {
    return this.fresh.get(segmentKey(segmentUrl)) ?? segmentUrl;
  }

  /** Fetch the same child playlist route again. One request at a time per playlist. */
  refresh(playlistUrl: string): Promise<RefreshResult> {
    if (this.revoked) return Promise.resolve("revoked");
    const key = segmentKey(playlistUrl);
    const running = this.inflight.get(key);
    if (running) return running;
    const run = (async (): Promise<RefreshResult> => {
      this.refreshCount += 1;
      try {
        const res = await this.fetchPlaylist(playlistUrl);
        if (isAccessDenied(res.status)) {
          this.markRevoked();
          return "revoked";
        }
        if (res.status < 200 || res.status >= 300) return "error";
        this.noteLoaded(playlistUrl, res.body, res.expiresAt);
        return "ok";
      } catch {
        return "error";
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, run);
    return run;
  }

  /** The URL to load a segment from now: refreshed first when its window is about to close. */
  async urlFor(segmentUrl: string, playlistUrl: string): Promise<string> {
    if (this.revoked) throw new AccessRevokedError();
    if (playlistUrl && this.needsRefresh(playlistUrl)) {
      const result = await this.refresh(playlistUrl);
      if (result === "revoked") throw new AccessRevokedError();
      // "error": the old URL may still have a few seconds; the 403 path catches the rest.
    }
    return this.currentUrl(segmentUrl);
  }

  private markRevoked(): void {
    if (this.revoked) return;
    this.revoked = true;
    this.onRevoked?.();
  }
}

export class AccessRevokedError extends Error {
  constructor() {
    super("Access to this video was withdrawn");
  }
}

/* ── hls.js loaders ─────────────────────────────────────── */

type AnyLoader = Loader<LoaderContext>;
export type LoaderCtor = new (config: HlsConfig) => AnyLoader;

/** Fill a loader's stats as if `entry` had just been downloaded (keeps the ABR estimate honest). */
function replayStats(stats: LoaderStats, entry: PreloadEntry, now: number): void {
  const bytes = typeof entry.data === "string" ? entry.data.length : entry.data.byteLength;
  const total = Math.max(1, entry.durationMs);
  stats.loading.start = now - total;
  stats.loading.first = now - total + Math.min(total, Math.max(0, entry.ttfbMs));
  stats.loading.end = now;
  stats.loaded = bytes;
  stats.total = bytes;
  stats.aborted = false;
}

function perfNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/**
  The playlist loader: hls.js's own loader, plus the preload cache in front
  (hlsPreload.ts) and X-HLS-Expires-At read from every response.
*/
export function makePlaylistLoader(Base: LoaderCtor, refresher: SignedPlaylistRefresher, cache = hlsPreloadCache): LoaderCtor {
  return class RefreshingPlaylistLoader implements AnyLoader {
    context: LoaderContext | null = null;
    stats: LoaderStats;
    private inner: AnyLoader;
    private stopped = false;

    constructor(config: HlsConfig) {
      this.inner = new Base(config);
      this.stats = this.inner.stats;
    }

    load(context: LoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>): void {
      this.context = context;
      const hit = cache.take(context.url);
      if (hit && typeof hit.data === "string") {
        setTimeout(() => {
          if (this.stopped) return;
          replayStats(this.stats, hit, perfNow());
          refresher.noteLoaded(context.url, hit.data as string, hit.expiresAt);
          callbacks.onSuccess({ url: context.url, data: hit.data }, this.stats, context, null);
        }, 0);
        return;
      }
      this.inner.load(context, config, {
        ...callbacks,
        onSuccess: (response, stats, ctx, details) => {
          const header = this.inner.getResponseHeader?.(HLS_EXPIRES_HEADER) ?? null;
          if (typeof response.data === "string") refresher.noteLoaded(ctx.url, response.data, parseExpiresAt(header));
          callbacks.onSuccess(response, stats, ctx, details);
        },
      });
    }

    abort(): void {
      this.stopped = true;
      this.inner.abort();
    }

    destroy(): void {
      this.stopped = true;
      this.inner.destroy();
    }

    getResponseHeader(name: string): string | null {
      return this.inner.getResponseHeader?.(name) ?? null;
    }
  };
}

/**
  The fragment loader: loads each segment from its newest URL, refreshes the
  playlist before the window closes, and retries a 401/403 segment once
  after a refresh. A revoked viewer gets the 403 passed through.
*/
export function makeFragmentLoader(Base: LoaderCtor, refresher: SignedPlaylistRefresher, cache = hlsPreloadCache): LoaderCtor {
  return class RefreshingFragmentLoader implements AnyLoader {
    context: LoaderContext | null = null;
    stats: LoaderStats;
    private inner: AnyLoader;
    private started = false;
    private stopped = false;

    constructor(private readonly hlsConfig: HlsConfig) {
      this.inner = new Base(hlsConfig);
      this.stats = this.inner.stats;
    }

    load(context: LoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>): void {
      this.context = context;
      this.pendingAbort = callbacks.onAbort;
      const original = context.url;
      const frag = (context as LoaderContext & { frag?: { baseurl?: string } }).frag;
      const playlistUrl = frag?.baseurl ?? "";

      const fail = (code: number, text: string) => {
        if (this.stopped) return;
        callbacks.onError({ code, text }, context, null, this.stats);
      };

      const attempt = (url: string, retry: boolean) => {
        if (this.stopped) return;
        context.url = url;
        const hit = !retry ? cache.take(url) : null;
        if (hit && hit.data instanceof ArrayBuffer) {
          setTimeout(() => {
            if (this.stopped) return;
            replayStats(this.stats, hit, perfNow());
            callbacks.onSuccess({ url, data: hit.data }, this.stats, context, null);
          }, 0);
          return;
        }
        const inner = retry ? this.nextInner() : this.inner;
        this.started = true;
        inner.load(context, config, {
          ...callbacks,
          onError: (error, ctx, details, stats) => {
            if (this.stopped) return;
            if (!retry && playlistUrl && (error.code === 401 || error.code === 403)) {
              void refresher.refresh(playlistUrl).then((result) => {
                if (this.stopped) return;
                const next = refresher.currentUrl(original);
                if (result === "ok" && next !== url) attempt(next, true);
                else callbacks.onError(error, ctx, details, stats);
              });
              return;
            }
            callbacks.onError(error, ctx, details, stats);
          },
        });
      };

      refresher.urlFor(original, playlistUrl).then(
        (url) => attempt(url, false),
        () => fail(403, "Access to this video was withdrawn"),
      );
    }

    /** XhrLoader is single-use: a retry gets a new one that writes into the same stats object hls.js holds. */
    private nextInner(): AnyLoader {
      this.inner.destroy();
      const next = new Base(this.hlsConfig);
      this.stats.loading.start = 0;
      this.stats.loading.first = 0;
      this.stats.loading.end = 0;
      this.stats.aborted = false;
      next.stats = this.stats;
      this.inner = next;
      return next;
    }

    abort(): void {
      if (this.stopped) return;
      this.stopped = true;
      if (this.started) {
        this.inner.abort();
        return;
      }
      if (this.context) {
        this.stats.aborted = true;
        // Not on the wire yet (waiting for a refresh): report the abort ourselves, as XhrLoader would.
        this.pendingAbort?.(this.stats, this.context, null);
      }
    }

    destroy(): void {
      this.stopped = true;
      this.inner.destroy();
    }

    private pendingAbort: LoaderCallbacks<LoaderContext>["onAbort"];
  };
}

/**
  The hls.js config both players use: credentials by host (hlsAuth.ts) and
  the refreshing loaders above, around hls.js's own default loader.
*/
export function signedHlsConfig(HlsCtor: { DefaultConfig: HlsConfig }, refresher: SignedPlaylistRefresher, extra: Partial<HlsConfig> = {}): Partial<HlsConfig> {
  const Base = HlsCtor.DefaultConfig.loader as unknown as LoaderCtor;
  return {
    ...extra,
    xhrSetup: hlsXhrSetup,
    pLoader: makePlaylistLoader(Base, refresher) as unknown as HlsConfig["pLoader"],
    fLoader: makeFragmentLoader(Base, refresher) as unknown as HlsConfig["fLoader"],
  };
}

/* ── what a fatal hls.js error means ───────────────────── */

export type FatalAction = "recover-media" | "unavailable" | "fallback-file";

export interface FatalErrorInfo {
  /** hls.js ErrorTypes value ("mediaError", "networkError", …). */
  type: string;
  /** hls.js ErrorDetails value ("manifestLoadError", "fragLoadError", …). */
  details: string;
  response?: { code?: number } | null;
}

/**
  - media errors: hls.recoverMediaError().
  - the viewer lost access (refresh said so, or any 401/403/410, or a 404
    on a child playlist or segment after the start): "unavailable". Never the
    progressive file: it would be refused too, or worse, keep playing.
  - anything else (the master playlist missing while it transcodes, a
    timeout, a 5xx): the progressive file, at the same position.
*/
export function fatalHlsAction(info: FatalErrorInfo, revoked: boolean): FatalAction {
  if (revoked) return "unavailable";
  if (info.type === "mediaError") return "recover-media";
  const code = info.response?.code ?? 0;
  if (code === 401 || code === 403 || code === 410) return "unavailable";
  if (code === 404 && info.details !== "manifestLoadError") return "unavailable";
  return "fallback-file";
}
