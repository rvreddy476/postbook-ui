import api from "@/lib/api";
import { hydrateRows } from "../data/posttubeApi";
import { CHIP_ALL, CHIP_SUBSCRIPTIONS, mediaServeUrl, type HydratedPostRow } from "../model";
import type { FeedPage, PostTubeVideo } from "../types";
import type { LiveStream } from "@/hooks/useLiveV2";

/*
  The ONE adapter for the discovery screens (Trending, Topics, Search,
  Live, the home topic strip). Every request these screens send and every
  response shape they read is written here and nowhere else, so a contract
  change on the wire is one edit in this file.

  Routes, as pinned in the MTube plan (section 3) — what each builder emits:

    GET /v1/posts/trending?content_type=long_video&limit&cursor
        Period (Today / Week / Month) is NOT on the wire: the route has no
        period parameter and the plan keeps it unchanged. The page narrows
        by published_at on the client (discoveryModel.withinPeriod). Flip
        TRENDING_PERIOD_ON_WIRE once the route accepts `period=`.
    GET /v1/posts/categories
        Both shapes: the new [{slug,label,kind}] and the older [{id,label}]
        (kind absent → "all"). Only kind long|all reaches a Tube screen.
    GET /v1/feed/videos?category=<slug>&sort=recent|popular&limit&cursor
    GET /v1/feed/videos?chip=fresh|seen|new_to_you&limit&cursor     (topic strip)
    GET /v1/search/posts?type=videos&q&sort=relevance|views|date&duration=short|medium|long&date=hour|today|week|month|year&limit
    GET /v1/search/channels?q&limit   rows {id, owner_id, name, handle, avatar_media_id, follower_count}
    GET /v1/search/collections?q&limit rows {id, owner_id, title, item_count, cover_media_id}
    Live now: hooks/useLiveV2 (GET /v1/livestream/streams), shared with the live screens.
    GET /v1/livestream/streams?status=scheduled&limit&cursor   Upcoming (rows carry scheduled_at)
    GET /v1/posts/live-recordings?limit&cursor                  Past streams (hydrated post rows)
*/

/* ── Envelope ───────────────────────────────────────────── */

interface Envelope<T> {
  data: T;
  meta?: { next_cursor?: string | null } | null;
}

/** `data` may be the list itself or `{items}`; both are read. */
function listOf<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const o = data as { items?: unknown; results?: unknown };
    if (Array.isArray(o.items)) return o.items as T[];
    if (Array.isArray(o.results)) return o.results as T[];
  }
  return [];
}

function cursorOf(body: Envelope<unknown> | undefined): string | undefined {
  const meta = body?.meta?.next_cursor;
  if (meta) return meta;
  const inData = (body?.data as { next_cursor?: string | null } | undefined)?.next_cursor;
  return inData || undefined;
}

/* ── Trending ───────────────────────────────────────────── */

export type TrendingPeriod = "today" | "week" | "month";
export const TRENDING_PERIODS: readonly { value: TrendingPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];
export const DEFAULT_TRENDING_PERIOD: TrendingPeriod = "week";

/**
 * `GET /v1/posts/trending` does not take a period; the client narrows.
 * Set to true (one edit) when the route grows `period=`.
 */
export const TRENDING_PERIOD_ON_WIRE = false;

export interface TrendingParamsInput {
  limit?: number;
  cursor?: string;
  period?: TrendingPeriod;
}

export function buildTrendingParams(input: TrendingParamsInput = {}): Record<string, string> {
  const params: Record<string, string> = { content_type: "long_video", limit: String(input.limit ?? 24) };
  if (input.cursor) params.cursor = input.cursor;
  if (TRENDING_PERIOD_ON_WIRE && input.period) params.period = input.period;
  return params;
}

export async function getTrendingPage(input: TrendingParamsInput = {}): Promise<FeedPage> {
  const res = await api.get<Envelope<unknown>>("/v1/posts/trending", { params: buildTrendingParams(input) });
  const rows = listOf<HydratedPostRow>(res.data?.data);
  return { items: await hydrateRows(rows), next_cursor: cursorOf(res.data) };
}

