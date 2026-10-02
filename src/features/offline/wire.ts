/*
  Offline copies: every wire shape and every request, in this one file — a
  late contract change is one edit here (contract pinned 2 Oct 2026).

    POST   /v1/posts/:id/offline          {device_id}            → the grant card (repeated = a renewal: 30 more days)
    POST   /v1/posts/offline/check        {device_id, post_ids}  → valid / invalid rows (≤100 ids a call)
    GET    /v1/posts/offline?device_id=                          → the device's active copies (cards without media.path)
    DELETE /v1/posts/:id/offline          {device_id} (+ query)  → idempotent

  The services are Go: an absent value arrives as "" / 0 / null / a zero
  time as often as it arrives missing, so every reader falls through on
  EMPTY, not only on absent.

  The bytes come from the serve routes (`/v1/media/:id/serve/:variant`),
  never from the attachment route: nothing here builds an attachment URL.
*/

export const DEFAULT_RECHECK_SECONDS = 172_800;
export const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const CHECK_BATCH = 100;
export const DEVICE_ID_MAX = 64;

export type OfflineSurface = "video" | "reel";

export interface OfflineMedia {
  mediaId: string;
  variant: string;
  /** Gateway-relative serve path. */
  path: string;
  mime: string;
  /** null = the server did not say; the response's own length is used and nothing is verified. */
  sizeBytes: number | null;
}

export interface OfflineCaption {
  lang: string;
  label: string;
  path: string;
}

export interface OfflineSound {
  path: string;
  mime: string;
  sizeBytes: number | null;
  /** Where in the sound the reel starts. */
  startMs: number;
  /** The creator's mix, 0..1 each. */
  originalVolume: number;
  overlayVolume: number;
}

/** What the page lists: the grant without anything fetchable. */
export interface OfflineCard {
  postId: string;
  title: string;
  channelName: string;
  durationMs: number | null;
  posterPath: string | null;
  /** Epoch ms. */
  expiresAt: number;
  recheckAfterSeconds: number;
  /** Only when the server says; the saving surface decides otherwise. */
  surface: OfflineSurface | null;
}

export interface OfflineGrant extends OfflineCard {
  media: OfflineMedia;
  captions: OfflineCaption[];
  sound: OfflineSound | null;
}

export type OfflineInvalidReason = "deleted" | "private" | "not_allowed" | "expired" | "blocked" | "revoked" | "unknown";
const REASONS: ReadonlySet<string> = new Set(["deleted", "private", "not_allowed", "expired", "blocked", "revoked", "unknown"]);

export type OfflineCheckRow =
  | { postId: string; valid: true; expiresAt: number | null; /** false = the server will not renew this copy; absent = try. */ renewable?: boolean }
  | { postId: string; valid: false; reason: OfflineInvalidReason };

/* ── readers ────────────────────────────────────────────── */

type Obj = Record<string, unknown>;

function obj(v: unknown): Obj | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null;
}

/** A non-empty string, else null ("" is absent). */
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

