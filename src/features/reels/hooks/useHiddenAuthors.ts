"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchHiddenAuthors, sendAuthorFeedback } from "@/features/reels/data/reelFeedApi";
import { REEL_FEED_KEY } from "@/features/reels/hooks/useReelFeed";

export const HIDDEN_AUTHORS_KEY = ["feed", "hidden-authors"] as const;

/** GET /v1/feed/feedback/authors — the channels the viewer asked not to be recommended. */
export function useHiddenAuthors() {
  return useQuery({
    queryKey: HIDDEN_AUTHORS_KEY,
    queryFn: ({ signal }) => fetchHiddenAuthors(signal),
  });
}

/** Reverses "Don't recommend": the positive signal, then every feed refetches. */
export function useShowAuthorAgain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (authorId: string) => {
      await sendAuthorFeedback(authorId, "interested");
      return authorId;
    },
    onSuccess: (authorId) => {
      qc.setQueryData<{ author_id: string; created_at: string }[]>(HIDDEN_AUTHORS_KEY, (old) => old?.filter((h) => h.author_id !== authorId));
      void qc.invalidateQueries({ queryKey: HIDDEN_AUTHORS_KEY });
      void qc.invalidateQueries({ queryKey: REEL_FEED_KEY });
      void qc.invalidateQueries({ queryKey: ["home-feed"] });
      void qc.invalidateQueries({ queryKey: ["tube"] });
    },
  });
}