/* ── Topics (the taxonomy) ──────────────────────────────── */

export type TopicKind = "all" | "short" | "long";

export interface Topic {
  slug: string;
  label: string;
  kind: TopicKind;
}

function topicKind(raw: unknown): TopicKind {
  const k = String(raw ?? "").trim().toLowerCase();
  if (k === "short" || k === "long") return k;
  return "all";
}

function titleCase(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * `/v1/posts/categories` → topics. New shape `{slug,label,kind}`; older
 * `{id,label}` (and bare strings) still read, with kind "all". Duplicates
 * and entries without a slug are dropped; order is the server's.
 */
export function normalizeTopics(raw: unknown): Topic[] {
  const list = listOf<unknown>(
    raw && typeof raw === "object" && !Array.isArray(raw) && Array.isArray((raw as { categories?: unknown[] }).categories)
      ? (raw as { categories: unknown[] }).categories
      : raw,
  );
  const out: Topic[] = [];
  const seen = new Set<string>();
  for (const entry of list) {
    let slug = "";
    let label = "";
    let kind: TopicKind = "all";
    if (typeof entry === "string") {
      slug = entry;
    } else if (entry && typeof entry === "object") {
      const o = entry as Record<string, unknown>;
      slug = String(o.slug ?? o.id ?? o.key ?? o.value ?? "");
      label = String(o.label ?? o.name ?? o.title ?? "");
      kind = topicKind(o.kind);
    }
    slug = slug.trim().toLowerCase();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, label: label.trim() || titleCase(slug), kind });
  }
  return out;
}

/** Only what belongs on a long-video screen: kind long or all. */
export function tubeTopics(topics: readonly Topic[]): Topic[] {
  return topics.filter((t) => t.kind === "long" || t.kind === "all");
}

export async function getTopics(): Promise<Topic[]> {
  const res = await api.get<Envelope<unknown>>("/v1/posts/categories");
  return normalizeTopics(res.data?.data ?? res.data);
}

/* ── Topic feed ─────────────────────────────────────────── */

export type TopicSort = "recent" | "popular";
export const TOPIC_SORTS: readonly { value: TopicSort; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "popular", label: "Popular" },
];

export interface TopicFeedInput {
  slug: string;
  sort?: TopicSort;
  limit?: number;
  cursor?: string;
}

/** `GET /v1/feed/videos?category=<slug>&sort=` — the slug is sent lowercase, as the feed validates it. */
export function buildTopicFeedParams(input: TopicFeedInput): Record<string, string> {
  const params: Record<string, string> = {
    category: input.slug.trim().toLowerCase(),
    sort: input.sort ?? "recent",
    limit: String(input.limit ?? 20),
  };
  if (input.cursor) params.cursor = input.cursor;
  return params;
}

export async function getTopicFeed(input: TopicFeedInput): Promise<FeedPage> {
  const res = await api.get<Envelope<unknown>>("/v1/feed/videos", { params: buildTopicFeedParams(input) });
  const rows = listOf<HydratedPostRow>(res.data?.data);
  return { items: await hydrateRows(rows), next_cursor: cursorOf(res.data) };
}

/* ── Topic strip (home) ─────────────────────────────────── */

/**
 * The feed's own narrowings (`chip=` on /v1/feed/videos): Fresh = uploaded
 * in the last 7 days, Seen = in the viewer's history, New to you = authors
 * the viewer has never watched. The plan's wording is
 * recently_uploaded | watched | new_to_you; this lane was briefed
 * fresh | seen | new_to_you — the spelling lives only here.
 */
export const FEED_CHIPS = ["fresh", "seen", "new_to_you"] as const;
export type FeedChip = (typeof FEED_CHIPS)[number];

export function isFeedChip(value: string): value is FeedChip {
  return (FEED_CHIPS as readonly string[]).includes(value);
}

export const STRIP_CHIPS: readonly { value: FeedChip; label: string }[] = [
  { value: "fresh", label: "Fresh" },
  { value: "seen", label: "Seen" },
  { value: "new_to_you", label: "New to you" },
];

