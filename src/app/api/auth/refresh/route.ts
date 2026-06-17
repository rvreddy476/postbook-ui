import { NextRequest, NextResponse } from "next/server"

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:8081"

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null)
    const refreshToken = typeof body?.refreshToken === "string"
        ? body.refreshToken.trim()
        : ""

    if (!refreshToken) {
        return NextResponse.json(
            { error: "Missing refresh token" },
            { status: 400 }
        )
    }

    // Forward the browser's User-Agent and client IP so auth-service's
    // fingerprint check (compares UA family + /24 subnet against the
    // values stored at login) doesn't deny the refresh.
    const browserUA = req.headers.get("user-agent") ?? ""
    const forwardedFor = req.headers.get("x-forwarded-for")
        ?? req.headers.get("x-real-ip")
        ?? ""

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    }
    if (browserUA) headers["User-Agent"] = browserUA
    if (forwardedFor) headers["X-Forwarded-For"] = forwardedFor

    // The auth-service Refresh handler reads the token from the JSON body
    // (field "refresh_token") when no cookie is present — explicitly supported
    // for mobile/non-browser clients. Sending it as a Cookie header was broken
    // because encodeURIComponent() changed the token value (e.g. + → %2B) and
    // Gin reads cookie values raw (no URL-decoding), causing a database mismatch.
    const upstream = await fetch(`${AUTH_SERVICE_URL}/v1/auth/refresh`, {
        method: "POST",
        headers,
        body: JSON.stringify({ refresh_token: refreshToken }),
    })

    const data = await upstream.json().catch(() => null)

    if (!upstream.ok) {
        return NextResponse.json(
            data ?? { error: "Refresh failed" },
            { status: upstream.status }
        )
    }

    return NextResponse.json(data)
}
