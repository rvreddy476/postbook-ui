"use client"

import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { refreshCommentSurfaces } from '@/lib/commentCache'
import { applyReaction, patchCommentInList, topReactions } from '@/components/comments/reactionMath'
import type { CommentItem, CommentReaction } from "@/types/profile"

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
            return Array.isArray(data) ? data : (data as any)?.items ?? []
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
            refreshCommentSurfaces(qc, variables.postId)
            qc.invalidateQueries({ queryKey: ["home-feed"] })
            qc.invalidateQueries({ queryKey: ["profile-posts"] })
        },
    })
}

/* ── Replies ──────────────────────────────────────────────── */

export interface RepliesPage {
    data: CommentItem[]
    meta?: { next_cursor?: string }
}

export interface RepliesCache {
    pages: RepliesPage[]
    pageParams: unknown[]
}

export const repliesKey = (commentId: string) => ["comment-replies", commentId] as const

/** GET /v1/comments/:id/replies, oldest first, 20 per page by cursor. */
export function useCommentReplies(commentId: string | undefined, enabled = false) {
    return useInfiniteQuery({
        queryKey: repliesKey(commentId ?? ''),
        queryFn: async ({ pageParam }) => {
            const res = await api.get<RepliesPage>(`/v1/comments/${commentId}/replies`, {
                params: { limit: "20", ...(pageParam ? { cursor: pageParam } : {}) },
            })
            const data = res.data?.data
            return { data: Array.isArray(data) ? data : [], meta: res.data?.meta } satisfies RepliesPage
        },
        initialPageParam: '' as string,
        getNextPageParam: last => last.meta?.next_cursor || undefined,
        enabled: !!commentId && enabled,
    })
}

/** Every reply the cache holds for a comment, in page order. */
export function flattenReplies(cache: RepliesCache | undefined): CommentItem[] {
    return cache?.pages?.flatMap(page => page.data ?? []) ?? []
}

/**
 * Apply `patch` to comment `id` in every list that can hold it: the post's
 * comment page, the around-a-comment pages, and every replies list. Nested
 * first-reply previews are covered by patchCommentInList.
 */
export function patchCommentEverywhere(qc: QueryClient, postId: string, id: string, patch: (item: CommentItem) => CommentItem) {
    for (const [key, value] of qc.getQueriesData<CommentItem[]>({ queryKey: ["comments", postId] })) {
        if (Array.isArray(value)) qc.setQueryData(key, patchCommentInList(value, id, patch))
    }
    for (const [key, value] of qc.getQueriesData<CommentItem[]>({ queryKey: ["comments-around", postId] })) {
        if (Array.isArray(value)) qc.setQueryData(key, patchCommentInList(value, id, patch))
    }
    for (const [key, value] of qc.getQueriesData<RepliesCache>({ queryKey: ["comment-replies"] })) {
        if (!value?.pages) continue
        let changed = false
        const pages = value.pages.map(page => {
            const data = patchCommentInList(page.data ?? [], id, patch)
            if (data !== page.data) changed = true
            return data === page.data ? page : { ...page, data }
        })
        if (changed) qc.setQueryData(key, { ...value, pages })
    }
}

/** Append an optimistic reply to a loaded replies list; a list that has not loaded is left for the refetch. */
function appendReplyToCache(qc: QueryClient, parentId: string, reply: CommentItem) {
    qc.setQueryData<RepliesCache>(repliesKey(parentId), old => {
        if (!old?.pages?.length) return old
        if (old.pages.some(page => page.data?.some(item => item.id === reply.id))) return old
        const last = old.pages.length - 1
        const pages = old.pages.map((page, index) => index === last ? { ...page, data: [...(page.data ?? []), reply] } : page)
        return { ...old, pages }
    })
}

/**
 * POST /v1/comments/:parentId/reply. `parentId` is always the top-level
 * comment; replying to a reply attaches to that same parent, the caller
 * prefixes `@username ` in the text. Optimistic append, then both lists refetch.
 */
