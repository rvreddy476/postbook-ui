import type { LiveChatMessage, LiveEndedReason, LiveStream, LiveStreamStatus } from "./model"
import { num, str } from "./model"
import { parseHeartsFrame } from "./hearts"

// Real-time side of a live stream.
//
// live-service-v2 publishes every room event as one JSON object on Redis
// `live:stream:{id}` (internal/service/realtime.go):
//   {"type", "stream_id", "at", <payload fields>..., "payload": {...}}
// The payload's fields sit at the top level (what this client reads) and
// again under "payload". The ws-gateway forwards that object verbatim
// (redisLoop: valid JSON is not re-wrapped) to sockets it admitted through
// {"type":"subscribe_live_stream","stream_id"} (liverooms.go). A refused
// subscribe is answered with
//   {"type":"error","code":"LIVE_ROOM_REFUSED","stream_id":"<uuid>"}
// and a seat dropped by the gateway's 30 s re-check with
//   {"type":"subscription_revoked","stream_id":"<uuid>"}
// Either one switches this client to polling the authorized HTTP chat list.
//
// Types read here: status.changed, chat.message, chat.removed, viewer.count,
// moderation.ban, moderation.unban, moderation.moderators, hearts. The other
// moderation.* types (mute, unmute, word_filter_*, pin, unpin) are not
// shown on the web and parse to null.

export type LiveFrame =
  | {
      kind: "status"
      stream_id: string
      status: LiveStreamStatus | string
      ended_reason: LiveEndedReason | ""
      status_changed_at: string
      viewer_count: number | null
      viewer_peak: number | null
    }
  | { kind: "chat"; stream_id: string; message: LiveChatMessage }
  | { kind: "removed"; stream_id: string; message_id: string }
  | { kind: "viewers"; stream_id: string; viewer_count: number; viewer_peak: number | null }
  | { kind: "ban"; stream_id: string; user_id: string }
  | { kind: "unban"; stream_id: string; user_id: string }
  | { kind: "moderators"; stream_id: string; user_ids: string[] }
  | { kind: "refused"; stream_id: string }
  /** Free hearts since the last frame (aggregated, no user ids) and the stream total (0 when absent). */
  | { kind: "hearts"; stream_id: string; count: number; heart_count: number }

type Obj = Record<string, unknown>

function asObj(v: unknown): Obj | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null
}

/** Parse one socket frame; null when it is not a live-room frame. */
export function parseLiveFrame(raw: unknown): LiveFrame | null {
  const frame = asObj(raw)
  if (!frame) return null
  const type = str(frame.type)
  if (!type) return null
  const payload = asObj(frame.payload) ?? {}
  // Top level first (live-service-v2's reading contract), then "payload".
  const field = (k: string) => (frame[k] !== undefined ? frame[k] : payload[k])
  const streamId = str(field("stream_id"))
  if (!streamId) return null

  if ((type === "error" && str(frame.code) === "LIVE_ROOM_REFUSED") || type === "subscription_revoked") {
    return { kind: "refused", stream_id: streamId }
  }
  switch (type) {
    case "status.changed": {
      const status = str(field("status"))
      if (!status) return null
      const count = num(field("viewer_count"))
      return {
        kind: "status", stream_id: streamId, status,
        ended_reason: str(field("ended_reason")) as LiveEndedReason | "",
        status_changed_at: str(field("status_changed_at")),
        viewer_count: count !== null && count >= 0 ? count : null,
        viewer_peak: num(field("viewer_peak")),
      }
    }
    case "chat.message": {
      // The event is exactly the row GET /chat returns.
      const id = str(field("id"))
      const userId = str(field("user_id"))
      if (!id || !userId) return null
      return {
        kind: "chat", stream_id: streamId,
        message: {
          id, stream_id: streamId, user_id: userId,
          text: str(field("text")),
          is_pinned: field("is_pinned") === true,
          created_at: str(field("created_at")),
        },
      }
    }
    case "chat.removed": {
      const id = str(field("message_id"))
      return id ? { kind: "removed", stream_id: streamId, message_id: id } : null
    }
    case "viewer.count": {
      const count = num(field("viewer_count"))
      if (count === null || count < 0) return null
      return { kind: "viewers", stream_id: streamId, viewer_count: count, viewer_peak: num(field("viewer_peak")) }
    }
    case "moderation.moderators": {
      const ids = field("user_ids")
      if (!Array.isArray(ids)) return null
      return { kind: "moderators", stream_id: streamId, user_ids: ids.map(str).filter(Boolean) }
    }
    case "moderation.ban":
    case "moderation.unban": {
      const userId = str(field("user_id"))
      if (!userId) return null
      return { kind: type === "moderation.ban" ? "ban" : "unban", stream_id: streamId, user_id: userId }
    }
    case "hearts": {
      const hearts = parseHeartsFrame(field)
      return hearts ? { kind: "hearts", stream_id: streamId, ...hearts } : null
    }
  }
  return null
}

