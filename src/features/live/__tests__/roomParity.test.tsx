import { describe, expect, it } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import type { LiveChatAuthor, LiveChatMessage } from "../model"
import { parseLiveFrame } from "../realtime"
import { canSendChat, chatReducer, initialChatState, messageActions, moderationTools, normalizeFilterWord } from "../chat"
import { JOIN_BURST_MS, MAX_JOINS, MAX_JOIN_ROWS, addJoin, chatTimeline, joinLabel, type LiveJoin } from "../joins"
import { BLOCKED_WORD_COPY, chatSendErrorCopy, isBlockedWord, moderationErrorCopy } from "../errors"
import { liveModerationPaths, parseMuteList, parsePinned, parseWordFilters } from "../moderation"
import { ModerationPanel } from "../components/ModerationPanel"
import { LiveRoomActions } from "../components/LiveRoomActions"
import { ChatJoinRow, PinnedMessageBar } from "../components/ChatSystemRows"

// parity audit T-29 (web package 3-W7): join notices, chat moderation
// controls on existing live-service-v2 routes, Follow and Share in the room.

const S = "11111111-1111-4111-8111-111111111111"
const U = "22222222-2222-4222-8222-222222222222"
const AT = "2026-10-14T10:00:00Z"
const T0 = Date.parse(AT)

/** The wire object as live-service-v2 publishes it: fields at the top level and again under "payload". */
function roomEvent(type: string, payload: Record<string, unknown>) {
  return JSON.parse(JSON.stringify({ ...payload, type, stream_id: S, at: AT, payload }))
}

const card = (name = "", handle = "", user_id = U): LiveChatAuthor => ({ user_id, name, handle, avatar_url: "", badges: [], role: "viewer" })

describe("viewer.joined frame (live-service-v2 service/joins.go)", () => {
  const body = { stream_id: S, user_id: U, user: card("Asha", "asha"), joined_at: AT }

  it("reads the top-level shape", () => {
    expect(parseLiveFrame(roomEvent("viewer.joined", body))).toEqual({
      kind: "joined", stream_id: S, user_id: U, joined_at: AT, author: card("Asha", "asha"),
    })
  })

  it("reads the payload-only shape", () => {
    const f = parseLiveFrame({ type: "viewer.joined", payload: body })
    expect(f).toMatchObject({ kind: "joined", stream_id: S, user_id: U, joined_at: AT })
    expect(f && f.kind === "joined" ? f.author?.name : "").toBe("Asha")
  })

  it("missing stream_id or user_id is null; a missing card is a null author", () => {
    expect(parseLiveFrame({ type: "viewer.joined", user_id: U, joined_at: AT })).toBeNull()
    expect(parseLiveFrame(roomEvent("viewer.joined", { stream_id: S, joined_at: AT }))).toBeNull()
    expect(parseLiveFrame(roomEvent("viewer.joined", { stream_id: S, user_id: "", joined_at: AT }))).toBeNull()
    // joined_at falls back to the envelope's "at".
    expect(parseLiveFrame(roomEvent("viewer.joined", { stream_id: S, user_id: U }))).toMatchObject({ kind: "joined", author: null, joined_at: AT })
  })

  it("a card without user_id takes the frame's user id", () => {
    const f = parseLiveFrame(roomEvent("viewer.joined", { stream_id: S, user_id: U, user: { name: "Ravi" } }))
    expect(f && f.kind === "joined" ? f.author?.user_id : "").toBe(U)
  })
})

describe("moderation frames now read", () => {
  it("mute / unmute {user_id}", () => {
    expect(parseLiveFrame(roomEvent("moderation.mute", { stream_id: S, user_id: U, muted_by: "h", by_role: "host" })))
      .toEqual({ kind: "mute", stream_id: S, user_id: U })
    expect(parseLiveFrame(roomEvent("moderation.unmute", { stream_id: S, user_id: U }))).toEqual({ kind: "unmute", stream_id: S, user_id: U })
    expect(parseLiveFrame(roomEvent("moderation.mute", { stream_id: S }))).toBeNull()
  })
  it("pin {message_id, user_id, text} / unpin {message_id}", () => {
    expect(parseLiveFrame(roomEvent("moderation.pin", { stream_id: S, message_id: "m1", user_id: U, text: "hi", pinned_by: "h" })))
      .toEqual({ kind: "pin", stream_id: S, message_id: "m1", user_id: U, text: "hi" })
    expect(parseLiveFrame(roomEvent("moderation.unpin", { stream_id: S, message_id: "m1" }))).toEqual({ kind: "unpin", stream_id: S, message_id: "m1" })
    expect(parseLiveFrame(roomEvent("moderation.pin", { stream_id: S, text: "x" }))).toBeNull()
  })
})

