import { expect, test } from "bun:test";

import type { PostDetail } from "@/types/profile";
import { homeFeedKey, homeFeedParams } from "@/hooks/useFeedPosts";
import { POLL_INTERVALS } from "@/hooks/useFeedDelta";
import { patchCachedValue, withSaved } from "../data/patchPost";
import { followingDotAnchor } from "../hooks/useFollowingDot";

const post = (id: string, extra: Partial<PostDetail> = {}) => ({ id, author_id: "a", text: "", visibility: "public", content_type: "post", is_pinned: false, created_at: "", updated_at: "", ...extra }) as PostDetail;

test("Following asks /v1/feed/home with following_only=true, chronological; For You keeps its key", () => {
  expect(homeFeedParams("chronological", { followingOnly: true }, "c1")).toEqual({ limit: "20", feed_mode: "chronological", platform: "postbook", following_only: "true", cursor: "c1" });
  expect(homeFeedParams("ranked", { excludeSelf: false, circleOnly: false })).toEqual({ limit: "20", feed_mode: "ranked", platform: "postbook" });
  expect(homeFeedKey("ranked", { excludeSelf: false, circleOnly: false })).toEqual(["home-feed", "ranked", false, false]);
  expect(homeFeedKey("chronological", { followingOnly: true })).toEqual(["home-feed", "chronological", false, false, "following_only"]);
});

test("the Following dot polls every minute, anchored on the newest Following post or the moment the feed opened", () => {
  expect(POLL_INTERVALS.following).toBe(60_000);
  expect(followingDotAnchor(undefined, "2026-10-19T10:00:00.000Z")).toBe("2026-10-19T10:00:00.000Z");
  expect(followingDotAnchor("2026-10-19T09:00:00Z", "2026-10-19T10:00:00.000Z")).toBe("2026-10-19T09:00:00Z");
});

test("a save moves the flag and the count together, and leaves an absent count absent", () => {
  const saved = withSaved(post("p", { counts: { likes: 1, comments: 0, saves: 2 } }), true);
  expect(saved.is_bookmarked).toBe(true);
  expect(saved.counts?.saves).toBe(3);
  expect(withSaved(saved, false).counts?.saves).toBe(2);
  expect(withSaved(post("p", { is_bookmarked: true, counts: { likes: 0, comments: 0, saves: 0 } }), false).counts?.saves).toBe(0);
  expect(withSaved(post("p", { counts: { likes: 0, comments: 0 } }), true).counts?.saves).toBeUndefined();
});

test("a patch reaches the post in an infinite feed, a list and a single read, and nothing else", () => {
  const feed = { pages: [{ data: [post("a"), post("b")] }, { data: [post("c")] }], pageParams: ["", "x"] };
  const next = patchCachedValue(feed, "c", (p) => ({ ...p, text: "hit" })) as typeof feed;
  expect(next.pages[1].data[0].text).toBe("hit");
  expect(next.pages[0].data.map((p) => p.text)).toEqual(["", ""]);
  expect(next.pages.map((p) => p.data.map((x) => x.id))).toEqual([["a", "b"], ["c"]]);
  expect((patchCachedValue([post("a")], "a", (p) => ({ ...p, text: "l" })) as PostDetail[])[0].text).toBe("l");
  expect((patchCachedValue(post("a"), "a", (p) => ({ ...p, text: "s" })) as PostDetail).text).toBe("s");
  expect(patchCachedValue(undefined, "a", (p) => p)).toBeUndefined();
});
