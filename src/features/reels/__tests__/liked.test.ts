import { describe, expect, test } from "bun:test";

import { indexBatch, likedReelsToItems } from "@/features/reels/liked";
import type { FeedReelPost } from "@/features/reels/model";

const short = (id: string, extra: Partial<FeedReelPost> = {}): FeedReelPost => ({
  id,
  author_id: "a",
  content_type: "reel",
  cover_media_id: `cover-${id}`,
  counts: { likes: 7 },
  media: [{ media_id: `m-${id}`, kind: "video", duration_ms: 12_000 }],
  ...extra,
});

describe("likedReelsToItems", () => {
  test("keeps the liked order, not the batch's", () => {
    const batch = { c: short("c"), a: short("a"), b: short("b") };
    expect(likedReelsToItems(["a", "b", "c"], batch).map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(likedReelsToItems(["c", "a"], batch).map((r) => r.id)).toEqual(["c", "a"]);
  });

  test("drops long video and feed posts (isShortForm), missing rows and duplicates", () => {
    const batch = {
      a: short("a"),
      long: short("long", { content_type: "video" }),
      over: short("over", { media: [{ media_id: "m", kind: "video", duration_ms: 6 * 60 * 1000 }] }),
      photo: short("photo", { content_type: "post", media: [{ media_id: "p", kind: "image" }] }),
    };
    expect(likedReelsToItems(["a", "long", "over", "photo", "gone", "a"], batch).map((r) => r.id)).toEqual(["a"]);
  });

  test("accepts an array envelope too, and empty input", () => {
    expect(likedReelsToItems(["b", "a"], [short("a"), short("b")]).map((r) => r.id)).toEqual(["b", "a"]);
    expect(likedReelsToItems([], null)).toEqual([]);
    expect(indexBatch(undefined).size).toBe(0);
  });

  test("poster and like count survive for the grid", () => {
    const [item] = likedReelsToItems(["a"], { a: short("a") });
    expect(item.media.posterUrl).toContain("/v1/media/cover-a/serve");
    expect(item.likeCount).toBe(7);
  });
});