/**
 * Live rooms are desired state, exactly like post rooms
 * (src/lib/postThreadLive.ts PostRoomSubscriptions): ref-counted, never a
 * queued stale frame, re-sent on every socket open so the gateway re-asks
 * live-service-v2 after a reconnect.
 */
export class LiveRoomSubscriptions {
  private refs = new Map<string, number>()
  private connected = false
  constructor(private send: (frame: { type: string; stream_id: string }) => void) {}
  subscribe(streamId: string) {
    const count = this.refs.get(streamId) ?? 0
    this.refs.set(streamId, count + 1)
    if (!count && this.connected) this.send({ type: "subscribe_live_stream", stream_id: streamId })
  }
  unsubscribe(streamId: string) {
    const count = this.refs.get(streamId) ?? 0
    if (count > 1) { this.refs.set(streamId, count - 1); return }
    this.refs.delete(streamId)
    if (count && this.connected) this.send({ type: "unsubscribe_live_stream", stream_id: streamId })
  }
  isConnected() { return this.connected }
  onOpen() { this.connected = true; this.refresh() }
  onClose() { this.connected = false }
  refresh() {
    if (this.connected) for (const id of this.refs.keys()) {
      this.send({ type: "subscribe_live_stream", stream_id: id })
    }
  }
}

/**
 * Chat transport for one stream.
 *   subscribing — subscribe sent (or will be on open); frames arrive over ws.
 *   refused     — the gateway said no (or revoked the seat): poll HTTP.
 * A socket (re)open re-sends the subscribe, so it returns to subscribing;
 * a fresh refusal frame flips it back.
 */
export type ChatTransport = "subscribing" | "refused"

export type TransportEvent =
  | { type: "refused"; stream_id: string }
  | { type: "socket_open" }

export function nextTransport(state: ChatTransport, streamId: string, event: TransportEvent): ChatTransport {
  switch (event.type) {
    case "refused":
      return event.stream_id === streamId ? "refused" : state
    case "socket_open":
      return "subscribing"
  }
}

/**
 * Poll the HTTP chat list only when the room cannot deliver frames: the
 * subscribe was refused, or there is no open socket to deliver them.
 */
export function shouldPollChat(transport: ChatTransport, socketOpen: boolean): boolean {
  return transport === "refused" || !socketOpen
}

export const CHAT_POLL_MS = 4000

/** The chat list's refetch interval: off while frames flow, CHAT_POLL_MS otherwise. */
export function chatPollInterval(transport: ChatTransport, socketOpen: boolean): number | false {
  return shouldPollChat(transport, socketOpen) ? CHAT_POLL_MS : false
}

/**
 * The stream row after a room frame: status.changed carries status,
 * ended_reason (null unless ended/failed), status_changed_at and the
 * counts; viewer.count carries viewer_count and viewer_peak. A frame only
 * patches what it carries; the poll re-reads the whole row.
 */
export function applyStreamFrame(prev: LiveStream | undefined, frame: LiveFrame): LiveStream | undefined {
  if (!prev) return prev
  switch (frame.kind) {
    case "status":
      return {
        ...prev,
        status: frame.status as LiveStream["status"],
        ended_reason: (frame.ended_reason || null) as LiveStream["ended_reason"],
        status_changed_at: frame.status_changed_at || prev.status_changed_at,
        viewer_count: frame.viewer_count ?? prev.viewer_count,
        viewer_peak: frame.viewer_peak ?? prev.viewer_peak,
      }
    case "viewers":
      return { ...prev, viewer_count: frame.viewer_count, viewer_peak: frame.viewer_peak ?? prev.viewer_peak }
    default:
      return prev
  }
}
