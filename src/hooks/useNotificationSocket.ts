"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import NotificationSocket from "@/lib/notificationSocket"

const TOKEN_KEY = "postbook_auth_tokens"

function getAccessToken(): string | null {
    if (typeof window === "undefined") return null
    try {
        const raw = localStorage.getItem(TOKEN_KEY)
        if (!raw) return null
        const record = JSON.parse(raw) as { accessToken?: string }
        return record.accessToken ?? null
    } catch {
        return null
    }
}

/**
 * React hook that manages the NotificationSocket lifecycle.
 *
 * - Creates a single socket instance per mount
 * - Connects when an auth token is available
 * - Disconnects on unmount
 *
 * Returns:
 *   on           — register a listener for a given event type (returns unsubscribe fn)
 *   isConnected  — whether the socket is currently open
 */
export function useNotificationSocket() {
    const socketRef = useRef<NotificationSocket | null>(null)
    const [isConnected, setIsConnected] = useState(false)

    useEffect(() => {
        const token = getAccessToken()
        if (!token) return

        const socket = new NotificationSocket(token)
        socketRef.current = socket

        // Track connection state
        const unsubConnected = socket.on("_connected", () => setIsConnected(true))
        const unsubDisconnected = socket.on("_disconnected", () => setIsConnected(false))

        socket.connect()

        return () => {
            unsubConnected()
            unsubDisconnected()
            socket.disconnect()
            socketRef.current = null
            setIsConnected(false)
        }
    }, [])

    const on = useCallback((type: string, callback: (data: any) => void): (() => void) => {
        const socket = socketRef.current
        if (!socket) {
            // Return no-op unsubscribe if socket is not yet ready
            return () => {}
        }
        return socket.on(type, callback)
    }, [])

    return { on, isConnected }
}
