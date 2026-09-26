"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  recordShare,
  sendAuthorFeedback,
  sendPostFeedback,
  setLike,
  setSaved,
} from "@/features/reels/data/reelFeedApi";
import { patchReelEverywhere, removeReelEverywhere } from "@/features/reels/hooks/useReelFeed";
import type { ReelItem } from "@/features/reels/model";

/*
  Engagement writes for the stage. Each one patches the feed cache first
  (the rail must answer the tap instantly) and rolls back on failure. The
  cache is the single source of truth for what the rail shows, so a reel
  liked here reads as liked after any re-render, and after a refetch the
  server's flag replaces the optimistic one.
*/

export function useLikeReel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reel, liked }: { reel: ReelItem; liked: boolean }) => {
      await setLike(reel.id, liked);
    },
    onMutate: ({ reel, liked }) => {
      patchReelEverywhere(qc, reel.id, (item) => ({
        viewerLiked: liked,
        likeCount: Math.max(0, item.likeCount + (liked ? 1 : -1) * (item.viewerLiked === liked ? 0 : 1)),
      }));
      return { reel };
    },
    onError: (_err, { reel }) => {
      patchReelEverywhere(qc, reel.id, { viewerLiked: reel.viewerLiked, likeCount: reel.likeCount });
    },
  });
}

export function useSaveReel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reel, saved }: { reel: ReelItem; saved: boolean }) => {
      await setSaved(reel.id, saved);
    },
    onMutate: ({ reel, saved }) => {
      patchReelEverywhere(qc, reel.id, { viewerSaved: saved });
    },
    onError: (_err, { reel }) => {
      patchReelEverywhere(qc, reel.id, { viewerSaved: reel.viewerSaved });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-items"], refetchType: "none" });
    },
  });
}

export function useShareReel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reel: ReelItem) => recordShare(reel.id),
    onSuccess: (count, reel) => {
      patchReelEverywhere(qc, reel.id, (item) => ({
        shareCount: typeof count === "number" ? count : item.shareCount + 1,
      }));
    },
  });
}

/** "Not interested": the reel leaves the feed at once; the signal follows. */
export function useNotInterested() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reel: ReelItem) => {
      await sendPostFeedback(reel.id, "not_interested");
    },
    onMutate: (reel) => {
      removeReelEverywhere(qc, reel.id);
    },
  });
}

/** "Don't recommend @author": waits for the server, then hides their reels. */
export function useDontRecommendAuthor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reel: ReelItem) => {
      await sendAuthorFeedback(reel.authorId, "not_interested");
      return reel.authorId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reels", "feed"] });
    },
  });
}
