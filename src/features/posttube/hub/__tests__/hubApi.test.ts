import { describe, expect, test } from "bun:test";

import {
  normalizeBulkOutcomes,
  normalizeCaptionPage,
  normalizeCaptionRow,
  normalizeCards,
  normalizeChapters,
  normalizeContentInsights,
  normalizeCreatorInsights,
  normalizeEndScreens,
  normalizeFlags,
  normalizeHubCategories,
  normalizeInboxRow,
  normalizeLibraryRow,
  normalizePostDetail,
  normalizeSummary,
  normalizeVisibility,
  watchHref,
} from "../hubApi";

describe("library rows", () => {
  test("reads the pinned uploads contract", () => {
    const row = normalizeLibraryRow({
      id: "p1",
      title: "A title",
      text: "desc\nmore",
      content_type: "long_video",
      cover_media_id: "c1",
      media: [{ media_id: "m1", kind: "video", duration_ms: 65_000 }],
      visibility: "unlisted",
      scheduled_at: null,
      published_at: "2026-09-01T00:00:00Z",
      view_count: 12,
      comment_count: 3,
      processing_status: "ready",
      flags: ["review_hold", "made_for_kids"],
      allow_download: true,
      source: "live",
    })!;
    expect(row.title).toBe("A title");
    expect(row.media_id).toBe("m1");
    expect(row.duration_seconds).toBe(65);
    expect(row.visibility).toBe("unlisted");
    expect(row.view_count).toBe(12);
    expect(row.comment_count).toBe(3);
    expect(row.flags).toEqual(["review_hold", "made_for_kids"]);
    expect(row.allow_download).toBe(true);
    expect(row.source).toBe("live");
    expect(row.thumbnail_url).toContain("/v1/media/c1/serve");
  });

  test("tolerates the older row: no flags, notices[], counts, empty visibility (Go zero value)", () => {
    const row = normalizeLibraryRow({
      id: "p2",
      text: "first line is the title",
      content_type: "long_video",
      created_at: "2026-08-01T00:00:00Z",
      counts: { likes: 4, comments: 9 },
      visibility: "",
      notices: ["processing failed", { kind: "copyright_hold" }],
      video_metadata: { duration_seconds: 30, upload_status: "ready", thumbnail_url: "https://x/t.jpg", media_asset_id: "m9" },
    })!;
    expect(row.title).toBe("first line is the title");
    expect(row.visibility).toBe("public");
    expect(row.comment_count).toBe(9);
    expect(row.like_count).toBe(4);
    expect(row.flags).toEqual(["processing_failed", "review_hold"]);
    expect(row.media_id).toBe("m9");
    expect(row.source).toBeNull();
    expect(row.thumbnail_url).toBe("https://x/t.jpg");
  });

  test("a scheduled_at with no visibility reads as scheduled and carries the flag", () => {
    expect(normalizeVisibility("", "2026-10-01T00:00:00Z")).toBe("scheduled");
    expect(normalizeVisibility("PUBLIC")).toBe("public");
    expect(normalizeVisibility("weird")).toBe("public");
    expect(normalizeFlags(null, { scheduledAt: "2026-10-01T00:00:00Z", madeForKids: true, processingStatus: "failed" })).toEqual(["processing_failed", "made_for_kids", "scheduled"]);
  });

  test("drops rows without an id", () => {
    expect(normalizeLibraryRow(null)).toBeNull();
    expect(normalizeLibraryRow({ title: "x" })).toBeNull();
  });

  test("watch links go to the right app", () => {
    expect(watchHref({ id: "a", content_type: "long_video" })).toBe("/posttube/watch/a");
    expect(watchHref({ id: "b", content_type: "reel" })).toBe("/reels?reelId=b");
  });
});

describe("post detail", () => {
  test("carries the owner-editable fields with safe defaults", () => {
    const d = normalizePostDetail({ id: "p", title: "T", text: "", content_type: "long_video", tags: ["a", 3, ""], hashtags: null, category: "howto-style", language: "", no_comments: true })!;
    expect(d.tags).toEqual(["a"]);
    expect(d.hashtags).toEqual([]);
    expect(d.category).toBe("howto-style");
    expect(d.language).toBe("");
    expect(d.no_comments).toBe(true);
    expect(d.made_for_kids).toBe(false);
    expect(d.allow_download).toBe(false);
  });
});

