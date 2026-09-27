"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuthUser } from "@/store/auth";

import {
  deleteCollection,
  fetchCollection,
  fetchCollectionItems,
  fetchSystemCollection,
  isSystemPlaylistRefusal,
  moveCollectionItem,
  patchCollection,
  removeCollectionItem,
  type Collection,
  type CollectionItem,
  type CollectionPatch,
  type SystemCollectionKind,
} from "../libraryApi";
import { planMove, reconcileOrder } from "../reorder";

/*
  One hook for every collection page: a user collection by id, or a system
  one (Queue = watch_later, Loved = liked) by kind. The system read creates
  the list on first call, so a signed-in viewer always gets a row back.

  Cache keys are the library's own (`posttube/library/*`): the rows here are
  normalised, so they must not share a key with the older `PlaylistItem`
  shape in hooks/usePosttubeExtras. Writes invalidate both families.
*/

export type CollectionSource = { kind: "system"; system: SystemCollectionKind } | { kind: "user"; id: string };

export const LIBRARY_KEYS = {
  system: (kind: SystemCollectionKind) => ["posttube", "library", "system", kind] as const,
  collection: (id?: string) => ["posttube", "library", "collection", id] as const,
  items: (id?: string) => ["posttube", "library", "items", id] as const,
  mine: (userId?: string) => ["posttube", "playlists", "library", userId] as const,
};

export type CollectionStatus = "signed-out" | "loading" | "error" | "missing" | "ready";

export interface CollectionState {
  status: CollectionStatus;
  collection: Collection | null;
  items: CollectionItem[];
  itemsLoading: boolean;
  itemsError: boolean;
  /** The signed-in viewer owns this list (system lists are always the viewer's). */
  isOwner: boolean;
  isSystem: boolean;
  error: string | null;
  refetch: () => void;
  move: (postId: string, toIndex: number) => void;
  moveBy: (postId: string, delta: number) => void;
  remove: (postId: string) => void;
  patch: (patch: CollectionPatch) => Promise<Collection | null>;
  destroy: () => Promise<boolean>;
  pending: { move: boolean; remove: string | null; patch: boolean; destroy: boolean };
}

function invalidateLegacy(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: ["posttube", "playlists"] });
  qc.invalidateQueries({ queryKey: ["posttube", "playlist", id] });
  qc.invalidateQueries({ queryKey: ["posttube", "playlist-items", id] });
}

