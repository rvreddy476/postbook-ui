"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchLikedReelIds, fetchPostsBatch } from "@/features/reels/data/reelFeedApi";
import { likedReelsToItems } from "@/features/reels/liked";
import type { ReelItem } from "@/features/reels/model";

export const LIKED_REELS_KEY = ["reels", "liked"] as const;

/** The reels the viewer liked, newest first: ids from post-service, rows from the batch route. */
export function useLikedReels(limit = 60, enabled = true) {
  return useQuery<ReelItem[]>({
    queryKey: [...LIKED_REELS_KEY, limit],
    queryFn: async ({ signal }) => {
      const ids = await fetchLikedReelIds(limit, signal);
      if (ids.length === 0) return [];
      const batch = await fetchPostsBatch(ids, signal);
      return likedReelsToItems(ids, batch);
    },
    enabled,
    staleTime: 30_000,
  });
}
