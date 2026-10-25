/*
  The search page, the pure parts: which tabs exist, what each tab asks the
  server, where recents live, and how the answers are read. Kept free of
  React so the request shapes are pinned by tests.

    Top       GET /v1/search?q=&types=users,posts,hashtags   recorded by default
    People    GET /v1/search/users?q=&record=1               recorded only with record=1
    Videos    GET /v1/search/posts?q=&type=videos            recorded by default
    Reels     GET /v1/search/posts?q=&type=flicks            recorded by default
    Sounds    GET /v1/audio/search?q=&limit=&offset=         media-service, never recorded
    Hashtags  GET /v1/search/hashtags?q=&record=1            recorded only with record=1

    Recents   GET    /v1/search/history
              DELETE /v1/search/history/:id   one entry
              DELETE /v1/search/history       all of them
    Popular   GET /v1/search/popular?limit=   signed-out allowed

  record=1 is sent ONLY from here. The users and hashtags routes also serve
  @mention, invite and composer pickers, whose keystrokes are not searches.
  There is no LIVE tab: no live listing route takes a query.
*/

import { videoRowToResult, type VideoResult, type VideoSearchRow } from "@/features/posttube/discovery/discoveryApi";
import { toReelSound, type ReelSound } from "@/features/reels/model";

/* ── tabs ──────────────────────────────────────────────────── */

export type SearchTabId = "top" | "people" | "videos" | "reels" | "sounds" | "hashtags";

export interface SearchTabDef {
  id: SearchTabId;
  label: string;
}

export const SEARCH_TABS: readonly SearchTabDef[] = [
  { id: "top", label: "Top" },
  { id: "people", label: "People" },
  { id: "videos", label: "Videos" },
  { id: "reels", label: "Reels" },
  { id: "sounds", label: "Sounds" },
  { id: "hashtags", label: "Hashtags" },
];

/** Old links used ?type=all|profiles|posts|hashtags|…; anything unknown is Top. */
const LEGACY_TABS: Record<string, SearchTabId> = {
  all: "top",
  posts: "top",
  profiles: "people",
  users: "people",
  flicks: "reels",
};

export function parseSearchTab(raw: string | null | undefined): SearchTabId {
  const v = (raw ?? "").trim().toLowerCase();
  if (SEARCH_TABS.some((t) => t.id === v)) return v as SearchTabId;
  return LEGACY_TABS[v] ?? "top";
}

/**
  Arrow-key movement across the tab list (WAI-ARIA tabs pattern): Left and
  Right wrap, Home and End jump. null for any other key.
*/
export function nextTabIndex(current: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
      return (current + 1) % count;
    case "ArrowLeft":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/** The page's own URL for a query and tab. Top is the default and is left out. */
export function searchPageHref(query: string, tab: SearchTabId): string {
  const p = new URLSearchParams();
  const q = query.trim();
  if (q) p.set("q", q);
  if (tab !== "top") p.set("tab", tab);
  const qs = p.toString();
  return qs ? `/search?${qs}` : "/search";
}

/* ── requests ──────────────────────────────────────────────── */

export interface SearchRequest {
  path: string;
  params: Record<string, string | number>;
}

export const TOP_TYPES = "users,posts,hashtags";
export const TOP_LIMIT = 10;
export const PEOPLE_LIMIT = 20;
export const VIDEOS_LIMIT = 30;
export const REELS_LIMIT = 60;
export const SOUNDS_LIMIT = 30;
export const HASHTAGS_LIMIT = 30;

/** What one tab asks the server for a committed query. */
export function buildTabRequest(tab: SearchTabId, query: string): SearchRequest {
  const q = query.trim();
  switch (tab) {
    case "top":
      return { path: "/v1/search", params: { q, types: TOP_TYPES, limit: TOP_LIMIT } };
    case "people":
      return { path: "/v1/search/users", params: { q, limit: PEOPLE_LIMIT, record: 1 } };
    case "videos":
      return { path: "/v1/search/posts", params: { q, type: "videos", limit: VIDEOS_LIMIT } };
    case "reels":
      return { path: "/v1/search/posts", params: { q, type: "flicks", limit: REELS_LIMIT } };
    case "sounds":
      return { path: "/v1/audio/search", params: { q, limit: SOUNDS_LIMIT, offset: 0 } };
    case "hashtags":
      return { path: "/v1/search/hashtags", params: { q, limit: HASHTAGS_LIMIT, record: 1 } };
  }
}

export const HISTORY_PATH = "/v1/search/history";
export const POPULAR_PATH = "/v1/search/popular";
export const POPULAR_LIMIT = 10;
export const RECENTS_SHOWN = 10;

/** One entry. The bare HISTORY_PATH is "clear all" — never use it for one item. */
export function historyItemPath(id: string): string {
  return `${HISTORY_PATH}/${encodeURIComponent(id)}`;
}

/* ── reading the answers ───────────────────────────────────── */

/** `{data: X}` → X; a bare X is tolerated. */
export function unwrap(body: unknown): unknown {
  if (body && typeof body === "object" && !Array.isArray(body) && "data" in body) {
    return (body as { data: unknown }).data;
  }
  return body;
}

function listIn(data: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const k of keys) if (Array.isArray(o[k])) return o[k] as unknown[];
  }
  return [];
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

export interface RecentSearch {
  id: string;
  query: string;
}

/** History rows, newest first as sent; rows without an id cannot be removed and are dropped. */
export function parseHistory(data: unknown): RecentSearch[] {
  const out: RecentSearch[] = [];
  const seen = new Set<string>();
  for (const row of listIn(data, "items")) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = text(o.id);
    const query = text(o.query);
    if (!id || !query || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, query });
  }
  return out;
}

