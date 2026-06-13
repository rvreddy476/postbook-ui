"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"

// Mirrors Architecture/services/post-service/internal/store/postgres/
// product_tags.go PostProductTag. Time + position are optional —
// time-NULL means "the whole video", position-NULL means "player picks".
export type PostProductTag = {
    id: string
    post_id: string
    affiliate_link_id: string
    creator_id: string
    time_start_ms: number | null
    time_end_ms: number | null
    position_x: number | null // 0..100
    position_y: number | null // 0..100
    label: string
    image_url: string
    impression_count: number
    click_count: number
    is_active: boolean
    created_at: string
    updated_at: string
}

// ─── reads ──────────────────────────────────────────────────────────

/**
 * Fetch the active product tags for a post. The player calls this once
 * per video open and then drives the overlay state off of the
 * currentTime cursor — no streaming needed.
 *
 * Cached for 5 minutes — a creator editing tags mid-watch is rare and
 * the next play will re-fetch.
 */
export function useProductTags(postId: string | null | undefined) {
    return useQuery({
        queryKey: ["product-tags", postId],
        queryFn: async () => {
            const res = await api.get<{ data: PostProductTag[] }>(
                `/v1/posts/${postId}/product-tags`,
            )
            return res.data?.data ?? []
        },
        enabled: !!postId,
        staleTime: 5 * 60 * 1000,
    })
}

// ─── writes ─────────────────────────────────────────────────────────

export type CreateProductTagInput = {
    postId: string
    affiliate_link_id: string
    time_start_ms?: number
    time_end_ms?: number
    position_x?: number
    position_y?: number
    label?: string
    image_url?: string
}

export function useCreateProductTag() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (input: CreateProductTagInput) => {
            const { postId, ...body } = input
            const res = await api.post<{ data: PostProductTag }>(
                `/v1/posts/${postId}/product-tags`,
                body,
            )
            return res.data?.data
        },
        onSuccess: (_data, input) => {
            qc.invalidateQueries({ queryKey: ["product-tags", input.postId] })
        },
    })
}

export function useDeleteProductTag() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ postId, tagId }: { postId: string; tagId: string }) => {
            await api.delete(`/v1/posts/${postId}/product-tags/${tagId}`)
        },
        onSuccess: (_data, { postId }) => {
            qc.invalidateQueries({ queryKey: ["product-tags", postId] })
        },
    })
}

// ─── analytics emitters ─────────────────────────────────────────────
//
// Both are best-effort fire-and-forget. The player should NOT block
// rendering on either. We swallow errors silently so a transient
// network blip doesn't surface as a console error on every view.

/**
 * Bump the impression counter when an overlay enters the viewport.
 * The caller is responsible for de-duping (don't fire on every paint;
 * fire on the leading edge of the time window).
 */
export async function emitProductTagImpression(
    postId: string,
    tagId: string,
): Promise<void> {
    try {
        await api.post(
            `/v1/posts/${postId}/product-tags/${tagId}/impression`,
            null,
        )
    } catch {
        // best-effort; ignore
    }
}

/**
 * Bump the click counter on overlay tap, then return — the caller
 * navigates to the affiliate URL itself. Doing the counter increment
 * before the navigation means we don't lose the event on unload.
 */
export async function emitProductTagClick(
    postId: string,
    tagId: string,
): Promise<void> {
    try {
        await api.post(`/v1/posts/${postId}/product-tags/${tagId}/click`, null)
    } catch {
        // best-effort; ignore
    }
}
