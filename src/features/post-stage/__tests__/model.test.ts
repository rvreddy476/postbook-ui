import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { POST_TEMPLATES } from "@/components/studio/postStyle";
import type { PostDetail } from "@/types/profile";
import {
  declaredLabels,
  frameAspect,
  isFeedReselect,
  railAriaLabel,
  railCountText,
  relativeDate,
  stageSwatch,
  stageWordsStyle,
  toStagePost,
  trailingHashtags,
} from "../model";

/* Byte-identical copies of the backend goldens (post-service post_detail.json, feed-service feed_row_photo_carousel.json). */
const golden = (name: string) => JSON.parse(readFileSync(resolve(import.meta.dir, "contracts", name), "utf8")) as PostDetail;
const detail = golden("post_detail.json");
const row = golden("feed_row_photo_carousel.json");

describe("the goldens reach the stage model", () => {
  for (const [name, wire] of [["post_detail.json", detail], ["feed_row_photo_carousel.json", row]] as const) {
    test(`${name}: counts incl. saves, labels, title, hashtags, media order and alt text`, () => {
      const post = toStagePost(wire);
      expect(post.id).toBe("c1111111-1111-4111-8111-111111111111");
      expect(post.counts).toEqual({ likes: 128, comments: 14, shares: 6, saves: 21 });
      // paid_promotion is false on both: Brand then AI-generated, in that order.
      expect(post.labels).toEqual(["Brand", "AI-generated"]);
      expect(post.title).toBe("Sunday market");
      expect(post.caption).toBe("Sunday market haul #food @call.b");
      expect(post.hashtags).toEqual(["food", "market"]);
      expect(post.kind).toBe("media");
      expect(post.media.map((m) => m.mediaId)).toEqual([
        "c3333333-3333-4333-8333-333333333333",
        "c4444444-4444-4444-8444-444444444444",
        "c5555555-5555-4555-8555-555555555555",
      ]);
      expect(post.media.map((m) => m.alt)).toEqual(["Stalls under string lights", "A basket of mangoes", ""]);
      expect(post.linkUrl).toBe("https://example.com/sunday-market");
      expect(post.language).toBe("en");
      expect(post.commentAccess).toBe("followers");
      expect(post.remixSetting).toBe("disallow");
      expect(post.shareHidden).toBe(false);
      expect(post.commentsOff).toBe(false);
      expect(post.viewerLiked).toBe(false);
      expect(post.viewerSaved).toBe(false);
    });
  }

  test("the feed row carries the author; the post read does not, and the stage falls back to the profile", () => {
    expect(toStagePost(row)).toMatchObject({ authorId: "c2222222-2222-4222-8222-222222222222", authorName: "Raghu", authorHandle: "raghu" });
    expect(toStagePost(detail)).toMatchObject({ authorId: "c2222222-2222-4222-8222-222222222222", authorName: "", authorHandle: "" });
  });

  test("media is ordered by position, not by array order", () => {
    const shuffled = { ...row, media: [...(row.media ?? [])].reverse() };
    expect(toStagePost(shuffled).media.map((m) => m.position)).toEqual([0, 1, 2]);
  });

  test("a count the row leaves out is unknown, never 0; a present 0 stays 0", () => {
    const post = toStagePost({ ...row, counts: { likes: 0, comments: 0 } });
    expect(post.counts).toEqual({ likes: 0, comments: 0, shares: undefined, saves: undefined });
    expect(toStagePost({ ...row, counts: { likes: 1, comments: 1, saves: 0, bookmarks: 4 } }).counts.saves).toBe(4);
  });

  test("Go zero values fall through: an empty display name reads the username", () => {
    const post = toStagePost({ ...row, author: { id: "a", display_name: "", username: "bee", avatar_media_id: "" } });
    expect(post.authorName).toBe("bee");
    expect(post.authorAvatar).toBe("");
  });
});

test("declared labels: paid promotion, brand, AI — in that order, only when true", () => {
  expect(declaredLabels({ paid_promotion: true, is_branded: true, ai_generated: true })).toEqual(["Paid partnership", "Brand", "AI-generated"]);
  expect(declaredLabels({ ai_generated: true, paid_promotion: true })).toEqual(["Paid partnership", "AI-generated"]);
  expect(declaredLabels({})).toEqual([]);
});

