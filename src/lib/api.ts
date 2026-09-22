import axios, { AxiosError, InternalAxiosRequestConfig } from "axios"
import {
    clearAccessToken,
    ensureAccessToken,
    forceRefresh,
    peekAccessToken,
    purgeLegacyTokenStorage,
} from "@/lib/accessToken"

const SESSION_KEY = "postbook_session"

const canUseStorage = () =>
    typeof window !== "undefined" && typeof localStorage !== "undefined"

/**
 * The access token is NOT stored here any more — it lives in memory, in
 * src/lib/accessToken.ts, derived on demand from the httpOnly refresh cookie.
 *
 * It used to sit in localStorage under `postbook_auth_tokens`, readable by
 * any injected script, so one XSS anywhere in the app — or in any dependency
 * it loads — exfiltrated a replayable session. See accessToken.ts.
 */

// Drops the expired access token — does NOT touch the session user record and
// does NOT fire session-changed. Keeps the user visually logged in while
// preventing a stale token from being sent again. If the session is genuinely
// over, the refresh route has already dropped the cookies and middleware
// redirects on the next navigation.
const clearExpiredTokens = () => {
    clearAccessToken()
}

const getUserId = (): string | null => {
    if (!canUseStorage()) return null
    try {
        const raw = localStorage.getItem(SESSION_KEY)
        if (!raw) return null
        const user = JSON.parse(raw) as { id?: string }
        return user.id ?? null
    } catch {
        return null
    }
}

/**
 * Public accessor for the current user's ID. Returns null when no
 * session is active. Reads from the same storage slot used by the
 * axios interceptor so the value is consistent across surfaces.
 *
 * Components subscribe to session changes via the session-changed event
 * if they need to react; the snapshot returned by this function is
 * a point-in-time read.
 */
export const getCurrentUserId = getUserId

/**
 * One-shot migration for sessions created before the refresh token moved to
 * a cookie.
 *
 * Those browsers still have a refresh token in localStorage. Without this
 * they would either keep using it from JS (the thing we are removing) or be
 * forced to sign in again. Instead the token is handed to /api/auth/session,
 * which verifies it against the access token, stores it httpOnly, and then it
 * is deleted from localStorage — whatever the outcome, it does not stay here.
 *
 * Runs once per page load, and only when a legacy token is actually present.
 */
const migrateLegacyTokenStorage = () => {
    if (!canUseStorage()) return

    let legacyRefresh: string | undefined
    let accessToken: string | undefined

    try {
        const raw = localStorage.getItem("postbook_auth_tokens")
        if (!raw) return
        const record = JSON.parse(raw) as {
            accessToken?: string
            refreshToken?: string
        }
        legacyRefresh = record.refreshToken?.trim() || undefined
        accessToken = record.accessToken?.trim() || undefined
    } catch {
        // Unreadable record — still delete it below.
    }

    // Unconditional, and first: whatever happens next, no token stays on disk.
    purgeLegacyTokenStorage()

    // An access token alone is not worth adopting — it expires in minutes and
    // ensureAccessToken() will mint a fresh one from the cookie. Only a
    // legacy REFRESH token is worth converting, and only with an access token
    // to prove the pair with, which is what /api/auth/session requires.
    if (!legacyRefresh || !accessToken) return

    void fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, refreshToken: legacyRefresh }),
    }).catch(() => {
        // Nothing to undo: the token is out of localStorage either way.
    })
}

if (typeof window !== "undefined") {
    migrateLegacyTokenStorage()
}

/**
 * Echo the server's CSRF token. Never mint one.
 *
 * This used to generate a random value, write it to a `csrf_token` cookie and
 * send it as X-CSRF-Token — a token the client invented, which proves nothing
 * and reads like protection that exists. auth-service issues the real
 * `csrf_token` cookie on login and refresh (handler.go setAuthCookies), and
 * its middleware compares that cookie against the header. A self-minted pair
 * satisfies that comparison with a value the server never chose, so the
 * forgery was not merely useless — it was the check answering itself.
 *
 * Now: send the header only when the server has actually set the cookie. If
 * there is no cookie there is no header, and the server decides what to do
 * about that.
 *
 * Worth knowing: for this app the header is usually moot either way. The
 * shared CSRF middleware skips the check entirely when the request is
 * authenticated by a bearer token (shared/middleware/csrf.go), which is how
 * every call here authenticates. It matters only on cookie-authenticated
 * paths.
 */
const readServerCsrfToken = (): string | null => {
    if (typeof document === "undefined") return null
    const match = document.cookie
        .split("; ")
        .find((c) => c.startsWith("csrf_token="))
    if (!match) return null
    const value = match.slice("csrf_token=".length)
    return value ? decodeURIComponent(value) : null
}

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || "",
    withCredentials: false,
})

api.interceptors.request.use(async (config) => {
    // Async on purpose. The token lives in memory, so a freshly opened tab
    // has none until the refresh cookie has been spent once. Awaiting here
    // means the very first request of a cold tab carries a token instead of
    // 401-ing and relying on the retry path — and ensureAccessToken()
    // single-flights, so twelve simultaneous requests still refresh once.
    const token = await ensureAccessToken()
    if (token) {
        config.headers["Authorization"] = `Bearer ${token}`
    }

    const userId = getUserId()
    if (userId) {
        config.headers["X-User-Id"] = userId
    }

    if (config.method && ["post", "put", "delete", "patch"].includes(config.method.toLowerCase())) {
        config.headers["X-Requested-With"] = "XMLHttpRequest"
        const csrfToken = readServerCsrfToken()
        if (csrfToken) {
            config.headers["X-CSRF-Token"] = csrfToken
        }
    }

    // Removed: an `X-Admin-Role: rider:admin` header that this client attached
    // to every /v1/rider/admin/* request.
    //
    // It never authorised anything it appeared to. Since 2026-09-07 the
    // gateway strips client-supplied identity headers and re-stamps X-Scopes
    // from the signed token, and rider-service's AdminGuard authorises on that
    // claim (services/rider-service/internal/http/middleware/audit.go, which
    // keeps the old constant purely to document the change). Sending it did
    // nothing except make this file look like it granted itself admin.
    //
    // Before that date it DID work, on any authenticated user willing to send
    // one header — which is what made removing it worth doing rather than
    // leaving as harmless dead weight.

    return config
})

// The refresh itself, its single-flight guard and the "invalid vs merely
// unreachable" distinction all live in src/lib/accessToken.ts now, so every
// caller — axios, the sockets, the fetch-based hooks — shares one in-flight
// request against a refresh token the server rotates on every use.

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
            originalRequest._retry = true

            // forceRefresh, not ensureAccessToken: we hold a token and it has
            // just been refused, so "there is already a token" is exactly the
            // wrong reason to skip the refresh.
            const newToken = await forceRefresh()
            if (newToken) {
                originalRequest.headers["Authorization"] = `Bearer ${newToken}`
                return api(originalRequest)
            }

            clearExpiredTokens()
        } else if (error.response?.status === 401) {
            clearExpiredTokens()
        }

        return Promise.reject(error)
    }
)

export { peekAccessToken }

export default api