describe("bulk outcomes", () => {
  test("results array, bare array, id map, and no detail at all", () => {
    expect(normalizeBulkOutcomes({ results: [{ post_id: "a", ok: true }, { post_id: "b", ok: false, error: "FORBIDDEN" }] }, ["a", "b"])).toEqual([
      { post_id: "a", ok: true, error: undefined },
      { post_id: "b", ok: false, error: "FORBIDDEN" },
    ]);
    expect(normalizeBulkOutcomes([{ id: "a", status: "updated" }, { id: "b", status: "failed" }], ["a", "b"]).map((o) => o.ok)).toEqual([true, false]);
    expect(normalizeBulkOutcomes({ a: "ok", b: { error: "x" } }, ["a", "b"]).map((o) => o.ok)).toEqual([true, false]);
    expect(normalizeBulkOutcomes({}, ["a", "b"]).every((o) => o.ok)).toBe(true);
  });
});

describe("summary and categories", () => {
  test("summary reads the new and the old names", () => {
    expect(normalizeSummary({ videos: 1, shorts: 2, live: 3, collections: 4, followers: 5 })).toEqual({ videos: 1, shorts: 2, live: 3, collections: 4, followers: 5 });
    expect(normalizeSummary({ videos: 1, flicks: 2, playlists: 4, subscribers: 5 })).toEqual({ videos: 1, shorts: 2, live: 0, collections: 4, followers: 5 });
    expect(normalizeSummary(null)).toEqual({ videos: 0, shorts: 0, live: 0, collections: 0, followers: 0 });
  });

  test("categories: new [{slug,label,kind}], older strings and {categories}", () => {
    expect(normalizeHubCategories([{ slug: "howto-style", label: "How-to & style", kind: "long" }])).toEqual([{ slug: "howto-style", label: "How-to & style", kind: "long" }]);
    expect(normalizeHubCategories(["comedy", "comedy", ""])).toEqual([{ slug: "comedy", label: "Comedy", kind: "all" }]);
    expect(normalizeHubCategories({ categories: [{ key: "sci_tech", name: "Science" }] })).toEqual([{ slug: "sci_tech", label: "Science", kind: "all" }]);
  });
});

describe("elements", () => {
  test("chapters sort by start and default the source", () => {
    const c = normalizeChapters([
      { chapter_index: 1, title: "Two", start_ms: 60_000, source: "manual" },
      { chapter_index: 0, title: "One", start_ms: 0, source: "" },
    ]);
    expect(c.map((x) => x.title)).toEqual(["One", "Two"]);
    expect(c[0].source).toBe("manual");
  });

  test("end screens accept a JSON string position and an unknown type falls back to video", () => {
    const s = normalizeEndScreens([{ id: "e1", type: "channel_subscribe", position: '{"slot":2}', start_ms: 5, end_ms: 10 }, { type: "nope", position: { x: 1 }, start_ms: 0, end_ms: 1 }]);
    expect(s[0].position).toEqual({ slot: 2 });
    expect(s[0].type).toBe("channel_subscribe");
    expect(s[1].type).toBe("video");
    expect(s[1].position).toEqual({ x: 1 });
  });

  test("cards sort by appear time", () => {
    const c = normalizeCards({ cards: [{ type: "video", title: "b", appear_at_ms: 9000 }, { type: "poll", title: "a", appear_at_ms: 100 }] });
    expect(c.map((x) => x.title)).toEqual(["a", "b"]);
  });
});

