import { expect, test } from "bun:test"

import { peekAccessToken, setAccessToken } from "@/lib/accessToken"
import {
  connectToHub,
  isHubOpen,
  subscribeToLiveEvents,
  subscribeToLiveStream,
  unsubscribeFromLiveStream,
} from "@/services/messageService"
import type { LiveFrame } from "../realtime"

const S = "22222222-2222-4222-8222-222222222222"

test("the app socket subscribes to the live room on open and routes the gateway's refusal and room frames", async () => {
  const names = ["window", "localStorage", "WebSocket", "fetch", "setTimeout"] as const
  const originals = names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const)
  const previousToken = peekAccessToken()
  let signedIn = true
  const sockets: FakeSocket[] = []
  class FakeSocket {
    static OPEN = 1
    static CONNECTING = 0
    readyState = 0
    frames: string[] = []
    onopen?: () => void
    onclose?: () => void
    onmessage?: (e: { data: string }) => void
    constructor(_url: string) { sockets.push(this) }
    send(frame: string) { this.frames.push(frame) }
    close() { this.readyState = 3; this.onclose?.() }
    open() { this.readyState = 1; this.onopen?.() }
    receive(payload: unknown) { this.onmessage?.({ data: JSON.stringify(payload) }) }
  }
  const replace = (name: string, value: unknown) =>
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
  const got: LiveFrame[] = []
  const off = subscribeToLiveEvents((f) => got.push(f))
  try {
    replace("window", { location: { protocol: "https:", host: "test.invalid", hostname: "test.invalid" } })
    replace("localStorage", { getItem: () => (signedIn ? JSON.stringify({ id: "viewer" }) : null) })
    replace("WebSocket", FakeSocket)
    replace("fetch", async () => new Response(JSON.stringify({ token: "in-test-token" }), { headers: { "content-type": "application/json" } }))
    replace("setTimeout", () => 0)
    setAccessToken("in-test-access-token")

    subscribeToLiveStream(S)
    await connectToHub(() => {})
    const sock = sockets.at(-1)!
    expect(sock.frames).toEqual([])
    expect(isHubOpen()).toBe(false)
    sock.open()
    expect(isHubOpen()).toBe(true)
    expect(sock.frames).toEqual([JSON.stringify({ type: "subscribe_live_stream", stream_id: S })])

    sock.receive({ type: "error", code: "LIVE_ROOM_REFUSED", stream_id: S })
    // live-service-v2's room event as the gateway forwards it (verbatim).
    const removed = { stream_id: S, message_id: "m1", by_role: "host" }
    sock.receive({ ...removed, type: "chat.removed", at: "2026-10-01T10:00:00Z", payload: removed })
    sock.receive({ type: "subscription_revoked", conversation_id: "c1" })
    sock.receive({ type: "subscription_revoked", stream_id: S })
    expect(got).toEqual([
      { kind: "refused", stream_id: S },
      { kind: "removed", stream_id: S, message_id: "m1" },
      { kind: "refused", stream_id: S },
    ])

    unsubscribeFromLiveStream(S)
    expect(sock.frames.at(-1)).toBe(JSON.stringify({ type: "unsubscribe_live_stream", stream_id: S }))
    signedIn = false
    sock.close()
    expect(isHubOpen()).toBe(false)
  } finally {
    unsubscribeFromLiveStream(S)
    off()
    signedIn = false
    sockets.at(-1)?.close()
    setAccessToken(previousToken)
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else Reflect.deleteProperty(globalThis, name)
    }
  }
})
