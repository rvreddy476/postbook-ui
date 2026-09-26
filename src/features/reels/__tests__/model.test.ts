import { describe, expect, test } from "bun:test";

import { formatClock, formatCount, isShortForm, toReelItem, toReelItems, type FeedReelPost } from "@/features/reels/model";

function flick(overrides: Partial<FeedReelPost> = {}): FeedReelPost {
  return {
    id: "3f860f61-ddb6-4be6-98e6-3b892e9c584f",
    author_id: "7cd6ea3a-9c80-4f20-806f-5d08de0f914b",
    text: "hello",
    content_type: "flick",
    cover_media_id: "2d703985-5419-4c4d-9ab7-2a0547782f65",
    counts: { likes: 1, comments: 0 },
    view_count: 12,
    has_reacted: false,
    is_bookmarked: true,
    hashtags: ["my", "bangaram"],
    author: { id: "7cd6ea3a-9c80-4f20-806f-5d08de0f914b", display_name: "raghu varan", username: "rvreddy47621", avatar_url: "/v1/media/e13c/serve/avatar" },
    reason_text: "From someone you follow",
    media: [
      {
        media_id: "383a2a8b-2cd8-4a02-9f3e-e4d32cd28e45",
        kind: "video",
        width: 1080,
        height: 1920,
        duration_ms: 28411,
        variants: { "360p": "https://x/360", "480p": "https://x/480", "720p": "https://x/720", original: "https://x/o", thumb_150: "https://x/t" },
        hls_url: "/v1/media/383a2a8b-2cd8-4a02-9f3e-e4d32cd28e45/hls/master.m3u8",
        playback_url: "/v1/media/383a2a8b-2cd8-4a02-9f3e-e4d32cd28e45/hls/master.m3u8",
        playback_kind: "hls",
        status: "ready",
      },
    ],
    ...overrides,
  };
}

describe("isShortForm — only reels reach the stage", () => {
  test("a flick under five minutes is a reel", () => {
    expect(isShortForm(flick())).toBe(true);
  });
  test("legacy 'reel' and 'short' types are reels too", () => {
    expect(isShortForm(flick({ content_type: "reel" }))).toBe(true);
    expect(isShortForm(flick({ content_type: "short" }))).toBe(true);
  });
  test("a long video is never a reel, whatever its length", () => {
    expect(isShortForm(flick({ content_type: "long_video" }))).toBe(false);
    expect(isShortForm(flick({ content_type: "video" }))).toBe(false);
  });
  test("a feed post with a video is not a reel", () => {
    expect(isShortForm(flick({ content_type: "post" }))).toBe(false);
  });
  test("a flick over the five-minute cap is dropped (client re-check, as on Android)", () => {
    const long = flick();
    long.media![0].duration_ms = 5 * 60 * 1000 + 1;
    expect(isShortForm(long)).toBe(false);
    const exact = flick();
    exact.media![0].duration_ms = 5 * 60 * 1000;
    expect(isShortForm(exact)).toBe(true);
  });
  test("no video media → not a reel", () => {
    expect(isShortForm(flick({ media: [{ media_id: "i", kind: "image" }] }))).toBe(false);
    expect(isShortForm(flick({ media: null }))).toBe(false);
  });
  test("content_type wins over feed_content_type", () => {
    expect(isShortForm(flick({ content_type: "long_video", feed_content_type: "flick" }))).toBe(false);
    expect(isShortForm(flick({ content_type: undefined, feed_content_type: "flick" }))).toBe(true);
  });
});

describe("toReelItem — the wire shape, once", () => {
  test("maps media, counts, flags and author", () => {
    const item = toReelItem(flick())!;
    expect(item.id).toBe("3f860f61-ddb6-4be6-98e6-3b892e9c584f");
    expect(item.media.hlsUrl).toBe("/v1/media/383a2a8b-2cd8-4a02-9f3e-e4d32cd28e45/hls/master.m3u8");
    expect(item.media.fileUrl).toBe("/v1/media/383a2a8b-2cd8-4a02-9f3e-e4d32cd28e45/serve");
    expect(item.media.posterUrl).toBe("/v1/media/2d703985-5419-4c4d-9ab7-2a0547782f65/serve");
    expect(item.media.qualities).toEqual(["360p", "480p", "720p"]);
    expect(item.media.durationMs).toBe(28411);
    expect(item.likeCount).toBe(1);
    expect(item.viewerLiked).toBe(false);
    expect(item.viewerSaved).toBe(true);
    expect(item.authorUsername).toBe("rvreddy47621");
    expect(item.authorAvatarUrl).toBe("/v1/media/e13c/serve/avatar");
    expect(item.reasonText).toBe("From someone you follow");
    expect(item.hashtags).toEqual(["my", "bangaram"]);
  });
  test("viewer_reaction counts as liked even when has_reacted is absent (Go zero values)", () => {
    expect(toReelItem(flick({ has_reacted: undefined, viewer_reaction: "like" }))!.viewerLiked).toBe(true);
    expect(toReelItem(flick({ has_reacted: undefined, viewer_reaction: "" }))!.viewerLiked).toBe(false);
  });
  test("an original-only asset has no hls url and plays the file", () => {
    const p = flick();
    p.media![0].playback_kind = "original";
    p.media![0].playback_url = "https://signed/original";
    p.media![0].hls_url = null;
    const item = toReelItem(p)!;
    expect(item.media.hlsUrl).toBeNull();
    expect(item.media.fileUrl).toContain("/serve");
  });
  test("missing cover → no poster; missing author → a name is still shown", () => {
    const item = toReelItem(flick({ cover_media_id: null, author: null }))!;
    expect(item.media.posterUrl).toBeNull();
    expect(item.authorName).toBe("Someone");
  });
  test("toReelItems drops non-reels and keeps order", () => {
    const rows = [flick({ id: "a" }), flick({ id: "b", content_type: "long_video" }), flick({ id: "c" })];
    expect(toReelItems(rows).map((r) => r.id)).toEqual(["a", "c"]);
    expect(toReelItems(null)).toEqual([]);
  });
});

describe("display helpers", () => {
  test("formatCount", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1200)).toBe("1.2K");
    expect(formatCount(12000)).toBe("12K");
    expect(formatCount(1_500_000)).toBe("1.5M");
  });
  test("formatClock", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(28411)).toBe("0:28");
    expect(formatClock(61000)).toBe("1:01");
  });
});
