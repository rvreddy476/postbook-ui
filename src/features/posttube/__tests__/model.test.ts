import { describe, expect, test } from "bun:test";

import {
  AUTOPLAY_IDLE,
  autoplayReducer,
  buildVideoFeedQuery,
  mapRelatedRows,
  mapTrendingRows,
  nextEpisode,
  normalizeCategories,
  normalizeProgressRow,
  normalizeProgressRows,
  normalizeSeries,
  parseTubePrefs,
  prevEpisode,
  progressToVideo,
  readAutoplayNextPref,
  resumePositionMs,
  rowToVideo,
  type HydratedPostRow,
  type SeriesEpisode,
} from "@/features/posttube/model";

/* ── Watch progress ─────────────────────────────────────── */

describe("normalizeProgressRow", () => {
  test("reads the ms wire and derives the percent", () => {
    const row = normalizeProgressRow({ post_id: "p1", position_ms: 30_000, duration_ms: 120_000, last_watched_at: "2026-09-26T10:00:00Z" });
    expect(row.postId).toBe("p1");
    expect(row.positionMs).toBe(30_000);
    expect(row.durationMs).toBe(120_000);
    expect(row.percent).toBe(25);
    expect(row.completed).toBe(false);
    expect(row.lastWatchedAt).toBe("2026-09-26T10:00:00Z");
  });

  test("history percent is never 0 for a row with a position (the watched_sec bug)", () => {
    const row = normalizeProgressRow({ post_id: "p", position_ms: 61_000, duration_ms: 100_000 });
    expect(row.percent).toBeGreaterThan(0);
    expect(Math.round(row.percent)).toBe(61);
  });

  test("completed at 90% or more, even when the server did not flag it", () => {
    expect(normalizeProgressRow({ post_id: "a", position_ms: 89_999, duration_ms: 100_000 }).completed).toBe(false);
    expect(normalizeProgressRow({ post_id: "b", position_ms: 90_000, duration_ms: 100_000 }).completed).toBe(true);
    expect(normalizeProgressRow({ post_id: "c", position_ms: 10, duration_ms: 100_000, completed: true }).completed).toBe(true);
  });

  test("prefers the server percent when present, clamps, and survives missing fields", () => {
    expect(normalizeProgressRow({ post_id: "a", position_ms: 1, duration_ms: 100, percent_watched: 140 }).percent).toBe(100);
    const empty = normalizeProgressRow({ post_id: "z" });
    expect(empty.positionMs).toBe(0);
    expect(empty.durationMs).toBe(0);
    expect(empty.percent).toBe(0);
    expect(empty.completed).toBe(false);
  });

  test("normalizeProgressRows drops rows with no post_id", () => {
    const rows = normalizeProgressRows([{ post_id: "ok", position_ms: 5, duration_ms: 10 }, { position_ms: 1 } as never, null as never]);
    expect(rows.map((r) => r.postId)).toEqual(["ok"]);
  });
});

describe("resumePositionMs", () => {
  test("resumes below 95% and starts over at or above it", () => {
    expect(resumePositionMs(normalizeProgressRow({ post_id: "a", position_ms: 40_000, duration_ms: 100_000 }))).toBe(40_000);
    expect(resumePositionMs(normalizeProgressRow({ post_id: "b", position_ms: 95_000, duration_ms: 100_000 }))).toBe(0);
    expect(resumePositionMs(normalizeProgressRow({ post_id: "c", position_ms: 50_000, duration_ms: 100_000, completed: true }))).toBe(0);
    expect(resumePositionMs(null)).toBe(0);
  });
});

/* ── Series ─────────────────────────────────────────────── */

const gapEpisodes: SeriesEpisode[] = [
  { post_id: "e1", episode_num: 1 },
  { post_id: "e2", episode_num: 2 },
  { post_id: "e4", episode_num: 4 },
];

describe("nextEpisode / prevEpisode", () => {
  test("steps over a gap: after 2 comes 4, after 4 nothing", () => {
    expect(nextEpisode(gapEpisodes, 2)?.post_id).toBe("e4");
    expect(nextEpisode(gapEpisodes, 3)?.post_id).toBe("e4");
    expect(nextEpisode(gapEpisodes, 4)).toBeNull();
    expect(nextEpisode(gapEpisodes, 1)?.post_id).toBe("e2");
  });

  test("prev walks back over the gap", () => {
    expect(prevEpisode(gapEpisodes, 4)?.post_id).toBe("e2");
    expect(prevEpisode(gapEpisodes, 1)).toBeNull();
  });

  test("normalizeSeries fills next/prev from the list and sorts episodes", () => {
    const s = normalizeSeries({ series: { id: "s" }, episodes: [gapEpisodes[2], gapEpisodes[0], gapEpisodes[1]], current: { episode_num: 2 } });
    expect(s?.episodes.map((e) => e.episode_num)).toEqual([1, 2, 4]);
    expect(s?.next).toEqual({ post_id: "e4", episode_num: 4 });
    expect(s?.prev).toEqual({ post_id: "e1", episode_num: 1 });
    expect(normalizeSeries(null)).toBeNull();
    expect(normalizeSeries({ episodes: [] })).toBeNull();
  });

  test("normalizeSeries keeps a server-provided next even when the list disagrees", () => {
    const s = normalizeSeries({ series: { id: "s" }, episodes: gapEpisodes, current: { episode_num: 2 }, next: { post_id: "srv", episode_num: 9 } });
    expect(s?.next?.post_id).toBe("srv");
  });
});