export function useCollection(source: CollectionSource): CollectionState {
  const user = useAuthUser();
  const qc = useQueryClient();
  const signedIn = !!user;
  const [error, setError] = useState<string | null>(null);

  const systemQuery = useQuery<Collection>({
    queryKey: source.kind === "system" ? LIBRARY_KEYS.system(source.system) : LIBRARY_KEYS.system("watch_later"),
    queryFn: () => fetchSystemCollection(source.kind === "system" ? source.system : "watch_later"),
    enabled: source.kind === "system" && signedIn,
    staleTime: 60_000,
  });

  const userQuery = useQuery<Collection | null>({
    queryKey: LIBRARY_KEYS.collection(source.kind === "user" ? source.id : undefined),
    queryFn: () => fetchCollection(source.kind === "user" ? source.id : ""),
    enabled: source.kind === "user" && !!source.id,
    staleTime: 15_000,
  });

  const collection: Collection | null = source.kind === "system" ? (systemQuery.data ?? null) : (userQuery.data ?? null);
  const collectionId = collection?.id;

  const itemsQuery = useQuery<CollectionItem[]>({
    queryKey: LIBRARY_KEYS.items(collectionId),
    queryFn: () => fetchCollectionItems(collectionId!),
    enabled: !!collectionId,
    staleTime: 0,
  });

  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);

  const status: CollectionStatus = (() => {
    if (source.kind === "system") {
      if (!signedIn) return "signed-out";
      if (systemQuery.isPending) return "loading";
      if (systemQuery.isError) return "error";
      return "ready";
    }
    if (userQuery.isPending) return "loading";
    if (userQuery.isError) return "error";
    if (!userQuery.data) return "missing";
    return "ready";
  })();

  const isSystem = collection ? collection.kind !== "user" : source.kind === "system";
  const isOwner = !!collection && signedIn && (isSystem || collection.creatorId === user?.id);

  // ── Move (optimistic, rollback on failure) ──────────────────────────
  const inFlight = useRef(0);
  const moveMutation = useMutation({
    mutationFn: ({ postId, position }: { postId: string; position: number; rollback: CollectionItem[] }) =>
      moveCollectionItem(collectionId!, postId, position),
    onMutate: async ({ rollback }) => {
      inFlight.current += 1;
      await qc.cancelQueries({ queryKey: LIBRARY_KEYS.items(collectionId) });
      return { rollback };
    },
    onSuccess: (serverOrder) => {
      qc.setQueryData<CollectionItem[]>(LIBRARY_KEYS.items(collectionId), (current) => reconcileOrder(serverOrder, current ?? []));
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.rollback && inFlight.current <= 1) qc.setQueryData(LIBRARY_KEYS.items(collectionId), ctx.rollback);
      setError("The order could not be saved.");
    },
    onSettled: () => {
      inFlight.current = Math.max(0, inFlight.current - 1);
      if (inFlight.current === 0) {
        qc.invalidateQueries({ queryKey: LIBRARY_KEYS.items(collectionId) });
        if (collectionId) invalidateLegacy(qc, collectionId);
      }
    },
  });

  const move = useCallback(
    (postId: string, toIndex: number) => {
      if (!collectionId) return;
      const current = qc.getQueryData<CollectionItem[]>(LIBRARY_KEYS.items(collectionId)) ?? [];
      const plan = planMove(current, postId, toIndex);
      if (!plan) return;
      setError(null);
      qc.setQueryData(LIBRARY_KEYS.items(collectionId), plan.optimistic);
      moveMutation.mutate({ postId, position: plan.position, rollback: plan.rollback });
    },
    [collectionId, qc, moveMutation],
  );

  const moveBy = useCallback(
    (postId: string, delta: number) => {
      if (!collectionId) return;
      const current = qc.getQueryData<CollectionItem[]>(LIBRARY_KEYS.items(collectionId)) ?? [];
      const from = current.findIndex((r) => r.postId === postId);
      if (from < 0) return;
      move(postId, from + delta);
    },
    [collectionId, qc, move],
  );

  // ── Remove ──────────────────────────────────────────────────────────
  const [removing, setRemoving] = useState<string | null>(null);
  const removeMutation = useMutation({
    mutationFn: (postId: string) => removeCollectionItem(collectionId!, postId),
    onMutate: async (postId) => {
      await qc.cancelQueries({ queryKey: LIBRARY_KEYS.items(collectionId) });
      const rollback = qc.getQueryData<CollectionItem[]>(LIBRARY_KEYS.items(collectionId)) ?? [];
      qc.setQueryData<CollectionItem[]>(
        LIBRARY_KEYS.items(collectionId),
        rollback.filter((r) => r.postId !== postId).map((r, i) => ({ ...r, position: i })),
      );
      return { rollback };
    },
    onError: (_err, _postId, ctx) => {
      if (ctx?.rollback) qc.setQueryData(LIBRARY_KEYS.items(collectionId), ctx.rollback);
      setError("The video could not be removed.");
    },
    onSettled: () => {
      setRemoving(null);
      qc.invalidateQueries({ queryKey: LIBRARY_KEYS.items(collectionId) });
      if (source.kind === "system") qc.invalidateQueries({ queryKey: LIBRARY_KEYS.system(source.system) });
      else qc.invalidateQueries({ queryKey: LIBRARY_KEYS.collection(source.id) });
      if (collectionId) invalidateLegacy(qc, collectionId);
    },
  });

  const remove = useCallback(
    (postId: string) => {
      if (!collectionId) return;
      setError(null);
      setRemoving(postId);
      removeMutation.mutate(postId);
    },
    [collectionId, removeMutation],
  );

  // ── Patch / delete (user collections only; the server refuses system ones) ──
  const patchMutation = useMutation({
    mutationFn: (patch: CollectionPatch) => patchCollection(collectionId!, patch),
    onSuccess: (updated) => {
      qc.setQueryData(LIBRARY_KEYS.collection(updated.id), updated);
      qc.invalidateQueries({ queryKey: ["posttube", "playlists"] });
      qc.invalidateQueries({ queryKey: ["posttube", "playlist", updated.id] });
    },
  });

  const patch = useCallback(
    async (p: CollectionPatch) => {
      if (!collectionId || isSystem) return null;
      setError(null);
      try {
        return await patchMutation.mutateAsync(p);
      } catch (err) {
        setError(isSystemPlaylistRefusal(err) ? "This list cannot be changed." : "The changes could not be saved.");
        return null;
      }
    },
    [collectionId, isSystem, patchMutation],
  );

  const destroyMutation = useMutation({
    mutationFn: () => deleteCollection(collectionId!),
    onSuccess: () => {
      qc.removeQueries({ queryKey: LIBRARY_KEYS.collection(collectionId) });
      qc.removeQueries({ queryKey: LIBRARY_KEYS.items(collectionId) });
      qc.invalidateQueries({ queryKey: ["posttube", "playlists"] });
    },
  });

  const destroy = useCallback(async () => {
    if (!collectionId || isSystem) return false;
    setError(null);
    try {
      await destroyMutation.mutateAsync();
      return true;
    } catch (err) {
      setError(isSystemPlaylistRefusal(err) ? "This list cannot be deleted." : "The collection could not be deleted.");
      return false;
    }
  }, [collectionId, isSystem, destroyMutation]);

  const refetch = useCallback(() => {
    setError(null);
    if (source.kind === "system") void systemQuery.refetch();
    else void userQuery.refetch();
    if (collectionId) void itemsQuery.refetch();
  }, [source.kind, systemQuery, userQuery, itemsQuery, collectionId]);

  return {
    status,
    collection,
    items,
    itemsLoading: !!collectionId && itemsQuery.isPending,
    itemsError: itemsQuery.isError,
    isOwner,
    isSystem,
    error,
    refetch,
    move,
    moveBy,
    remove,
    patch,
    destroy,
    pending: {
      move: moveMutation.isPending,
      remove: removing,
      patch: patchMutation.isPending,
      destroy: destroyMutation.isPending,
    },
  };
}
