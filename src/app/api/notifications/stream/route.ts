import { NextRequest } from "next/server"

const API_GATEWAY = process.env.API_GATEWAY_URL || "http://localhost:8080"

export async function GET(req: NextRequest) {
    const userId = req.headers.get("x-user-id") || ""
    const authHeader = req.headers.get("authorization") || ""

    const upstream = await fetch(`${API_GATEWAY}/v1/notifications/stream`, {
        headers: {
            "X-User-Id": userId,
            "Authorization": authHeader,
            "Accept": "text/event-stream",
        },
    })

    if (!upstream.ok || !upstream.body) {
        return new Response(
            JSON.stringify({ error: "Failed to connect to notification stream" }),
            { status: upstream.status || 502, headers: { "Content-Type": "application/json" } }
        )
    }

    // Stream SSE response through to the client
    return new Response(upstream.body, {
        status: 200,
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    })
}
