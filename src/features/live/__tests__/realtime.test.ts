import { describe, expect, it } from "bun:test"

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import type { LiveStream } from "../model"
import {
  CHAT_POLL_MS,
  LiveRoomSubscriptions,
  applyStreamFrame,
  chatPollInterval,
  nextTransport,
  parseLiveFrame,
  shouldPollChat,
} from "../realtime"

const S = "11111111-1111-4111-8111-111111111111"
const AT = "2026-10-01T10:00:00Z"

/**
 * The wire object exactly as live-service-v2 builds it (realtime.go
 * roomEventBody): the payload's fields at the top level next to type,
 * stream_id and at, and the payload again under "payload". The ws-gateway
 * forwards it verbatim.
 */
function roomEvent(type: string, payload: Record<string, unknown>) {
  return JSON.parse(JSON.stringify({ ...payload, type, stream_id: S, at: AT, payload }))
}

describe("parseLiveFrame (live-service-v2 room events)", () => {
  it("status.changed: status, ended_reason (null unless over), status_changed_at and the counts", () => {
    const evt = roomEvent("status.changed", {
      stream_id: S, status: "reconnecting", ended_reason: null, status_changed_at: "t",
      started_at: AT, ended_at: null, viewer_count: 3, viewer_peak: 8,
    })
    expect(parseLiveFrame(evt)).toEqual({
      kind: "status", stream_id: S, status: "reconnecting", ended_reason: "", status_changed_at: "t",
      viewer_count: 3, viewer_peak: 8,
    })
    const ended = roomEvent("status.changed", { stream_id: S, status: "ended", ended_reason: "host_lost", status_changed_at: "t2", viewer_count: 0, viewer_peak: 8 })
    expect(parseLiveFrame(ended)).toMatchObject({ kind: "status", status: "ended", ended_reason: "host_lost" })
    expect(parseLiveFrame(roomEvent("status.changed", { stream_id: S, status: "" }))).toBeNull()
  })
  it("reads the top-level fields (the reading contract) even with no payload copy", () => {
    expect(parseLiveFrame({ type: "chat.removed", stream_id: S, message_id: "m1", by_role: "host" }))
      .toEqual({ kind: "removed", stream_id: S, message_id: "m1" })
  })
  it("chat.message is exactly the GET /chat row", () => {
    const row = { id: "m1", stream_id: S, user_id: "u1", text: "hi", is_pinned: false, created_at: "2026-10-01T10:00:00Z" }
    expect(parseLiveFrame(roomEvent("chat.message", row))).toEqual({ kind: "chat", stream_id: S, message: row })
    expect(parseLiveFrame(roomEvent("chat.message", { ...row, id: "" }))).toBeNull()
  })
  it("the retired v1 names are not read", () => {
    const row = { id: "m1", stream_id: S, user_id: "u1", text: "hi", created_at: AT }
    expect(parseLiveFrame(roomEvent("live_chat_message", row))).toBeNull()
    expect(parseLiveFrame(roomEvent("live_stream_viewers", { stream_id: S, viewer_count: 3 }))).toBeNull()
    expect(parseLiveFrame(roomEvent("live_stream_ended", { stream_id: S }))).toBeNull()
  })
  it("chat.removed {message_id, by_role}", () => {
    expect(parseLiveFrame(roomEvent("chat.removed", { stream_id: S, message_id: "m1", by_role: "moderator" })))
      .toEqual({ kind: "removed", stream_id: S, message_id: "m1" })
    expect(parseLiveFrame(roomEvent("chat.removed", { stream_id: S, id: "m1" }))).toBeNull()
  })
  it("viewer.count {viewer_count, viewer_peak}", () => {
    expect(parseLiveFrame(roomEvent("viewer.count", { stream_id: S, viewer_count: 4, viewer_peak: 9 })))
      .toEqual({ kind: "viewers", stream_id: S, viewer_count: 4, viewer_peak: 9 })
    expect(parseLiveFrame(roomEvent("viewer.count", { stream_id: S, viewer_count: -1 }))).toBeNull()
  })
  it("moderation.ban / unban {user_id, by_role} and moderation.moderators {user_ids}", () => {
    expect(parseLiveFrame(roomEvent("moderation.ban", { stream_id: S, user_id: "u2", by_role: "host" })))
      .toEqual({ kind: "ban", stream_id: S, user_id: "u2" })
    expect(parseLiveFrame(roomEvent("moderation.unban", { stream_id: S, user_id: "u2", by_role: "moderator" })))
      .toEqual({ kind: "unban", stream_id: S, user_id: "u2" })
    expect(parseLiveFrame(roomEvent("moderation.moderators", { stream_id: S, user_ids: ["a", "", "b"] })))
      .toEqual({ kind: "moderators", stream_id: S, user_ids: ["a", "b"] })
  })
  it("moderation events the web does not show parse to null", () => {
    for (const type of ["moderation.mute", "moderation.unmute", "moderation.word_filter_added", "moderation.word_filter_removed", "moderation.pin", "moderation.unpin"]) {
      expect(parseLiveFrame(roomEvent(type, { stream_id: S, user_id: "u2", word: "w", message_id: "m" }))).toBeNull()
    }
  })
  it("the gateway's refusal and revocation frames (liverooms.go)", () => {
    expect(parseLiveFrame({ type: "error", code: "LIVE_ROOM_REFUSED", stream_id: S })).toEqual({ kind: "refused", stream_id: S })
    expect(parseLiveFrame({ type: "subscription_revoked", stream_id: S })).toEqual({ kind: "refused", stream_id: S })
    // stream_id is omitted when the id did not parse: nothing to route it to.
    expect(parseLiveFrame({ type: "error", code: "LIVE_ROOM_REFUSED" })).toBeNull()
  })
  it("ignores other frames", () => {
    expect(parseLiveFrame({ type: "error", code: "SOMETHING_ELSE", stream_id: S })).toBeNull()
    expect(parseLiveFrame({ type: "subscription_revoked", conversation_id: "c" })).toBeNull()
    expect(parseLiveFrame({ type: "chat.message", payload: { id: "m", user_id: "u" } })).toBeNull()
    expect(parseLiveFrame({ type: "presence_update" })).toBeNull()
    expect(parseLiveFrame(null)).toBeNull()
    expect(parseLiveFrame("x")).toBeNull()
  })
})