export function useCreateReply() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ commentId, text }: { commentId: string; text: string; postId: string; authorId?: string }) => {
            const res = await api.post<{ data: CommentItem }>(`/v1/comments/${commentId}/reply`, { text }, {
                headers: { 'Idempotency-Key': crypto.randomUUID() },
            })
            return res.data.data
        },
        onMutate: async ({ commentId, text, postId, authorId }) => {
            const now = new Date().toISOString()
            const optimistic: CommentItem = {
                id: `pending-${crypto.randomUUID()}`, post_id: postId, author_id: authorId ?? '', body: text,
                like_count: 0, dislike_count: 0, reply_count: 0, is_reply: true, created_at: now, updated_at: now,
                reactions: [], reaction_count: 0, viewer_reaction: null,
            }
            appendReplyToCache(qc, commentId, optimistic)
            patchCommentEverywhere(qc, postId, commentId, item => ({
                ...item, reply_count: (item.reply_count ?? 0) + 1, reply: item.reply ?? optimistic,
            }))
            return { optimistic }
        },
        onSuccess: (reply, { commentId, postId }, context) => {
            if (!reply) return
            const replace = (item: CommentItem) => item.id === context?.optimistic.id ? reply : item
            qc.setQueryData<RepliesCache>(repliesKey(commentId), old => old?.pages ? { ...old, pages: old.pages.map(page => ({ ...page, data: (page.data ?? []).map(replace) })) } : old)
            patchCommentEverywhere(qc, postId, commentId, item => item.reply?.id === context?.optimistic.id ? { ...item, reply } : item)
        },
        onSettled: (_data, _error, variables) => {
            void qc.invalidateQueries({ queryKey: ["comments", variables.postId] })
            void qc.invalidateQueries({ queryKey: repliesKey(variables.commentId) })
            refreshCommentSurfaces(qc, variables.postId)
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
            refreshCommentSurfaces(qc, variables.postId)
            void qc.invalidateQueries({ queryKey: ["comment-replies"] })
            qc.invalidateQueries({ queryKey: ["home-feed"] })
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
            refreshCommentSurfaces(qc, variables.postId)
            void qc.invalidateQueries({ queryKey: ["comment-replies"] })
        },
    })
}

/* ── Emoji reactions ──────────────────────────────────────── */

interface CommentReactionResponse {
    data?: { emoji?: string | null; reaction_count?: number; reactions?: CommentReaction[]; viewer_reaction?: string | null }
}

/** The server's acknowledged state, or null when it replied with an empty body (204). */
function parseReactionAck(body: unknown): { reaction_count: number; reactions: CommentReaction[]; viewer_reaction: string | null } | null {
    const data = (body as CommentReactionResponse | undefined)?.data
    if (!data || typeof data !== 'object') return null
    if (typeof data.reaction_count !== 'number' || !Array.isArray(data.reactions)) return null
    const viewer = data.viewer_reaction === undefined ? (data.emoji ?? null) : data.viewer_reaction
    return { reaction_count: Math.max(0, data.reaction_count), reactions: topReactions(data.reactions), viewer_reaction: viewer || null }
}

/**
 * PUT /v1/comments/:id/reaction {emoji} or DELETE when `emoji` is null.
 * Optimistic patch through applyReaction on every cached copy; rollback on
 * error; the acknowledged counts replace the guess on success.
 */
export function useSetCommentReaction() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ commentId, emoji }: { commentId: string; emoji: string | null; postId: string }) => {
            const res = emoji
                ? await api.put<CommentReactionResponse>(`/v1/comments/${commentId}/reaction`, { emoji })
                : await api.delete<CommentReactionResponse>(`/v1/comments/${commentId}/reaction`)
            return parseReactionAck(res.data)
        },
        onMutate: async ({ commentId, emoji, postId }) => {
            await qc.cancelQueries({ queryKey: ["comments", postId] })
            const snapshot = [
                ...qc.getQueriesData<unknown>({ queryKey: ["comments", postId] }),
                ...qc.getQueriesData<unknown>({ queryKey: ["comments-around", postId] }),
                ...qc.getQueriesData<unknown>({ queryKey: ["comment-replies"] }),
            ]
            patchCommentEverywhere(qc, postId, commentId, item => applyReaction(item, emoji))
            return { snapshot }
        },
        onError: (_error, _variables, context) => {
            for (const [key, value] of context?.snapshot ?? []) qc.setQueryData(key, value)
        },
        onSuccess: (ack, { commentId, postId }) => {
            if (!ack) return
            patchCommentEverywhere(qc, postId, commentId, item => ({
                ...item, reactions: ack.reactions, reaction_count: ack.reaction_count, like_count: ack.reaction_count, viewer_reaction: ack.viewer_reaction,
            }))
        },
        onSettled: (_data, _error, variables) => {
            void qc.invalidateQueries({ queryKey: ["comments", variables.postId] })
            void qc.invalidateQueries({ queryKey: ["comment-replies"] })
        },
    })
}

/* ── Legacy like / dislike (no longer used by the UI; the server still serves them) ── */

interface CommentLikeResponse {
    data: { liked: boolean; count: number; dislike_count: number }
}

/** @deprecated Use useSetCommentReaction; POST /like toggles a heart and predates emoji reactions. */
export function useToggleCommentLike() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ commentId, postId }: { commentId: string; postId: string }) => {
            const res = await api.post<CommentLikeResponse>(`/v1/comments/${commentId}/like`)
            return { ...res.data.data, postId }
        },
        onSuccess: (_data, variables) => {
            refreshCommentSurfaces(qc, variables.postId)
        },
    })
}

interface CommentDislikeResponse {
    data: { disliked: boolean; dislike_count: number; like_count: number }
}

/** @deprecated Dislikes are no longer shown in the UI. */
export function useToggleCommentDislike() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ commentId, postId }: { commentId: string; postId: string }) => {
            const res = await api.post<CommentDislikeResponse>(`/v1/comments/${commentId}/dislike`)
            return { ...res.data.data, postId }
        },
        onSuccess: (_data, variables) => {
            refreshCommentSurfaces(qc, variables.postId)
        },
    })
}