/* ── Autoplay countdown ─────────────────────────────────── */

describe("autoplayReducer", () => {
  test("counts 10 → 0 and fires", () => {
    let s = autoplayReducer(AUTOPLAY_IDLE, { type: "start" });
    expect(s).toEqual({ status: "counting", remaining: 10 });
    for (let i = 0; i < 9; i += 1) s = autoplayReducer(s, { type: "tick" });
    expect(s).toEqual({ status: "counting", remaining: 1 });
    s = autoplayReducer(s, { type: "tick" });
    expect(s).toEqual({ status: "fired", remaining: 0 });
    // Further ticks are inert.
    expect(autoplayReducer(s, { type: "tick" })).toEqual(s);
  });

  test("cancel is sticky until reset", () => {
    let s = autoplayReducer(AUTOPLAY_IDLE, { type: "start" });
    s = autoplayReducer(s, { type: "tick" });
    s = autoplayReducer(s, { type: "cancel" });
    expect(s.status).toBe("cancelled");
    expect(autoplayReducer(s, { type: "start" }).status).toBe("cancelled");
    expect(autoplayReducer(s, { type: "tick" }).status).toBe("cancelled");
    const fresh = autoplayReducer(s, { type: "reset" });
    expect(fresh).toEqual(AUTOPLAY_IDLE);
    expect(autoplayReducer(fresh, { type: "start" }).status).toBe("counting");
  });

  test("play now fires immediately; start while counting does not restart the clock", () => {
    let s = autoplayReducer(AUTOPLAY_IDLE, { type: "start", seconds: 5 });
    s = autoplayReducer(s, { type: "tick" });
    expect(autoplayReducer(s, { type: "start" }).remaining).toBe(4);
    expect(autoplayReducer(s, { type: "playNow" })).toEqual({ status: "fired", remaining: 0 });
  });

  test("the stored preference defaults to on and reads 0/false as off", () => {
    const store = (v: string | null) => ({ getItem: () => v });
    expect(readAutoplayNextPref(store(null))).toBe(true);
    expect(readAutoplayNextPref(store("1"))).toBe(true);
    expect(readAutoplayNextPref(store("0"))).toBe(false);
    expect(readAutoplayNextPref(store("false"))).toBe(false);
    expect(readAutoplayNextPref(null)).toBe(true);
  });
});

/* ── Row mappers ────────────────────────────────────────── */

const row = (id: string, extra: Partial<HydratedPostRow> = {}): HydratedPostRow => ({
  id,
  author_id: "u1",
  text: "First line\nsecond line",
  content_type: "long_video",
  created_at: "2026-09-01T00:00:00Z",
  cover_media_id: "cov1",
  media: [{ media_id: "vid1", kind: "video", duration_ms: 125_000 }],
  counts: { likes: 12, comments: 3, shares: 1 },
  view_count: 1500,
  author: { id: "u1", display_name: "Ada", username: "ada", avatar_media_id: "av1" },
  channel: { user_id: "u1", name: "Ada's Channel", handle: "ada", subscriber_count: 42, is_subscribed: true },
  ...extra,
});

describe("rowToVideo", () => {
  test("maps a hydrated row without any lookups", () => {
    const v = rowToVideo(row("p1"));
    expect(v.id).toBe("p1");
    expect(v.title).toBe("First line");
    expect(v.channel_name).toBe("Ada's Channel");
    expect(v.channel_handle).toBe("ada");
    expect(v.subscription_channel_id).toBe("u1");
    expect(v.channel_subscriber_count).toBe(42);
    expect(v.viewer_has_subscribed).toBe(true);
    expect(v.duration_seconds).toBe(125);
    expect(v.thumbnail_url.endsWith("/v1/media/cov1/serve")).toBe(true);
    expect(v.video_url.endsWith("/v1/media/vid1/serve")).toBe(true);
    expect(v.view_count).toBe(1500);
    expect(v.like_count).toBe(12);
  });

  test("uses the explicit title and video_metadata when present", () => {
    const v = rowToVideo(row("p2", { title: "  Proper title ", video_metadata: { duration_seconds: 600, thumbnail_url: "https://cdn/x.jpg", playback_url: "https://cdn/x.m3u8", final_category: "long_video" } }));
    expect(v.title).toBe("Proper title");
    expect(v.duration_seconds).toBe(600);
    expect(v.thumbnail_url).toBe("https://cdn/x.jpg");
    expect(v.video_url).toBe("https://cdn/x.m3u8");
    expect(v.content_type).toBe("long_video");
  });

  test("falls back to the author id when nothing is hydrated", () => {
    const v = rowToVideo(row("p3", { author: null, channel: null, text: "" }));
    expect(v.title).toBe("Untitled");
    expect(v.channel_name).toBe("u1");
    expect(v.channel_avatar_url).toContain("dicebear");
  });
});

