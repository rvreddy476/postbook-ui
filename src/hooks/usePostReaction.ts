"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"

interface LikeToggleResponse {
    data: { liked: boolean; count: number }
}

/**
 * useToggleLike – optimistic like toggle using the new POST /v1/posts/:id/like endpoint.
 * Posts take the like only (founder, 24 Oct 2026): this is the heart toggle.
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
            qc.setQueriesData({ queryKey: ["profile-posts"] }, updatePost)
        },
        onSettled: (_data, _err, postId) => {
            // Mark feed caches stale without forcing a refetch — the
            // optimistic onMutate update is already correct, so refetching
            // would cause the list to remount and the page to "shake".
            // Next natural refetch (focus, mount, manual) picks up server state.
            qc.invalidateQueries({ queryKey: ["home-feed"], refetchType: "none" })
            qc.invalidateQueries({ queryKey: ["profile-posts"], refetchType: "none" })
            qc.invalidateQueries({ queryKey: ["post-detail", postId], refetchType: "none" })
        },
    })
}
