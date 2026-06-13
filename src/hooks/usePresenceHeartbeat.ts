"use client"

import { useEffect, useRef } from "react"
import api from "@/lib/api"
import { getSharedNotificationSocket } from "@/lib/notificationSocket"
import { useAuthUser } from "@/store/auth"

/**
 * usePresenceHeartbeat keeps the logged-in web user marked "online".
 *
 * Why this exists: the server stores presence as a Redis key
 * `presence:{userID}` with a 90s TTL. That key is only ever written by a
 * heartbeat. The mobile app has one (PresenceService); the web app never
 * did — so every web-only user was permanently Offline to their friends,
 * no matter how often the friend's page polled.
 *
 * While authenticated and the tab is visible it POSTs
 * `/v1/users/me/heartbeat` immediately (online within a blink of login),
 * then every 30s — well inside the 90s TTL. It pauses when the tab is
 * hidden and beats again on return, so a buried tab eventually expires
 * to Offline rather than lying "online" forever.
 */
const HEARTBEAT_MS = 30_000

export function usePresenceHeartbeat() {
    const user = useAuthUser()
    const userId = user?.id ?? null
    const sendingRef = useRef(false)

    useEffect(() => {
        if (!userId) return

        // Ensure the app-wide realtime WebSocket is open for the whole
        // session. The WS gateway treats an open connection as "online" and
        // broadcasts presence changes over it — this is what makes a friend
        // coming online show up instantly (see usePresence).
        getSharedNotificationSocket()

        let cancelled = false

        const beat = async () => {
            if (cancelled || sendingRef.current) return
            if (typeof document !== "undefined" && document.hidden) return
            sendingRef.current = true
            try {
                await api.post("/v1/users/me/heartbeat")
            } catch {
                // Best-effort: a missed beat just risks the dot going
                // stale; the next beat recovers it.
            } finally {
                sendingRef.current = false
            }
        }

        beat() // immediate — don't wait a full interval to show online
        const timer = setInterval(beat, HEARTBEAT_MS)
        const onVisibility = () => {
            if (!document.hidden) beat()
        }
        document.addEventListener("visibilitychange", onVisibility)

        return () => {
            cancelled = true
            clearInterval(timer)
            document.removeEventListener("visibilitychange", onVisibility)
        }
    }, [userId])
}
