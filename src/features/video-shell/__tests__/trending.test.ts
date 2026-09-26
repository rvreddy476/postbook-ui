import { describe, expect, test } from "bun:test";

import { trendingHeading, trendingHref, trendingRow, trendingTitle, type TrendingPost } from "../trending";

const base: TrendingPost = {
  id: "p1",
  author_id: "u1",
  text: "First line of the caption\nsecond line",
  content_type: "long_video",
  cover_media_id: "m9",
  counts: { likes: 1200, comments: 3, shares: 1 },
  view_count: 45_000,
  media: [{ media_id: "v1", kind: "video", duration_ms: 90_000 }],
};

describe("trendingTitle", () => {
  test("prefers the title", () => {
    expect(trendingTitle({ ...base, title: "  A title  " })).toBe("A title");
  });
  test("falls back to the first non-empty line of text, capped at 80 chars", () => {
    expect(trendingTitle({ ...base, title: "" })).toBe("First line of the caption");
    expect(trendingTitle({ text: "\n\n  third line is first  \nmore" })).toBe("third line is first");
    const long = "x".repeat(120);
    const t = trendingTitle({ text: long });
    expect(t.length).toBe(81);
    expect(t.endsWith("…")).toBe(true);
    expect(t.startsWith("x".repeat(80))).toBe(true);
  });
  test("is Untitled when there is nothing", () => {
    expect(trendingTitle({})).toBe("Untitled");
    expect(trendingTitle({ title: " ", text: " \n " })).toBe("Untitled");
  });
});

describe("trendingHref", () => {
  test("flick goes to the reels stage, long_video to the watch page", () => {
    expect(trendingHref({ id: "a b", content_type: "flick" })).toBe("/reels?reelId=a%20b");
    expect(trendingHref({ id: "v1", content_type: "long_video" })).toBe("/posttube/watch/v1");
  });
  test("uses the requested kind when the row has no content_type", () => {
    expect(trendingHref({ id: "v1" }, "flick")).toBe("/reels?reelId=v1");
    expect(trendingHref({ id: "v1" }, "long_video")).toBe("/posttube/watch/v1");
    expect(trendingHref({ id: "v1" })).toBe("/posttube/watch/v1");
  });
});

describe("trendingRow", () => {
  test("maps a post into a row", () => {
    const row = trendingRow(base);
    expect(row).toMatchObject({
      id: "p1",
      authorId: "u1",
      title: "First line of the caption",
      href: "/posttube/watch/p1",
      views: 45_000,
      likes: 1200,
      stats: "45K views · 1.2K likes",
      authorName: null,
      durationMs: 90_000,
    });
    expect(row.posterUrl).toMatch(/\/v1\/media\/m9\/serve$/);
  });

  test("uses the row's own author when enriched, and tolerates missing fields", () => {
    const row = trendingRow({ id: "p2", author_id: "u2", content_type: "flick", author: { display_name: "Asha" } });
    expect(row.authorName).toBe("Asha");
    expect(row.href).toBe("/reels?reelId=p2");
    expect(row.posterUrl).toBeNull();
    expect(row.views).toBe(0);
    expect(row.likes).toBe(0);
    expect(row.stats).toBe("0 views · 0 likes");
    expect(row.durationMs).toBeNull();
    expect(row.title).toBe("Untitled");
    expect(trendingRow({ id: "p3", author_id: "u3", author: { username: "asha_k" } }).authorName).toBe("asha_k");
  });
});

test("trendingHeading", () => {
  expect(trendingHeading("flick")).toBe("Trending reels");
  expect(trendingHeading("long_video")).toBe("Trending videos");
});
