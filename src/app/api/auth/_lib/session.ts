import { NextRequest, NextResponse } from "next/server"

/**
 * Server-side session cookies for the main Postbook app.
 *
 * Before this module the refresh token lived in localStorage under
 * `postbook_auth_tokens`, readable by any injected script. The PostMatch
 * half of this app already does the right thing (see src/lib/postmatchApi.ts
 * and src/app/api/postmatch/auth/*): the refresh token is held in an
 * httpOnly cookie set by a BFF route and never enters JS. This mirrors that
 * design for the main app.
 *
 * Two cookies, deliberately split:
 *
 *   pb_rt   the refresh token itself. httpOnly, SameSite=Lax,
 *           Secure in production, scoped to /api/auth — the only path that
 *           ever needs to read it. Not visible to page requests, so a
 *           stray log or a mis-scoped handler cannot leak it.
 *
 *   pb_auth an opaque presence flag ("1"). Same protections but scoped to
 *           "/" so middleware can see it on a page request.
 *           It carries no identity and no roles. It means "this browser
 *           completed a login"; it does NOT mean the session is still
 *           valid and it says nothing about what the user may do. Never
 *           authorise on it — see src/middleware.ts.
 *
 * Both are cleared together, so a browser cannot end up holding a refresh
 * token that middleware believes is absent.
 */

export const REFRESH_COOKIE = "pb_rt"
export const SESSION_FLAG_COOKIE = "pb_auth"

/** The refresh cookie is readable only by the BFF routes under /api/auth. */
export const REFRESH_COOKIE_PATH = "/api/auth"

/**
 * The access token, for media reads only.
 *
 * <img> and <video> cannot send an Authorization header, and the access token
 * otherwise lives only in page storage, so every image and video request
 * reached the gateway anonymous. media-service answers an anonymous read of
 * anything not world-readable with 404 (deliberately indistinguishable from
 * "does not exist"), which is why feed videos sat at 0:00.
 *
 * The gateway already reads a cookie named exactly `access_token` — it is how
 * a browser EventSource authenticates — so the name is not ours to choose.
 * Scoped to /v1/media so the browser attaches it to media reads and to NOTHING
 * else: no state-changing route ever receives it. httpOnly so script cannot
 * read it; SameSite=Lax so another site's <img> or <video> pointing at our
 * media does not carry it either.
 */
export const MEDIA_ACCESS_COOKIE = "access_token"
export const MEDIA_ACCESS_COOKIE_PATH = "/v1/media"

/** Seconds until the JWT's exp, or null if it cannot be read. Not a verification. */
function secondsUntilExpiry(jwt: string): number | null {
    try {
        const payload = JSON.parse(
            Buffer.from(jwt.split(".")[1] ?? "", "base64url").toString("utf8"),
        ) as { exp?: unknown }
        if (typeof payload.exp !== "number") return null
        const left = Math.floor(payload.exp - Date.now() / 1000)
        return left > 0 ? left : null
    } catch {
        return null
    }
}

/**
 * Matches the upstream refresh-token TTL ceiling. The server enforces its
 * own expiry on every refresh attempt, so this is only about not keeping a
 * dead cookie around forever.
 */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

/** The gateway is the hop the browser's own /v1/* rewrite already uses. */
export const API_GATEWAY_URL = process.env.API_GATEWAY_URL || "http://localhost:8080"

/** auth-service direct — what the pre-existing refresh route has always used. */
export const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:8081"

const secureCookies = () => process.env.NODE_ENV === "production"

/** Attach the refresh token, the presence flag, or both. */
export function attachSession(
    res: NextResponse,
    tokens: { refreshToken?: string; accessToken?: string },
) {
    if (tokens.refreshToken) {
        res.cookies.set({
            name: REFRESH_COOKIE,
            value: tokens.refreshToken,
            httpOnly: true,
            secure: secureCookies(),
            sameSite: "lax",
            path: REFRESH_COOKIE_PATH,
            maxAge: COOKIE_MAX_AGE_SECONDS,
        })
    }

    // The flag tracks "logged in", which an access token alone establishes.
    // Set it even when the upstream returned no refresh token so a session
    // that cannot be refreshed is still a session middleware lets through.
    if (tokens.refreshToken || tokens.accessToken) {
        res.cookies.set({
            name: SESSION_FLAG_COOKIE,
            value: "1",
            httpOnly: true,
            secure: secureCookies(),
            sameSite: "lax",
            path: "/",
            maxAge: COOKIE_MAX_AGE_SECONDS,
        })
    }

    // Lives exactly as long as the token it carries, so an expired token is
    // never presented. Every refresh re-sets it through this same function.
    if (tokens.accessToken) {
        res.cookies.set({
            name: MEDIA_ACCESS_COOKIE,
            value: tokens.accessToken,
            httpOnly: true,
            secure: secureCookies(),
            sameSite: "lax",
            path: MEDIA_ACCESS_COOKIE_PATH,
            maxAge: secondsUntilExpiry(tokens.accessToken) ?? 60 * 15,
        })
    }
}

/** Remove all three cookies. Safe to call when none is present. */
export function clearSession(res: NextResponse) {
    res.cookies.delete({ name: REFRESH_COOKIE, path: REFRESH_COOKIE_PATH })
    res.cookies.delete({ name: SESSION_FLAG_COOKIE, path: "/" })
    res.cookies.delete({ name: MEDIA_ACCESS_COOKIE, path: MEDIA_ACCESS_COOKIE_PATH })
}

