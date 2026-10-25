import { describe, expect, test } from "bun:test";
import { InfiniteQueryObserver, QueryClient } from "@tanstack/react-query";

import {
  PROFILE_POST_SORTS,
  isProfilePostSort,
  nextProfilePostsCursor,
  profilePostsInfiniteOptions,
  profilePostsParams,
  profilePostsQueryKey,
  type ProfilePostSort,
} from "@/lib/profilePostSort";

type Page = { data: string[]; meta?: { next_cursor?: string } };

describe("profile post sort params (T-21)", () => {
  test("only the three server sorts exist", () => {
    expect([...PROFILE_POST_SORTS]).toEqual(["latest", "popular", "oldest"]);
    expect(isProfilePostSort("popular")).toBe(true);
    // post-service answers anything else with 400 INVALID_SORT.
    for (const bad of ["newest", "top", "likes", "recent", "", undefined]) expect(isProfilePostSort(bad)).toBe(false);
  });

  test("the sort travels as ?sort=, the first page has no cursor", () => {
    expect(profilePostsParams({ contentType: "video", sort: "popular" })).toEqual({ limit: "20", type: "video", sort: "popular" });
    expect(profilePostsParams({ contentType: "reel", sort: "oldest", cursor: "c1" })).toEqual({
      limit: "20", type: "reel", sort: "oldest", cursor: "c1",
    });
  });

  test("no sort keeps the pre-T-21 request and key", () => {
    expect(profilePostsParams({ contentType: "all" })).toEqual({ limit: "20" });
    expect(profilePostsQueryKey("u", "video")).toEqual(["profile-posts", "u", "video"]);
  });

  test("each sort is its own query key, so its cursor never crosses to another sort", () => {
    const keys = PROFILE_POST_SORTS.map((s) => JSON.stringify(profilePostsQueryKey("u", "video", s)));
    expect(new Set(keys).size).toBe(3);
  });

  test("next cursor comes from meta.next_cursor; empty means the end", () => {
    expect(nextProfilePostsCursor({ meta: { next_cursor: "abc" } })).toBe("abc");
    expect(nextProfilePostsCursor({ meta: { next_cursor: "" } })).toBeUndefined();
    expect(nextProfilePostsCursor({})).toBeUndefined();
  });
});

describe("paging restarts when the sort changes", () => {
  test("latest pages with its own cursor; switching to popular starts again with no cursor", async () => {
    const calls: Record<string, string>[] = [];
    const get = async (_path: string, params: Record<string, string>): Promise<Page> => {
      calls.push(params);
      const next = params.cursor ? "" : `${params.sort}-cursor-1`;
      return { data: [`${params.sort}-${params.cursor ?? "first"}`], meta: { next_cursor: next } };
    };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const run = async (sort: ProfilePostSort) => {
      const observer = new InfiniteQueryObserver(client, profilePostsInfiniteOptions<Page>("author-1", "video", sort, get));
      const unsubscribe = observer.subscribe(() => {});
      await observer.refetch();
      return { observer, unsubscribe };
    };

    const latest = await run("latest");
    await latest.observer.fetchNextPage();
    latest.unsubscribe();

    const popular = await run("popular");
    popular.unsubscribe();

    expect(calls.map((c) => [c.sort, c.cursor])).toEqual([
      ["latest", undefined],
      ["latest", "latest-cursor-1"],
      // A new sort: first page, no cursor — the latest cursor is never replayed.
      ["popular", undefined],
    ]);
    expect(calls.some((c) => c.sort === "popular" && c.cursor?.startsWith("latest"))).toBe(false);
    client.clear();
  });
});
