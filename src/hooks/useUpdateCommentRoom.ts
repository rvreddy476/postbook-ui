"use client"

import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
    subscribeToUpdateRoom,
    unsubscribeFromUpdateRoom,
    subscribeToCommentUpdates,
    type ChannelCommentUpdate,
} from "@/services/messageService"

/**
 * Subscribes to real-time comment updates for a channel update via WebSocket.
 * On mount (when updateId is set): sends subscribe_update to ws-gateway.
 * On unmount or when updateId changes: sends unsubscribe_update.
 * Deduplicates by event_id using a capped Set (max 500).
 */
export function useUpdateCommentRoom(
    updateId: string | undefined,
    channelId: string | undefined,
    onRealtimeEvent?: (event: ChannelCommentUpdate) => void,
) {
    const qc = useQueryClient()
    const dedupRef = useRef<Set<string>>(new Set())
    const onEventRef = useRef(onRealtimeEvent)
    onEventRef.current = onRealtimeEvent

    useEffect(() => {
        if (!updateId) return

        subscribeToUpdateRoom(updateId)

        const unsub = subscribeToCommentUpdates((event: ChannelCommentUpdate) => {
            if (event.update_id !== updateId) return

            // Deduplicate by event_id
            if (event.event_id && dedupRef.current.has(event.event_id)) return
            if (event.event_id) {
                dedupRef.current.add(event.event_id)
                // Cap at 500 entries — FIFO eviction
                if (dedupRef.current.size > 500) {
                    const first = dedupRef.current.values().next().value
                    if (first) dedupRef.current.delete(first)
                }
            }

            // Invoke the callback for local state merge
            onEventRef.current?.(event)

            // Invalidate React Query caches
            if (channelId) {
                qc.invalidateQueries({ queryKey: ["channel-comments", channelId, updateId] })
                qc.invalidateQueries({ queryKey: ["channel-updates", channelId] })
            }
        })

        return () => {
            unsubscribeFromUpdateRoom(updateId)
            unsub()
            dedupRef.current.clear()
        }
    }, [updateId, channelId, qc])
}
