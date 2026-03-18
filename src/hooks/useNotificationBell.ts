"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { useNotificationSocket } from "@/hooks/useNotificationSocket"
import { playNotificationSound } from "@/hooks/useNotificationSound"

export interface BellNotification {
    notification_id: string
    type: string
    actor_user_id: string
    entity_type: string
    entity_id: string
    deep_link?: string
    is_read: boolean
    created_at: string
    title?: string
    body?: string
    image_url?: string
    severity?: "normal" | "critical"
    channel_id?: string
    notif_type?: string
}

/**
 * Hook for the header notification bell.
 *
 * - Fetches the initial unread count on mount via GET /v1/notifications/unread-count
 * - Listens for real-time "notification" WebSocket events to increment count and
 *   prepend to the in-memory list
 * - Provides markAsRead and markAllSeen helpers
 */
export function useNotificationBell() {
    const [unreadCount, setUnreadCount] = useState(0)
    const [notifications, setNotifications] = useState<BellNotification[]>([])
    const { on } = useNotificationSocket()
    const queryClient = useQueryClient()
    const mountedRef = useRef(true)

    // Fetch initial unread count
    useEffect(() => {
        mountedRef.current = true

        const fetchUnread = async () => {
            try {
                const res = await api.get<{ data: { count: number } }>("/v1/notifications/unread-count")
                if (mountedRef.current) {
                    setUnreadCount(res.data?.data?.count ?? 0)
                }
            } catch {
                // Silently fail — the polling in useUnreadCount will catch up
            }
        }

        fetchUnread()

        return () => {
            mountedRef.current = false
        }
    }, [])

    // Listen for real-time notification events
    useEffect(() => {
        const unsub = on("notification", (data: any) => {
            if (!mountedRef.current) return

            const notif: BellNotification = {
                notification_id: data.notification_id ?? data.id ?? crypto.randomUUID(),
                type: data.type ?? data.notif_type ?? "notification",
                actor_user_id: data.actor_user_id ?? "",
                entity_type: data.entity_type ?? "",
                entity_id: data.entity_id ?? "",
                deep_link: data.deep_link,
                is_read: false,
                created_at: data.created_at ?? new Date().toISOString(),
                title: data.title,
                body: data.body,
                image_url: data.image_url,
                severity: data.severity ?? "normal",
                channel_id: data.channel_id,
                notif_type: data.notif_type,
            }

            // Increment unread count
            setUnreadCount((prev) => prev + 1)

            // Prepend to list (keep max 50 in memory)
            setNotifications((prev) => [notif, ...prev].slice(0, 50))

            // Invalidate React Query caches so the full notification list refreshes
            queryClient.invalidateQueries({ queryKey: ["activity-notifications"] })
            queryClient.invalidateQueries({ queryKey: ["unread-count"] })

            // Play sound
            playNotificationSound()
        })

        return unsub
    }, [on, queryClient])

    /** Mark a single notification as read (decrements unread count). */
    const markAsRead = useCallback(
        async (notificationId: string, bucket?: number, ts?: string) => {
            setNotifications((prev) =>
                prev.map((n) =>
                    n.notification_id === notificationId ? { ...n, is_read: true } : n
                )
            )
            setUnreadCount((prev) => Math.max(0, prev - 1))

            if (bucket != null && ts) {
                try {
                    await api.post("/v1/notifications/read", { bucket, ts })
                    queryClient.invalidateQueries({ queryKey: ["activity-notifications"] })
                    queryClient.invalidateQueries({ queryKey: ["unread-count"] })
                } catch {
                    // Optimistic update already applied
                }
            }
        },
        [queryClient]
    )

    /** Mark all notifications as seen (resets unread count to 0). */
    const markAllSeen = useCallback(async () => {
        setUnreadCount(0)
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))

        try {
            await api.patch("/v1/notifications/read-all")
            queryClient.invalidateQueries({ queryKey: ["activity-notifications"] })
            queryClient.invalidateQueries({ queryKey: ["unread-count"] })
        } catch {
            // Optimistic update already applied
        }
    }, [queryClient])

    return { unreadCount, notifications, markAsRead, markAllSeen }
}
