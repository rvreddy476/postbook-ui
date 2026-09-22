"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { ToastProvider } from "@/contexts/ToastContext"
import { NotificationProvider } from "@/contexts/NotificationContext"
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat"
import { useAuthUser } from "@/store/auth"
import { connectToHub } from "@/services/messageService"
import { ensureAccessToken, lastRefreshOutcome } from "@/lib/accessToken"
import { getSession, logoutUser } from "@/services/authService"
import CallOverlay from "@/components/CallOverlay"

/**
 * SessionReconciler makes the httpOnly refresh cookie the single authority
 * on whether this browser is signed in.
 *
 * The cached user record in localStorage and the cookies used to be two
 * independent sources of truth, and they drifted: clear one and the other
 * still said "signed in". That is how a browser could keep behaving as a
 * live session after a sign-out whose cookie-clearing request never landed.
 *
 * So on every load we try to mint an access token from the cookie. If the
 * server says that cookie is finished — 401/403, and NOT merely unreachable
 * — then the cached record is a claim nothing backs, and it goes. That fires
 * session-changed, which lands the user on /login.
 *
 * A network failure is deliberately not a sign-out: an origin that is down
 * must not log anybody out.
 *
 * Renders nothing.
 */
function SessionReconciler() {
    useEffect(() => {
        let cancelled = false
        void (async () => {
            // Nothing cached means nothing to reconcile — and a signed-out
            // visitor should not have the refresh cookie probed on every view.
            if (!getSession()) return
            await ensureAccessToken()
            if (cancelled) return
            if (lastRefreshOutcome() === "invalid") {
                logoutUser()
            }
        })()
        return () => {
            cancelled = true
        }
    }, [])
    return null
}

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
                <SessionReconciler />
                <PresenceHeartbeat />
                {/* Global on purpose. Importing CallOverlay is what registers
                    the signalling listener (callService subscribes at module
                    load), and both were mounted only on the "/" route — so on
                    /messenger an incoming call_offer had no listener and no
                    overlay: it was dropped before anything could ring. */}
                <CallOverlay />
                <AppNotifications>{children}</AppNotifications>
            </ToastProvider>
        </QueryClientProvider>
    )
}
