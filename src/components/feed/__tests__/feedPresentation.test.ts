import { describe, expect, test } from "bun:test";
import { uniqueFeedPosts } from "../feedPresentation";
import type { PostDetail } from "@/types/profile";

const post = (id: string) => ({ id, text: id }) as PostDetail;

describe("feed page presentation", () => {
  test("null and unloaded pages are genuinely empty", () => {
    expect(uniqueFeedPosts(undefined)).toEqual([]);
    expect(uniqueFeedPosts([{ data: null }, { data: [] }])).toEqual([]);
  });
  test("keeps server ranking and deduplicates overlapping cursor pages", () => {
    expect(
      uniqueFeedPosts([
        { data: [post("b"), post("a")] },
        { data: [post("a"), post("c")] },
      ]).map((p) => p.id),
    ).toEqual(["b", "a", "c"]);
  });
  test("does not mutate cached pages or clone the canonical first post", () => {
    const first = post("a");
    const pages = [{ data: [first, post("a"), post("")] }];
    expect(uniqueFeedPosts(pages)).toEqual([first]);
    expect(uniqueFeedPosts(pages)[0]).toBe(first);
    expect(pages[0].data).toHaveLength(3);
  });
});
