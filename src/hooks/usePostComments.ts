"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { CommentItem } from "@/types/profile"

interface CommentsResponse {
    data: CommentItem[]
    meta?: { next_cursor?: string }
}

export function useComments(postId: string | undefined, enabled = false) {
    return useQuery({
        queryKey: ["comments", postId],
        queryFn: async () => {
            const res = await api.get<CommentsResponse>(`/v1/posts/${postId}/comments`, {
                params: { limit: "50" },
            })
            // Backend now returns data as array directly (PG-backed)
            const data = res.data.data
            return Array.isArray(data) ? data : (data as any).items ?? []
        },
        enabled: !!postId && enabled,
    })
}

export function useAddComment() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ postId, text }: { postId: string; text: string }) => {
            const res = await api.post<{ data: CommentItem }>(`/v1/posts/${postId}/comments`, { text }, {
                headers: { 'Idempotency-Key': crypto.randomUUID() },
            })
            return res.data.data
        },
        onSuccess: (_data, variables) => {
            qc.invalidateQueries({ queryKey: ["comments", variables.postId] })
            qc.invalidateQueries({ queryKey: ["home-feed"] })
            qc.invalidateQueries({ queryKey: ["feed-posts"] })
            qc.invalidateQueries({ queryKey: ["profile-posts"] })
        },
    })
}

export function useCreateReply() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ commentId, text, postId }: { commentId: string; text: string; postId: string }) => {
            const res = await api.post<{ data: CommentItem }>(`/v1/comments/${commentId}/reply`, { text }, {
                headers: { 'Idempotency-Key': crypto.randomUUID() },
            })
            return { reply: res.data.data, postId, commentId }
        },
        onSettled: (_data, _error, variables) => {
            // Refetch comments in background to sync with server
            qc.invalidateQueries({ queryKey: ["comments", variables.postId] })
        },
    })
}

export function useDeleteComment() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ commentId, postId }: { commentId: string; postId: string }) => {
            await api.delete(`/v1/comments/${commentId}`)
            return { postId }
        },
        onSuccess: (_data, variables) => {
            qc.invalidateQueries({ queryKey: ["comments", variables.postId] })
            qc.invalidateQueries({ queryKey: ["home-feed"] })
            qc.invalidateQueries({ queryKey: ["feed-posts"] })
        },
    })
}

export function useEditComment() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ commentId, body, postId }: { commentId: string; body: string; postId: string }) => {
            await api.patch(`/v1/comments/${commentId}`, { body })
            return { postId }
        },
        onSuccess: (_data, variables) => {
            qc.invalidateQueries({ queryKey: ["comments", variables.postId] })
        },
    })
}

interface CommentLikeResponse {
    data: { liked: boolean; count: number; dislike_count: number }
}

export function useToggleCommentLike() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ commentId, postId }: { commentId: string; postId: string }) => {
            const res = await api.post<CommentLikeResponse>(`/v1/comments/${commentId}/like`)
            return { ...res.data.data, postId }
        },
        onSuccess: (_data, variables) => {
            qc.invalidateQueries({ queryKey: ["comments", variables.postId] })
        },
    })
}

interface CommentDislikeResponse {
    data: { disliked: boolean; dislike_count: number; like_count: number }
}

export function useToggleCommentDislike() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ commentId, postId }: { commentId: string; postId: string }) => {
            const res = await api.post<CommentDislikeResponse>(`/v1/comments/${commentId}/dislike`)
            return { ...res.data.data, postId }
        },
        onSuccess: (_data, variables) => {
            qc.invalidateQueries({ queryKey: ["comments", variables.postId] })
        },
    })
}
