"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { getReelsPage } from "@/features/reels/data/reelsApi";

export function useReelsFeed(options?: { enabled?: boolean; pageSize?: number }) {
  return useInfiniteQuery({
    queryKey: ["reels-theater-feed", options?.pageSize ?? 8],
    queryFn: ({ pageParam }) =>
      getReelsPage({
        cursor: pageParam,
        limit: options?.pageSize ?? 8,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    enabled: options?.enabled ?? true,
  });
}
