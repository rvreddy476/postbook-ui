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
 * streams are dropped. Today's list route returns live rows only, so
 * upcoming stays empty until it lists scheduled streams as well.
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

/** "Today 18:30" / "Tue 09:00" / "12 Oct" for an upcoming stream, in the viewer's locale. */
export function formatScheduled(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t);
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const sameDay = new Date(now).toDateString() === d.toDateString();
  if (sameDay) return `Today ${time}`;
  if (t - now < 6 * DAY_MS) return `${d.toLocaleDateString(undefined, { weekday: "short" })} ${time}`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
