import { mediaHref } from "@/features/reels/model";
import { toSoundInfo, type SoundInfo } from "@/features/reels/sounds";

/*
  Trending sounds: the sounds most used in reels this week, ranked by
  media-service every 15 minutes from our own sounds (original + curated
  library). Everything here is pure, so the rules are pinned by tests.

    GET /v1/audio/trending?filter=all|rising&cursor=&limit=
      → data: [{ rank, sound, uses_7d, uses_prev_7d, rising }]
        meta: { next_cursor, updated_at }

  The server lists only the sounds this viewer may hear; a row that is no
  sound, or not ready to play, is dropped here, and a sound listed twice is
  shown once. An older answer — a bare sound list, or `{tracks: [...]}` —
  still reads, ranked by its order, so the shelf never breaks mid-rollout.
*/

export type TrendingFilter = "all" | "rising";

export const TRENDING_FILTERS: readonly { id: TrendingFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "rising", label: "Rising" },
];

/** The picker's shelf and the page's first page. */
export const TRENDING_PAGE_SIZE = 20;
export const TRENDING_MAX_LIMIT = 50;

export const TRENDING_SOUNDS_PATH = "/reels/sounds/trending";

/** The trending page, on a tab: All is the bare path. */
export function trendingSoundsHref(filter: TrendingFilter = "all"): string {
  return filter === "rising" ? `${TRENDING_SOUNDS_PATH}?filter=rising` : TRENDING_SOUNDS_PATH;
}

/** `?filter=` as read off the page's address: anything but "rising" is All. */
export function trendingFilterFromSearch(raw: string | string[] | null | undefined): TrendingFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "").trim().toLowerCase() === "rising" ? "rising" : "all";
}

/** The request for one page. `limit` is 1..50 (20 by default); an empty cursor is not sent. */
export function trendingSoundsRequest(params: { filter?: TrendingFilter; cursor?: string | null; limit?: number } = {}): {
  url: string;
  params: Record<string, string>;
} {
  const raw = Math.floor(params.limit ?? TRENDING_PAGE_SIZE);
  const limit = Number.isFinite(raw) ? Math.min(TRENDING_MAX_LIMIT, Math.max(1, raw)) : TRENDING_PAGE_SIZE;
  const query: Record<string, string> = { filter: params.filter === "rising" ? "rising" : "all", limit: String(limit) };
  const cursor = (params.cursor ?? "").trim();
  if (cursor) query.cursor = cursor;
  return { url: "/v1/audio/trending", params: query };
}

/* ── one row ───────────────────────────────────────────────── */

export interface TrendingSound {
  /** 1 is the top. */
  rank: number;
  sound: SoundInfo;
  /** Distinct (creator, day) uses in the last 7 days; 0 when the answer did not say. */
  uses7d: number;
  usesPrev7d: number;
  rising: boolean;
  /** A cover for the row, when the sound carries one; otherwise the row draws a disc. */
  coverUrl: string | null;
}

function record(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

function count(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

function text(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/** A cover only from what the browser may load: a site path, an https URL, or a media id. */
function coverFrom(sound: Record<string, unknown>): string | null {
  const url = text(sound.cover_url) || text(sound.thumbnail_url);
  if (url.startsWith("https://") || (url.startsWith("/") && !url.startsWith("//"))) return url.startsWith("/v1/") ? mediaHref(url) : url;
  const mediaId = text(sound.cover_media_id);
  return mediaId ? mediaHref(`/v1/media/${encodeURIComponent(mediaId)}/serve`) : null;
}

/**
  One entry. `fallbackRank` is the entry's place in the list, used when the
  entry carries no usable rank (or is an older bare sound row). null when
  there is no playable sound in it.
*/
export function toTrendingSound(raw: unknown, fallbackRank: number): TrendingSound | null {
  const o = record(raw);
  if (!o) return null;
  // The pinned shape nests the sound; an older answer is the sound itself.
  const nested = record(o.sound);
  const soundRow = nested ?? (typeof o.id === "string" ? o : null);
  if (!soundRow) return null;
  const sound = toSoundInfo(soundRow);
  if (!sound) return null;
  const rank = typeof o.rank === "number" && Number.isInteger(o.rank) && o.rank >= 1 ? o.rank : Math.max(1, Math.floor(fallbackRank));
  return {
    rank,
    sound,
    uses7d: nested ? count(o.uses_7d) : 0,
    usesPrev7d: nested ? count(o.uses_prev_7d) : 0,
    rising: nested ? o.rising === true : false,
    coverUrl: coverFrom(soundRow),
  };
}

/* ── a page ────────────────────────────────────────────────── */

export interface TrendingSoundsPage {
  items: TrendingSound[];
  /** The next page's cursor; undefined at the end (absent or empty). */
  nextCursor: string | undefined;
  /** When the list was last computed (RFC 3339), when the answer said. */
  updatedAt: string | null;
}

function rowsOf(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const o = record(data);
  if (!o) return [];
  for (const key of ["items", "tracks", "data"] as const) if (Array.isArray(o[key])) return o[key] as unknown[];
  return [];
}

/**
  The envelope's `data` and `meta` → the page. An older answer has no
  ranks and no cursor (one page), so its rows rank by position. The Rising
  tab keeps rising rows only, in case a server ignores the filter.
*/
export function toTrendingSoundsPage(data: unknown, meta?: unknown, options: { filter?: TrendingFilter } = {}): TrendingSoundsPage {
  const seen = new Set<string>();
  const items: TrendingSound[] = [];
  rowsOf(data).forEach((row, index) => {
    const entry = toTrendingSound(row, index + 1);
    if (!entry || seen.has(entry.sound.id)) return;
    if (options.filter === "rising" && !entry.rising) return;
    seen.add(entry.sound.id);
    items.push(entry);
  });
  const m = record(meta);
  const cursor = text(m?.next_cursor);
  const updated = text(m?.updated_at);
  return { items, nextCursor: cursor || undefined, updatedAt: updated || null };
}

/** Every page's rows in order, each sound once (a sound that moved up between pages stays where it was first seen). */
export function mergeTrendingPages(pages: readonly (TrendingSoundsPage | null | undefined)[] | null | undefined): TrendingSound[] {
  const out: TrendingSound[] = [];
  const seen = new Set<string>();
  for (const page of pages ?? []) {
    for (const entry of page?.items ?? []) {
      if (seen.has(entry.sound.id)) continue;
      seen.add(entry.sound.id);
      out.push(entry);
    }
  }
  return out;
}

/* ── words ─────────────────────────────────────────────────── */

/** "42 reels this week", "1 reel this week"; "" when the answer did not say (0). */
export function trendingUsesLabel(uses7d: number): string {
  const n = Number.isFinite(uses7d) && uses7d > 0 ? Math.floor(uses7d) : 0;
  if (n === 0) return "";
  return `${n.toLocaleString("en-US")} reel${n === 1 ? "" : "s"} this week`;
}

/** The empty state of a tab. */
export function trendingEmptyText(filter: TrendingFilter): { title: string; body: string } {
  return filter === "rising"
    ? { title: "Nothing is rising right now", body: "Sounds that are quickly picking up reels show up here. Check back soon." }
    : { title: "No trending sounds yet", body: "When sounds start getting used in reels this week, the top ones show up here." };
}
