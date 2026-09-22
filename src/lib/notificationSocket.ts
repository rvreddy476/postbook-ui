/**
 * NotificationSocket — persistent WebSocket connection for real-time notifications.
 *
 * Connects to the WS gateway at /v1/ws/notifications and dispatches typed events
 * to registered listeners. Includes heartbeat (30s ping) and exponential-backoff
 * reconnection (up to 10 attempts, max 30s delay).
 */

import { ensureAccessToken } from "@/lib/accessToken"

type Listener = (data: any) => void

// The token is no longer read from localStorage. It lives in memory and is
// resolved at connect time — see connect(), which awaits ensureAccessToken()
// so a cold tab opens its socket as soon as the refresh cookie is spent
// instead of silently never connecting.

function buildWsUrl(token: string): string {
    if (typeof window === "undefined") return ""

    const explicitBase = process.env.NEXT_PUBLIC_WS_BASE_URL ?? ""
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
    const path = `/v1/ws/notifications?access_token=${encodeURIComponent(token)}`

    if (explicitBase) {
        return `${explicitBase.replace(/\/+$/, "")}${path}`
    }

    // If an explicit API base URL is set, derive WS URL from it.
    if (apiBase) {
        const wsBase = apiBase.replace(/^http/, "ws").replace(/\/+$/, "")
        return `${wsBase}${path}`
    }

    // Next rewrites can proxy HTTP /v1 calls, but not browser WebSocket
    // upgrades. In local dev, connect directly to chat-ws-gateway.
    const { hostname } = window.location
    if (hostname === "localhost" || hostname === "127.0.0.1") {
        return `ws://${hostname}:8093${path}`
    }

    // Derive from current page origin (production behind cloudflared)
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
    return `${proto}//${window.location.host}${path}`
}

class NotificationSocket {
    private ws: WebSocket | null = null
    private token: string
    private listeners: Map<string, Set<Listener>> = new Map()
    private reconnectAttempts = 0
    private maxReconnectAttempts = 10
    private reconnectDelay = 1000
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null
    private _isConnected = false
    private destroyed = false

    constructor(token: string) {
        this.token = token
    }

    /** Whether the socket is currently open. */
    get isConnected(): boolean {
        return this._isConnected
    }

    /**
     * Open the WebSocket connection. Safe to call multiple times.
     *
     * Resolves the token itself rather than taking one from the constructor,
     * because the token now lives in memory: a tab that has just loaded has
     * none until the httpOnly refresh cookie has been spent once. Taking it
     * up front would mean every cold tab opened its socket with `null` — i.e.
     * never connected, with no error anywhere.
     */
    async connect(): Promise<void> {
        if (this.destroyed) return
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return
        }

        const token = (await ensureAccessToken()) ?? this.token
        if (this.destroyed) return
        if (!token) {
            // No session. Not an error, and not worth retrying in a loop —
            // a sign-in mints a token and the caller connects again.
            return
        }
        this.token = token

        const url = buildWsUrl(this.token)
        if (!url) return

        try {
            this.ws = new WebSocket(url)
        } catch {
            this.attemptReconnect()
            return
        }

        this.ws.onopen = () => {
            this._isConnected = true
            this.reconnectAttempts = 0
            this.reconnectDelay = 1000
            this.startHeartbeat()
            this.dispatch("_connected", {})
        }

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data)

                // Server pong — ignore
                if (message.type === "pong") return

                // Dispatch on the event type
                const type = message.type ?? message.event_type ?? "notification"
                this.dispatch(type, message.payload ?? message)
            } catch {
                // Ignore malformed frames
            }
        }

        this.ws.onclose = () => {
            this._isConnected = false
            this.stopHeartbeat()
            this.dispatch("_disconnected", {})
            this.attemptReconnect()
        }

        this.ws.onerror = () => {
            // onclose fires after onerror — reconnect is handled there
        }
    }

    /** Gracefully close the connection and stop all reconnect attempts. */
    disconnect(): void {
        this.destroyed = true
        this.stopHeartbeat()

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
        }

        if (this.ws) {
            this.ws.onclose = null // prevent reconnect
            this.ws.close()
            this.ws = null
        }

        this._isConnected = false
        this.listeners.clear()
    }

    /**
     * Send a typed envelope to the WS gateway. Used for client-originated
     * messages like conversation.enter / conversation.heartbeat /
     * conversation.leave / typing.start. Silently drops the send if the
     * socket isn't open — the gateway also has heartbeat-based recovery
     * so a missed beat isn't fatal.
     */
    send(payload: Record<string, unknown>): boolean {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false
        try {
            this.ws.send(JSON.stringify(payload))
            return true
        } catch {
            return false
        }
    }

    /**
     * Register a listener for a given event type.
     * Returns an unsubscribe function.
     *
     * Special types:
     *   "_connected"    — fires when the socket opens
     *   "_disconnected" — fires when the socket closes
     *   "notification"  — the standard activity notification event
     */
    on(type: string, callback: Listener): () => void {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set())
        }
        this.listeners.get(type)!.add(callback)

        return () => {
            const set = this.listeners.get(type)
            if (set) {
                set.delete(callback)
                if (set.size === 0) this.listeners.delete(type)
            }
        }
    }

    // ---- Private ----

    private dispatch(type: string, data: any): void {
        const set = this.listeners.get(type)
        if (set) {
            set.forEach((cb) => {
                try {
                    cb(data)
                } catch (err) {
                    console.error(`[NotificationSocket] listener error for "${type}":`, err)
                }
            })
        }
    }

    private startHeartbeat(): void {
        this.stopHeartbeat()
        this.heartbeatInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: "ping" }))
            }
        }, 30_000)
    }

    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval)
            this.heartbeatInterval = null
        }
    }

    private attemptReconnect(): void {
        if (this.destroyed) return
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.warn(
                `[NotificationSocket] gave up after ${this.maxReconnectAttempts} retries. Refresh the page to reconnect.`
            )
            return
        }

        // connect() re-resolves the token itself, so a rotation between
        // attempts is picked up without reading it here.

        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30_000)
        this.reconnectAttempts++

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            this.connect()
        }, delay)
    }
}

/* ------------------------------------------------------------------ */
/*  App-wide shared instance                                           */
/* ------------------------------------------------------------------ */

let sharedSocket: NotificationSocket | null = null

/**
 * getSharedNotificationSocket returns the process-wide realtime socket,
 * creating and connecting it on first call once an auth token exists.
 *
 * One socket for the whole tab is deliberate: the WS gateway treats an
 * open connection as the user's "online" presence, so the connection must
 * live for the entire authenticated session — not per-component. Every
 * consumer (notification bell, presence) shares this instance and just
 * registers its own listener via `.on(...)`; none of them should call
 * `disconnect()` on it.
 */
export function getSharedNotificationSocket(): NotificationSocket | null {
    if (typeof window === "undefined") return null
    if (sharedSocket) return sharedSocket
    // The instance is created without a token and resolves one inside
    // connect(). It used to return null when localStorage held no token,
    // which with an in-memory token would be true on every cold tab — and
    // callers register their listeners on the returned object, in effects
    // that do not run again, so a null here meant presence and live updates
    // stayed dead for the whole page.
    sharedSocket = new NotificationSocket("")
    void sharedSocket.connect()
    return sharedSocket
}

export default NotificationSocket
