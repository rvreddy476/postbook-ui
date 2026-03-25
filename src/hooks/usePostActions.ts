"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"

export function useTogglePin() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ postId, pinned }: { postId: string; pinned: boolean }) => {
            await api.put(`/v1/posts/${postId}/pin`, { pinned })
            return pinned
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["home-feed"] })
            qc.invalidateQueries({ queryKey: ["feed-posts"] })
            qc.invalidateQueries({ queryKey: ["profile-posts"] })
        },
    })
}

interface BookmarkToggleResponse {
    data: { bookmarked: boolean }
}

/**
 * useToggleBookmark – atomic toggle using POST /v1/posts/:id/bookmark.
 * Replaces the old useBookmark / useUnbookmark pair.
 */
export function useToggleBookmark() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (postId: string) => {
            const res = await api.post<BookmarkToggleResponse>(`/v1/posts/${postId}/bookmark`)
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["home-feed"] })
            qc.invalidateQueries({ queryKey: ["feed-posts"] })
            qc.invalidateQueries({ queryKey: ["profile-posts"] })
        },
    })
}

export function useToggleTune() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ postId, tuned }: { postId: string; tuned: boolean }) => {
            if (tuned) {
                await api.post(`/v1/posts/${postId}/tune`)
            } else {
                await api.delete(`/v1/posts/${postId}/tune`)
            }
            return { postId, tuned }
        },
        onSuccess: ({ postId }) => {
            qc.invalidateQueries({ queryKey: ["post-tune", postId] })
        },
    })
}

export function useTuneState(postId: string | undefined) {
    return useQuery({
        queryKey: ["post-tune", postId],
        queryFn: async () => {
            const res = await api.get<{ data: { tuned: boolean } }>(`/v1/posts/${postId}/tune/me`)
            return res.data.data.tuned
        },
        enabled: !!postId,
        retry: false,
        staleTime: 30_000,
    })
}

interface ShareResponse {
    data: { shared: boolean; count: number }
}

/**
 * useSharePost – routes repost/quote through POST /v1/posts/:id/repost
 * (creates a real repost record + publishes post.reposted for feed fanout)
 * and external (copy-link) through the old POST /v1/posts/:id/share.
 */
export function useSharePost() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ postId, shareType, quoteText }: { postId: string; shareType: 'repost' | 'quote' | 'external'; quoteText?: string }) => {
            if (shareType === 'external') {
                const res = await api.post<ShareResponse>(`/v1/posts/${postId}/share`, {
                    share_type: 'external',
                })
                return res.data.data
            }
            // repost / quote → proper repost endpoint
            const res = await api.post(`/v1/posts/${postId}/repost`, {
                type: shareType === 'quote' ? 'quote' : 'plain',
                quote_text: quoteText ?? '',
            })
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["home-feed"] })
            qc.invalidateQueries({ queryKey: ["feed-posts"] })
            qc.invalidateQueries({ queryKey: ["profile-posts"] })
        },
    })
}

// Legacy hooks kept for backward compatibility
export function useBookmark() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (postId: string) => {
            await api.post(`/v1/posts/${postId}/bookmark`)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["home-feed"] })
            qc.invalidateQueries({ queryKey: ["feed-posts"] })
            qc.invalidateQueries({ queryKey: ["profile-posts"] })
        },
    })
}

export function useUnbookmark() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (postId: string) => {
            await api.delete(`/v1/posts/${postId}/bookmark`)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["home-feed"] })
            qc.invalidateQueries({ queryKey: ["feed-posts"] })
            qc.invalidateQueries({ queryKey: ["profile-posts"] })
        },
    })
}
