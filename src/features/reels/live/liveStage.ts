import {
  LIVE_WATCH_BASE,
  isLive,
  liveNowParams,
  upcomingOnly,
  upcomingParams,
  watchState,
  type LiveListFilters,
  type StreamRow,
  type WatchState,
} from "@/features/live/discovery";
import { feedFromSearch } from "@/features/reels/feed";

/*
  The Reels Live tab's own rules (live surfaces contract, 2 Oct 2026, §4).
  Pure: no React, no requests. Reels is the vertical surface, so its Live
  tab lists PORTRAIT streams that are live right now; a stream opened by id
  (/reels/live/<id>) is shown whatever its shape or status, first in the
  stage, and swiping on continues into the portrait list.

  One room at a time: only the active item may hold a LiveKit connection,
  and only while the tab is in the foreground and the server says media can
  flow. Every other item is its cover. Nothing here ever promotes a stream
  to Live: the badge is `status === "live"` and nothing else.
*/

export const LIVE_TAB_ORIENTATION = "portrait" as const;
export const LIVE_TAB_BASE = LIVE_WATCH_BASE.portrait;
/** How many creators the ring lookup and the side list ask for. */
export const LIVE_CREATORS_LIMIT = 50;
/** How many of them the side list draws. */
export const SIDE_CREATORS_MAX = 12;

/* ── tabs and requests ─────────────────────────────────────── */

export type LiveTab = "for-you" | "following";

export const LIVE_TABS: ReadonlyArray<{ key: LiveTab; label: string; href: string }> = [
  { key: "for-you", label: "For you", href: LIVE_TAB_BASE },
  { key: "following", label: "Following", href: `${LIVE_TAB_BASE}?feed=following` },
];

/** `/reels/live` is For you; `/reels/live?feed=following` is Following (the same param the reels feed uses). */
export function liveTabFromSearch(params: URLSearchParams | null | undefined): LiveTab {
  return feedFromSearch(params);
}

/** The list filters of a tab: always portrait; `following` only on the Following tab. */
export function liveTabFilters(tab: LiveTab): LiveListFilters {
  const filters: LiveListFilters = { orientation: LIVE_TAB_ORIENTATION };
  if (tab === "following") filters.following = true;
  return filters;
}

/** GET /v1/livestream/streams for a tab: status=live, orientation=portrait, following=true when asked. */
export function liveTabRequest(tab: LiveTab, cursor?: string): Record<string, string> {
  return liveNowParams({ ...liveTabFilters(tab), cursor });
}

/** GET /v1/livestream/streams/upcoming for a tab's empty state. */
export function upcomingTabRequest(tab: LiveTab, cursor?: string): Record<string, string> {
  return upcomingParams({ ...liveTabFilters(tab), cursor });
}

/* ── lists ─────────────────────────────────────────────────── */

