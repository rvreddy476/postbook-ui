"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useGlobalToast } from "@/contexts/ToastContext";
import { readSessionUserId } from "@/features/reels/session";
import { useBatchRelationships } from "@/hooks/useConnections";
import { useFollowUser } from "@/hooks/useEditProfile";

/*
  Whether the viewer follows each author on screen, and Follow from the
  rail. The same batch relationship read and follow mutation the reels
  stage uses. `following` is undefined while it is unknown (signed out, or
  the read has not answered), and the rail shows no Follow control then.
*/
export function useAuthorFollow(authorIds: string[]) {
  const qc = useQueryClient();
  const toast = useGlobalToast();
  const [viewerId, setViewerId] = useState("");
  useEffect(() => setViewerId(readSessionUserId()), []);
  const relationships = useBatchRelationships(viewerId, viewerId ? authorIds : []);
  const followMut = useFollowUser();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const followingOf = useCallback(
    (authorId: string): boolean | undefined => {
      if (!viewerId || authorId === viewerId) return undefined;
      return relationships.data?.get(authorId)?.following;
    },
    [relationships.data, viewerId],
  );

  const follow = useCallback(
    async (authorId: string, name: string) => {
      setPendingId(authorId);
      try {
        await followMut.mutateAsync(authorId);
        await qc.invalidateQueries({ queryKey: ["relationships", "batch"] });
      } catch {
        toast({ type: "error", title: `Could not follow ${name}` });
      } finally {
        setPendingId(null);
      }
    },
    [followMut, qc, toast],
  );

  return { viewerId, followingOf, follow, pendingId };
}
