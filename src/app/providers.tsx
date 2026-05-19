"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { ToastProvider } from "@/contexts/ToastContext"
import { NotificationProvider } from "@/contexts/NotificationContext"
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat"
import { useAuthUser } from "@/store/auth"
import { connectToHub } from "@/services/messageService"

/**
 * PresenceHeartbeat marks the logged-in web user online for the whole
 * authenticated session. Renders nothing — it just runs the heartbeat.
 */
function PresenceHeartbeat() {
    usePresenceHeartbeat()
    return null
}

/**
 * AppNotifications mounts the unread-message tracker app-wide, so every
 * screen (Friends, Messenger, …) shares one real-time unread count via
 * useNotifications(). It also opens the chat WebSocket hub for the whole
 * session, so a new message bumps the count live everywhere — not only
 * while the Messenger page is open.
 */
function AppNotifications({ children }: { children: React.ReactNode }) {
    const user = useAuthUser()
    const userId = user?.id ?? ""

    useEffect(() => {
        // Idempotent — no-op when the hub socket is already open.
        if (userId) void connectToHub(() => {})
    }, [userId])

    return (
        <NotificationProvider currentUserId={userId}>
            {children}
        </NotificationProvider>
    )
}

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        refetchOnWindowFocus: false,
                        retry: false,
                    },
                },
            })
    )

    return (
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <PresenceHeartbeat />
                <AppNotifications>{children}</AppNotifications>
            </ToastProvider>
        </QueryClientProvider>
    )
}
