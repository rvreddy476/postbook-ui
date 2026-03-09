"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { getCommentsPage } from "@/features/reels/data/reelsApi";

export function reelCommentsQueryKey(reelId: string | undefined) {
  return ["reels-theater-comments", reelId] as const;
}

export function useReelComments(
  reelId: string | undefined,
  options?: { enabled?: boolean; pageSize?: number }
) {
  return useInfiniteQuery({
    queryKey: reelCommentsQueryKey(reelId),
    queryFn: ({ pageParam }) =>
      getCommentsPage({
        reelId: reelId ?? "",
        cursor: pageParam,
        limit: options?.pageSize ?? 40,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    enabled: Boolean(reelId) && (options?.enabled ?? true),
  });
}
