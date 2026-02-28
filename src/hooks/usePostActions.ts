"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
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

interface ShareResponse {
    data: { shared: boolean; count: number }
}

export function useSharePost() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ postId, shareType, quoteText }: { postId: string; shareType: 'repost' | 'quote' | 'external'; quoteText?: string }) => {
            const res = await api.post<ShareResponse>(`/v1/posts/${postId}/share`, {
                share_type: shareType,
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