describe("conversations", () => {
  test("inbox row: comment + post + author_replied, with heart/pin aliases", () => {
    const r = normalizeInboxRow({
      comment: { id: "c1", post_id: "p1", author_id: "u1", text: "hi @you", created_at: "2026-09-01T00:00:00Z", creator_hearted: true, is_pinned: true, reply_count: 2 },
      post: { id: "p1", title: "Video", content_type: "long_video", cover_media_id: "cv" },
      author_replied: false,
    })!;
    expect(r.comment.body).toBe("hi @you");
    expect(r.comment.hearted).toBe(true);
    expect(r.comment.pinned).toBe(true);
    expect(r.comment.reply_count).toBe(2);
    expect(r.post.cover_media_id).toBe("cv");
    expect(r.author_replied).toBe(false);
  });

  test("a bare comment row still reads (post from post_id)", () => {
    const r = normalizeInboxRow({ id: "c2", post_id: "p9", author_id: "u", body: "x" })!;
    expect(r.post.id).toBe("p9");
    expect(r.post.title).toBe("Untitled");
    expect(r.comment.hearted).toBe(false);
  });
});

describe("captions", () => {
  test("mine page: {data:{items}, meta:{next_cursor}} per media-service 73da6b13, post_id null; a bare data array still reads", () => {
    const page = normalizeCaptionPage({
      data: { items: [{ media_id: "m1", post_id: null, languages: [{ language: "en", source: "manual_upload", published: true, updated_at: "2026-09-02T00:00:00Z" }], modified_at: "2026-09-02T00:00:00Z" }] },
      meta: { next_cursor: "c2" },
    });
    expect(page.items.length).toBe(1);
    expect(page.items[0].post_id).toBeNull();
    expect(page.items[0].languages[0].published).toBe(true);
    expect(page.next_cursor).toBe("c2");
    expect(normalizeCaptionPage({ data: [{ media_id: "m2", languages: [] }] }).items[0].media_id).toBe("m2");
    expect(normalizeCaptionPage({ data: { items: [] } }).next_cursor).toBeUndefined();
    expect(normalizeCaptionPage(undefined).items).toEqual([]);
  });

  test("mine rows: languages with the auto-draft default", () => {
    const r = normalizeCaptionRow({ media_id: "m1", languages: [{ language: "en", source: "manual_upload", updated_at: "2026-09-02T00:00:00Z" }, { language: "hi", source: "auto", updated_at: "2026-09-03T00:00:00Z" }] })!;
    expect(r.languages.map((l) => l.published)).toEqual([true, false]);
    expect(r.modified_at).toBe("2026-09-03T00:00:00Z");
    expect(normalizeCaptionRow({})).toBeNull();
  });
});

describe("insights", () => {
  test("creator: the bare object of 73da6b13 — followers_delta null stays null, the 48 h series pads, views_by_day absent", () => {
    const d = normalizeCreatorInsights({ period: "7d", views: 10, watch_time_ms: 1000, unique_viewers: 4, followers_delta: null, realtime: { views_48h: 3, series_48h: [1, 2] }, top_content: [{ content_id: "a", views: 5 }] }, "28d");
    expect(d.period).toBe("7d");
    expect(d.followers_delta).toBeNull();
    expect(d.unique_viewers).toBe(4);
    expect(d.realtime.series_48h.length).toBe(48);
    expect(d.realtime.series_48h.slice(-2)).toEqual([1, 2]);
    expect(d.views_by_day).toEqual([]);
    expect(d.top_content[0]).toEqual({ content_id: "a", views: 5, watch_time_ms: 0 });
    expect(normalizeCreatorInsights({ followers_delta: 7 }, "7d").followers_delta).toBe(7);
    expect(normalizeCreatorInsights(null, "90d").period).toBe("90d");
  });

  test("content: retention on 0..1 is scaled to percent, traffic sorted, views summed from days", () => {
    const d = normalizeContentInsights({ views_by_day: [{ day: "2026-09-01", views: 2 }, { day: "2026-09-02", views: 3 }], retention: [1, 0.5, 0.25], traffic: [{ surface: "search", views: 1 }, { surface: "home", views: 4 }] });
    expect(d.retention).toEqual([100, 50, 25]);
    expect(d.traffic[0].surface).toBe("home");
    expect(d.views).toBe(5);
  });
});
