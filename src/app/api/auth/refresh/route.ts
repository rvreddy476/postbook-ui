import { NextRequest, NextResponse } from "next/server"
import {
    AUTH_SERVICE_URL,
    REFRESH_COOKIE,
    attachSession,
    clearSession,
    clientForwardHeaders,
    readAccessToken,
    takeRefreshToken,
} from "../_lib/session"

/**
 * Refresh the access token from the httpOnly refresh cookie.
 *
 * This route used to take the refresh token in the request body, which meant
 * the caller had to keep it in localStorage. It now reads pb_rt, which JS
 * cannot see, and rotates that cookie with whatever the upstream returns.
 * The response carries only the access token.
 */
export async function POST(req: NextRequest) {
    const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value?.trim()

    if (!refreshToken) {
        // No cookie: either never logged in, or logged out. 401 is what the
        // axios interceptor reads as "the session is gone, stop retrying".
        const res = NextResponse.json(
            { error: { code: "NO_REFRESH_TOKEN", message: "No active session." } },
            { status: 401 },
        )
        clearSession(res)
        return res
    }

    // Forward the browser's User-Agent and client IP so auth-service's
    // fingerprint check (UA family + /24 subnet against the values stored at
    // login) doesn't deny — or revoke — the session. See _lib/session.ts.
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...clientForwardHeaders(req),
    }

    // The auth-service Refresh handler reads the token from the JSON body
    // (field "refresh_token") when no cookie is present — explicitly supported
    // for mobile/non-browser clients. Sending it as a Cookie header was broken
    // because encodeURIComponent() changed the token value (e.g. + → %2B) and
    // Gin reads cookie values raw (no URL-decoding), causing a database mismatch.
    let upstream: Response
    try {
        upstream = await fetch(`${AUTH_SERVICE_URL}/v1/auth/refresh`, {
            method: "POST",
            headers,
            body: JSON.stringify({ refresh_token: refreshToken }),
            cache: "no-store",
        })
    } catch {
        // Network trouble is not proof the session is dead — keep the cookie
        // so a later attempt can still succeed, and say so explicitly. The
        // axios interceptor reads a non-401 as "unavailable" and leaves the
        // user signed in.
        return NextResponse.json(
            {
                error: {
                    code: "UPSTREAM_UNREACHABLE",
                    message: "Authentication service is unreachable.",
                },
            },
            { status: 503 },
        )
    }

    const text = await upstream.text()

    if (!upstream.ok) {
        const res = new NextResponse(
            text || JSON.stringify({ error: { code: "REFRESH_FAILED" } }),
            { status: upstream.status, headers: { "Content-Type": "application/json" } },
        )
        // A refused refresh means this token will not work again — upstream
        // revokes the session on a fingerprint mismatch. Drop the cookies so
        // the browser stops presenting a dead session to middleware.
        if (upstream.status === 401 || upstream.status === 403) {
            clearSession(res)
        }
        return res
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

    // takeRefreshToken strips the rotated token from the payload before it is
    // serialised back to the browser.
    const rotatedRefresh = takeRefreshToken(payload)
    const accessToken = readAccessToken(payload)

    if (!accessToken) {
        return NextResponse.json(
            {
                error: {
                    code: "INCOMPLETE_UPSTREAM_RESPONSE",
                    message: "Refresh succeeded but returned no access token.",
                },
            },
            { status: 502 },
        )
    }

    const res = NextResponse.json(payload)
    attachSession(res, { refreshToken: rotatedRefresh, accessToken })
    return res
}