/**
 * The strip's value is one of: CHIP_ALL, CHIP_SUBSCRIPTIONS ("Following"),
 * a feed chip or a topic slug. Each maps to exactly one narrowing of
 * `GET /v1/feed/videos`; none combine and `following_only` is never sent.
 */
export function buildStripFeedParams(value: string, opts: { limit?: number; cursor?: string } = {}): Record<string, string> {
  const params: Record<string, string> = { limit: String(opts.limit ?? 20) };
  if (opts.cursor) params.cursor = opts.cursor;
  const v = value.trim();
  if (!v || v === CHIP_ALL) return params;
  if (v === CHIP_SUBSCRIPTIONS) params.subscribed_only = "true";
  else if (isFeedChip(v)) params.chip = v;
  else params.category = v.toLowerCase();
  return params;
}

/** The home grid behind the strip: `GET /v1/feed/videos` narrowed by the strip's value. */
export async function getStripFeed(value: string, opts: { limit?: number; cursor?: string } = {}): Promise<FeedPage> {
  const res = await api.get<Envelope<unknown>>("/v1/feed/videos", { params: buildStripFeedParams(value, opts) });
  const rows = listOf<HydratedPostRow>(res.data?.data);
  return { items: await hydrateRows(rows), next_cursor: cursorOf(res.data) };
}

/* ── Search ─────────────────────────────────────────────── */

export type SearchTab = "videos" | "channels" | "collections";
export type SearchLength = "any" | "short" | "medium" | "long";
export type SearchWhen = "any" | "hour" | "today" | "week" | "month" | "year";
export type SearchSort = "relevance" | "views" | "date";

export interface SearchFilters {
  q: string;
  tab: SearchTab;
  length: SearchLength;
  when: SearchWhen;
  sort: SearchSort;
}

export const DEFAULT_SEARCH_FILTERS: SearchFilters = { q: "", tab: "videos", length: "any", when: "any", sort: "relevance" };

export const SEARCH_TABS: readonly { value: SearchTab; label: string }[] = [
  { value: "videos", label: "Videos" },
  { value: "channels", label: "Channels" },
  { value: "collections", label: "Collections" },
];
export const SEARCH_LENGTHS: readonly { value: SearchLength; label: string }[] = [
  { value: "any", label: "Any length" },
  { value: "short", label: "Under 4 min" },
  { value: "medium", label: "4–20 min" },
  { value: "long", label: "Over 20 min" },
];
export const SEARCH_WHENS: readonly { value: SearchWhen; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "hour", label: "Last hour" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
];
export const SEARCH_SORTS: readonly { value: SearchSort; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "views", label: "Views" },
  { value: "date", label: "Date" },
];

function oneOf<T extends string>(raw: string | null | undefined, allowed: readonly { value: T }[], fallback: T): T {
  const v = (raw ?? "").trim().toLowerCase();
  return (allowed.some((a) => a.value === v) ? v : fallback) as T;
}

/** The page's URL (`?q=&tab=&len=&when=&sort=`) → filters; unknown values fall back. */
export function parseSearchFilters(get: (key: string) => string | null): SearchFilters {
  return {
    q: (get("q") ?? "").trim(),
    tab: oneOf(get("tab"), SEARCH_TABS, DEFAULT_SEARCH_FILTERS.tab),
    length: oneOf(get("len"), SEARCH_LENGTHS, DEFAULT_SEARCH_FILTERS.length),
    when: oneOf(get("when"), SEARCH_WHENS, DEFAULT_SEARCH_FILTERS.when),
    sort: oneOf(get("sort"), SEARCH_SORTS, DEFAULT_SEARCH_FILTERS.sort),
  };
}

