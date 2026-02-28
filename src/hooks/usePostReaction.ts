"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"

interface LikeToggleResponse {
    data: { liked: boolean; count: number }
}

/**
 * useToggleLike – optimistic like toggle using the new POST /v1/posts/:id/like endpoint.
 * Replaces the old useReactToPost / useUnreactToPost pair.
 */
export function useToggleLike() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (postId: string) => {
            const res = await api.post<LikeToggleResponse>(`/v1/posts/${postId}/like`)
            return res.data.data
        },
        onMutate: async (postId: string) => {
            await qc.cancelQueries({ queryKey: ["home-feed"] })
            await qc.cancelQueries({ queryKey: ["feed-posts"] })
            await qc.cancelQueries({ queryKey: ["profile-posts"] })

            const updatePost = (old: any) => {
                if (!old?.pages) return old
                return {
                    ...old,
                    pages: old.pages.map((page: any) => ({
                        ...page,
                        data: page.data.map((post: any) => {
                            if (post.id !== postId) return post
                            const wasLiked = !!post.viewer_reaction
                            return {
                                ...post,
                                viewer_reaction: wasLiked ? null : { type: 'like' },
                                counts: {
                                    ...post.counts,
                                    likes: wasLiked ? Math.max(0, (post.counts?.likes ?? 0) - 1) : (post.counts?.likes ?? 0) + 1
                                }
                            }
                        })
                    }))
                }
            }

            qc.setQueriesData({ queryKey: ["home-feed"] }, updatePost)
            qc.setQueriesData({ queryKey: ["feed-posts"] }, updatePost)
            qc.setQueriesData({ queryKey: ["profile-posts"] }, updatePost)
        },
        onSettled: (_data, _err, postId) => {
            // Sync from server after toggle — PostCard handles optimistic UI locally
            qc.invalidateQueries({ queryKey: ["home-feed"] })
            qc.invalidateQueries({ queryKey: ["feed-posts"] })
            qc.invalidateQueries({ queryKey: ["profile-posts"] })
            qc.invalidateQueries({ queryKey: ["post-detail", postId] })
        },
    })
}

/**
 * useToggleReaction – multi-reaction toggle (like, love, haha, wow, sad, angry).
 * Uses POST /v1/posts/:id/react with { reaction_type }.
 */
export function useToggleReaction() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ postId, reactionType }: { postId: string; reactionType: string }) => {
            const res = await api.post(`/v1/posts/${postId}/react`, { reaction_type: reactionType })
            return res.data.data as { reaction_type: string; is_set: boolean; counts: Record<string, number> }
        },
        onMutate: async ({ postId, reactionType }) => {
            await qc.cancelQueries({ queryKey: ["home-feed"] })
            await qc.cancelQueries({ queryKey: ["feed-posts"] })
            await qc.cancelQueries({ queryKey: ["profile-posts"] })

            const updatePost = (old: any) => {
                if (!old?.pages) return old
                return {
                    ...old,
                    pages: old.pages.map((page: any) => ({
                        ...page,
                        data: page.data.map((post: any) => {
                            if (post.id !== postId) return post
                            const wasSameReaction = post.viewer_reaction === reactionType
                            return {
                                ...post,
                                viewer_reaction: wasSameReaction ? null : reactionType,
                                counts: {
                                    ...post.counts,
                                    likes: wasSameReaction
                                        ? Math.max(0, (post.counts?.likes ?? 0) - 1)
                                        : (post.counts?.likes ?? 0) + (post.viewer_reaction ? 0 : 1),
                                },
                            }
                        }),
                    })),
                }
            }

            qc.setQueriesData({ queryKey: ["home-feed"] }, updatePost)
            qc.setQueriesData({ queryKey: ["feed-posts"] }, updatePost)
            qc.setQueriesData({ queryKey: ["profile-posts"] }, updatePost)
        },
        onSettled: (_data, _err, { postId }) => {
            qc.invalidateQueries({ queryKey: ["home-feed"] })
            qc.invalidateQueries({ queryKey: ["feed-posts"] })
            qc.invalidateQueries({ queryKey: ["profile-posts"] })
            qc.invalidateQueries({ queryKey: ["post-detail", postId] })
            qc.invalidateQueries({ queryKey: ["reaction-counts", postId] })
        },
    })
}

/**
 * useReactionCounts – fetch reaction count breakdown for a post.
 */
export function useReactionCounts(postId: string | undefined) {
    return useQuery({
        queryKey: ["reaction-counts", postId],
        queryFn: async () => {
            const res = await api.get(`/v1/posts/${postId}/reactions/counts`)
            return res.data.data as { like: number; love: number; haha: number; wow: number; sad: number; angry: number; total: number }
        },
        enabled: !!postId,
    })
}

// Keep legacy hooks for backward compatibility during migration
export function useReactToPost() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (postId: string) => {
            await api.post(`/v1/posts/${postId}/reactions`, { reaction: "like" })
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["home-feed"] })
            qc.invalidateQueries({ queryKey: ["feed-posts"] })
            qc.invalidateQueries({ queryKey: ["profile-posts"] })
        },
    })
}

export function useUnreactToPost() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (postId: string) => {
            await api.delete(`/v1/posts/${postId}/reactions`)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["home-feed"] })
            qc.invalidateQueries({ queryKey: ["feed-posts"] })
            qc.invalidateQueries({ queryKey: ["profile-posts"] })
        },
    })
}
