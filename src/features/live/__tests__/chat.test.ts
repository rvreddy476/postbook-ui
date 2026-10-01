import { describe, expect, it } from "bun:test"

import type { LiveChatMessage } from "../model"
import {
  CHAT_WINDOW,
  canSendChat,
  chatReducer,
  chatRole,
  initialChatState,
  messageActions,
  nextModerators,
  streamTools,
  type ChatAction,
  type ChatState,
} from "../chat"

const S = "stream-1"
const HOST = "host"
const msg = (id: string, user = "u1", at = 0, stream = S): LiveChatMessage => ({
  id, stream_id: stream, user_id: user, text: `t-${id}`,
  created_at: new Date(Date.UTC(2026, 9, 1, 10, 0, at)).toISOString(),
})
const frame = (state: ChatState, a: ChatAction) => chatReducer(state, a)

describe("chat reducer", () => {
  it("appends messages oldest-first and dedupes the pub/sub echo of my own send", () => {
    let s = initialChatState(S)
    s = chatReducer(s, { type: "sent", message: msg("a", "me", 1) })
    s = chatReducer(s, { type: "frame", frame: { kind: "chat", stream_id: S, message: msg("a", "me", 1) } })
    s = chatReducer(s, { type: "frame", frame: { kind: "chat", stream_id: S, message: msg("b", "u2", 0) } })
    expect(s.messages.map((m) => m.id)).toEqual(["b", "a"])
  })

  it("chat.removed hides a message live, and a late echo of it never reappears", () => {
    let s = initialChatState(S)
    s = frame(s, { type: "frame", frame: { kind: "chat", stream_id: S, message: msg("a") } })
    s = frame(s, { type: "frame", frame: { kind: "removed", stream_id: S, message_id: "a" } })
    expect(s.messages).toEqual([])
    s = frame(s, { type: "frame", frame: { kind: "chat", stream_id: S, message: msg("a") } })
    s = frame(s, { type: "replay", messages: [msg("a")] })
    expect(s.messages).toEqual([])
  })

  it("a removal that arrives before its message still hides it", () => {
    let s = initialChatState(S)
    s = frame(s, { type: "frame", frame: { kind: "removed", stream_id: S, message_id: "x" } })
    s = frame(s, { type: "frame", frame: { kind: "chat", stream_id: S, message: msg("x") } })
    expect(s.messages).toEqual([])
  })

  it("frames for another stream are ignored", () => {
    const s0 = initialChatState(S)
    const s1 = frame(s0, { type: "frame", frame: { kind: "chat", stream_id: "other", message: msg("a", "u", 0, "other") } })
    const s2 = frame(s1, { type: "frame", frame: { kind: "ban", stream_id: "other", user_id: "u" } })
    expect(s2).toEqual(s0)
  })

  it("moderation: ban, unban, moderators", () => {
    let s = initialChatState(S, ["m1"])
    s = frame(s, { type: "frame", frame: { kind: "ban", stream_id: S, user_id: "u9" } })
    s = frame(s, { type: "frame", frame: { kind: "ban", stream_id: S, user_id: "u9" } })
    expect(s.banned).toEqual(["u9"])
    s = frame(s, { type: "frame", frame: { kind: "unban", stream_id: S, user_id: "u9" } })
    expect(s.banned).toEqual([])
    s = frame(s, { type: "frame", frame: { kind: "moderators", stream_id: S, user_ids: ["m2", "m2", "m3"] } })
    expect(s.moderators).toEqual(["m2", "m3"])
    s = frame(s, { type: "moderators_seed", user_ids: ["m4"] })
    expect(s.moderators).toEqual(["m4"])
  })

  it("banning a moderator removes them as moderator, as the server does", () => {
    let s = initialChatState(S, ["m1", "m2"])
    s = frame(s, { type: "frame", frame: { kind: "ban", stream_id: S, user_id: "m1" } })
    expect(s.banned).toEqual(["m1"])
    expect(s.moderators).toEqual(["m2"])
  })

  it("GET /bans replaces the ban list; later frames keep it current", () => {
    let s = frame(initialChatState(S), { type: "frame", frame: { kind: "ban", stream_id: S, user_id: "stale" } })
    s = frame(s, { type: "bans_seed", user_ids: ["b1", "b2", "b1", ""] })
    expect(s.banned).toEqual(["b1", "b2"])
    s = frame(s, { type: "frame", frame: { kind: "unban", stream_id: S, user_id: "b1" } })
    expect(s.banned).toEqual(["b2"])
  })

  it("replay is the truth for its window: a message removed while polling disappears; newer socket arrivals stay", () => {
    let s = initialChatState(S)
    for (const [id, at] of [["a", 1], ["b", 2], ["c", 3], ["d", 9]] as const) {
      s = frame(s, { type: "sent", message: msg(id, "u", at) })
    }
    // Server list (newest first, as the API sends it) covers up to c; b was removed meanwhile.
    s = frame(s, { type: "replay", messages: [msg("c", "u", 3), msg("a", "u", 1)] })
    expect(s.messages.map((m) => m.id)).toEqual(["a", "c", "d"])
  })

  it("an empty replay keeps what the socket delivered", () => {
    let s = frame(initialChatState(S), { type: "sent", message: msg("a") })
    s = frame(s, { type: "replay", messages: [] })
    expect(s.messages.map((m) => m.id)).toEqual(["a"])
  })

  it("keeps a bounded window", () => {
    let s = initialChatState(S)
    for (let i = 0; i < CHAT_WINDOW + 5; i++) s = frame(s, { type: "sent", message: { ...msg(`m${i}`), created_at: new Date(i * 1000).toISOString() } })
    expect(s.messages.length).toBe(CHAT_WINDOW)
    expect(s.messages[0].id).toBe("m5")
  })
})

