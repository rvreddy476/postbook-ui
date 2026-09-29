import http, { type IncomingMessage } from "node:http"
import https from "node:https"
import net from "node:net"
import { Readable } from "node:stream"

import { NextRequest, NextResponse } from "next/server"

import {
    MAX_REDIRECTS,
    internalTarget,
    isRedirect,
    readStorageRoute,
    responseHeaders,
    storageRequestHeaders,
    withoutQuery,
    type StorageTarget,
} from "../_lib/storageRoute"

const API_GATEWAY = process.env.API_GATEWAY_URL || "http://localhost:8080"

/*
  How long one address may take to connect before the next is tried. Node's
  default is 250 ms, and a host with four addresses is given up on after
  about half a second. Over a busy link that is not enough: while one video
  stream was open, every new connection (each seek is one) failed with
  ETIMEDOUT and the player reported a broken file. Raised, never lowered.
*/
const CONNECT_ATTEMPT_MS = 1000
if (net.getDefaultAutoSelectFamilyAttemptTimeout() < CONNECT_ATTEMPT_MS) {
    net.setDefaultAutoSelectFamilyAttemptTimeout(CONNECT_ATTEMPT_MS)
}

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

    let upstream: Upstream
    try {
        upstream = await reach(url, req.method, headers, body, req.signal)
    } catch (err) {
        if (req.signal.aborted) {
            // The browser went away (a seek, a closed tab): nothing to answer.
            return new NextResponse(null, { status: 499 })
        }
        console.log(`[proxy] Upstream UNREACHABLE ${req.method} ${withoutQuery(url)}: ${reason(err)}`)
        return NextResponse.json(
            { error: { code: "UPSTREAM_UNREACHABLE", message: "The service could not be reached" } },
            { status: 502, headers: { "cache-control": "no-store" } },
        )
    }

    if (upstream.status >= 400) {
        const errBody = upstream.body ? await new Response(upstream.body).text() : ""
        console.log(`[proxy] Upstream ERROR ${upstream.status}: ${errBody.slice(0, 500)}`)
        return new NextResponse(errBody, {
            status: upstream.status,
            statusText: upstream.statusText,
            headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
        })
    }

    // Stream the response back
    const bodiless = req.method === "HEAD" || upstream.status === 204 || upstream.status === 304
    return new NextResponse(bodiless ? null : upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: upstream.headers,
    })
}

interface Upstream {
    status: number
    statusText: string
    headers: Headers
    body: ReadableStream<Uint8Array> | null
}

function reason(err: unknown): string {
    const cause = err instanceof Error ? (err.cause as { code?: string } | undefined) : undefined
    return cause?.code ?? (err instanceof Error ? err.message : String(err))
}

/*
  One request to the gateway, and the redirects it answers with.

  A read (GET, HEAD) follows redirects by hand, so each hop can be sent the
  right way: a hop to the public storage origin goes to storage on the
  private network when a route is configured (storageRoute.ts), and a hop
  that leaves the gateway carries no session. The bytes are streamed to the
  browser from here, which is what keeps media same-origin for it.

  The browser's own abort is passed on at every hop: a seek abandons the
  request before it, and without this each abandoned request kept pulling
  the rest of the file.

  A read that could not connect is tried once more; a write is never
  repeated.
*/
async function reach(url: URL, method: string, headers: Headers, body: BodyInit | null, signal: AbortSignal): Promise<Upstream> {
    if (method !== "GET" && method !== "HEAD") {
        return fromFetch(await fetch(url, { method, headers, body, redirect: "follow", signal }))
    }
    try {
        return await read(url, method, headers, signal)
    } catch (err) {
        if (signal.aborted) throw err
        return read(url, method, headers, signal)
    }
}

async function read(url: URL, method: string, headers: Headers, signal: AbortSignal): Promise<Upstream> {
    const route = readStorageRoute()
    const gateway = url.origin
    let current = url
    let answer = fromFetch(await fetch(current, { method, headers, redirect: "manual", signal }))

    for (let hops = 0; isRedirect(answer.status); hops++) {
        const location = answer.headers.get("location")
        if (!location) return answer
        await answer.body?.cancel().catch(() => undefined)
        if (hops >= MAX_REDIRECTS) throw new Error("too many redirects")

        current = new URL(location, current)
        if (current.protocol !== "http:" && current.protocol !== "https:") throw new Error("redirect to an unsupported scheme")

        const internal = internalTarget(current, route)
        if (internal) {
            answer = await fromStorage(internal, method, storageRequestHeaders(headers), signal)
        } else {
            // The session stays with the gateway; any other origin gets the byte range and nothing else.
            const hopHeaders = current.origin === gateway ? headers : new Headers(storageRequestHeaders(headers))
            answer = fromFetch(await fetch(current, { method, headers: hopHeaders, redirect: "manual", signal }))
        }
    }
    return answer
}

function fromFetch(res: Response): Upstream {
    return { status: res.status, statusText: res.statusText, headers: responseHeaders(res.headers.entries()), body: res.body }
}

/** The signed request, sent to storage on the private network with the Host it was signed for. */
function fromStorage(target: StorageTarget, method: string, headers: Record<string, string>, signal: AbortSignal): Promise<Upstream> {
    return new Promise((resolve, reject) => {
        const send = target.protocol === "https:" ? https.request : http.request
        const request = send(
            {
                protocol: target.protocol,
                hostname: target.hostname,
                port: target.port,
                method,
                path: target.path,
                headers: { ...headers, host: target.hostHeader },
                signal,
            },
            (res: IncomingMessage) => {
                resolve({
                    status: res.statusCode ?? 502,
                    statusText: res.statusMessage ?? "",
                    headers: responseHeaders(Object.entries(res.headers)),
                    body: Readable.toWeb(res) as unknown as ReadableStream<Uint8Array>,
                })
            },
        )
        request.on("error", reject)
        request.end()
    })
}

export const GET = proxyRequest
export const POST = proxyRequest
export const PUT = proxyRequest
export const DELETE = proxyRequest
export const PATCH = proxyRequest
