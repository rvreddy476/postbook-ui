import { describe, expect, test } from "bun:test";

import {
  DEFAULT_SEARCH_FILTERS,
  TRENDING_PERIOD_ON_WIRE,
  buildChannelSearchParams,
  buildCollectionSearchParams,
  buildStripFeedParams,
  buildTopicFeedParams,
  buildTrendingParams,
  buildVideoSearchParams,
  channelRowToResult,
  collectionRowToResult,
  normalizeTopics,
  parseSearchFilters,
  searchHref,
  tubeTopics,
  videoRowToResult,
  type SearchFilters,
} from "../discoveryApi";

/* ── Trending ───────────────────────────────────────────── */

describe("buildTrendingParams", () => {
  test("always long_video, limit 24 by default, cursor only when given", () => {
    expect(buildTrendingParams()).toEqual({ content_type: "long_video", limit: "24" });
    expect(buildTrendingParams({ limit: 12, cursor: "c2" })).toEqual({ content_type: "long_video", limit: "12", cursor: "c2" });
  });

  test("the period never reaches the wire while the route has no period parameter", () => {
    expect(TRENDING_PERIOD_ON_WIRE).toBe(false);
    expect(buildTrendingParams({ period: "today" })).not.toHaveProperty("period");
  });
});

/* ── Topics ─────────────────────────────────────────────── */

describe("normalizeTopics", () => {
  test("reads the pinned shape {slug,label,kind}", () => {
    expect(normalizeTopics([{ slug: "science-tech", label: "Science & tech", kind: "long" }, { slug: "dance", label: "Dance", kind: "short" }])).toEqual([
      { slug: "science-tech", label: "Science & tech", kind: "long" },
      { slug: "dance", label: "Dance", kind: "short" },
    ]);
  });

  test("reads the older {id,label} shape with kind all, and the {data:[…]} / {categories:[…]} wrappers", () => {
    const older = [{ id: "comedy", label: "Comedy" }, { id: "music", label: "Music" }];
    expect(normalizeTopics(older)).toEqual([
      { slug: "comedy", label: "Comedy", kind: "all" },
      { slug: "music", label: "Music", kind: "all" },
    ]);
    expect(normalizeTopics({ categories: older })).toHaveLength(2);
    expect(normalizeTopics({ items: older })).toHaveLength(2);
  });

  test("drops empty slugs and duplicates, lowercases slugs, titles a missing label, tolerates junk kinds", () => {
    const out = normalizeTopics([{ slug: " Howto-Style ", kind: "weird" }, { slug: "howto-style", label: "dup" }, { id: "" }, "podcasts", 42, null]);
    expect(out).toEqual([
      { slug: "howto-style", label: "Howto Style", kind: "all" },
      { slug: "podcasts", label: "Podcasts", kind: "all" },
    ]);
    expect(normalizeTopics(undefined)).toEqual([]);
    expect(normalizeTopics("nope")).toEqual([]);
  });
});

test("tubeTopics keeps long and all, never short", () => {
  const topics = normalizeTopics([
    { slug: "a", label: "A", kind: "all" },
    { slug: "b", label: "B", kind: "short" },
    { slug: "c", label: "C", kind: "long" },
  ]);
  expect(tubeTopics(topics).map((t) => t.slug)).toEqual(["a", "c"]);
});

describe("buildTopicFeedParams", () => {
  test("category + sort (recent by default) + limit, cursor when paging; slug lowercased", () => {
    expect(buildTopicFeedParams({ slug: "Documentary" })).toEqual({ category: "documentary", sort: "recent", limit: "20" });
    expect(buildTopicFeedParams({ slug: "podcasts", sort: "popular", limit: 8, cursor: "x" })).toEqual({ category: "podcasts", sort: "popular", limit: "8", cursor: "x" });
  });
});

/* ── Strip ──────────────────────────────────────────────── */

describe("buildStripFeedParams", () => {
  test("All sends nothing but the page; Following is subscribed_only; a feed chip is chip=; a slug is category=", () => {
    expect(buildStripFeedParams("all")).toEqual({ limit: "20" });
    expect(buildStripFeedParams("")).toEqual({ limit: "20" });
    expect(buildStripFeedParams("subscriptions")).toEqual({ limit: "20", subscribed_only: "true" });
    expect(buildStripFeedParams("fresh")).toEqual({ limit: "20", chip: "fresh" });
    expect(buildStripFeedParams("seen")).toEqual({ limit: "20", chip: "seen" });
    expect(buildStripFeedParams("new_to_you")).toEqual({ limit: "20", chip: "new_to_you" });
    expect(buildStripFeedParams("Gaming", { limit: 10, cursor: "c" })).toEqual({ limit: "10", cursor: "c", category: "gaming" });
  });

  test("a feed chip is never sent as a category and following_only is never sent", () => {
    for (const v of ["fresh", "seen", "new_to_you", "subscriptions", "all", "music"]) {
      const p = buildStripFeedParams(v);
      expect(p).not.toHaveProperty("following_only");
      if (v === "fresh" || v === "seen" || v === "new_to_you") expect(p).not.toHaveProperty("category");
    }
  });
});

