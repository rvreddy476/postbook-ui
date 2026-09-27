"use client";

import { useQuery } from "@tanstack/react-query";

import api from "@/lib/api";
import { fetchPostsBatch } from "@/features/reels/data/reelFeedApi";
import { likedReelsToItems } from "@/features/reels/liked";
import { REEL_SEARCH_LIMIT, reelSearchIds } from "@/features/reels/search";
import type { ReelItem } from "@/features/reels/model";

interface SearchPostsResponse {
  data?: { items?: Array<{ id?: string; post_id?: string; content_type?: string; post_type?: string }> } | null;
}

/**
 * GET /v1/search/posts?q=&type=flicks — reels only — then the full rows
 * through POST /v1/posts/batch (the search rows carry no cover), kept in
 * rank order. Same batch mapper the liked page uses.
 */
export function useReelSearch(query: string) {
  const q = query.trim();
  return useQuery<ReelItem[]>({
    queryKey: ["reels", "search", q],
    enabled: q.length > 0,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const res = await api.get<SearchPostsResponse>("/v1/search/posts", { params: { q, type: "flicks", limit: REEL_SEARCH_LIMIT }, signal });
      const ids = reelSearchIds(res.data?.data?.items);
      if (ids.length === 0) return [];
      const batch = await fetchPostsBatch(ids, signal);
      return likedReelsToItems(ids, batch);
    },
  });
}
