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

    const encodedRefreshToken = encodeURIComponent(refreshToken)

    // Forward the browser's User-Agent and client IP so auth-service's
    // fingerprint check (compares UA family + /24 subnet against the
    // values stored at login) doesn't deny the refresh just because
    // Node's default fetch UA != the browser UA that originally signed in.
    const browserUA = req.headers.get("user-agent") ?? ""
    const forwardedFor = req.headers.get("x-forwarded-for")
        ?? req.headers.get("x-real-ip")
        ?? ""

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Cookie": `refresh_token=${encodedRefreshToken}`,
    }
    if (browserUA) headers["User-Agent"] = browserUA
    if (forwardedFor) headers["X-Forwarded-For"] = forwardedFor

    // Call auth service with refresh token as a cookie (that's what it expects)
    const upstream = await fetch(`${AUTH_SERVICE_URL}/v1/auth/refresh`, {
        method: "POST",
        headers,
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