/** A positive finite number, else null (0 is absent). */
function pos(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

/**
  A creator volume: the one field where a present 0 is real (that side of
  the mix is muted) and must NOT fall through. Absent or not a number is 1.
*/
function volume(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
}

/** An RFC 3339 time as epoch ms; "" and Go's zero time (year 1) are absent. */
export function wireTime(v: unknown): number | null {
  const s = str(v);
  if (!s) return null;
  const ms = Date.parse(s);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

/** Only our own gateway paths are ever fetched with the session: "/v1/…", no scheme, no "//host". */
export function safeApiPath(v: unknown): string | null {
  const s = str(v);
  if (!s || !s.startsWith("/v1/") || s.includes("//") || s.includes("\\")) return null;
  // The attachment route is the owner's, in Creator Hub. A viewer's copy never comes from it.
  if (/\/download(?:[/?#]|$)/.test(s)) return null;
  return s;
}

function envelope(raw: unknown): unknown {
  const o = obj(raw);
  return o && "data" in o ? o.data : raw;
}

function surfaceOf(o: Obj): OfflineSurface | null {
  const t = (str(o.content_type) ?? str(o.kind) ?? "").toLowerCase();
  if (t === "flick" || t === "reel" || t === "short") return "reel";
  if (t === "long_video" || t === "video") return "video";
  return null;
}

function card(o: Obj, now: number): OfflineCard | null {
  const postId = str(o.post_id) ?? str(o.id);
  if (!postId) return null;
  return {
    postId,
    title: str(o.title) ?? "Untitled video",
    channelName: str(o.channel_name) ?? "",
    durationMs: pos(o.duration_ms),
    posterPath: safeApiPath(o.poster_path),
    expiresAt: wireTime(o.expires_at) ?? now + DEFAULT_TTL_MS,
    recheckAfterSeconds: pos(o.recheck_after_seconds) ?? DEFAULT_RECHECK_SECONDS,
    surface: surfaceOf(o),
  };
}

/** The grant card. null when it names nothing that can be fetched. */
export function parseGrant(raw: unknown, now: number): OfflineGrant | null {
  const o = obj(envelope(raw));
  if (!o) return null;
  const base = card(o, now);
  const m = obj(o.media);
  if (!base || !m) return null;
  const mediaId = str(m.media_id);
  const variant = str(m.variant) ?? "720p";
  const path = safeApiPath(m.path) ?? (mediaId ? `/v1/media/${encodeURIComponent(mediaId)}/serve/${encodeURIComponent(variant)}` : null);
  if (!path) return null;

  const captions: OfflineCaption[] = [];
  for (const c of Array.isArray(o.captions) ? o.captions : []) {
    const row = obj(c);
    const cPath = row ? safeApiPath(row.path) : null;
    if (!row || !cPath) continue;
    const lang = str(row.lang) ?? "en";
    captions.push({ lang, label: str(row.label) ?? lang, path: cPath });
  }

  const s = obj(o.sound);
  const sPath = s ? safeApiPath(s.path) : null;
  return {
    ...base,
    media: { mediaId: mediaId ?? "", variant, path, mime: str(m.mime) ?? "video/mp4", sizeBytes: pos(m.size_bytes) },
    captions,
    sound:
      s && sPath
        ? {
            path: sPath,
            mime: str(s.mime) ?? "audio/mp4",
            sizeBytes: pos(s.size_bytes),
            startMs: Math.floor(pos(s.start_ms) ?? 0),
            originalVolume: volume(s.original_volume),
            overlayVolume: volume(s.overlay_volume),
          }
        : null,
  };
}

/** GET /v1/posts/offline: the device's cards. Rows without a post id are dropped. */
export function parseList(raw: unknown, now: number): OfflineCard[] {
  const rows = envelope(raw);
  const out: OfflineCard[] = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const o = obj(r);
    const c = o ? card(o, now) : null;
    if (c) out.push(c);
  }
  return out;
}

/**
  POST /v1/posts/offline/check. A row is invalid ONLY when it says
  `valid: false`; an invalid row with no reason (or one this build does not
  know) reads "unknown". A row with no `valid` at all is dropped: nothing
  is ever deleted on a guess.
*/
export function parseCheck(raw: unknown): OfflineCheckRow[] {
  const rows = envelope(raw);
  const out: OfflineCheckRow[] = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const o = obj(r);
    const postId = o ? str(o.post_id) : null;
    if (!o || !postId) continue;
    if (o.valid === true) out.push({ postId, valid: true, expiresAt: wireTime(o.expires_at), renewable: o.renewable !== false });
    else if (o.valid === false) {
      const reason = (str(o.reason) ?? "unknown").toLowerCase();
      out.push({ postId, valid: false, reason: (REASONS.has(reason) ? reason : "unknown") as OfflineInvalidReason });
    }
  }
  return out;
}

/* ── requests ───────────────────────────────────────────── */

export interface OfflineRequest {
  method: "GET" | "POST" | "DELETE";
  url: string;
  body?: Record<string, unknown>;
  params?: Record<string, string>;
}

export function grantRequest(postId: string, deviceId: string): OfflineRequest {
  return { method: "POST", url: `/v1/posts/${encodeURIComponent(postId)}/offline`, body: { device_id: deviceId } };
}

/** One request per 100 ids, the server's ceiling. */
export function checkRequests(postIds: readonly string[], deviceId: string): OfflineRequest[] {
  const ids = Array.from(new Set(postIds.filter(Boolean)));
  const out: OfflineRequest[] = [];
  for (let i = 0; i < ids.length; i += CHECK_BATCH) {
    out.push({ method: "POST", url: "/v1/posts/offline/check", body: { device_id: deviceId, post_ids: ids.slice(i, i + CHECK_BATCH) } });
  }
  return out;
}

export function listRequest(deviceId: string): OfflineRequest {
  return { method: "GET", url: "/v1/posts/offline", params: { device_id: deviceId } };
}

/** The device id goes in the body and the query: some hops drop a DELETE body. */
export function removeRequest(postId: string, deviceId: string): OfflineRequest {
  return { method: "DELETE", url: `/v1/posts/${encodeURIComponent(postId)}/offline`, body: { device_id: deviceId }, params: { device_id: deviceId } };
}

/* ── errors ─────────────────────────────────────────────── */

export type OfflineRefusal = "sign_in" | "not_allowed" | "not_ready" | "limit" | "gone" | "unsupported_kind" | "network" | "failed";

function status(err: unknown): number | null {
  const s = (err as { response?: { status?: unknown } })?.response?.status;
  return typeof s === "number" ? s : null;
}

function code(err: unknown): string | null {
  const data = obj((err as { response?: { data?: unknown } })?.response?.data);
  if (!data) return null;
  const e = obj(data.error);
  return str(e?.code) ?? (typeof data.error === "string" && /^[A-Z0-9_]+$/.test(data.error) ? data.error : null) ?? str(data.code);
}

/** Why the server refused a grant. No response at all is "network". */
export function refusalOf(err: unknown): OfflineRefusal {
  const s = status(err);
  const c = code(err);
  if (s === null) return "network";
  if (s === 401) return "sign_in";
  if (c === "OFFLINE_NOT_ALLOWED" || s === 403) return "not_allowed";
  if (c === "OFFLINE_LIMIT") return "limit";
  if (c === "NOT_READY" || s === 409) return "not_ready";
  if (s === 404) return "gone";
  if (s === 422) return "unsupported_kind";
  return "failed";
}

export const REFUSAL_MESSAGES: Record<OfflineRefusal, string> = {
  sign_in: "Sign in to save videos offline.",
  not_allowed: "The creator has turned off offline copies for this video.",
  not_ready: "This video is still being prepared. Try again in a little while.",
  limit: "You have reached 100 offline copies. Remove some to save more.",
  gone: "This video is not available.",
  unsupported_kind: "This kind of post cannot be saved offline.",
  network: "You are offline. Connect to save this video.",
  failed: "Could not save this video offline.",
};

/* ── transport ──────────────────────────────────────────── */

/** The slice of axios this file needs; a fake in tests. */
export interface OfflineHttp {
  request(config: { method: string; url: string; data?: unknown; params?: Record<string, string> }): Promise<{ data: unknown }>;
}

export interface OfflineApi {
  grant(postId: string): Promise<OfflineGrant>;
  check(postIds: readonly string[]): Promise<OfflineCheckRow[]>;
  list(): Promise<OfflineCard[]>;
  remove(postId: string): Promise<void>;
}

export class OfflineGrantError extends Error {
  constructor(public readonly refusal: OfflineRefusal) {
    super(REFUSAL_MESSAGES[refusal]);
    this.name = "OfflineGrantError";
  }
}

export function createOfflineApi(http: OfflineHttp, deviceId: () => string, now: () => number = Date.now): OfflineApi {
  const send = (r: OfflineRequest) => http.request({ method: r.method, url: r.url, data: r.body, params: r.params });
  return {
    async grant(postId) {
      let res: { data: unknown };
      try {
        res = await send(grantRequest(postId, deviceId()));
      } catch (err) {
        throw new OfflineGrantError(refusalOf(err));
      }
      const grant = parseGrant(res.data, now());
      if (!grant) throw new OfflineGrantError("failed");
      return grant;
    },
    async check(postIds) {
      const rows: OfflineCheckRow[] = [];
      for (const r of checkRequests(postIds, deviceId())) rows.push(...parseCheck((await send(r)).data));
      return rows;
    },
    async list() {
      return parseList((await send(listRequest(deviceId()))).data, now());
    },
    async remove(postId) {
      await send(removeRequest(postId, deviceId()));
    },
  };
}
