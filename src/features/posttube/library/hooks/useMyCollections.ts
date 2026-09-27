"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuthUser } from "@/store/auth";

import { fetchCreatorCollections, type Collection } from "../libraryApi";
import { LIBRARY_KEYS } from "./useCollection";

/*
  The viewer's own collections for /posttube/playlists. System lists
  (Queue, Loved) are filtered out if the creator listing ever returns them:
  they have their own pages and must never look like a user collection.

  GET /v1/creators/:me/playlists. Creation stays on the existing
  useCreatePlaylist (hooks/usePosttubeExtras), whose invalidation of
  ["posttube", "playlists"] covers this key too.
*/

export function useMyCollections() {
  const user = useAuthUser();
  return useQuery<Collection[]>({
    queryKey: LIBRARY_KEYS.mine(user?.id),
    queryFn: async () => (await fetchCreatorCollections(user!.id)).filter((c) => c.kind === "user"),
    enabled: !!user?.id,
    staleTime: 15_000,
  });
}