/**
 * Forward the browser's User-Agent and client IP upstream.
 *
 * auth-service stores the User-Agent family and the /24 subnet at login and
 * compares them on every refresh (internal/service/auth.go,
 * refreshSessionOfKind). A User-Agent family that does not match is treated
 * as a stolen token and REVOKES the session. So login and refresh have to
 * present the same client, or a normal token renewal burns the session.
 *
 * The pre-existing /api/auth/refresh route forwards these; the /api/proxy
 * route login used to travel through does not, which means web logins have
 * been recording an empty fingerprint. Forwarding here makes the pair
 * consistent and turns that check back on.
 */
export function clientForwardHeaders(req: NextRequest): Record<string, string> {
    const headers: Record<string, string> = {}

    const ua = req.headers.get("user-agent")
    if (ua) headers["User-Agent"] = ua

    const forwardedFor =
        req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip")
    if (forwardedFor) headers["X-Forwarded-For"] = forwardedFor

    // Carried through for parity with the /api/proxy hop.
    for (const name of ["x-request-id", "x-client-platform", "accept-language"]) {
        const value = req.headers.get(name)
        if (value) headers[name] = value
    }

    return headers
}

type Dict = Record<string, unknown>

const asDict = (value: unknown): Dict | null =>
    value && typeof value === "object" && !Array.isArray(value) ? (value as Dict) : null

const asArray = (value: unknown): unknown[] | null =>
    Array.isArray(value) ? value : null

/**
 * Pull the refresh token out of an auth response and delete every copy of it
 * from the payload, so what reaches the browser cannot contain one.
 *
 * Mirrors responseMapper.ts:getTokens() — the token can sit at
 * `{ data: { tokens: {...} } }`, `{ data: {...} }`, `{ result: {...} }` or
 * the root. Walks a bounded depth rather than assuming one shape, because a
 * missed nesting here would silently put the token back in JS.
 */
export function takeRefreshToken(payload: unknown, depth = 0): string | undefined {
    if (depth > 6) return undefined

    const list = asArray(payload)
    if (list) {
        let found: string | undefined
        for (const entry of list) {
            const nested = takeRefreshToken(entry, depth + 1)
            if (nested && !found) found = nested
        }
        return found
    }

    const node = asDict(payload)
    if (!node) return undefined

    let found: string | undefined

    for (const key of ["refresh_token", "refreshToken"]) {
        const value = node[key]
        if (typeof value === "string" && value.trim() && !found) {
            found = value.trim()
        }
        if (key in node) {
            delete node[key]
        }
    }

    for (const value of Object.values(node)) {
        const nested = takeRefreshToken(value, depth + 1)
        if (nested && !found) found = nested
    }

    return found
}

/** Read an access token out of an auth response without removing it. */
export function readAccessToken(payload: unknown, depth = 0): string | undefined {
    if (depth > 6) return undefined

    const list = asArray(payload)
    if (list) {
        for (const entry of list) {
            const nested = readAccessToken(entry, depth + 1)
            if (nested) return nested
        }
        return undefined
    }

    const node = asDict(payload)
    if (!node) return undefined

    for (const key of ["access_token", "accessToken", "token"]) {
        const value = node[key]
        if (typeof value === "string" && value.trim()) return value.trim()
    }

    for (const value of Object.values(node)) {
        const nested = readAccessToken(value, depth + 1)
        if (nested) return nested
    }

    return undefined
}

const jsonResponse = (text: string, status: number) =>
    new NextResponse(text || JSON.stringify({ error: "upstream_error" }), {
        status,
        headers: { "Content-Type": "application/json" },
    })

/**
 * Proxy one auth endpoint, move any refresh token it returns into the
 * httpOnly cookie, and hand the rest of the payload to the browser.
 *
 * The upstream and the request body are unchanged from what the browser used
 * to send through the /v1/* → /api/proxy/* rewrite, so the login contract is
 * the same one the app has always spoken — only the refresh token's
 * destination changed.
 */
export async function passthroughAuth(req: NextRequest, upstreamPath: string) {
    const body = await req.text()

    let upstream: Response
    try {
        upstream = await fetch(`${API_GATEWAY_URL}${upstreamPath}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                ...clientForwardHeaders(req),
            },
            body,
            cache: "no-store",
        })
    } catch {
        return NextResponse.json(
            {
                error: {
                    code: "UPSTREAM_UNREACHABLE",
                    message: "Authentication service is unreachable. Please try again.",
                },
            },
            { status: 502 },
        )
    }

    const text = await upstream.text()
    if (!upstream.ok) {
        // Pass the upstream error body through untouched — authService.ts
        // maps its error codes to user-facing copy.
        return jsonResponse(text, upstream.status)
    }

    let payload: unknown
    try {
        payload = JSON.parse(text)
    } catch {
        return NextResponse.json(
            {
                error: {
                    code: "BAD_UPSTREAM_RESPONSE",
                    message: "Authentication service returned an unreadable response.",
                },
            },
            { status: 502 },
        )
    }

    const refreshToken = takeRefreshToken(payload)
    const accessToken = readAccessToken(payload)

    const res = NextResponse.json(payload)
    attachSession(res, { refreshToken, accessToken })
    return res
}