describe("mapRelatedRows / mapTrendingRows", () => {
  test("related drops the current video and duplicates", () => {
    const out = mapRelatedRows([row("cur"), row("a"), row("a"), row("b"), null as never], "cur");
    expect(out.map((v) => v.id)).toEqual(["a", "b"]);
  });

  test("trending accepts the {items} envelope or a bare array", () => {
    expect(mapTrendingRows({ items: [row("t1"), row("t2")], next_cursor: null }).map((v) => v.id)).toEqual(["t1", "t2"]);
    expect(mapTrendingRows([row("t3")]).map((v) => v.id)).toEqual(["t3"]);
    expect(mapTrendingRows(null)).toEqual([]);
    expect(mapTrendingRows({ items: null })).toEqual([]);
  });

  test("progressToVideo carries the resume state and drops rows without a post", () => {
    const p = normalizeProgressRow({ post_id: "p1", position_ms: 30_000, duration_ms: 120_000, last_watched_at: "2026-09-26T10:00:00Z", post: row("p1") });
    const v = progressToVideo(p);
    expect(v?.resume_position_ms).toBe(30_000);
    expect(v?.resume_percent_watched).toBe(25);
    expect(v?.last_watched_at).toBe("2026-09-26T10:00:00Z");
    expect(progressToVideo(normalizeProgressRow({ post_id: "x", position_ms: 1, duration_ms: 2 }))).toBeNull();
  });
});

/* ── Feed query ─────────────────────────────────────────── */

describe("buildVideoFeedQuery", () => {
  test("All sends only limit (+cursor)", () => {
    expect(buildVideoFeedQuery({ chip: "all", limit: 20 })).toEqual({ limit: "20" });
    expect(buildVideoFeedQuery({ chip: null, cursor: "c1" })).toEqual({ limit: "20", cursor: "c1" });
  });

  test("Subscriptions is subscribed_only=true and never following_only", () => {
    const q = buildVideoFeedQuery({ chip: "subscriptions", limit: 12 });
    expect(q).toEqual({ limit: "12", subscribed_only: "true" });
    expect("following_only" in q).toBe(false);
    expect("category" in q).toBe(false);
  });

  test("a category chip is category=<slug> and not combined with subscribed_only", () => {
    const q = buildVideoFeedQuery({ chip: "gaming", limit: 20, cursor: "abc" });
    expect(q).toEqual({ limit: "20", cursor: "abc", category: "gaming" });
    expect("subscribed_only" in q).toBe(false);
    expect("following_only" in q).toBe(false);
  });
});

describe("normalizeCategories", () => {
  test("accepts strings, objects, and wrapped lists; dedupes; labels from slug", () => {
    expect(normalizeCategories(["gaming", "music", "gaming"])).toEqual([
      { slug: "gaming", label: "Gaming" },
      { slug: "music", label: "Music" },
    ]);
    expect(normalizeCategories([{ slug: "how_to", name: "How-to" }, { id: "news" }, { nope: 1 }])).toEqual([
      { slug: "how_to", label: "How-to" },
      { slug: "news", label: "News" },
    ]);
    expect(normalizeCategories({ categories: [{ slug: "tech", label: "Tech" }] })).toEqual([{ slug: "tech", label: "Tech" }]);
    expect(normalizeCategories(null)).toEqual([]);
  });
});

/* ── Player prefs ───────────────────────────────────────── */

describe("parseTubePrefs", () => {
  test("defaults, validates, and ignores junk", () => {
    expect(parseTubePrefs(null)).toEqual({ speed: 1, quality: "auto", captions: false, volume: 1, muted: false });
    expect(parseTubePrefs(JSON.stringify({ speed: 1.5, quality: "720p", captions: true, volume: 0.4, muted: true }))).toEqual({ speed: 1.5, quality: "720p", captions: true, volume: 0.4, muted: true });
    expect(parseTubePrefs(JSON.stringify({ speed: 3, quality: "hd", volume: 7 }))).toEqual({ speed: 1, quality: "auto", captions: false, volume: 1, muted: false });
    expect(parseTubePrefs("{not json")).toEqual({ speed: 1, quality: "auto", captions: false, volume: 1, muted: false });
  });
});
