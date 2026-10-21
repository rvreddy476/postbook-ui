import { isAxiosError } from "axios";

import api from "@/lib/api";
import { normalizeTopics, type Topic } from "@/features/posttube/discovery/discoveryApi";
import { toReelItems, type FeedReelPost, type ReelItem } from "@/features/reels/model";

/*
  Explore (TikTok parity T-18): category chips over a grid of short videos.

    GET /v1/posts/categories?kind=short   → the chips ({id, slug, label, kind})
    GET /v1/feed/reels?category=<slug>&cursor=&limit=
                                          → only short videos in that category

  feed-service answers a malformed slug with 400 INVALID_CATEGORY and a
  well-formed slug no reel carries with an empty page. It also walks a
  bounded number of timeline windows per request, so a page can come back
  EMPTY WITH A CURSOR: there may be more further back. The client keeps
  asking while a cursor is present, but never more than EXPLORE_MAX_HOPS
  requests for one user action (one chip tap, one "Show more").
*/

/** The "All" chip: no category on the request. */
export const EXPLORE_ALL = "";
export const EXPLORE_PAGE_SIZE = 18;
/** Requests one user action may spend walking past empty pages. */
export const EXPLORE_MAX_HOPS = 4;
/** The query-string key the page keeps the chip in, so a chip is shareable. */
export const EXPLORE_CATEGORY_PARAM = "category";

/** The same rule feed-service applies (service.NormalizeCategoryFilter). */
const CATEGORY_SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;

export interface ExploreCategory {
  slug: string;
  label: string;
}

/**
 * A raw chip / URL value → the slug the feed validates. Lowercased and
 * trimmed as the server does; `valid` is false for anything the server would
 * refuse with INVALID_CATEGORY, so the page never sends it.
 */
export function normalizeExploreCategory(raw: string | null | undefined): { slug: string; valid: boolean } {
  const slug = (raw ?? "").trim().toLowerCase();
  if (!slug) return { slug: EXPLORE_ALL, valid: true };
  return { slug, valid: CATEGORY_SLUG_RE.test(slug) };
}

/** The query one explore request sends. "All" sends no category at all. */
export function exploreFeedParams(input: { category: string; cursor?: string; limit?: number }): Record<string, string> {
  const params: Record<string, string> = { limit: String(input.limit ?? EXPLORE_PAGE_SIZE) };
  const { slug } = normalizeExploreCategory(input.category);
  if (slug) params.category = slug;
  if (input.cursor) params.cursor = input.cursor;
  return params;
}

/** The server (or the client, first) refused the category as malformed. */
export class InvalidCategoryError extends Error {
  readonly code = "INVALID_CATEGORY";
  constructor(readonly category: string) {
    super(`"${category}" is not a category`);
    this.name = "InvalidCategoryError";
  }
}

export function isInvalidCategoryError(err: unknown): err is InvalidCategoryError {
  return err instanceof InvalidCategoryError;
}

export interface ExplorePage {
  items: ReelItem[];
  /** Undefined when the feed has nothing further back. */
  nextCursor: string | undefined;
  /** Requests this page took (1 unless it walked past empty pages). */
  requests: number;
}

interface Envelope<T> {
  data: T;
  meta?: { next_cursor?: string } | null;
}

/**
 * One user action's worth of explore feed. Walks past empty pages while a
 * cursor is present, up to EXPLORE_MAX_HOPS requests; stops at the first page
 * with reels. An empty result with a cursor means "there may be more" — the
 * page offers to keep looking rather than calling the category empty.
 */
export async function fetchExplorePage(input: {
  category: string;
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
  maxHops?: number;
}): Promise<ExplorePage> {
  const { slug, valid } = normalizeExploreCategory(input.category);
  if (!valid) throw new InvalidCategoryError(slug);
  const maxHops = Math.max(1, input.maxHops ?? EXPLORE_MAX_HOPS);
  let cursor = input.cursor;
  let requests = 0;
  while (true) {
    requests += 1;
    let res;
    try {
      res = await api.get<Envelope<FeedReelPost[] | null>>("/v1/feed/reels", {
        params: exploreFeedParams({ category: slug, cursor, limit: input.limit }),
        signal: input.signal,
      });
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 400) {
        const code = (err.response.data as { error?: { code?: string } } | undefined)?.error?.code;
        if (code === "INVALID_CATEGORY") throw new InvalidCategoryError(slug);
      }
      throw err;
    }
    const items = toReelItems(res.data?.data);
    // Go zero values: an empty cursor is no cursor.
    const next = res.data?.meta?.next_cursor || undefined;
    // A repeated cursor would loop forever on a misbehaving server.
    const stuck = next !== undefined && next === cursor;
    if (items.length > 0 || !next || stuck || requests >= maxHops) {
      return { items, nextCursor: stuck ? undefined : next, requests };
    }
    cursor = next;
  }
}

/** The chips: short-form categories only, in the server's order. */
export function shortCategories(topics: readonly Topic[]): ExploreCategory[] {
  return topics.filter((t) => t.kind === "all" || t.kind === "short").map((t) => ({ slug: t.slug, label: t.label }));
}

export async function fetchShortCategories(signal?: AbortSignal): Promise<ExploreCategory[]> {
  const res = await api.get<Envelope<unknown>>("/v1/posts/categories", { params: { kind: "short" }, signal });
  return shortCategories(normalizeTopics(res.data?.data ?? res.data));
}

/** The reels across loaded pages, each once, in order. */
export function exploreTiles(pages: readonly ExplorePage[] | null | undefined): ReelItem[] {
  const out: ReelItem[] = [];
  const seen = new Set<string>();
  for (const page of pages ?? []) {
    for (const reel of page.items) {
      if (seen.has(reel.id)) continue;
      seen.add(reel.id);
      out.push(reel);
    }
  }
  return out;
}

/** Roving focus over the chips: arrows step and wrap, Home/End jump. null = not a chip key. */
export function nextChipIndex(current: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (current + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
