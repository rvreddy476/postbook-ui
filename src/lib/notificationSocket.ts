/**
 * NotificationSocket — persistent WebSocket connection for real-time notifications.
 *
 * Connects to the WS gateway at /v1/ws/notifications and dispatches typed events
 * to registered listeners. Includes heartbeat (30s ping) and exponential-backoff
 * reconnection (up to 10 attempts, max 30s delay).
 */

type Listener = (data: any) => void

const TOKEN_KEY = "postbook_auth_tokens"

function getStoredAccessToken(): string | null {
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

function buildWsUrl(token: string): string {
    if (typeof window === "undefined") return ""

    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

    // If an explicit API base URL is set, derive WS URL from it
    if (apiBase) {
        const wsBase = apiBase.replace(/^http/, "ws")
        return `${wsBase}/v1/ws/notifications?token=${encodeURIComponent(token)}`
    }

    // Derive from current page origin (production behind cloudflared)
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
    return `${proto}//${window.location.host}/v1/ws/notifications?token=${encodeURIComponent(token)}`
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

    /** Open the WebSocket connection. Safe to call multiple times. */
    connect(): void {
        if (this.destroyed) return
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return
        }

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

        // Refresh token on reconnect in case it was rotated
        const freshToken = getStoredAccessToken()
        if (freshToken) {
            this.token = freshToken
        }

        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30_000)
        this.reconnectAttempts++

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            this.connect()
        }, delay)
    }
}

export default NotificationSocket
