"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import NotificationSocket from "@/lib/notificationSocket"

// The token is no longer read from localStorage here — the socket resolves
// it from memory inside connect(), which also means this effect no longer
// has to bail out on a cold tab that has not minted one yet.

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
        const socket = new NotificationSocket("")
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
