"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuthUser } from "@/store/auth";

import {
  fetchCollectionItems,
  fetchSystemCollection,
  queuePost,
  unqueuePost,
  type Collection,
  type CollectionItem,
} from "../libraryApi";
import { LIBRARY_KEYS } from "./useCollection";

/*
  useQueue(): the viewer's Queue (system playlist `watch_later`) as a
  membership test plus an optimistic toggle. The watch page's rail calls
  `toggle(postId, post.viewer_queued)`; the rows here call `queued(postId)`.

  Optimism lives in a tiny module store shared by every mount (the rail and
  a row must agree the instant one of them toggles), then the items cache
  is patched and refetched. On failure the override is dropped, which is
  the rollback.

  Requests: GET /v1/playlists/system/watch_later (creates on first read),
  GET /v1/playlists/:id/items, POST|DELETE /v1/posts/:id/watch-later.
*/

const overrides = new Map<string, boolean>();
const listeners = new Set<() => void>();
let version = 0;

function setOverride(postId: string, value: boolean | null) {
  if (value === null) overrides.delete(postId);
  else overrides.set(postId, value);
  version += 1;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function snapshot() {
  return version;
}

function serverSnapshot() {
  return 0;
}

export interface QueueApi {
  /** Signed in: the toggle can be used. */
  canQueue: boolean;
  /** The Queue playlist id, once known (the watch page can link `?list=` with it). */
  queueId: string | null;
  loaded: boolean;
  /** `hint` is the post detail's `viewer_queued`, used until the list itself has loaded. */
  queued: (postId: string, hint?: boolean | null) => boolean;
  toggle: (postId: string, hint?: boolean | null) => Promise<boolean>;
  add: (postId: string) => Promise<boolean>;
  removeFromQueue: (postId: string) => Promise<boolean>;
  pending: boolean;
}

export function useQueue(): QueueApi {
  const user = useAuthUser();
  const qc = useQueryClient();
  const signedIn = !!user;
  useSyncExternalStore(subscribe, snapshot, serverSnapshot);

  const system = useQuery<Collection>({
    queryKey: LIBRARY_KEYS.system("watch_later"),
    queryFn: () => fetchSystemCollection("watch_later"),
    enabled: signedIn,
    staleTime: 60_000,
  });
  const queueId = system.data?.id ?? null;

  const items = useQuery<CollectionItem[]>({
    queryKey: LIBRARY_KEYS.items(queueId ?? undefined),
    queryFn: () => fetchCollectionItems(queueId!),
    enabled: !!queueId,
    staleTime: 30_000,
  });

  const queued = useCallback(
    (postId: string, hint?: boolean | null) => {
      const o = overrides.get(postId);
      if (o !== undefined) return o;
      if (items.data) return items.data.some((r) => r.postId === postId);
      return !!hint;
    },
    [items.data],
  );

  const mutation = useMutation({
    mutationFn: async ({ postId, next }: { postId: string; next: boolean }) => {
      if (next) await queuePost(postId);
      else await unqueuePost(postId);
      return next;
    },
    onSuccess: (next, { postId }) => {
      if (queueId) {
        qc.setQueryData<CollectionItem[]>(LIBRARY_KEYS.items(queueId), (current) => {
          const rows = current ?? [];
          if (next) {
            if (rows.some((r) => r.postId === postId)) return rows;
            return [...rows, { playlistId: queueId, postId, position: rows.length, post: null }];
          }
          return rows.filter((r) => r.postId !== postId).map((r, i) => ({ ...r, position: i }));
        });
      }
      setOverride(postId, null);
      qc.invalidateQueries({ queryKey: LIBRARY_KEYS.items(queueId ?? undefined) });
      qc.invalidateQueries({ queryKey: LIBRARY_KEYS.system("watch_later") });
      qc.invalidateQueries({ queryKey: ["posttube", "playlists"] });
      if (queueId) qc.invalidateQueries({ queryKey: ["posttube", "playlist-items", queueId] });
    },
    onError: (_err, { postId }) => {
      setOverride(postId, null);
    },
  });

  const set = useCallback(
    async (postId: string, next: boolean) => {
      if (!signedIn) return false;
      setOverride(postId, next);
      try {
        await mutation.mutateAsync({ postId, next });
        return true;
      } catch {
        return false;
      }
    },
    [signedIn, mutation],
  );

  const toggle = useCallback((postId: string, hint?: boolean | null) => set(postId, !queued(postId, hint)), [set, queued]);

  return {
    canQueue: signedIn,
    queueId,
    loaded: !!items.data,
    queued,
    toggle,
    add: (postId: string) => set(postId, true),
    removeFromQueue: (postId: string) => set(postId, false),
    pending: mutation.isPending,
  };
}

/*
  useLovedIds(): the ids in the viewer's Loved list (system playlist
  `liked`). Cheap: one playlist read and one items read, both cached. The
  like button itself stays on POST/DELETE /v1/posts/:id/like — the server
  mirrors likes into this list, so after a like the caller invalidates
  `LIBRARY_KEYS.items(lovedId)` (or waits for the 30 s stale window).
*/
export function useLovedIds(): { canLove: boolean; lovedId: string | null; loaded: boolean; loved: (postId: string) => boolean; ids: Set<string>; invalidate: () => void } {
  const user = useAuthUser();
  const qc = useQueryClient();
  const signedIn = !!user;

  const system = useQuery<Collection>({
    queryKey: LIBRARY_KEYS.system("liked"),
    queryFn: () => fetchSystemCollection("liked"),
    enabled: signedIn,
    staleTime: 60_000,
  });
  const lovedId = system.data?.id ?? null;

  const items = useQuery<CollectionItem[]>({
    queryKey: LIBRARY_KEYS.items(lovedId ?? undefined),
    queryFn: () => fetchCollectionItems(lovedId!),
    enabled: !!lovedId,
    staleTime: 30_000,
  });

  const ids = new Set((items.data ?? []).map((r) => r.postId));
  return {
    canLove: signedIn,
    lovedId,
    loaded: !!items.data,
    loved: (postId: string) => ids.has(postId),
    ids,
    invalidate: () => {
      qc.invalidateQueries({ queryKey: LIBRARY_KEYS.items(lovedId ?? undefined) });
      qc.invalidateQueries({ queryKey: LIBRARY_KEYS.system("liked") });
    },
  };
}
