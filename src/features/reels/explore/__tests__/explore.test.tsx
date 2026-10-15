import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import api from "@/lib/api";
import {
  EXPLORE_ALL,
  EXPLORE_MAX_HOPS,
  InvalidCategoryError,
  exploreFeedParams,
  exploreTiles,
  fetchExplorePage,
  fetchShortCategories,
  isInvalidCategoryError,
  nextChipIndex,
  normalizeExploreCategory,
} from "@/features/reels/explore/exploreApi";
import { CategoryChips } from "@/features/reels/explore/CategoryChips";
import { ExploreGrid } from "@/features/reels/explore/ExploreGrid";
import { SuggestedCreatorsView, creatorCard, followLabel, type FollowState } from "@/features/reels/explore/SuggestedCreators";
import { followUser, unfollowUser } from "@/hooks/useEditProfile";
import { toReelItem, type FeedReelPost } from "@/features/reels/model";
import type { SuggestionUser } from "@/hooks/useConnections";

afterEach(() => mock.restore());

function reelRow(id: string, extra: Partial<FeedReelPost> = {}): FeedReelPost {
  return {
    id,
    author_id: `a-${id}`,
    content_type: "reel",
    text: `caption ${id}`,
    cover_media_id: `cover-${id}`,
    media: [{ media_id: `m-${id}`, kind: "video", duration_ms: 12_000, width: 1080, height: 1920 }],
    counts: { likes: 1200 },
    author: { id: `a-${id}`, username: `maker_${id}`, display_name: `Maker ${id}`, avatar_media_id: `av-${id}` },
    ...extra,
  };
}

const page = (rows: FeedReelPost[], next?: string) => ({ data: { data: rows, meta: next === undefined ? null : { next_cursor: next } } });
const paramsOf = (get: ReturnType<typeof spyOn>, call: number) =>
  (get.mock.calls[call] as unknown as [string, { params: Record<string, string> }])[1].params;
const axiosError = (status: number, code: string) =>
  Object.assign(new Error(String(status)), { isAxiosError: true, response: { status, data: { error: { code } } } });