const join = (user_id: string, at: number, name = ""): LiveJoin => ({ user_id, at, author: name ? card(name, "", user_id) : null })
const message = (id: string, at: number): LiveChatMessage => ({ id, stream_id: S, user_id: "w", text: id, created_at: new Date(at).toISOString() })
const labelsOf = (items: ReturnType<typeof chatTimeline>) => items.map((i) => (i.kind === "joins" ? i.label : i.message.id))

describe("join notices: names, bursts, own join, caps", () => {
  it("name fallback: name, else @handle, else Viewer, never an id", () => {
    expect(joinLabel([card("Asha", "asha")])).toBe("Asha joined")
    expect(joinLabel([card("", "ravi")])).toBe("@ravi joined")
    expect(joinLabel([card("", "")])).toBe("Viewer joined")
    expect(joinLabel([null])).toBe("Viewer joined")
    expect(joinLabel([null, null, null])).toBe("3 viewers joined")
    expect(joinLabel([card("", "", "abcdef12-3456")])).not.toContain("abcdef")
  })

  it("collapses a burst into one sentence", () => {
    expect(joinLabel([card("A"), card("B")])).toBe("A and B joined")
    expect(joinLabel([card("A"), card("B"), card("C")])).toBe("A, B and C joined")
    expect(joinLabel([card("A"), card("B"), card("C"), card("D"), card("E")])).toBe("A, B and 3 others joined")
    expect(joinLabel([card("A"), null])).toBe("A and 1 other joined")
    expect(joinLabel([null, card("B"), null, null])).toBe("B and 3 others joined")
  })

  it("joins within the window collapse into one row; a later one starts a new row", () => {
    const joins = [join("a", T0, "A"), join("b", T0 + 1000, "B"), join("c", T0 + 2000, "C"), join("d", T0 + 3000, "D"), join("e", T0 + 4000, "E"), join("f", T0 + JOIN_BURST_MS + 5000, "F")]
    expect(labelsOf(chatTimeline([], joins, null))).toEqual(["A, B and 3 others joined", "F joined"])
  })

  it("a chat message ends a burst, and rows sit in time order beside messages", () => {
    const items = chatTimeline([message("m1", T0 + 1500)], [join("a", T0, "A"), join("b", T0 + 2000, "B")], null)
    expect(labelsOf(items)).toEqual(["A joined", "m1", "B joined"])
  })

  it("never shows the reader's own join", () => {
    expect(labelsOf(chatTimeline([], [join("me", T0, "Me"), join("a", T0 + 100, "A")], "me"))).toEqual(["A joined"])
    expect(chatTimeline([], [join("me", T0, "Me")], "me")).toEqual([])
  })

  it("caps stored joins and shown rows", () => {
    let joins: LiveJoin[] = []
    for (let i = 0; i < MAX_JOINS + 10; i++) joins = addJoin(joins, join(`u${i}`, T0 + i * 60_000))
    expect(joins.length).toBe(MAX_JOINS)
    expect(joins[0].user_id).toBe("u10")
    expect(chatTimeline([], joins, null).length).toBe(MAX_JOIN_ROWS)
  })

  it("a redelivered join inside the window is stored once", () => {
    const once = addJoin([], join("a", T0))
    expect(addJoin(once, join("a", T0 + 500))).toBe(once)
    expect(addJoin(once, join("a", T0 + 120_000)).length).toBe(2)
  })
})

