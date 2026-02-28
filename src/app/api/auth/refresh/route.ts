import { NextRequest, NextResponse } from "next/server"

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:8081"

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null)
    const refreshToken = body?.refreshToken

    if (!refreshToken) {
        return NextResponse.json(
            { error: "Missing refresh token" },
            { status: 400 }
        )
    }

    // Call auth service with refresh token as a cookie (that's what it expects)
    const upstream = await fetch(`${AUTH_SERVICE_URL}/v1/auth/refresh`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Cookie": `refresh_token=${refreshToken}`,
        },
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
