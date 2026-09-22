import { NextRequest, NextResponse } from "next/server"
import {
    API_GATEWAY_URL,
    REFRESH_COOKIE,
    clearSession,
    clientForwardHeaders,
} from "../_lib/session"

/**
 * Tell the server the session is over, then clear the cookies.
 *
 * Logout used to be local-only: the client dropped its localStorage keys and
 * the refresh token stayed valid server-side, so a stolen token still worked
 * after the user had "signed out".
 *
 * Two upstream endpoints exist:
 *
 *   POST /v1/auth/logout      public; revokes the ONE session behind the
 *                             refresh token. Reads the token from the
 *                             `refresh_token` COOKIE only — the handler
 *                             (internal/http/handler.go Logout) never looks
 *                             at the body, and svc.Logout("") returns nil,
 *                             so a call without that cookie answers 200 and
 *                             revokes nothing. Hence the Cookie header below.
 *
 *   POST /v1/auth/logout-all  authenticated + CSRF; revokes every session for
 *                             the user. Used when the caller asks for
 *                             `allDevices`, which is what a "sign out
 *                             everywhere" control needs.
 *
 * Whatever the upstream says, the cookies are cleared. A network error must
 * not trap someone in a session they asked to end.
 */
export async function POST(req: NextRequest) {
    const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value?.trim()

    let allDevices = false
    try {
        const body = (await req.json()) as { allDevices?: unknown } | null
        allDevices = body?.allDevices === true
    } catch {
        // No body is the normal single-session case.
    }

    const revoked: { endpoint: string; ok: boolean; status?: number; error?: string }[] = []

    if (refreshToken) {
        try {
            // Raw value, not encodeURIComponent'd: Gin reads cookie values
            // without URL-decoding, so encoding the token (+ → %2B) would
            // hash to a different session and silently revoke nothing.
            const upstream = await fetch(`${API_GATEWAY_URL}/v1/auth/logout`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    Cookie: `refresh_token=${refreshToken}`,
                    ...clientForwardHeaders(req),
                },
                body: JSON.stringify({ refresh_token: refreshToken }),
                cache: "no-store",
            })
            revoked.push({
                endpoint: "/v1/auth/logout",
                ok: upstream.ok,
                status: upstream.status,
            })
        } catch (error) {
            revoked.push({
                endpoint: "/v1/auth/logout",
                ok: false,
                error: error instanceof Error ? error.message : "request failed",
            })
        }
    } else {
        revoked.push({
            endpoint: "/v1/auth/logout",
            ok: false,
            error: "no refresh cookie to revoke",
        })
    }

    if (allDevices) {
        // logout-all sits behind auth + CSRF, so it needs the caller's bearer
        // token and the server's CSRF pair. We forward what the browser sent;
        // if either is absent the upstream refuses and we report that rather
        // than pretending every device was signed out.
        const authorization = req.headers.get("authorization")
        const csrfHeader = req.headers.get("x-csrf-token")
        const cookieHeader = req.headers.get("cookie")

        if (!authorization) {
            revoked.push({
                endpoint: "/v1/auth/logout-all",
                ok: false,
                error: "no bearer token on the logout request",
            })
        } else {
            try {
                const headers: Record<string, string> = {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    Authorization: authorization,
                    ...clientForwardHeaders(req),
                }
                if (csrfHeader) headers["X-CSRF-Token"] = csrfHeader
                if (cookieHeader) headers["Cookie"] = cookieHeader

                const upstream = await fetch(`${API_GATEWAY_URL}/v1/auth/logout-all`, {
                    method: "POST",
                    headers,
                    cache: "no-store",
                })
                revoked.push({
                    endpoint: "/v1/auth/logout-all",
                    ok: upstream.ok,
                    status: upstream.status,
                })
            } catch (error) {
                revoked.push({
                    endpoint: "/v1/auth/logout-all",
                    ok: false,
                    error: error instanceof Error ? error.message : "request failed",
                })
            }
        }
    }

    const serverRevoked = revoked.every((entry) => entry.ok)
    if (!serverRevoked) {
        console.error("[auth/logout] server-side revocation incomplete:", revoked)
    }

    // The local clear is unconditional.
    const res = NextResponse.json({
        data: {
            status: "ok",
            // Honest about what actually happened upstream, so a caller (or a
            // reader of the network tab) can tell a revoked session from a
            // merely forgotten one.
            server_revoked: serverRevoked,
            attempts: revoked,
        },
    })
    clearSession(res)
    return res
}

/**
 * Logout as a NAVIGATION rather than a background fetch.
 *
 * The POST above is correct but fire-and-forget: the client starts it and
 * immediately routes to /login without awaiting it. When that request does
 * not land — origin down, tunnel down, offline, tab closed mid-flight — the
 * local session is gone but the cookies are NOT, so `pb_auth` survives and
 * middleware keeps waving that browser into every gated route. The user has
 * been told they signed out and they have not.
 *
 * Sending the browser here instead makes the clear part of a navigation the
 * browser has to complete: the same revocation runs, the same cookies are
 * cleared on the response, and the redirect to /login only happens because
 * that response arrived. If the network is down the browser stays put and
 * shows an error, which is the honest outcome — better than a UI that claims
 * a session ended while the refresh token is still live server-side.
 */
export async function GET(req: NextRequest) {
    const cleared = await POST(
        new NextRequest(req.url, { method: "POST", headers: req.headers }),
    )

    const target = new URL("/login", req.url)
    const res = NextResponse.redirect(target, { status: 303 })

    // Carry over the Set-Cookie headers the POST produced; a fresh response
    // does not inherit them.
    for (const cookie of cleared.headers.getSetCookie()) {
        res.headers.append("set-cookie", cookie)
    }
    res.headers.set("Cache-Control", "no-store, must-revalidate")
    return res
}
