import { describe, expect, test } from "bun:test";

import { REEL_SEARCH_PATH, reelSearchHref, reelSearchIds } from "@/features/reels/search";

describe("reel search", () => {
  test("a query goes to the reel-only results page; an empty one stays put", () => {
    expect(reelSearchHref("bangaram")).toBe(`${REEL_SEARCH_PATH}?q=bangaram`);
    expect(reelSearchHref("  two words ")).toBe(`${REEL_SEARCH_PATH}?q=two%20words`);
    expect(reelSearchHref("   ")).toBeNull();
  });

  test("ids keep rank order, drop duplicates and anything that is not short-form", () => {
    const ids = reelSearchIds([
      { id: "a", content_type: "flick" },
      { post_id: "b", post_type: "reel" },
      { id: "a", content_type: "flick" },
      { id: "c", content_type: "long_video" },
      { id: "d" },
    ]);
    expect(ids).toEqual(["a", "b", "d"]);
    expect(reelSearchIds(null)).toEqual([]);
  });
});
