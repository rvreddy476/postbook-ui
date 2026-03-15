"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { MediaSlot, SlotAssignRequest, BatchSlotResponse } from "@/types/media"

interface SlotsResponse { data: MediaSlot[] }
interface BatchResponse { data: BatchSlotResponse }

// === QUERIES ===

/** Get all resolved media slots for an entity (e.g. channel, user, page). */
export function useMediaSlots(ownerType: string, ownerId?: string) {
    return useQuery<MediaSlot[]>({
        queryKey: ["media-slots", ownerType, ownerId],
        queryFn: async () => {
            const res = await api.get<SlotsResponse>(
                `/v1/media/slots/${ownerType}/${ownerId}`
            )
            return res.data.data ?? []
        },
        enabled: !!ownerId,
        staleTime: 30_000,
    })
}

/** Batch-resolve slots for multiple entities at once. */
export function useBatchMediaSlots(
    queries: { owner_type: string; owner_id: string }[]
) {
    return useQuery<Record<string, MediaSlot[]>>({
        queryKey: ["media-slots-batch", queries],
        queryFn: async () => {
            const res = await api.post<BatchResponse>(
                "/v1/media/slots/batch",
                { queries }
            )
            return res.data.data?.results ?? {}
        },
        enabled: queries.length > 0,
        staleTime: 30_000,
    })
}

// === MUTATIONS ===

/** Assign a media asset to a named slot on an entity. */
export function useAssignSlot() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (params: {
            ownerType: string
            ownerId: string
            slotName: string
            body: SlotAssignRequest
        }) => {
            await api.put(
                `/v1/media/slots/${params.ownerType}/${params.ownerId}/${params.slotName}`,
                params.body
            )
        },
        onSuccess: (_, vars) => {
            qc.invalidateQueries({
                queryKey: ["media-slots", vars.ownerType, vars.ownerId],
            })
        },
    })
}

/** Remove a media slot from an entity. */
export function useRemoveSlot() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (params: {
            ownerType: string
            ownerId: string
            slotName: string
        }) => {
            await api.delete(
                `/v1/media/slots/${params.ownerType}/${params.ownerId}/${params.slotName}`
            )
        },
        onSuccess: (_, vars) => {
            qc.invalidateQueries({
                queryKey: ["media-slots", vars.ownerType, vars.ownerId],
            })
        },
    })
}

// === HELPERS ===

/**
 * Get the serve URL for a specific slot from resolved slot data.
 * Falls back to undefined if the slot is not found.
 *
 * @param slots  - resolved slots array (from useMediaSlots)
 * @param slotName - e.g. "avatar", "banner", "watermark"
 * @param variant  - optional variant name (e.g. "thumb", "small", "large")
 */
export function getSlotUrl(
    slots: MediaSlot[] | undefined,
    slotName: string,
    variant?: string
): string | undefined {
    const slot = slots?.find((s) => s.slot_name === slotName)
    if (!slot) return undefined
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || ""
    if (variant && slot.variants[variant]) {
        return `${baseUrl}/v1/media/${slot.media_asset_id}/serve/${variant}`
    }
    return `${baseUrl}/v1/media/${slot.media_asset_id}/serve`
}

/**
 * Get a slot URL with a legacy media-id fallback.
 * Use this during the migration period when entities may still have
 * avatar_media_id / banner_media_id fields but no slot data yet.
 */
export function getSlotUrlWithFallback(
    slots: MediaSlot[] | undefined,
    slotName: string,
    legacyMediaId: string | undefined,
    variant?: string
): string | undefined {
    const slotUrl = getSlotUrl(slots, slotName, variant)
    if (slotUrl) return slotUrl
    if (!legacyMediaId) return undefined
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || ""
    return `${baseUrl}/v1/media/${legacyMediaId}/serve`
}
