"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { subscribeToPostUpdates } from "@/services/messageService";
import { patchPostEverywhere } from "@/features/post-stage/data/patchPost";

/*
  Live counts: the hub pushes likes / comments / shares as they change and
  the numbers move in place on every cached copy of the post. Counts only —
  nothing is inserted or reordered while the viewer is watching.
*/
export function usePostCountUpdates(): void {
  const qc = useQueryClient();
  useEffect(
    () =>
      subscribeToPostUpdates((update) => {
        patchPostEverywhere(qc, update.post_id, (post) => ({
          ...post,
          counts: {
            ...post.counts,
            likes: update.likes ?? post.counts?.likes ?? 0,
            comments: update.comments ?? post.counts?.comments ?? 0,
            shares: update.shares ?? post.counts?.shares ?? 0,
          },
        }));
        if (update.update_type === "comment") void qc.invalidateQueries({ queryKey: ["comments", update.post_id] });
      }),
    [qc],
  );
}