describe("roles and host-only tools", () => {
  const base = { hostId: HOST, moderators: ["mod"], banned: [] as string[] }
  const labels = (role: Parameters<typeof messageActions>[0]["role"], meId: string | null, authorId: string, banned: string[] = []) =>
    messageActions({ ...base, role, meId, authorId, banned }).map((a) => a.label)

  it("chatRole", () => {
    expect(chatRole(null, HOST, ["mod"])).toBe("guest")
    expect(chatRole("", HOST, ["mod"])).toBe("guest")
    expect(chatRole(HOST, HOST, ["mod"])).toBe("host")
    expect(chatRole("mod", HOST, ["mod"])).toBe("moderator")
    expect(chatRole("v", HOST, ["mod"])).toBe("viewer")
  })

  it("viewers see Report only, never host tools", () => {
    expect(labels("viewer", "v", "u1")).toEqual(["Report message"])
    expect(labels("viewer", "v", "v")).toEqual([])
    expect(labels("viewer", "v", HOST)).toEqual(["Report message"])
    expect(labels("guest", null, "u1")).toEqual([])
  })

  it("host: remove, ban/unban, moderator toggle — alphabetical", () => {
    expect(labels("host", HOST, "u1")).toEqual(["Ban from stream", "Make moderator", "Remove message"])
    expect(labels("host", HOST, "u1", ["u1"])).toEqual(["Make moderator", "Remove message", "Unban from stream"])
    expect(labels("host", HOST, "mod")).toEqual(["Ban from stream", "Remove message", "Remove moderator"])
    expect(labels("host", HOST, HOST)).toEqual(["Remove message"])
  })

  it("moderators remove and ban others but never touch the host or set moderators", () => {
    expect(labels("moderator", "mod", "u1")).toEqual(["Ban from stream", "Remove message"])
    expect(labels("moderator", "mod", HOST)).toEqual([])
    expect(labels("moderator", "mod", "mod")).toEqual(["Remove message"])
  })

  it("stream tools", () => {
    expect(streamTools("host")).toEqual({ moderationPanel: true, reportStream: false, setModerators: true })
    expect(streamTools("moderator")).toEqual({ moderationPanel: true, reportStream: true, setModerators: false })
    expect(streamTools("viewer")).toEqual({ moderationPanel: false, reportStream: true, setModerators: false })
    expect(streamTools("guest")).toEqual({ moderationPanel: false, reportStream: false, setModerators: false })
  })

  it("nextModerators: max 5, never the host, idempotent", () => {
    expect(nextModerators(["a"], "b", "add", HOST)).toEqual({ ok: true, user_ids: ["a", "b"] })
    expect(nextModerators(["a"], "a", "add", HOST)).toEqual({ ok: true, user_ids: ["a"] })
    expect(nextModerators(["a"], HOST, "add", HOST)).toEqual({ ok: false, reason: "host" })
    expect(nextModerators(["a", "b", "c", "d", "e"], "f", "add", HOST)).toEqual({ ok: false, reason: "limit" })
    expect(nextModerators(["a", "b"], "a", "remove", HOST)).toEqual({ ok: true, user_ids: ["b"] })
  })

  it("canSendChat: signed in, not banned, and only while Live", () => {
    expect(canSendChat({ role: "viewer", meId: "v", banned: [], chatOpen: true })).toBe(true)
    expect(canSendChat({ role: "viewer", meId: "v", banned: ["v"], chatOpen: true })).toBe(false)
    expect(canSendChat({ role: "viewer", meId: "v", banned: [], chatOpen: false })).toBe(false)
    expect(canSendChat({ role: "guest", meId: null, banned: [], chatOpen: true })).toBe(false)
  })
})
