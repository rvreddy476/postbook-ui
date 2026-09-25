"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import {
    removePostFromQueries,
    restoreQueries,
    snapshotQueries,
    type QuerySnapshot,
} from "@/components/feed/removePostFromPages"

/** Every list that can show a post and must forget it when it goes. */
const POST_LIST_KEYS = [["home-feed"], ["profile-posts"]] as const

export type FeedSignal = "interested" | "not_interested"

/**
 * usePostFeedback – POST /v1/feed/feedback { post_id, signal }.
 *
 * feed-service keeps the latest answer per (viewer, post): not_interested
 * removes the post from every surface on the next fetch; interested undoes
 * it. So "Undo" after hiding is simply sending `interested`. The old card
 * posted to /v1/feed/not-interested, which does not exist — every click
 * 404'd behind a "couldn't apply that preference" alert.
 *
 * No cache work here: the card decides whether to hide optimistically (see
 * useHidePost) because the toast's Undo needs the snapshot.
 */
export function usePostFeedback() {
    return useMutation({
        mutationFn: async ({ postId, signal }: { postId: string; signal: FeedSignal }) => {
            await api.post(`/v1/feed/feedback`, { post_id: postId, signal })
            return { postId, signal }
        },
    })
}

/**
 * useHidePost – "Not interested" with an optimistic removal and an undo.
 *
 *   hide(postId)   snapshots the lists holding the post, removes it from
 *                  them, sends not_interested; on failure restores and
 *                  rethrows.
 *   undo(snapshot) restores the snapshot and sends interested.
 *
 * The snapshot is returned rather than kept in the hook because the card is
 * usually unmounted by the time Undo is pressed (it was just removed from
 * the list) — the toast holds it instead.
 */
export function useHidePost() {
    const qc = useQueryClient()
    const feedback = usePostFeedback()

    const hide = async (postId: string): Promise<QuerySnapshot[]> => {
        const snapshot = snapshotQueries(qc, POST_LIST_KEYS, postId)
        removePostFromQueries(qc, POST_LIST_KEYS, postId)
        try {
            await feedback.mutateAsync({ postId, signal: "not_interested" })
        } catch (err) {
            restoreQueries(qc, snapshot)
            throw err
        }
        return snapshot
    }

    const undo = async (postId: string, snapshot: readonly QuerySnapshot[]): Promise<void> => {
        restoreQueries(qc, snapshot)
        await feedback.mutateAsync({ postId, signal: "interested" })
    }

    /** "Interested" on its own: a positive signal, nothing to restore. */
    const interested = async (postId: string): Promise<void> => {
        await feedback.mutateAsync({ postId, signal: "interested" })
    }

    return { hide, undo, interested, isPending: feedback.isPending }
}

/**
 * useDeletePost – DELETE /v1/posts/:id, then forget the post in every list
 * that could still be showing it. The lists are also invalidated so a
 * paginated cursor that pointed past the deleted row heals on its own.
 */
export function useDeletePost() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (postId: string) => {
            await api.delete(`/v1/posts/${postId}`)
            return postId
        },
        onSuccess: (postId) => {
            removePostFromQueries(qc, POST_LIST_KEYS, postId)
            qc.invalidateQueries({ queryKey: ["home-feed"] })
            qc.invalidateQueries({ queryKey: ["profile-posts"] })
        },
    })
}

export function useTogglePin() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ postId, pinned }: { postId: string; pinned: boolean }) => {
            await api.put(`/v1/posts/${postId}/pin`, { pinned })
            return pinned
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["home-feed"] })
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
            qc.invalidateQueries({ queryKey: ["profile-posts"] })
        },
    })
}
