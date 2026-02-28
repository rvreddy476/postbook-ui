"use client"

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { SavedItem, SavedCollection } from "@/types/profile"

interface SavedItemsResponse {
    data: SavedItem[]
    meta?: { next_cursor: string }
}

export function useSavedItems(collectionName?: string) {
    return useInfiniteQuery({
        queryKey: ["saved-items", collectionName],
        queryFn: async ({ pageParam }) => {
            const params: Record<string, string> = { limit: "20" }
            if (collectionName) params.collection = collectionName
            if (pageParam) params.cursor = pageParam as string
            const res = await api.get<SavedItemsResponse>("/v1/saved", { params })
            return res.data
        },
        initialPageParam: "" as string,
        getNextPageParam: (lastPage) => lastPage.meta?.next_cursor || undefined,
    })
}

export function useSaveItem() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (payload: { target_type: string; target_id: string; collection_name?: string }) => {
            const res = await api.post<{ data: SavedItem }>("/v1/saved", payload)
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["saved-items"] })
            qc.invalidateQueries({ queryKey: ["saved-collections"] })
        },
    })
}

export function useUnsaveItem() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (savedId: string) => {
            await api.delete(`/v1/saved/${savedId}`)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["saved-items"] })
            qc.invalidateQueries({ queryKey: ["saved-collections"] })
        },
    })
}

export function useCollections() {
    return useQuery({
        queryKey: ["saved-collections"],
        queryFn: async () => {
            const res = await api.get<{ data: SavedCollection[] }>("/v1/saved/collections")
            return res.data.data ?? []
        },
    })
}
