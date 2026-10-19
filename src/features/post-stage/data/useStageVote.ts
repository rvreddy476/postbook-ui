"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import api from "@/lib/api";

/*
  A poll vote from the stage: the same POST /v1/posts/:id/vote as
  useCastVote, refreshing only the poll itself. useCastVote also
  invalidates the home feed, and refetching a ranked feed can reorder the
  posts under the viewer.
*/
export function useStageVote(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (optionId: string) => {
      await api.post(`/v1/posts/${postId}/vote`, { option_id: optionId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["poll", postId] }),
  });
}