describe("chip → request", () => {
  test("All sends no category; a chip sends its slug, lowercased and trimmed as the server reads it", () => {
    expect(exploreFeedParams({ category: EXPLORE_ALL })).toEqual({ limit: "18" });
    expect(exploreFeedParams({ category: "dance" })).toEqual({ limit: "18", category: "dance" });
    expect(exploreFeedParams({ category: "  Comedy " })).toEqual({ limit: "18", category: "comedy" });
    expect(exploreFeedParams({ category: "music", cursor: "c9", limit: 6 })).toEqual({ limit: "6", category: "music", cursor: "c9" });
  });

  test("a chip tap is one GET /v1/feed/reels?category= and the page maps to reels", async () => {
    const get = spyOn(api, "get").mockResolvedValue(page([reelRow("r1"), reelRow("r2")], "c1") as never);
    const result = await fetchExplorePage({ category: "dance" });
    expect(get.mock.calls.length).toBe(1);
    expect(get.mock.calls[0][0]).toBe("/v1/feed/reels");
    expect(paramsOf(get, 0)).toEqual({ limit: "18", category: "dance" });
    expect(result.items.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(result.nextCursor).toBe("c1");
    expect(result.requests).toBe(1);
  });

  test("long video and feed posts never reach the grid, whatever the server sends", async () => {
    spyOn(api, "get").mockResolvedValue(
      page([
        reelRow("short"),
        reelRow("long", { content_type: "video", media: [{ media_id: "m", kind: "video", duration_ms: 20 * 60_000 }] }),
        reelRow("post", { content_type: "post" }),
      ]) as never,
    );
    const result = await fetchExplorePage({ category: "" });
    expect(result.items.map((r) => r.id)).toEqual(["short"]);
  });

  test("the chips are the short-video categories from GET /v1/posts/categories?kind=short", async () => {
    const get = spyOn(api, "get").mockResolvedValue({
      data: {
        data: [
          { id: "comedy", slug: "comedy", label: "Comedy", kind: "all" },
          { id: "dance", slug: "dance", label: "Dance", kind: "all" },
          { id: "podcasts", slug: "podcasts", label: "Podcasts", kind: "long" },
          { id: "clips", slug: "clips", label: "Clips", kind: "short" },
        ],
      },
    } as never);
    const chips = await fetchShortCategories();
    expect(get.mock.calls[0][0]).toBe("/v1/posts/categories");
    expect(paramsOf(get, 0)).toEqual({ kind: "short" });
    expect(chips).toEqual([
      { slug: "comedy", label: "Comedy" },
      { slug: "dance", label: "Dance" },
      { slug: "clips", label: "Clips" },
    ]);
  });
});

describe("paging through empty pages", () => {
  test("an empty page with a cursor is not the end: the next page is asked for, cursor carried", async () => {
    const get = spyOn(api, "get")
      .mockResolvedValueOnce(page([], "c1") as never)
      .mockResolvedValueOnce(page([], "c2") as never)
      .mockResolvedValueOnce(page([reelRow("r9")], "c3") as never);
    const result = await fetchExplorePage({ category: "pets" });
    expect(result.requests).toBe(3);
    expect(result.items.map((r) => r.id)).toEqual(["r9"]);
    expect(result.nextCursor).toBe("c3");
    expect(paramsOf(get, 0).cursor).toBeUndefined();
    expect(paramsOf(get, 1)).toEqual({ limit: "18", category: "pets", cursor: "c1" });
    expect(paramsOf(get, 2)).toEqual({ limit: "18", category: "pets", cursor: "c2" });
  });

  test("one user action spends at most EXPLORE_MAX_HOPS requests, and hands back the cursor to keep looking", async () => {
    let n = 0;
    const get = spyOn(api, "get").mockImplementation((async () => page([], `c${++n}`)) as never);
    const result = await fetchExplorePage({ category: "pets" });
    expect(get.mock.calls.length).toBe(EXPLORE_MAX_HOPS);
    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBe(`c${EXPLORE_MAX_HOPS}`);
    // The next action (Keep looking) starts from that cursor.
    await fetchExplorePage({ category: "pets", cursor: result.nextCursor, maxHops: 1 });
    expect(paramsOf(get, EXPLORE_MAX_HOPS).cursor).toBe(`c${EXPLORE_MAX_HOPS}`);
  });

  test("an empty page without a cursor ends it; an empty-string cursor is no cursor; a repeated cursor stops", async () => {
    const get = spyOn(api, "get").mockResolvedValue(page([]) as never);
    expect(await fetchExplorePage({ category: "pets" })).toEqual({ items: [], nextCursor: undefined, requests: 1 });
    get.mockResolvedValue(page([], "") as never);
    expect((await fetchExplorePage({ category: "pets" })).nextCursor).toBeUndefined();
    get.mockResolvedValue(page([], "same") as never);
    const stuck = await fetchExplorePage({ category: "pets", cursor: "same" });
    expect(stuck.nextCursor).toBeUndefined();
    expect(stuck.requests).toBe(1);
  });

  test("tiles across pages are de-duplicated and kept in order", () => {
    const a = toReelItem(reelRow("a"))!;
    const b = toReelItem(reelRow("b"))!;
    expect(exploreTiles([{ items: [a, b], nextCursor: "x", requests: 1 }, { items: [b], nextCursor: undefined, requests: 2 }]).map((r) => r.id)).toEqual(["a", "b"]);
    expect(exploreTiles(undefined)).toEqual([]);
  });
});

describe("invalid category", () => {
  test("a malformed slug is refused on the client and never sent", async () => {
    const get = spyOn(api, "get").mockResolvedValue(page([]) as never);
    expect(normalizeExploreCategory("Bad Slug!")).toEqual({ slug: "bad slug!", valid: false });
    expect(normalizeExploreCategory("-dash")).toEqual({ slug: "-dash", valid: false });
    expect(normalizeExploreCategory("x".repeat(33)).valid).toBe(false);
    expect(normalizeExploreCategory(null)).toEqual({ slug: "", valid: true });
    await expect(fetchExplorePage({ category: "Bad Slug!" })).rejects.toBeInstanceOf(InvalidCategoryError);
    expect(get.mock.calls.length).toBe(0);
  });

  test("the server's 400 INVALID_CATEGORY becomes InvalidCategoryError; any other failure is thrown as it was", async () => {
    const get = spyOn(api, "get").mockRejectedValue(axiosError(400, "INVALID_CATEGORY") as never);
    const err = await fetchExplorePage({ category: "comedy" }).catch((e) => e);
    expect(isInvalidCategoryError(err)).toBe(true);
    expect((err as InvalidCategoryError).category).toBe("comedy");
    const cursorErr = axiosError(400, "INVALID_CURSOR");
    get.mockRejectedValue(cursorErr as never);
    expect(await fetchExplorePage({ category: "comedy" }).catch((e) => e)).toBe(cursorErr);
    const down = axiosError(503, "FEED_UNAVAILABLE");
    get.mockRejectedValue(down as never);
    expect(await fetchExplorePage({ category: "comedy" }).catch((e) => e)).toBe(down);
  });

  test("a well-formed slug no reel carries is simply empty", async () => {
    spyOn(api, "get").mockResolvedValue(page([]) as never);
    const result = await fetchExplorePage({ category: "unused-slug" });
    expect(result).toEqual({ items: [], nextCursor: undefined, requests: 1 });
  });
});

describe("chips", () => {
  test("arrows step and wrap, Home and End jump, other keys are ignored", () => {
    expect(nextChipIndex(0, "ArrowRight", 4)).toBe(1);
    expect(nextChipIndex(3, "ArrowRight", 4)).toBe(0);
    expect(nextChipIndex(0, "ArrowLeft", 4)).toBe(3);
    expect(nextChipIndex(2, "Home", 4)).toBe(0);
    expect(nextChipIndex(0, "End", 4)).toBe(3);
    expect(nextChipIndex(1, "a", 4)).toBeNull();
    expect(nextChipIndex(0, "ArrowRight", 0)).toBeNull();
  });

  test("All comes first; the selected chip is pressed and is the one tab stop", () => {
    const html = renderToStaticMarkup(
      <CategoryChips categories={[{ slug: "comedy", label: "Comedy" }, { slug: "dance", label: "Dance" }]} value="dance" onChange={() => {}} />,
    );
    expect(html).toContain('role="toolbar"');
    const order = ["all", "comedy", "dance"].map((c) => html.indexOf(`data-chip="${c}"`));
    expect(order[0]).toBeGreaterThan(-1);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(1);
    expect(html).toMatch(/data-chip="dance" aria-pressed="true" tabindex="0"/);
    expect(html).toMatch(/data-chip="all" aria-pressed="false" tabindex="-1"/);
  });
});

describe("tile grid", () => {
  test("each tile is a cover, the creator and the like count, opening the stage on that reel; nothing plays", () => {
    const html = renderToStaticMarkup(<ExploreGrid reels={[toReelItem(reelRow("r1"))!]} />);
    expect(html).toContain('href="/reels?reelId=r1"');
    expect(html).toContain("/v1/media/cover-r1/serve");
    expect(html).toContain("@maker_r1");
    expect(html).toContain("1.2K");
    expect(html).not.toContain("<video");
    expect(html).not.toContain("autoplay");
  });
});

describe("suggested creators", () => {
  const suggestion = (id: string, extra: Partial<SuggestionUser> = {}): SuggestionUser => ({
    user_id: id,
    username: `user_${id}`,
    display_name: `User ${id}`,
    avatar_media_id: `av-${id}`,
    ...extra,
  });

  test("the grid renders one card per suggestion, each with a Follow button", () => {
    const creators = [suggestion("u1"), suggestion("u2", { avatar_media_id: undefined, explain_text: "Popular in Dance" })].map(creatorCard);
    const states: Record<string, FollowState> = { u2: "following" };
    const html = renderToStaticMarkup(
      <SuggestedCreatorsView creators={creators} stateOf={(id) => states[id] ?? "none"} onToggle={() => {}} label="Suggested creators" />,
    );
    expect((html.match(/class="explore-creator"/g) ?? []).length).toBe(2);
    expect(html).toContain('aria-label="Follow User u1"');
    expect(html).toContain('aria-label="Following User u2"');
    expect(html).toContain('data-state="none"');
    expect(html).toContain('href="/u/user_u1"');
    expect(html).toContain("/v1/media/av-u1/serve");
    expect(html).toContain("Popular in Dance");
    // No playing preview on a suggestion card.
    expect(html).not.toContain("<video");
  });

  test("card words: a Go empty explanation falls through to mutuals, then the handle", () => {
    expect(creatorCard(suggestion("u", { explain_text: "", mutual_friend_count: 2 })).reason).toBe("2 mutuals");
    expect(creatorCard(suggestion("u", { explain_text: "", mutual_friend_count: 0 })).reason).toBe("@user_u");
    expect(creatorCard(suggestion("u", { display_name: "", username: "" })).name).toBe("Someone");
    expect(followLabel("none")).toBe("Follow");
    expect(followLabel("requested")).toBe("Requested");
  });

  test("Follow is graph-service: POST /v1/graph/follow { user_id }; Unfollow is POST /v1/graph/unfollow", async () => {
    const id = "6f1c2a8e-1d2b-4c3d-8e9f-0a1b2c3d4e5f";
    const post = spyOn(api, "post").mockResolvedValue({ data: { data: { status: "followed" } } } as never);
    const get = spyOn(api, "get");
    expect(await followUser(id)).toEqual({ status: "followed" });
    expect(post.mock.calls[0][0]).toBe("/v1/graph/follow");
    expect(post.mock.calls[0][1]).toEqual({ user_id: id });
    await unfollowUser(id);
    expect(post.mock.calls[1][0]).toBe("/v1/graph/unfollow");
    expect(post.mock.calls[1][1]).toEqual({ user_id: id });
    // An id needs no username lookup, and nothing touches profile-service's retired routes.
    expect(get.mock.calls.length).toBe(0);
    for (const call of post.mock.calls) expect(String(call[0])).not.toContain("/v1/profiles");
  });
});