/** Filters → the page's own URL. Defaults are left out so the URL stays short. */
export function searchHref(filters: SearchFilters): string {
  const p = new URLSearchParams();
  if (filters.q) p.set("q", filters.q);
  if (filters.tab !== DEFAULT_SEARCH_FILTERS.tab) p.set("tab", filters.tab);
  if (filters.length !== "any") p.set("len", filters.length);
  if (filters.when !== "any") p.set("when", filters.when);
  if (filters.sort !== DEFAULT_SEARCH_FILTERS.sort) p.set("sort", filters.sort);
  const qs = p.toString();
  return qs ? `/posttube/search?${qs}` : "/posttube/search";
}

/** `GET /v1/search/posts` query. "any" filters are omitted; relevance is the default and still sent. */
export function buildVideoSearchParams(filters: SearchFilters, limit = 30): Record<string, string> {
  const params: Record<string, string> = { type: "videos", q: filters.q, sort: filters.sort, limit: String(limit) };
  if (filters.length !== "any") params.duration = filters.length;
  if (filters.when !== "any") params.date = filters.when;
  return params;
}

export function buildChannelSearchParams(q: string, limit = 30): Record<string, string> {
  return { q, limit: String(limit) };
}

export function buildCollectionSearchParams(q: string, limit = 30): Record<string, string> {
  return { q, limit: String(limit) };
}

/** One `/v1/search/posts?type=videos` row, as search-service's PostResult writes it. */
export interface VideoSearchRow {
  id?: string;
  post_id?: string;
  author_id?: string;
  author_username?: string;
  author?: { id?: string; username?: string; display_name?: string; avatar_url?: string | null } | null;
  title?: string;
  text?: string;
  thumbnail_url?: string | null;
  playback_url?: string | null;
  duration_ms?: number;
  content_type?: string;
  created_at?: string;
  like_count?: number;
  comment_count?: number;
  view_count?: number;
}

export interface ChannelSearchRow {
  id: string;
  owner_id: string;
  name: string;
  handle: string;
  avatar_media_id?: string | null;
  follower_count?: number;
}

export interface CollectionSearchRow {
  id: string;
  owner_id: string;
  title: string;
  item_count?: number;
  cover_media_id?: string | null;
}

/** What the screens render: one flat type per result kind. */
export interface VideoResult {
  kind: "video";
  id: string;
  title: string;
  href: string;
  thumbnailUrl: string;
  durationSeconds: number;
  creatorName: string;
  creatorHref: string;
  publishedAt: string;
  viewCount: number;
}

export interface ChannelResult {
  kind: "channel";
  id: string;
  name: string;
  handle: string;
  href: string;
  avatarUrl: string;
  followerCount: number;
}

export interface CollectionResult {
  kind: "collection";
  id: string;
  title: string;
  href: string;
  coverUrl: string;
  itemCount: number;
}

export type SearchResult = VideoResult | ChannelResult | CollectionResult;

export function videoRowToResult(row: VideoSearchRow): VideoResult | null {
  const id = String(row.id ?? row.post_id ?? "").trim();
  if (!id) return null;
  const username = row.author?.username || row.author_username || "";
  const creatorName = row.author?.display_name || username || "Creator";
  const firstLine = (row.text ?? "").split("\n")[0]?.trim() ?? "";
  return {
    kind: "video",
    id,
    title: (row.title ?? "").trim() || firstLine || "Untitled video",
    href: `/posttube/watch/${id}`,
    thumbnailUrl: row.thumbnail_url ?? "",
    durationSeconds: Math.max(0, Math.round((row.duration_ms ?? 0) / 1000)),
    creatorName,
    creatorHref: username ? `/u/${username}` : row.author?.id || row.author_id ? `/u/${row.author?.id || row.author_id}` : "",
    publishedAt: row.created_at ?? "",
    viewCount: row.view_count ?? 0,
  };
}

export function channelRowToResult(row: ChannelSearchRow): ChannelResult | null {
  const id = String(row.id ?? "").trim();
  if (!id) return null;
  const handle = (row.handle ?? "").trim();
  return {
    kind: "channel",
    id,
    name: (row.name ?? "").trim() || (handle ? `@${handle}` : "Channel"),
    handle,
    href: handle ? `/posttube/channel/${encodeURIComponent(handle)}` : `/posttube/channel/${encodeURIComponent(row.owner_id ?? id)}`,
    avatarUrl: row.avatar_media_id ? mediaServeUrl(row.avatar_media_id) : "",
    followerCount: row.follower_count ?? 0,
  };
}