test("the rail shows 0 as \"0\", and the control's name when the row has no count", () => {
  expect(railCountText("Like", 0)).toBe("0");
  expect(railCountText("Save", 21)).toBe("21");
  expect(railCountText("Share", 1500)).toBe("1.5K");
  expect(railCountText("Save", undefined)).toBe("Save");
  expect(railAriaLabel("Like", 3)).toBe("Like, 3");
  expect(railAriaLabel("Like", 0)).toBe("Like, 0");
  expect(railAriaLabel("Share", undefined)).toBe("Share");
});

test("relative dates", () => {
  const now = Date.parse("2026-10-19T12:00:00Z");
  expect(relativeDate("2026-10-19T11:59:30Z", now)).toBe("just now");
  expect(relativeDate("2026-10-19T11:55:00Z", now)).toBe("5m");
  expect(relativeDate("2026-10-19T09:00:00Z", now)).toBe("3h");
  expect(relativeDate("2026-10-17T12:00:00Z", now)).toBe("2d");
  expect(relativeDate("2026-09-01T12:00:00Z", now)).toBe("1 Sep");
  expect(relativeDate("2025-09-01T12:00:00Z", now)).toBe("1 Sep 2025");
  expect(relativeDate("", now)).toBe("");
});

test("only hashtags the caption does not already show are appended", () => {
  expect(trailingHashtags("Sunday market haul #food @call.b", ["food", "market"])).toEqual(["market"]);
  expect(trailingHashtags("", ["a"])).toEqual(["a"]);
});

test("a text post's colour: deterministic per post, from the composer's presets", () => {
  const backgrounds = POST_TEMPLATES.map((t) => t.style.background).filter(Boolean);
  const a = stageSwatch("post-a");
  expect(stageSwatch("post-a")).toEqual(a);
  expect(backgrounds).toContain(a.background);
  const seen = new Set(Array.from({ length: 40 }, (_, i) => stageSwatch(`p${i}`).background));
  expect(seen.size).toBeGreaterThan(1);
  // The author's own colour wins.
  expect(stageWordsStyle({ id: "x", rich: { background: "own" } }).background).toBe("own");
  expect(stageWordsStyle({ id: "x", rich: null }).background).toBe(stageSwatch("x").background);
});

test("a picked colour always carries white words, never a pale preset", () => {
  const pale = POST_TEMPLATES.filter((t) => t.style.background && !/^#?f{3}(?:f{3})?$/i.test(t.style.text_color ?? "")).map((t) => t.style.background);
  for (let i = 0; i < 60; i++) {
    const swatch = stageSwatch(`post-${i}`);
    expect(pale).not.toContain(swatch.background);
    expect((swatch.text_color ?? "").toLowerCase()).toMatch(/^#?f{3}(?:f{3})?$/);
  }
});

test("text posts and photos are 9:16; a landscape video widens the frame", () => {
  const words = toStagePost({ ...row, media: [] });
  expect(words.kind).toBe("words");
  expect(frameAspect(words)).toBeCloseTo(9 / 16);
  expect(frameAspect(toStagePost(row))).toBeCloseTo(9 / 16);
  const video = toStagePost({ ...row, media: [{ media_id: "v", kind: "video", width: 1920, height: 1080 }] });
  expect(frameAspect(video)).toBeCloseTo(16 / 9);
});

test("tapping Feed while on /feed is a reselect; elsewhere it is navigation", () => {
  const origin = "https://app.example";
  expect(isFeedReselect("/feed", "/feed", origin)).toBe(true);
  expect(isFeedReselect("https://app.example/feed", "/feed", origin)).toBe(true);
  expect(isFeedReselect("/feed", "/", origin)).toBe(false);
  expect(isFeedReselect("/reels", "/feed", origin)).toBe(false);
  expect(isFeedReselect("https://elsewhere.example/feed", "/feed", origin)).toBe(false);
});
