"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import {
  EXPLORE_PAGE_SIZE,
  fetchExplorePage,
  fetchShortCategories,
  isInvalidCategoryError,
} from "@/features/reels/explore/exploreApi";

export const EXPLORE_FEED_KEY = ["reels", "explore"] as const;

/** The chips. Static on the server, so cached for the session. */
export function useShortCategories() {
  return useQuery({
    queryKey: ["posts", "categories", "short"],
    queryFn: ({ signal }) => fetchShortCategories(signal),
    staleTime: 30 * 60_000,
  });
}

/** The grid for one chip. A malformed category is not retried: it will not get better. */
export function useExploreFeed(category: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: [...EXPLORE_FEED_KEY, { category }],
    queryFn: ({ pageParam, signal }) =>
      fetchExplorePage({ category, cursor: pageParam, limit: EXPLORE_PAGE_SIZE, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: (count, err) => !isInvalidCategoryError(err) && count < 2,
  });
}