export function collectionRowToResult(row: CollectionSearchRow): CollectionResult | null {
  const id = String(row.id ?? "").trim();
  if (!id) return null;
  return {
    kind: "collection",
    id,
    title: (row.title ?? "").trim() || "Untitled collection",
    href: `/posttube/playlists/${encodeURIComponent(id)}`,
    coverUrl: row.cover_media_id ? mediaServeUrl(row.cover_media_id) : "",
    itemCount: row.item_count ?? 0,
  };
}

function compact<T>(list: (T | null)[]): T[] {
  return list.filter((x): x is T => x !== null);
}

export async function searchVideos(filters: SearchFilters, limit = 30): Promise<VideoResult[]> {
  const res = await api.get<Envelope<unknown>>("/v1/search/posts", { params: buildVideoSearchParams(filters, limit) });
  return compact(listOf<VideoSearchRow>(res.data?.data).map(videoRowToResult));
}

export async function searchChannels(q: string, limit = 30): Promise<ChannelResult[]> {
  const res = await api.get<Envelope<unknown>>("/v1/search/channels", { params: buildChannelSearchParams(q, limit) });
  return compact(listOf<ChannelSearchRow>(res.data?.data).map(channelRowToResult));
}

export async function searchCollections(q: string, limit = 30): Promise<CollectionResult[]> {
  const res = await api.get<Envelope<unknown>>("/v1/search/collections", { params: buildCollectionSearchParams(q, limit) });
  return compact(listOf<CollectionSearchRow>(res.data?.data).map(collectionRowToResult));
}

/* ── Live: upcoming and past streams ────────────────────── */

export type LiveListStatus = "live" | "scheduled" | "all";

export interface LiveListInput {
  status: LiveListStatus;
  limit?: number;
  cursor?: string;
}

/** `GET /v1/livestream/streams?status=&limit&cursor` — status is always sent. */
export function buildLiveListParams(input: LiveListInput): Record<string, string> {
  const params: Record<string, string> = { status: input.status, limit: String(input.limit ?? 24) };
  if (input.cursor) params.cursor = input.cursor;
  return params;
}

export interface LiveListPage {
  items: LiveStream[];
  next_cursor?: string;
}

/**
 * The live-service list with a status. Upcoming uses `status=scheduled`
 * (rows carry `scheduled_at`); Live now stays on hooks/useLiveV2's
 * useLiveStreams, which the live screens share.
 */
export async function getLiveStreamsPage(input: LiveListInput): Promise<LiveListPage> {
  const res = await api.get<Envelope<unknown>>("/v1/livestream/streams", { params: buildLiveListParams(input) });
  return { items: listOf<LiveStream>(res.data?.data), next_cursor: cursorOf(res.data) };
}

export interface PastStreamsInput {
  limit?: number;
  cursor?: string;
}

export function buildPastStreamsParams(input: PastStreamsInput = {}): Record<string, string> {
  const params: Record<string, string> = { limit: String(input.limit ?? 12) };
  if (input.cursor) params.cursor = input.cursor;
  return params;
}

/**
 * `GET /v1/posts/live-recordings?limit&cursor` — recordings that became
 * videos (post-service consumes live.stream.vod_ready), hydrated rows of
 * the `/v1/posts/by-author` shape, newest first, `meta.next_cursor`.
 * Mapped to tube tiles through hydrateRows like every other video list.
 */
export async function getPastStreams(input: PastStreamsInput = {}): Promise<FeedPage> {
  const res = await api.get<Envelope<unknown>>("/v1/posts/live-recordings", { params: buildPastStreamsParams(input) });
  const rows = listOf<HydratedPostRow>(res.data?.data);
  return { items: await hydrateRows(rows), next_cursor: cursorOf(res.data) };
}

export type { PostTubeVideo, FeedPage };