describe("chat reducer: joins stay client-side", () => {
  const joined = (user_id: string) => ({ type: "frame" as const, frame: { kind: "joined" as const, stream_id: S, user_id, author: null, joined_at: AT } })

  it("never enter messages and survive an HTTP replay", () => {
    let s = chatReducer(initialChatState(S), joined(U))
    expect(s.messages).toEqual([])
    expect(s.joins.map((j) => j.user_id)).toEqual([U])
    s = chatReducer(s, { type: "replay", messages: [message("m1", T0)] })
    expect(s.messages.map((m) => m.id)).toEqual(["m1"])
    expect(s.joins.length).toBe(1)
  })

  it("other streams and banned viewers are ignored", () => {
    const other = { type: "frame" as const, frame: { kind: "joined" as const, stream_id: "other", user_id: U, author: null, joined_at: AT } }
    expect(chatReducer(initialChatState(S), other).joins).toEqual([])
    const banned = chatReducer(initialChatState(S), { type: "bans_seed", user_ids: [U] })
    expect(chatReducer(banned, joined(U)).joins).toEqual([])
  })

  it("mute / unmute, and the composer closes for a muted reader", () => {
    let s = chatReducer(initialChatState(S), { type: "frame", frame: { kind: "mute", stream_id: S, user_id: U } })
    expect(s.muted).toEqual([U])
    expect(canSendChat({ role: "viewer", meId: U, banned: [], chatOpen: true, muted: s.muted })).toBe(false)
    s = chatReducer(s, { type: "frame", frame: { kind: "unmute", stream_id: S, user_id: U } })
    expect(s.muted).toEqual([])
  })

  it("pin takes the row's author card; unpin and removal clear it", () => {
    const row = { ...message("m1", T0), author: card("Wen", "", "w") }
    let s = chatReducer(initialChatState(S), { type: "sent", message: row })
    s = chatReducer(s, { type: "frame", frame: { kind: "pin", stream_id: S, message_id: "m1", user_id: "w", text: "m1" } })
    expect(s.pinned?.author?.name).toBe("Wen")
    expect(chatReducer(s, { type: "frame", frame: { kind: "unpin", stream_id: S, message_id: "zz" } }).pinned).not.toBeNull()
    expect(chatReducer(s, { type: "frame", frame: { kind: "unpin", stream_id: S, message_id: "m1" } }).pinned).toBeNull()
    expect(chatReducer(s, { type: "removed_locally", message_id: "m1" }).pinned).toBeNull()
  })
})

describe("moderation controls only where live-service-v2 serves the route", () => {
  it("roles: mutes for host and moderators; word filters and pin for the host", () => {
    expect(moderationTools("host")).toEqual({ mutes: true, wordFilters: true, pin: true })
    expect(moderationTools("moderator")).toEqual({ mutes: true, wordFilters: false, pin: false })
    expect(moderationTools("viewer")).toEqual({ mutes: false, wordFilters: false, pin: false })
    expect(moderationTools("guest")).toEqual({ mutes: false, wordFilters: false, pin: false })
  })

  it("message menu: Pin/Unpin for the host only, Mute never on the host", () => {
    const base = { hostId: "host", moderators: ["mod"], banned: [] as string[], messageId: "m1" }
    const labels = (role: "host" | "moderator" | "viewer", meId: string, authorId: string, extra: { muted?: string[]; pinnedId?: string } = {}) =>
      messageActions({ ...base, role, meId, authorId, ...extra }).map((a) => a.label)
    expect(labels("host", "host", "host")).toEqual(["Pin message", "Remove message"])
    expect(labels("host", "host", "u1", { pinnedId: "m1", muted: ["u1"] })).toEqual(["Ban from stream", "Make moderator", "Remove message", "Unmute in chat", "Unpin message"])
    expect(labels("moderator", "mod", "u1")).toEqual(["Ban from stream", "Mute in chat", "Remove message"])
    expect(labels("moderator", "mod", "host")).toEqual([])
    expect(labels("viewer", "v", "u1")).toEqual(["Report message"])
  })

  it("routes are the existing ones", () => {
    expect(liveModerationPaths.mute(S)).toBe(`/v1/livestream/streams/${S}/chat/mute`)
    expect(liveModerationPaths.unmute(S, U)).toBe(`/v1/livestream/streams/${S}/chat/mute/${U}`)
    expect(liveModerationPaths.mutes(S)).toBe(`/v1/livestream/streams/${S}/chat/mutes`)
    expect(liveModerationPaths.wordFilters(S)).toBe(`/v1/livestream/streams/${S}/chat/word-filters`)
    expect(liveModerationPaths.wordFilter(S, "bad word")).toBe(`/v1/livestream/streams/${S}/chat/word-filters/bad%20word`)
    expect(liveModerationPaths.pin(S)).toBe(`/v1/livestream/streams/${S}/chat/pin`)
    expect(liveModerationPaths.pinned(S)).toBe(`/v1/livestream/streams/${S}/chat/pinned`)
  })

  it("parses the answers", () => {
    expect(parseMuteList({ data: { muted_user_ids: [U, "", U] } })).toEqual([U])
    expect(parseMuteList({ data: {} })).toEqual([])
    expect(parseWordFilters({ data: { words: ["zeta", "alpha"] } })).toEqual(["alpha", "zeta"])
    expect(parseWordFilters({ data: { words: null } })).toEqual([])
    expect(parsePinned({ data: null })).toBeNull()
    expect(parsePinned({})).toBeNull()
    expect(parsePinned({ data: { id: "m1", stream_id: S, user_id: U, text: "hi", is_pinned: true, created_at: AT, author: card("Asha") } }))
      .toMatchObject({ message_id: "m1", user_id: U, text: "hi", author: { name: "Asha" } })
  })

  it("word input is trimmed, lower-cased and 1..100 characters", () => {
    expect(normalizeFilterWord("  Spam ")).toBe("spam")
    expect(normalizeFilterWord("   ")).toBeNull()
    expect(normalizeFilterWord("అ".repeat(100))).toBe("అ".repeat(100))
    expect(normalizeFilterWord("a".repeat(101))).toBeNull()
    expect(moderationErrorCopy({ response: { status: 400, data: { error: { code: "INVALID_WORD" } } } })).toBe("Filter words can be 1 to 100 characters.")
  })

  it("panel sections by role", () => {
    const panel = (role: "host" | "moderator" | "viewer" | "guest") => renderToStaticMarkup(
      <ModerationPanel role={role} banned={[]} moderators={[]} muted={["u9"]} words={["spam"]}
        pinned={{ message_id: "m1", user_id: U, text: "Welcome", author: null }}
        pinnedName="Asha" nameOf={() => "Ravi"} onUnban={() => {}} onRemoveModerator={() => {}} />,
    )
    const host = panel("host")
    expect(host).toContain("Muted in chat")
    expect(host).toContain("Unmute")
    expect(host).toContain("Filtered words")
    expect(host).toContain('aria-label="Stop filtering spam"')
    expect(host).toContain("Pinned message")
    expect(host).toContain("Unpin")
    const mod = panel("moderator")
    expect(mod).toContain("Muted in chat")
    expect(mod).not.toContain("Filtered words")
    expect(mod).not.toContain("Pinned message")
    expect(panel("viewer")).toBe("")
    expect(panel("guest")).toBe("")
  })
})

