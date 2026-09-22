/**
 * The access token, in memory only.
 *
 * It used to live in localStorage under `postbook_auth_tokens`, where any
 * injected script could read it — one XSS anywhere in the app, in any
 * dependency, in any third-party widget, and the token is exfiltrated and
 * replayable until it expires. localStorage has no expiry, no origin
 * isolation beyond the origin itself, and no way to mark a value
 * script-invisible.
 *
 * So the browser now holds credentials the way the BFF pattern intends:
 *
 *   refresh token   httpOnly, Secure, SameSite cookie (`pb_rt`, scoped to
 *                   /api/auth). Script cannot read it, so XSS cannot steal
 *                   it; it can only be spent through our own origin.
 *   access token    a module variable in this file. Gone when the tab
 *                   closes, never written to disk, never in a storage
 *                   inspector, and not shared with another tab.
 *
 * The cost is that a fresh tab starts with no access token. That is what
 * `ensureAccessToken()` is for: it spends the refresh cookie once, on
 * demand, and every caller awaits the same in-flight promise.
 *
 * This also removes the drift that made a signed-out browser keep working.
 * Before, the cookie and localStorage were two independent sources of
 * truth: clear one and the other still said "signed in". Now there is one
 * source — the refresh cookie — and the access token is derived from it.
 * No cookie means no token means no API call, in every tab, immediately.
 */

/** Legacy storage slot. Read once at boot so old tokens stop sitting on disk. */
const LEGACY_TOKEN_KEY = "postbook_auth_tokens"

const REFRESH_PATH = "/api/auth/refresh"

let memAccessToken: string | null = null

/** In-flight refresh, so N concurrent 401s spend the refresh cookie once. */
let inFlight: Promise<string | null> | null = null

/**
 * Whether the refresh cookie has been proven dead. Set when the server says
 * 401/403 — not when it is merely unreachable, which must not sign anyone
 * out.
 */
let refreshRejected = false

type Listener = (token: string | null) => void
const listeners = new Set<Listener>()

function announce() {
    for (const listener of listeners) {
        try {
            listener(memAccessToken)
        } catch {
            // A listener must not be able to break the token store.
        }
    }
}

/**
 * Called when a token arrives (login, 2FA, refresh). The only writer.
 */
export function setAccessToken(token: string | null) {
    memAccessToken = token && token.trim() ? token.trim() : null
    if (memAccessToken) refreshRejected = false
    announce()
}

/** The current token, or null. Synchronous; does not refresh. */
export function peekAccessToken(): string | null {
    return memAccessToken
}

/** Forget the token. Does not touch cookies — logout's route does that. */
export function clearAccessToken() {
    memAccessToken = null
    inFlight = null
    announce()
}

/**
 * Subscribe to token changes. Used by long-lived transports (the chat and
 * notification sockets) that hold a token for the life of a connection and
 * would otherwise keep using a stale one after a refresh.
 */
export function onAccessTokenChange(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

/** Distinguishes "your session is over" from "the network is down". */
export type RefreshOutcome = "ok" | "invalid" | "unavailable"

let lastOutcome: RefreshOutcome = "ok"

/** The result of the most recent refresh attempt. */
export function lastRefreshOutcome(): RefreshOutcome {
    return lastOutcome
}

/**
 * Spend the refresh cookie for a new access token.
 *
 * `credentials: "same-origin"` is what sends `pb_rt`; without it the route
 * sees no cookie and answers 401, which would look exactly like an expired
 * session.
 */
async function refreshOnce(): Promise<string | null> {
    try {
        const res = await fetch(REFRESH_PATH, {
            method: "POST",
            credentials: "same-origin",
            headers: { Accept: "application/json" },
            cache: "no-store",
        })

        if (!res.ok) {
            // 401/403 is the server saying this refresh token is finished.
            // Anything else — 502, 503, a dead origin — is not, and must not
            // end anyone's session.
            lastOutcome = res.status === 401 || res.status === 403 ? "invalid" : "unavailable"
            if (lastOutcome === "invalid") refreshRejected = true
            return null
        }

        const payload = (await res.json()) as unknown
        const token = readAccessToken(payload)
        if (!token) {
            lastOutcome = "unavailable"
            return null
        }
        lastOutcome = "ok"
        setAccessToken(token)
        return token
    } catch {
        lastOutcome = "unavailable"
        return null
    }
}

/**
 * The token, refreshing if there isn't one.
 *
 * Every caller shares one in-flight request: a cold tab that fires twelve
 * authenticated requests at once spends the refresh cookie once, not twelve
 * times. That matters because the server ROTATES the refresh token, so a
 * second concurrent spend would present an already-used one.
 */
export function ensureAccessToken(): Promise<string | null> {
    // A token that is expired, or about to be, is not "a token we have".
    // Without this check a tab left open past the token's lifetime kept
    // presenting the dead one: every fetch-based caller — the notification
    // stream, the chat client — got 401 and simply retried with the same
    // token forever, because only the axios path knew how to refresh on
    // 401. Refresh proactively instead, 30s before expiry.
    if (memAccessToken && !isExpiringSoon(memAccessToken)) return Promise.resolve(memAccessToken)
    if (memAccessToken) {
        // Expired or nearly so: mint a new one; fall through to the
        // single-flight refresh below.
        memAccessToken = null
    }
    // A refresh cookie the server has already rejected is not worth
    // re-presenting on every request for the rest of the page's life.
    if (refreshRejected) return Promise.resolve(null)
    if (inFlight) return inFlight

    inFlight = refreshOnce().finally(() => {
        inFlight = null
    })
    return inFlight
}

/**
 * Force a refresh even though a token is held — the 401 path, where the
 * token we have is known to be stale.
 */
export function forceRefresh(): Promise<string | null> {
    if (refreshRejected) return Promise.resolve(null)
    if (inFlight) return inFlight
    memAccessToken = null
    inFlight = refreshOnce().finally(() => {
        inFlight = null
    })
    return inFlight
}

/**
 * Delete the legacy localStorage token.
 *
 * Existing browsers are carrying one right now. Leaving it there would keep
 * the exact exposure this module exists to remove, and a stale copy would
 * outlive the session it belongs to.
 */
export function purgeLegacyTokenStorage() {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return
    try {
        localStorage.removeItem(LEGACY_TOKEN_KEY)
    } catch {
        // Private mode / quota — nothing to clean up in that case anyway.
    }
}

/**
 * Whether a JWT is expired or within 30s of it. An unreadable token is
 * treated as expiring: presenting it would only earn a 401 anyway.
 * This is not verification — the server does that — only a reason to
 * refresh before the server has to tell us.
 */
function isExpiringSoon(jwt: string): boolean {
    try {
        const payload = JSON.parse(atob(jwt.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/") ?? "")) as {
            exp?: unknown
        }
        if (typeof payload.exp !== "number") return false
        return payload.exp * 1000 - Date.now() < 30_000
    } catch {
        return true
    }
}

/** Pull an access token out of the several shapes auth responses use. */
function readAccessToken(payload: unknown, depth = 0): string | null {
    if (depth > 6 || !payload || typeof payload !== "object") return null

    if (Array.isArray(payload)) {
        for (const entry of payload) {
            const found = readAccessToken(entry, depth + 1)
            if (found) return found
        }
        return null
    }

    const node = payload as Record<string, unknown>
    for (const key of ["access_token", "accessToken", "token"]) {
        const value = node[key]
        if (typeof value === "string" && value.trim()) return value.trim()
    }
    for (const value of Object.values(node)) {
        const found = readAccessToken(value, depth + 1)
        if (found) return found
    }
    return null
}
