import { NextRequest, NextResponse } from "next/server"
import {
    AUTH_SERVICE_URL,
    attachSession,
    clearSession,
    clientForwardHeaders,
} from "../_lib/session"

/**
 * Adopt a refresh token the browser is already holding into the httpOnly
 * cookie, and forget it everywhere else.
 *
 * Needed for two paths that do not go through the BFF login routes:
 *
 *   1. OAuth. The provider callback lands on /auth/callback, which builds the
 *      AuthResult in the page and hands it to AuthSessionStore. That page is
 *      outside this lane's file scope, so the token arrives in JS; this route
 *      is how it stops being kept there.
 *
 *   2. Migration. Sessions created before this change have a refresh token
 *      sitting in localStorage under `postbook_auth_tokens`. src/lib/api.ts
 *      posts it here once on boot and deletes it, so existing users are not
 *      forced to sign in again AND stop carrying an XSS-readable token.
 *
 * DELETE removes both cookies without calling upstream — used when the client
 * drops a session locally for a reason other than an explicit logout.
 *
 * Guards, because this route writes a session cookie from a client-supplied
 * value:
 *
 *   - application/json only. A cross-site form POST cannot set that
 *     content type, so this cannot be driven from another origin; combined
 *     with SameSite=Lax cookies it is not a session-fixation lever.
 *   - the caller must present an access token that /v1/auth/me accepts, so a
 *     junk or guessed value cannot be planted as somebody's session.
 */
export async function POST(req: NextRequest) {
    const contentType = req.headers.get("content-type") ?? ""
    if (!contentType.toLowerCase().includes("application/json")) {
        return NextResponse.json(
            {
                error: {
                    code: "UNSUPPORTED_MEDIA_TYPE",
                    message: "Expected application/json.",
                },
            },
            { status: 415 },
        )
    }

    let body: { accessToken?: unknown; refreshToken?: unknown } | null = null
    try {
        body = (await req.json()) as { accessToken?: unknown; refreshToken?: unknown }
    } catch {
        body = null
    }

    const accessToken =
        typeof body?.accessToken === "string" ? body.accessToken.trim() : ""
    const refreshToken =
        typeof body?.refreshToken === "string" ? body.refreshToken.trim() : ""

    if (!accessToken || !refreshToken) {
        return NextResponse.json(
            {
                error: {
                    code: "INCOMPLETE_SESSION",
                    message: "Both accessToken and refreshToken are required.",
                },
            },
            { status: 400 },
        )
    }

    // Prove the pair belongs to a real session before storing it.
    let verified = false
    try {
        const me = await fetch(`${AUTH_SERVICE_URL}/v1/auth/me`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
                ...clientForwardHeaders(req),
            },
            cache: "no-store",
        })
        verified = me.ok
    } catch {
        return NextResponse.json(
            {
                error: {
                    code: "UPSTREAM_UNREACHABLE",
                    message: "Could not verify the session right now.",
                },
            },
            { status: 503 },
        )
    }

    if (!verified) {
        return NextResponse.json(
            {
                error: {
                    code: "INVALID_SESSION",
                    message: "The supplied access token is not valid.",
                },
            },
            { status: 401 },
        )
    }

    const res = NextResponse.json({ data: { status: "ok" } })
    attachSession(res, { refreshToken, accessToken })
    return res
}

export async function DELETE() {
    const res = NextResponse.json({ data: { status: "ok" } })
    clearSession(res)
    return res
}
