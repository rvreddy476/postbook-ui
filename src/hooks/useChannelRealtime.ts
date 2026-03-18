"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useNotificationSocket } from "@/hooks/useNotificationSocket"

/**
 * Hook for broadcast channel pages that listens for real-time
 * channel_update notifications and invalidates the relevant queries
 * so the UI stays fresh without manual polling.
 */
export function useChannelRealtime(channelId: string) {
    const { on } = useNotificationSocket()
    const queryClient = useQueryClient()

    useEffect(() => {
        if (!channelId) return

        const unsub = on("notification", (data: any) => {
            // Only react to channel_update events for this channel
            if (data.channel_id === channelId && data.notif_type === "channel_update") {
                // Refresh the updates list
                queryClient.invalidateQueries({ queryKey: ["channel-updates", channelId] })
                // Refresh channel metadata (subscriber count, last activity, etc.)
                queryClient.invalidateQueries({ queryKey: ["broadcast-channel", channelId] })
            }
        })

        return unsub
    }, [channelId, on, queryClient])
}
