"use client"

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { PostDetail } from "@/types/profile"

interface PostsResponse {
    data: PostDetail[]
    meta?: { next_cursor: string }
}

const FLICK_TYPES = new Set(["reel", "flick", "short"])

export function useProfilePosts(userId: string | undefined, contentType: string) {
    return useInfiniteQuery({
        queryKey: ["profile-posts", userId, contentType],
        queryFn: async ({ pageParam }) => {
            const params: Record<string, string> = { limit: "20" }
            if (contentType && contentType !== "all") {
                params.type = contentType
            }
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

/**
 * Fetches all posts for a user and counts videos vs flicks client-side.
 * Used by the profile header PostTube stats card.
 */
export function useContentCounts(userId: string | undefined) {
    return useQuery({
        queryKey: ["content-counts", userId],
        queryFn: async () => {
            const res = await api.get<PostsResponse>(`/v1/posts/by-author/${userId}`, {
                params: { limit: "200" },
            })
            const posts = res.data.data ?? []
            const flicks = posts.filter((p) => FLICK_TYPES.has(p.content_type)).length
            const videos = posts.filter(
                (p) => !FLICK_TYPES.has(p.content_type) && p.content_type !== "post"
            ).length
            return {
                post: posts.length,
                video: videos,
                reel: flicks,
                total: posts.length,
            }
        },
        enabled: !!userId,
        staleTime: 60_000,
    })
}

export function useDeletePost() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (postId: string) => {
            await api.delete(`/v1/uploads/${postId}`)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["profile-posts"] })
        },
    })
}
