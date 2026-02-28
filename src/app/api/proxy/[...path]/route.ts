import { NextRequest, NextResponse } from "next/server"

const API_GATEWAY = process.env.API_GATEWAY_URL || "http://localhost:8080"

const FORWARDED_HEADERS = [
    "authorization",
    "x-user-id",
    "x-csrf-token",
    "x-requested-with",
    "content-type",
    "accept",
    "cookie",
]

async function proxyRequest(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params
    const target = `${API_GATEWAY}/v1/${path.join("/")}`
    const url = new URL(target)

    // Forward query params
    req.nextUrl.searchParams.forEach((value, key) => {
        url.searchParams.set(key, value)
    })

    // Build forwarded headers
    const headers = new Headers()
    for (const name of FORWARDED_HEADERS) {
        const value = req.headers.get(name)
        if (value) {
            headers.set(name, value)
        }
    }

    // Read body for non-GET/HEAD requests
    let body: BodyInit | null = null
    if (req.method !== "GET" && req.method !== "HEAD") {
        body = await req.arrayBuffer()
    }

    // For /serve endpoints, don't follow redirects — pass them to the browser
    // so image bytes flow directly from MinIO to browser instead of through proxy.
    const isServeRequest = path.includes("serve")

    const upstream = await fetch(url.toString(), {
        method: req.method,
        headers,
        body,
        redirect: isServeRequest ? "manual" : "follow",
    })

    // Pass redirect responses through to the browser
    if (isServeRequest && (upstream.status === 301 || upstream.status === 302 || upstream.status === 307 || upstream.status === 308)) {
        const location = upstream.headers.get("location")
        if (location) {
            return NextResponse.redirect(location, upstream.status as 301 | 302 | 307 | 308)
        }
    }

    if (!upstream.ok) {
        const errBody = await upstream.text()
        console.log(`[proxy] Upstream ERROR ${upstream.status}: ${errBody}`)
        return new NextResponse(errBody, {
            status: upstream.status,
            statusText: upstream.statusText,
            headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
        })
    }

    // Stream the response back
    const responseHeaders = new Headers()
    upstream.headers.forEach((value, key) => {
        // Skip hop-by-hop headers
        if (!["transfer-encoding", "connection", "keep-alive"].includes(key.toLowerCase())) {
            responseHeaders.set(key, value)
        }
    })

    return new NextResponse(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
    })
}

export const GET = proxyRequest
export const POST = proxyRequest
export const PUT = proxyRequest
export const DELETE = proxyRequest
export const PATCH = proxyRequest
