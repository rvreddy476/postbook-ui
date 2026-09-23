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
    // Byte ranges. Browsers fetch video in chunks with Range; without it the
    // storage answered with the whole file every time, seeking could not work,
    // and an MP4 whose index sits at the END showed 0:00 until the entire file
    // had streamed through this hop. The 206 and Content-Range it now gets back
    // are copied to the browser by the header loop below.
    "range",
    "if-range",
    /*
      Idempotency-Key. post-service REFUSES a create without one, and this
      allowlist silently dropped it: the client set the header, this hop threw
      it away, and the server answered "Idempotency-Key header is required"
      for a request that had carried exactly that. Adding the header at the
      call sites changed nothing, because nothing a call site does can survive
      a header filter it does not know about.

      Note what is deliberately NOT here: X-Scopes. Several admin pages set
      it, but a scope claimed by a browser is not a scope — the gateway
      derives them from the token. Forwarding it would let any client assert
      its own privileges.
    */
    "idempotency-key",
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

    // For /serve endpoints, follow redirects so the proxy streams image bytes
    // directly to the browser (avoids cross-origin redirect issues with MinIO).
    const upstream = await fetch(url.toString(), {
        method: req.method,
        headers,
        body,
        redirect: "follow",
    })

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
