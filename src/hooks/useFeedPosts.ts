"use client"

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { PostDetail } from "@/types/profile"

interface PostsResponse {
    data: PostDetail[]
    meta?: { next_cursor: string }
}

interface CreatePostPayload {
    text: string
    visibility: "public" | "followers" | "private"
    content_type: string
    media_ids?: string[]
    feeling?: string | null
    activity?: string | null
    activity_detail?: string | null
    location?: string | null
    location_name?: string | null
    location_lat?: number | null
    location_lng?: number | null
    post_type?: string
    app_origin?: string
    no_comments?: boolean
    no_likes?: boolean
    poll?: {
        question: string
        options: string[]
        allows_multiple?: boolean
        duration_hours?: number
    } | null
}

export function useFeedPosts(userId: string | undefined) {
    return useInfiniteQuery({
        queryKey: ["feed-posts", userId],
        queryFn: async ({ pageParam }) => {
            const params: Record<string, string> = { limit: "20" }
            if (pageParam) {
                params.cursor = pageParam as string
            }
            const res = await api.get<PostsResponse>(`/v1/posts/by-author/${userId}`, { params })
            return res.data
        },
        initialPageParam: "" as string,
        getNextPageParam: (lastPage) => lastPage.meta?.next_cursor || undefined,
        enabled: !!userId,
    })
}

export type FeedMode = "ranked" | "chronological"

export function useHomeFeed(feedMode: FeedMode = "chronological", options?: { excludeSelf?: boolean; circleOnly?: boolean; enabled?: boolean }) {
    const excludeSelf = options?.excludeSelf ?? false
    const circleOnly = options?.circleOnly ?? false
    const enabled = options?.enabled ?? true
    return useInfiniteQuery({
        queryKey: ["home-feed", feedMode, excludeSelf, circleOnly],
        queryFn: async ({ pageParam }) => {
            const params: Record<string, string> = { limit: "20", feed_mode: feedMode }
            if (excludeSelf) {
                params.exclude_self = "true"
            }
            if (circleOnly) {
                params.circle_only = "true"
            }
            if (pageParam) {
                params.cursor = pageParam as string
            }
            const res = await api.get<PostsResponse>(`/v1/feed/home`, { params })
            return res.data
        },
        initialPageParam: "" as string,
        getNextPageParam: (lastPage) => lastPage.meta?.next_cursor || undefined,
        enabled,
    })
}

export function useSaveFeedPreference() {
    return useMutation({
        mutationFn: async (feedMode: FeedMode) => {
            const res = await api.post("/v1/feed/preference", { feed_mode: feedMode })
            return res.data
        },
    })
}

export function usePostDetail(postId: string | undefined) {
    return useQuery({
        queryKey: ["post-detail", postId],
        queryFn: async () => {
            const res = await api.get<{ data: PostDetail }>(`/v1/posts/${postId}`)
            return res.data.data
        },
        enabled: !!postId,
    })
}

export function useCreatePost() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (payload: CreatePostPayload) => {
            const res = await api.post<{ data: PostDetail }>("/v1/posts", payload)
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["home-feed"] })
            qc.invalidateQueries({ queryKey: ["feed-posts"] })
            qc.invalidateQueries({ queryKey: ["profile-posts"] })
        },
    })
}
