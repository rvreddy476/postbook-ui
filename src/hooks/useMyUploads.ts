"use client"

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { UploadDetail, UploadCounts } from "@/types/profile"

interface UploadsResponse {
    data: UploadDetail[]
    meta?: { next_cursor?: string }
}

export function useMyVideos(limit = 20) {
    return useInfiniteQuery({
        queryKey: ["my-uploads", "videos"],
        queryFn: async ({ pageParam }) => {
            const params: Record<string, string> = { limit: String(limit) }
            if (pageParam) params.cursor = pageParam as string
            const res = await api.get<UploadsResponse>("/v1/uploads/videos", { params })
            return res.data
        },
        initialPageParam: "" as string,
        getNextPageParam: (lastPage) => lastPage.meta?.next_cursor || undefined,
    })
}

export function useMyFlicks(limit = 20) {
    return useInfiniteQuery({
        queryKey: ["my-uploads", "flicks"],
        queryFn: async ({ pageParam }) => {
            const params: Record<string, string> = { limit: String(limit) }
            if (pageParam) params.cursor = pageParam as string
            const res = await api.get<UploadsResponse>("/v1/uploads/flicks", { params })
            return res.data
        },
        initialPageParam: "" as string,
        getNextPageParam: (lastPage) => lastPage.meta?.next_cursor || undefined,
    })
}

export function useMyPosts(limit = 20) {
    return useInfiniteQuery({
        queryKey: ["my-uploads", "posts"],
        queryFn: async ({ pageParam }) => {
            const params: Record<string, string> = { limit: String(limit) }
            if (pageParam) params.cursor = pageParam as string
            const res = await api.get<UploadsResponse>("/v1/uploads/posts", { params })
            return res.data
        },
        initialPageParam: "" as string,
        getNextPageParam: (lastPage) => lastPage.meta?.next_cursor || undefined,
    })
}

export function useUploadCounts() {
    return useQuery({
        queryKey: ["my-uploads", "counts"],
        queryFn: async () => {
            const res = await api.get<{ data: UploadCounts }>("/v1/uploads/counts")
            return res.data.data
        },
        staleTime: 30_000,
    })
}

export function useDeleteUpload() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ postId }: { postId: string }) => {
            await api.delete(`/v1/uploads/${postId}`)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["my-uploads"] })
        },
    })
}