describe("blocked-word refusal", () => {
  it("has its own copy, branching on CHAT_BLOCKED_WORD only", () => {
    const err = { response: { status: 400, data: { error: { code: "CHAT_BLOCKED_WORD", message: "chat: message contains blocked word" } } } }
    expect(isBlockedWord(err)).toBe(true)
    expect(chatSendErrorCopy(err)).toBe(BLOCKED_WORD_COPY)
    expect(BLOCKED_WORD_COPY).toContain("wasn't sent")
    expect(BLOCKED_WORD_COPY).not.toContain("blocked word") // never the server's text
    expect(isBlockedWord({ response: { status: 400, data: { error: { code: "INVALID_REQUEST" } } } })).toBe(false)
  })
})

describe("room system rows", () => {
  it("join row and pinned bar", () => {
    expect(renderToStaticMarkup(<ChatJoinRow label="Asha joined" />)).toContain("Asha joined")
    expect(renderToStaticMarkup(<ChatJoinRow label="" />)).toBe("")
    const viewerBar = renderToStaticMarkup(<PinnedMessageBar name="Asha" text="Welcome" />)
    expect(viewerBar).toContain("Welcome")
    expect(viewerBar).not.toContain("Unpin")
    expect(renderToStaticMarkup(<PinnedMessageBar name="Asha" text="Welcome" canUnpin />)).toContain("Unpin")
  })
})

describe("Follow and Share on /live/[streamId]", () => {
  const actions = (role: "host" | "moderator" | "viewer" | "guest", extra: Partial<React.ComponentProps<typeof LiveRoomActions>> = {}) =>
    renderToStaticMarkup(
      <LiveRoomActions role={role} canFollow following={false} signInHref="/login?next=%2Flive%2Fs" onToggleFollow={() => {}} onShare={() => {}} {...extra} />,
    )

  it("render for non-hosts only", () => {
    expect(actions("host")).toBe("")
    for (const role of ["viewer", "moderator", "guest"] as const) {
      expect(actions(role)).toContain("Follow")
      expect(actions(role)).toContain("Share")
    }
  })

  it("signed out: Follow links to sign in and back", () => {
    expect(actions("guest")).toContain('href="/login?next=%2Flive%2Fs"')
  })

  it("following, loading and not followable", () => {
    expect(actions("viewer", { following: true })).toContain("Following")
    expect(actions("viewer", { following: true })).toContain('aria-pressed="true"')
    expect(actions("viewer", { following: undefined })).toContain("disabled")
    const noFollow = actions("viewer", { canFollow: false })
    expect(noFollow).not.toContain(">Follow")
    expect(noFollow).toContain("Share")
  })
})