describe("applyStreamFrame: frames patch the cached stream row", () => {
  const row = {
    id: S, status: "live", ended_reason: null, status_changed_at: "t0", viewer_count: 2, viewer_peak: 5,
  } as unknown as LiveStream
  it("status.changed sets status, the reason, the time and the counts", () => {
    const f = parseLiveFrame(roomEvent("status.changed", { stream_id: S, status: "ended", ended_reason: "admin_stopped", status_changed_at: "t1", viewer_count: 0, viewer_peak: 6 }))!
    expect(applyStreamFrame(row, f)).toMatchObject({ status: "ended", ended_reason: "admin_stopped", status_changed_at: "t1", viewer_count: 0, viewer_peak: 6 })
  })
  it("a restart clears an old ended_reason instead of keeping it", () => {
    const failed = { ...row, status: "failed", ended_reason: "no_media" } as LiveStream
    const f = parseLiveFrame(roomEvent("status.changed", { stream_id: S, status: "starting", ended_reason: null, status_changed_at: "t2", viewer_count: 0, viewer_peak: 0 }))!
    expect(applyStreamFrame(failed, f)).toMatchObject({ status: "starting", ended_reason: null })
  })
  it("viewer.count sets the server's count, including a drop to zero", () => {
    const f = parseLiveFrame(roomEvent("viewer.count", { stream_id: S, viewer_count: 0, viewer_peak: 5 }))!
    expect(applyStreamFrame(row, f)).toMatchObject({ viewer_count: 0, viewer_peak: 5, status: "live" })
  })
  it("no cached row stays no row; other frames change nothing", () => {
    const f = parseLiveFrame(roomEvent("viewer.count", { stream_id: S, viewer_count: 1 }))!
    expect(applyStreamFrame(undefined, f)).toBeUndefined()
    const chat = parseLiveFrame(roomEvent("chat.removed", { stream_id: S, message_id: "m" }))!
    expect(applyStreamFrame(row, chat)).toBe(row)
  })
})

describe("subscribe-refused fallback", () => {
  it("polls only when refused or when no socket can deliver frames", () => {
    expect(shouldPollChat("subscribing", true)).toBe(false)
    expect(shouldPollChat("refused", true)).toBe(true)
    expect(shouldPollChat("subscribing", false)).toBe(true)
  })
  it("a refusal for this stream flips to polling; another stream's refusal does not", () => {
    expect(nextTransport("subscribing", S, { type: "refused", stream_id: S })).toBe("refused")
    expect(nextTransport("subscribing", S, { type: "refused", stream_id: "other" })).toBe("subscribing")
  })
  it("a socket reopen re-subscribes and leaves polling until the gateway refuses again", () => {
    expect(nextTransport("refused", S, { type: "socket_open" })).toBe("subscribing")
  })
})

describe("LiveRoomSubscriptions (desired state, like post rooms)", () => {
  it("subscribes on every open, ref-counts owners, never queues stale frames", () => {
    const frames: object[] = []
    const rooms = new LiveRoomSubscriptions((f) => frames.push(f))
    rooms.subscribe(S)
    expect(frames).toEqual([])
    rooms.onOpen()
    rooms.onClose()
    rooms.onOpen()
    expect(frames).toEqual(Array(2).fill({ type: "subscribe_live_stream", stream_id: S }))
    rooms.subscribe(S)
    rooms.unsubscribe(S)
    expect(frames.length).toBe(2)
    rooms.unsubscribe(S)
    expect(frames.at(-1)).toEqual({ type: "unsubscribe_live_stream", stream_id: S })
    rooms.onClose()
    rooms.onOpen()
    expect(frames.length).toBe(3)
  })
  it("leaving while offline sends nothing", () => {
    const frames: object[] = []
    const rooms = new LiveRoomSubscriptions((f) => frames.push(f))
    rooms.subscribe(S)
    rooms.unsubscribe(S)
    rooms.onOpen()
    expect(frames).toEqual([])
    expect(rooms.isConnected()).toBe(true)
  })
})

describe("the chat list polls only on the fallback", () => {
  it("interval is off while subscribed and CHAT_POLL_MS when refused or offline", () => {
    expect(chatPollInterval("subscribing", true)).toBe(false)
    expect(chatPollInterval("refused", true)).toBe(CHAT_POLL_MS)
    expect(chatPollInterval("subscribing", false)).toBe(CHAT_POLL_MS)
  })
  it("useLiveRoom wires the rule into the chat query and the refusal into the transport", () => {
    const hook = readFileSync(resolve(import.meta.dir, "../../../hooks/useLiveV2.ts"), "utf8")
    expect(hook).toContain("refetchInterval: chatPollInterval(transport, socketOpen)")
    expect(hook).toContain('nextTransport(t, streamId, { type: "refused", stream_id: frame.stream_id })')
    expect(hook).toContain('nextTransport(t, streamId, { type: "socket_open" })')
  })
})
