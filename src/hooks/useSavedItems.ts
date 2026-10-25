"use client"

import { useInfiniteQuery, useQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query"
import api from "@/lib/api"
import {
    SAVED_COLLECTIONS_PATH,
    SAVED_ITEMS_PATH,
    applyDeleteToCounts,
    applyMoveToCounts,
    applyMoveToPages,
    createCollectionRequest,
    deleteCollectionRequest,
    moveSavedItemRequest,
    parseDeletedCollection,
    parseSavedCollection,
    parseSavedCollections,
    parseSavedItem,
    parseSavedItemsPage,
    renameCollectionRequest,
    saveToCollectionRequest,
    savedItemsParams,
    type ApiRequest,
    type SavedCollectionView,
    type SavedItemsPage,
    type SavedItemView,
    type SavedTab,
} from "@/features/saved/savedCollections"

/*
  Saved items and collections (post-service saved_collections_handler.go).
  Every shape goes through the decoders in features/saved/savedCollections.ts;
  the pages never read a raw response.
*/

export const SAVED_COLLECTIONS_KEY = ["saved-collections"] as const
export const savedItemsKey = (tab: SavedTab) => ["saved-items", tab] as const

function send(req: ApiRequest) {
    switch (req.method) {
        case "post":
            return api.post(req.url, req.body)
        case "put":
            return api.put(req.url, req.body)
        case "patch":
            return api.patch(req.url, req.body)
        case "delete":
            return api.delete(req.url)
        default:
            return api.get(req.url, { params: req.params })
    }
}

export function useSavedItems(tab: SavedTab, enabled = true) {
    return useInfiniteQuery({
        queryKey: savedItemsKey(tab),
        queryFn: async ({ pageParam }) => {
            const res = await api.get(SAVED_ITEMS_PATH, { params: savedItemsParams(tab, pageParam as string) })
            return parseSavedItemsPage(res.data)
        },
        initialPageParam: "" as string,
        getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
        enabled,
    })
}

export function useCollections(enabled = true) {
    return useQuery<SavedCollectionView[]>({
        queryKey: SAVED_COLLECTIONS_KEY,
        queryFn: async () => {
            const res = await api.get(SAVED_COLLECTIONS_PATH)
            return parseSavedCollections(res.data)
        },
        enabled,
    })
}

function useInvalidateSaved() {
    const qc = useQueryClient()
    return () => {
        void qc.invalidateQueries({ queryKey: ["saved-items"] })
        void qc.invalidateQueries({ queryKey: SAVED_COLLECTIONS_KEY })
    }
}

export function useUnsaveItem() {
    const invalidate = useInvalidateSaved()
    return useMutation({
        mutationFn: async (savedId: string) => {
            await api.delete(`${SAVED_ITEMS_PATH}/${encodeURIComponent(savedId)}`)
        },
        onSuccess: invalidate,
    })
}

export function useCreateCollection() {
    const qc = useQueryClient()
    return useMutation<SavedCollectionView, unknown, string>({
        mutationFn: async (name) => {
            const res = await send(createCollectionRequest(name))
            const created = parseSavedCollection((res.data as { data?: unknown })?.data)
            if (!created || created.isDefault) throw new Error("The server did not return the new collection.")
            return created
        },
        onSuccess: (created) => {
            qc.setQueryData<SavedCollectionView[]>(SAVED_COLLECTIONS_KEY, (old) =>
                old && !old.some((c) => c.id === created.id) ? [...old, created] : old,
            )
            void qc.invalidateQueries({ queryKey: SAVED_COLLECTIONS_KEY })
        },
    })
}

export function useRenameCollection() {
    const qc = useQueryClient()
    return useMutation<SavedCollectionView, unknown, { id: string; name: string }>({
        mutationFn: async ({ id, name }) => {
            const res = await send(renameCollectionRequest(id, name))
            const renamed = parseSavedCollection((res.data as { data?: unknown })?.data)
            if (!renamed || renamed.isDefault) throw new Error("The server did not return the renamed collection.")
            return renamed
        },
        onSuccess: (renamed) => {
            // The server's name (trimmed, spaces folded), not what was typed.
            qc.setQueryData<SavedCollectionView[]>(SAVED_COLLECTIONS_KEY, (old) =>
                old?.map((c) => (c.id === renamed.id ? { ...c, name: renamed.name } : c)),
            )
            void qc.invalidateQueries({ queryKey: SAVED_COLLECTIONS_KEY })
        },
    })
}

export function useDeleteCollection() {
    const qc = useQueryClient()
    return useMutation<{ movedToDefault: number }, unknown, string>({
        mutationFn: async (id) => {
            const res = await send(deleteCollectionRequest(id))
            return parseDeletedCollection(res.data)
        },
        onSuccess: ({ movedToDefault }, id) => {
            qc.setQueryData<SavedCollectionView[]>(SAVED_COLLECTIONS_KEY, (old) =>
                old ? applyDeleteToCounts(old, id, movedToDefault) : old,
            )
            qc.removeQueries({ queryKey: savedItemsKey(id) })
            void qc.invalidateQueries({ queryKey: ["saved-items"] })
            void qc.invalidateQueries({ queryKey: SAVED_COLLECTIONS_KEY })
        },
    })
}

export interface MoveSavedItemVars {
    item: SavedItemView
    toCollectionId: string | null
    /** The tab the item is listed on, whose list is updated straight away. */
    tab: SavedTab
}

export function useMoveSavedItem() {
    const qc = useQueryClient()
    return useMutation<SavedItemView | null, unknown, MoveSavedItemVars>({
        mutationFn: async ({ item, toCollectionId }) => {
            const res = await send(moveSavedItemRequest(item.id, toCollectionId))
            return parseSavedItem((res.data as { data?: unknown })?.data)
        },
        onSuccess: (moved, { item, toCollectionId, tab }) => {
            const to = moved ? moved.collectionId : toCollectionId
            qc.setQueryData<InfiniteData<SavedItemsPage>>(savedItemsKey(tab), (old) =>
                old ? { ...old, pages: applyMoveToPages(old.pages, item.id, to, tab) } : old,
            )
            qc.setQueryData<SavedCollectionView[]>(SAVED_COLLECTIONS_KEY, (old) =>
                old ? applyMoveToCounts(old, item.collectionId, to) : old,
            )
            // The other tabs and the server's counts catch up behind it.
            void qc.invalidateQueries({ queryKey: ["saved-items"], predicate: (q) => q.queryKey[1] !== tab })
            void qc.invalidateQueries({ queryKey: SAVED_COLLECTIONS_KEY })
        },
    })
}

export interface SavePostVars {
    postId: string
    toCollectionId: string | null
    alreadySaved: boolean
}

/**
 * Save a post into a collection from a card (replaces the unused
 * useSaveItem, which wrote POST /v1/saved by collection NAME and so missed
 * the bookmark route's feed refresh).
 */
export function useSavePostToCollection() {
    const qc = useQueryClient()
    return useMutation<void, unknown, SavePostVars>({
        mutationFn: async ({ postId, toCollectionId, alreadySaved }) => {
            await send(saveToCollectionRequest(postId, toCollectionId, alreadySaved))
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["saved-items"] })
            void qc.invalidateQueries({ queryKey: SAVED_COLLECTIONS_KEY })
        },
    })
}
