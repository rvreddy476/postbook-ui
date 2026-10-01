import type { LiveStream } from "@/hooks/useLiveV2";
import type { PostTubeVideo } from "../types";
import type { ChannelResult, CollectionResult, SearchFilters, SearchResult, TrendingPeriod, VideoResult } from "./discoveryApi";

/*
  Pure helpers behind the discovery screens: nothing here touches the
  network or React, so every rule is a plain function the tests pin.
*/

/* ── Trending: client-side period ───────────────────────── */

const DAY_MS = 24 * 60 * 60 * 1000;

export const PERIOD_WINDOW_MS: Record<TrendingPeriod, number> = {
  today: DAY_MS,
  week: 7 * DAY_MS,
  month: 30 * DAY_MS,
};

/** True when `publishedAt` parses and falls inside the period ending at `now`. An unparsable date is out. */
export function withinPeriod(publishedAt: string | null | undefined, period: TrendingPeriod, now = Date.now()): boolean {
  if (!publishedAt) return false;
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return false;
  return now - t <= PERIOD_WINDOW_MS[period] && t <= now + 60_000;
}

/** The trending rows narrowed to the period, order kept (the server's rank). */
export function filterByPeriod(videos: readonly PostTubeVideo[], period: TrendingPeriod, now = Date.now()): PostTubeVideo[] {
  return videos.filter((v) => withinPeriod(v.published_at, period, now));
}

/* ── Search: grouping ───────────────────────────────────── */

export interface SearchGroups {
  videos: VideoResult[];
  channels: ChannelResult[];
  collections: CollectionResult[];
}

/**
 * A mixed list of results → one list per kind, first occurrence wins
 * (deduped on kind + id), order otherwise kept. The page fetches each
 * kind on its own; this is what joins them when a route answers with a
 * mixed page or the same row arrives twice.
 */
export function groupSearchResults(rows: readonly SearchResult[]): SearchGroups {
  const groups: SearchGroups = { videos: [], channels: [], collections: [] };
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.kind}:${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (row.kind === "video") groups.videos.push(row);
    else if (row.kind === "channel") groups.channels.push(row);
    else groups.collections.push(row);
  }
  return groups;
}

/** "12 videos · 3 channels · 1 collection" — only the kinds with a count; empty when nothing. */
export function summarizeGroups(groups: SearchGroups): string {
  const parts: string[] = [];
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (groups.videos.length) parts.push(plural(groups.videos.length, "video", "videos"));
  if (groups.channels.length) parts.push(plural(groups.channels.length, "channel", "channels"));
  if (groups.collections.length) parts.push(plural(groups.collections.length, "collection", "collections"));
  return parts.join(" · ");
}

/** How many of Length / When / Sort are off their default — the badge on the filter bar. */
export function activeFilterCount(filters: SearchFilters): number {
  let n = 0;
  if (filters.length !== "any") n += 1;
  if (filters.when !== "any") n += 1;
  if (filters.sort !== "relevance") n += 1;
  return n;
}

/* ── Live: now vs upcoming ──────────────────────────────── */

export interface LiveSplit {
  live: LiveStream[];
  upcoming: LiveStream[];
}

/**
 * Live now = status "live", newest start first. Upcoming = status
 * "scheduled" with a scheduled_at, soonest first. Ended and failed
 * streams are dropped. The Live page reads Upcoming from its own
 * `?status=scheduled` list (groupUpcomingByDay); this split stays for any
 * list that mixes both.
 */
export function splitLiveStreams(streams: readonly LiveStream[]): LiveSplit {
  const live = streams
    .filter((s) => s.status === "live")
    .slice()
    .sort((a, b) => Date.parse(b.started_at ?? b.created_at) - Date.parse(a.started_at ?? a.created_at));
  const upcoming = streams
    .filter((s) => s.status === "scheduled" && !!s.scheduled_at)
    .slice()
    .sort((a, b) => Date.parse(a.scheduled_at ?? "") - Date.parse(b.scheduled_at ?? ""));
  return { live, upcoming };
}

/* ── Live: upcoming, by day ─────────────────────────────── */

/** Local midnight of the day `t` falls on. */
function startOfLocalDay(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Whole calendar days from `now`'s day to `t`'s day (DST-safe: rounded). */
export function calendarDaysFrom(t: number, now = Date.now()): number {
  return Math.round((startOfLocalDay(t) - startOfLocalDay(now)) / DAY_MS);
}

/** The viewer's clock for a time, "18:30" (or "06:30 pm" where the locale says so). */
export function formatClock(t: number): string {
  return new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/**
 * The day heading: Today (also for a stream that is late — its time has
 * passed and it has not started), Tomorrow, the weekday within the week,
 * then "12 Oct".
 */
export function scheduledDayLabel(t: number, now = Date.now()): string {
  const days = calendarDaysFrom(t, now);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  const d = new Date(t);
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** "Today · 18:30" / "Tomorrow · 09:00" / "Tue · 09:00" / "12 Oct · 18:30"; "" when unparsable. */
export function formatScheduled(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return `${scheduledDayLabel(t, now)} · ${formatClock(t)}`;
}

/** What the day grouping reads: a raw LiveStream and a parsed StreamRow both fit. */
export interface UpcomingLike {
  id: string;
  status: string;
  scheduled_at?: string | null;
}

export interface UpcomingDay<T extends UpcomingLike = LiveStream> {
  /** Local `YYYY-MM-DD`; stable across renders, the React key. */
  key: string;
  label: string;
  streams: T[];
}

function localDayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Upcoming rows (`GET /v1/livestream/streams/upcoming`) → one group per local
 * day, soonest first, each day's streams by time. Only status "scheduled"
 * with a parsable scheduled_at is kept (a stream that has gone live shows
 * under Live now); a late one joins Today; ids are deduped (pages can
 * overlap while the list moves).
 */
export function groupUpcomingByDay<T extends UpcomingLike>(streams: readonly T[], now = Date.now()): UpcomingDay<T>[] {
  const seen = new Set<string>();
  const timed: { s: T; t: number }[] = [];
  for (const s of streams) {
    if (s.status !== "scheduled" || seen.has(s.id)) continue;
    const t = Date.parse(s.scheduled_at ?? "");
    if (Number.isNaN(t)) continue;
    seen.add(s.id);
    timed.push({ s, t });
  }
  timed.sort((a, b) => a.t - b.t);
  const today = startOfLocalDay(now);
  const days: UpcomingDay<T>[] = [];
  for (const { s, t } of timed) {
    const dayT = Math.max(t, today);
    const key = localDayKey(dayT);
    let day = days[days.length - 1];
    if (!day || day.key !== key) {
      day = { key, label: scheduledDayLabel(dayT, now), streams: [] };
      days.push(day);
    }
    day.streams.push(s);
  }
  return days;
}