/** Live now in Reels: status "live" and portrait, each stream once. */
export function portraitLive(rows: readonly StreamRow[]): StreamRow[] {
  const seen = new Set<string>();
  const out: StreamRow[] = [];
  for (const row of rows) {
    if (!isLive(row) || row.orientation !== LIVE_TAB_ORIENTATION || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

/** Scheduled portrait streams still ahead, soonest first (the empty state's list). */
export function upcomingPortrait(rows: readonly StreamRow[], now = Date.now()): StreamRow[] {
  return upcomingOnly(rows, now).filter((r) => r.orientation === LIVE_TAB_ORIENTATION);
}

export interface HeldRow {
  row: StreamRow;
  /** Where it stood in the stage when it was last seen. */
  index: number;
}

/**
 * What the stage swipes through. `pinned` (a stream opened by id) is first
 * whatever its shape or status; then the live portrait rows. `held` is the
 * row being watched: when it drops out of the live list (it ended, or a
 * refresh reordered it away) it keeps its place, so the viewer sees
 * "Stream ended" instead of being thrown onto another stream.
 */
export function stageList(pinned: StreamRow | null | undefined, rows: readonly StreamRow[], held?: HeldRow | null): StreamRow[] {
  const live = portraitLive(rows).filter((r) => r.id !== pinned?.id);
  const list = pinned ? [pinned, ...live] : live;
  if (held && !list.some((r) => r.id === held.row.id)) {
    const at = Math.min(Math.max(pinned ? 1 : 0, held.index), list.length);
    list.splice(at, 0, held.row);
  }
  return list;
}

/* ── navigation ────────────────────────────────────────────── */

/** An index inside [0, count − 1]; 0 for an empty list or a junk index. */
export function clampIndex(index: number, count: number): number {
  if (count <= 0 || !Number.isFinite(index)) return 0;
  return Math.min(count - 1, Math.max(0, Math.floor(index)));
}

export function canStep(index: number, delta: 1 | -1, count: number): boolean {
  const next = index + delta;
  return next >= 0 && next <= count - 1;
}

/** One step up or down; the ends do not wrap and do not move. */
export function stepIndex(index: number, delta: 1 | -1, count: number): number {
  return canStep(index, delta, count) ? index + delta : clampIndex(index, count);
}

/** Where the active stream stands; an id that is not in the list reads as the top. */
export function activeIndex(list: readonly Pick<StreamRow, "id">[], activeId: string | null | undefined): number {
  if (!activeId) return 0;
  const at = list.findIndex((r) => r.id === activeId);
  return at < 0 ? 0 : at;
}

/* ── what an item shows ────────────────────────────────────── */

export interface LiveStageState extends WatchState {
  /** A landscape stream opened by id: drawn whole inside the tall frame. */
  letterbox: boolean;
  /** "Watch on PostTube" for a landscape stream; "" for a portrait one. */
  posttubeHref: string;
}

/** What the stage draws for a row, from the server's row alone. */
export function liveStageState(row: Pick<StreamRow, "id" | "status" | "orientation" | "scheduled_at" | "recording_post_id" | "recording_url">, now = Date.now()): LiveStageState {
  const state = watchState(row, now);
  const landscape = row.orientation === "landscape";
  return {
    ...state,
    // The LIVE badge: status === "live" only. Reconnecting keeps the player and says so instead.
    liveBadge: state.liveBadge && row.status === "live",
    letterbox: landscape,
    posttubeHref: landscape ? `${LIVE_WATCH_BASE.landscape}/${encodeURIComponent(row.id)}` : "",
  };
}

export interface ConnectInput {
  /** This item is the one on stage. */
  active: boolean;
  /** The tab is in the foreground (document.visibilityState). */
  pageVisible: boolean;
  /** The server says media can flow (live or reconnecting). */
  player: boolean;
  /** A final refusal to watch (banned, followers only, signed out). */
  refused?: boolean;
}

/**
 * Whether an item holds a room connection. Only the active one, only in a
 * foreground tab, only while the stream is on air and the viewer may watch.
 * The moment any of these turns false the player leaves the room.
 */
export function shouldConnect(input: ConnectInput): boolean {
  return input.active && input.pageVisible && input.player && !input.refused;
}

export type ItemMode = "connected" | "cover";

/** The mode of every item of the stage: at most one is "connected", the rest are their cover. */
export function stageModes(list: readonly Pick<StreamRow, "id" | "status" | "orientation" | "scheduled_at" | "recording_post_id" | "recording_url">[], active: number, pageVisible: boolean, now = Date.now()): ItemMode[] {
  return list.map((row, i) => (shouldConnect({ active: i === active, pageVisible, player: liveStageState(row, now).player }) ? "connected" : "cover"));
}

/** The streams either side of the active one: their covers are fetched ahead, never their rooms. */
export function neighbours<T>(list: readonly T[], active: number): T[] {
  const out: T[] = [];
  if (active - 1 >= 0 && list[active - 1]) out.push(list[active - 1]);
  if (active + 1 <= list.length - 1 && list[active + 1]) out.push(list[active + 1]);
  return out;
}

/* ── empty state ───────────────────────────────────────────── */

export interface LiveEmptyCopy {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}

export function liveEmptyCopy(input: { tab: LiveTab; signedIn: boolean }): LiveEmptyCopy {
  if (input.tab === "following") {
    if (!input.signedIn) {
      return { title: "Sign in to see who is live", body: "Streams from people you follow show up here.", actionHref: `/login?next=${encodeURIComponent(`${LIVE_TAB_BASE}?feed=following`)}`, actionLabel: "Sign in" };
    }
    return { title: "Nobody you follow is live right now", body: "When someone you follow goes live, their stream shows up here.", actionHref: LIVE_TAB_BASE, actionLabel: "Go to For you" };
  }
  return { title: "Nothing live right now", body: "Vertical live streams show up here the moment they start." };
}
