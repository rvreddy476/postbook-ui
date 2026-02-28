"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { Story } from "@/types/profile"

interface StoriesFeedResponse {
    data: Story[]
}

interface CreateStoryPayload {
    media_url: string
    media_type: "image" | "video"
    caption?: string
    visibility: "public" | "followers" | "close_friends"
    is_highlight?: boolean
    highlight_group?: string
}

export function useStoriesFeed(followedIds: string[]) {
    return useQuery({
        queryKey: ["stories-feed", followedIds],
        queryFn: async () => {
            if (followedIds.length === 0) return []
            const res = await api.get<StoriesFeedResponse>("/v1/stories/feed", {
                params: { followed_ids: followedIds.join(",") },
            })
            return res.data.data ?? []
        },
        enabled: followedIds.length > 0,
        staleTime: 60_000,
    })
}

export function useStoryDetail(storyId: string | undefined) {
    return useQuery({
        queryKey: ["story", storyId],
        queryFn: async () => {
            const res = await api.get<{ data: Story }>(`/v1/stories/${storyId}`)
            return res.data.data
        },
        enabled: !!storyId,
    })
}

export function useCreateStory() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (payload: CreateStoryPayload) => {
            const res = await api.post<{ data: Story }>("/v1/stories", payload)
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["stories-feed"] })
        },
    })
}

export function useDeleteStory() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (storyId: string) => {
            await api.delete(`/v1/stories/${storyId}`)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["stories-feed"] })
        },
    })
}

export function useViewStory() {
    return useMutation({
        mutationFn: async (storyId: string) => {
            await api.post(`/v1/stories/${storyId}/view`)
        },
    })
}
