"use client"

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { PostDetail } from "@/types/profile"
import { profilePostsInfiniteOptions, type ProfilePostSort } from "@/lib/profilePostSort"

interface PostsResponse {
    data: PostDetail[]
    meta?: { next_cursor: string }
}

const FLICK_TYPES = new Set(["reel", "flick", "short"])

/**
 * One author's posts, paged. `sort` (latest | popular | oldest) is part of
 * the query key: the cursor is tied to the sort that issued it, so a new
 * sort is a new query that starts from the first page (lib/profilePostSort).
 */
export function useProfilePosts(userId: string | undefined, contentType: string, sort?: ProfilePostSort) {
    return useInfiniteQuery(
        profilePostsInfiniteOptions<PostsResponse>(userId, contentType, sort, async (path, params) => {
            const res = await api.get<PostsResponse>(path, { params })
            return res.data
        }),
    )
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