/** Popular rows are {query}; plain strings are tolerated. */
export function parsePopular(data: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of listIn(data, "items")) {
    const q = typeof row === "string" ? row.trim() : row && typeof row === "object" ? text((row as { query?: unknown }).query) : "";
    const key = q.toLowerCase();
    if (!q || seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

export interface PersonResult {
  id: string;
  /** Link-safe: the handle, or the id when there is none. */
  linkName: string;
  /** The real handle, "" when the account has none. Display only. */
  handle: string;
  name: string;
  bio: string;
  avatarUrl: string;
  isVerified: boolean;
  followerCount: number;
}

/**
  One user row (search-service UserResult or a ranked users-bucket item).
  `||`, not `??`: Go sends an absent string as "".
*/
export function toPersonResult(raw: unknown): PersonResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = text(o.user_id) || text(o.id);
  if (!id) return null;
  const handle = text(o.username);
  const media = text(o.avatar_media_id);
  return {
    id,
    linkName: handle || id,
    handle,
    name: text(o.display_name) || handle || "User",
    bio: text(o.bio),
    avatarUrl: text(o.avatar_url) || (media ? `/v1/media/${encodeURIComponent(media)}/serve` : ""),
    isVerified: o.is_verified === true,
    followerCount: count(o.follower_count),
  };
}

export function parsePeople(data: unknown): PersonResult[] {
  return compact(listIn(data, "items", "users").map(toPersonResult));
}

export interface HashtagResult {
  tag: string;
  /** 0 when the route did not say (the hashtags route sends names only). */
  useCount: number;
}

export function hashtagHref(tag: string): string {
  return `/hashtag/${encodeURIComponent(tag)}`;
}

/** `{hashtags: string[]}` from /v1/search/hashtags, or ranked `{hashtag, use_count}` items. */
export function parseHashtags(data: unknown): HashtagResult[] {
  const out: HashtagResult[] = [];
  const seen = new Set<string>();
  for (const row of listIn(data, "hashtags", "items")) {
    const tag = (typeof row === "string" ? row.trim() : row && typeof row === "object" ? text((row as { hashtag?: unknown }).hashtag) : "").replace(/^#+/, "");
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push({ tag, useCount: row && typeof row === "object" ? count((row as { use_count?: unknown }).use_count) : 0 });
  }
  return out;
}

/** media-service `{tracks: [...]}`. */
export function parseSounds(data: unknown): ReelSound[] {
  return compact(listIn(data, "tracks", "items").map((row) => toReelSound(row)));
}

export function parseVideos(data: unknown): VideoResult[] {
  return compact(listIn(data, "items").map((row) => videoRowToResult(row as VideoSearchRow)));
}

export type TopPostKind = "video" | "reel" | "post";

export interface TopPostResult {
  id: string;
  kind: TopPostKind;
  href: string;
  title: string;
  thumbnailUrl: string;
  authorName: string;
  likeCount: number;
}

export function postKind(contentType: string): TopPostKind {
  const t = contentType.toLowerCase();
  if (t === "long_video" || t === "video") return "video";
  if (t === "flick" || t === "reel" || t === "short") return "reel";
  return "post";
}

/** Where a post result opens: the watch page, the reel stage, or the permalink. */
export function postHref(id: string, kind: TopPostKind): string {
  const e = encodeURIComponent(id);
  if (kind === "video") return `/posttube/watch/${e}`;
  if (kind === "reel") return `/reels?reelId=${e}`;
  return `/post/${e}`;
}

export function toTopPost(raw: unknown): TopPostResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = text(o.id) || text(o.post_id);
  if (!id) return null;
  const kind = postKind(text(o.content_type) || text(o.post_type));
  const author = o.author && typeof o.author === "object" ? (o.author as Record<string, unknown>) : {};
  const username = text(author.username) || text(o.author_username);
  const firstLine = (text(o.text).split("\n")[0] ?? "").trim();
  return {
    id,
    kind,
    href: postHref(id, kind),
    title: text(o.title) || firstLine || (kind === "video" ? "Untitled video" : kind === "reel" ? "Reel" : "Post"),
    thumbnailUrl: text(o.thumbnail_url),
    authorName: text(author.display_name) || username,
    likeCount: count(o.like_count),
  };
}

export interface TopResults {
  queryId: string;
  people: PersonResult[];
  posts: TopPostResult[];
  hashtags: HashtagResult[];
}

/** The ranked multi-entity answer, `{query_id, results: {users, posts, hashtags}}`. */
export function parseTop(data: unknown): TopResults {
  const o = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const results = o.results && typeof o.results === "object" ? (o.results as Record<string, unknown>) : {};
  const bucket = (k: string) => listIn(results[k], "items");
  return {
    queryId: text(o.query_id),
    people: compact(bucket("users").map(toPersonResult)),
    posts: compact(bucket("posts").map(toTopPost)),
    hashtags: parseHashtags({ items: bucket("hashtags") }),
  };
}

export function isTopEmpty(top: TopResults): boolean {
  return top.people.length === 0 && top.posts.length === 0 && top.hashtags.length === 0;
}

function compact<T>(list: (T | null)[]): T[] {
  return list.filter((x): x is T => x !== null);
}

/* ── words ─────────────────────────────────────────────────── */

const TAB_NOUN: Record<SearchTabId, string> = {
  top: "results",
  people: "people",
  videos: "videos",
  reels: "reels",
  sounds: "sounds",
  hashtags: "hashtags",
};

export function emptyResultTitle(tab: SearchTabId, query: string): string {
  return `No ${TAB_NOUN[tab]} for “${query.trim()}”`;
}

export function signInHref(returnTo: string): string {
  const to = encodeURIComponent(returnTo);
  return `/login?next=${to}&redirect=${to}`;
}