/* ── Search ─────────────────────────────────────────────── */

const get = (o: Record<string, string>) => (k: string) => (k in o ? o[k] : null);

describe("parseSearchFilters / searchHref", () => {
  test("defaults when nothing is in the URL, and unknown values fall back", () => {
    expect(parseSearchFilters(get({}))).toEqual(DEFAULT_SEARCH_FILTERS);
    expect(parseSearchFilters(get({ q: "  cats ", tab: "nope", len: "huge", when: "never", sort: "random" }))).toEqual({ ...DEFAULT_SEARCH_FILTERS, q: "cats" });
  });

  test("round-trips through the page URL, leaving defaults out", () => {
    const f: SearchFilters = { q: "deep sea", tab: "videos", length: "long", when: "week", sort: "views" };
    const href = searchHref(f);
    expect(href).toBe("/posttube/search?q=deep+sea&len=long&when=week&sort=views");
    const sp = new URL(`https://x${href}`).searchParams;
    expect(parseSearchFilters((k) => sp.get(k))).toEqual(f);
    expect(searchHref({ ...DEFAULT_SEARCH_FILTERS })).toBe("/posttube/search");
    expect(searchHref({ ...DEFAULT_SEARCH_FILTERS, q: "a", tab: "channels" })).toBe("/posttube/search?q=a&tab=channels");
  });
});

describe("buildVideoSearchParams", () => {
  test("type=videos, q, sort always; duration/date only when narrowed", () => {
    expect(buildVideoSearchParams({ ...DEFAULT_SEARCH_FILTERS, q: "cats" })).toEqual({ type: "videos", q: "cats", sort: "relevance", limit: "30" });
    expect(buildVideoSearchParams({ q: "cats", tab: "videos", length: "medium", when: "month", sort: "date" }, 10)).toEqual({
      type: "videos",
      q: "cats",
      sort: "date",
      duration: "medium",
      date: "month",
      limit: "10",
    });
  });

  test("channel and collection searches carry q and limit only", () => {
    expect(buildChannelSearchParams("cats")).toEqual({ q: "cats", limit: "30" });
    expect(buildCollectionSearchParams("cats", 5)).toEqual({ q: "cats", limit: "5" });
  });
});

describe("row mappers", () => {
  test("a video row → watch link, seconds from duration_ms, creator from author, title falls back to the first text line", () => {
    const r = videoRowToResult({
      post_id: "p1",
      author: { id: "u1", username: "bee", display_name: "Bee" },
      text: "First line\nsecond",
      thumbnail_url: "/t.jpg",
      duration_ms: 125_400,
      created_at: "2026-09-01T00:00:00Z",
      like_count: 3,
    })!;
    expect(r).toMatchObject({ kind: "video", id: "p1", href: "/posttube/watch/p1", title: "First line", durationSeconds: 125, creatorName: "Bee", creatorHref: "/u/bee", thumbnailUrl: "/t.jpg" });
    expect(videoRowToResult({ id: "p2", title: "T" })!.creatorName).toBe("Creator");
    expect(videoRowToResult({})).toBeNull();
  });

  test("a channel row → the channel page by handle, avatar from avatar_media_id", () => {
    const c = channelRowToResult({ id: "c1", owner_id: "u1", name: "Bee TV", handle: "bee", avatar_media_id: "m1", follower_count: 12 })!;
    expect(c).toMatchObject({ kind: "channel", id: "c1", href: "/posttube/channel/bee", followerCount: 12 });
    expect(c.avatarUrl).toContain("/v1/media/m1/serve");
    expect(channelRowToResult({ id: "c2", owner_id: "u2", name: "", handle: "" })!.href).toBe("/posttube/channel/u2");
    expect(channelRowToResult({ id: "", owner_id: "", name: "", handle: "" })).toBeNull();
  });

  test("a collection row → the playlist page, cover from cover_media_id, count defaults to 0", () => {
    const c = collectionRowToResult({ id: "l1", owner_id: "u1", title: "Deep dives", item_count: 4, cover_media_id: "m9" })!;
    expect(c).toMatchObject({ kind: "collection", id: "l1", href: "/posttube/playlists/l1", itemCount: 4 });
    expect(c.coverUrl).toContain("/v1/media/m9/serve");
    expect(collectionRowToResult({ id: "l2", owner_id: "u1", title: "" })).toMatchObject({ title: "Untitled collection", itemCount: 0, coverUrl: "" });
  });
});
