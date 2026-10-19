"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import api from "@/lib/api";
import { patchPostEverywhere, withSaved } from "./patchPost";

/*
  Save / unsave from the stage: the same POST /v1/posts/:id/bookmark toggle
  useToggleBookmark sends, but the result is written into every cached copy
  of the post (patchPost.ts) instead of invalidating the home feed. An
  invalidation refetches every loaded page of a ranked feed, and the posts
  can come back in a different order under the viewer's thumb. Only the
  saved list is refetched, since it changes membership.
*/
export function useStageSave(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["stage-save", postId],
    retry: false,
    mutationFn: async (next: boolean) => {
      const res = await api.post<{ data?: { bookmarked?: boolean } }>(`/v1/posts/${postId}/bookmark`);
      const saved = res.data?.data?.bookmarked;
      return typeof saved === "boolean" ? saved : next;
    },
    onMutate: (next) => {
      patchPostEverywhere(qc, postId, (post) => withSaved(post, next));
    },
    onSuccess: (saved) => {
      // The server is a toggle: if it disagrees with what was drawn, it wins.
      patchPostEverywhere(qc, postId, (post) => withSaved(post, saved));
      void qc.invalidateQueries({ queryKey: ["saved-posts"] });
    },
    onError: (_err, next) => {
      patchPostEverywhere(qc, postId, (post) => withSaved(post, !next));
    },
  });
}
