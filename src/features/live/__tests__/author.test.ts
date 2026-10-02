import { describe, expect, it } from "bun:test"

import {
  chatAuthorAvatar,
  chatAuthorName,
  chatRoleTag,
  collectAuthors,
  nameFromAuthors,
  parseChatAuthor,
  parseChatList,
  parseChatMessage,
} from "../author"
import { parseLiveFrame } from "../realtime"
import type { LiveChatAuthor } from "../model"

const USER = "7f3a9c1e-5b2d-4e8f-9a6c-1d2e3f4a5b6c"
const author = (patch: Partial<LiveChatAuthor> = {}): LiveChatAuthor => ({ user_id: USER, name: "", handle: "", avatar_url: "", badges: [], role: "viewer", ...patch })

describe("the name on a chat row", () => {
  it("name, else @handle, else Viewer", () => {
    expect(chatAuthorName(author({ name: "Asha Rao", handle: "asha" }))).toBe("Asha Rao")
    expect(chatAuthorName(author({ handle: "asha" }))).toBe("@asha")
    expect(chatAuthorName(author())).toBe("Viewer")
  })
  it("absent or null author → Viewer", () => {
    expect(chatAuthorName(null)).toBe("Viewer")
    expect(chatAuthorName(undefined)).toBe("Viewer")
  })
  it("never a piece of the user id", () => {
    for (const a of [author(), author({ name: "   " }), author({ handle: "@" }), null]) {
      const name = chatAuthorName(a)
      expect(name).toBe("Viewer")
      expect(name).not.toContain(USER.slice(0, 4))
    }
  })
  it("blank names fall through; a handle is shown with exactly one @", () => {
    expect(chatAuthorName(author({ name: "  ", handle: "ben" }))).toBe("@ben")
    expect(chatAuthorName(author({ handle: "@ben" }))).toBe("@ben")
  })
})

describe("Host and Mod marks", () => {
  const msg = (a: LiveChatAuthor | null | undefined, user_id = USER) => ({ user_id, author: a })
  it("come from author.role", () => {
    expect(chatRoleTag(msg(author({ role: "host" })), "someone-else", [])).toBe("Host")
    expect(chatRoleTag(msg(author({ role: "moderator" })), "h", [])).toBe("Mod")
    expect(chatRoleTag(msg(author({ role: "viewer" })), "h", [])).toBeUndefined()
  })
  it("author.role wins over the page's own lists", () => {
    expect(chatRoleTag(msg(author({ role: "viewer" })), "h", [USER])).toBeUndefined()
  })
  it("a row with no author card falls back to the host id and the moderator list", () => {
    expect(chatRoleTag(msg(null, "h"), "h", [])).toBe("Host")
    expect(chatRoleTag(msg(undefined, "m1"), "h", ["m1"])).toBe("Mod")
    expect(chatRoleTag(msg(null, "v"), "h", ["m1"])).toBeUndefined()
    expect(chatRoleTag(msg(null, ""), "", [])).toBeUndefined()
  })
})

describe("parsing the author card", () => {
  it("only user_id and role are guaranteed; the rest reads as empty", () => {
    expect(parseChatAuthor({ user_id: USER, badges: [], role: "viewer" })).toEqual(author())
  })
  it("absent or null → null (the fallbacks apply)", () => {
    expect(parseChatAuthor(undefined)).toBeNull()
    expect(parseChatAuthor(null)).toBeNull()
    expect(parseChatAuthor("asha")).toBeNull()
    expect(parseChatAuthor([])).toBeNull()
  })
  it("an unknown role is a viewer; badges are strings, once each", () => {
    expect(parseChatAuthor({ user_id: USER, role: "admin" })?.role).toBe("viewer")
    expect(parseChatAuthor({ user_id: USER })?.role).toBe("viewer")
    expect(parseChatAuthor({ user_id: USER, badges: ["founding_creator", "founding_creator", 3, ""] })?.badges).toEqual(["founding_creator"])
    expect(parseChatAuthor({ user_id: USER, badges: null })?.badges).toEqual([])
  })
  it("the avatar is the card's avatar_url, or none", () => {
    expect(chatAuthorAvatar(author({ avatar_url: "/v1/media/m/serve/avatar" }))).toBe("/v1/media/m/serve/avatar")
    expect(chatAuthorAvatar(author())).toBeNull()
    expect(chatAuthorAvatar(null)).toBeNull()
  })
  it("a row: id required, author parsed, a row from before the contract has none", () => {
    const row = parseChatMessage({ id: "m1", stream_id: "s", user_id: USER, text: "hi", is_pinned: false, created_at: "2026-10-02T09:00:00Z", author: { user_id: USER, name: "Asha", role: "host", badges: [] } })
    expect(row?.author?.name).toBe("Asha")
    expect(row?.author?.role).toBe("host")
    expect(parseChatMessage({ id: "m2", stream_id: "s", user_id: USER, text: "hi", created_at: "" })?.author).toBeNull()
    expect(parseChatMessage({ stream_id: "s", user_id: USER })).toBeNull()
    expect(parseChatList({ data: null })).toEqual([])
    expect(parseChatList({ data: [{ id: "m1" }, null, { text: "no id" }] }).map((m) => m.id)).toEqual(["m1"])
  })
})

describe("chat.message frames carry the author", () => {
  const card = { user_id: USER, name: "Asha Rao", handle: "asha", badges: ["founding_creator"], role: "host" }
  const base = { id: "m1", stream_id: "s", user_id: USER, text: "hello", is_pinned: false, created_at: "2026-10-02T09:00:00Z" }
  const authorOf = (frame: unknown) => {
    const parsed = parseLiveFrame(frame)
    return parsed?.kind === "chat" ? parsed.message.author : undefined
  }
  it("at the top level", () => {
    expect(authorOf({ type: "chat.message", ...base, author: card })).toEqual(author({ name: "Asha Rao", handle: "asha", badges: ["founding_creator"], role: "host" }))
  })
  it("under payload", () => {
    expect(authorOf({ type: "chat.message", stream_id: "s", payload: { ...base, author: { ...card, role: "moderator" } } })?.role).toBe("moderator")
  })
  it("top level first", () => {
    expect(authorOf({ type: "chat.message", ...base, author: card, payload: { ...base, author: { ...card, name: "Other" } } })?.name).toBe("Asha Rao")
  })
  it("no author on the frame → null, and the name is Viewer", () => {
    const a = authorOf({ type: "chat.message", ...base })
    expect(a).toBeNull()
    expect(chatAuthorName(a)).toBe("Viewer")
  })
})

describe("names for the moderation panel: authors seen in chat, else Viewer", () => {
  const m = (user_id: string, a: LiveChatAuthor | null) => ({ user_id, author: a })
  it("someone who wrote is named; someone who never did is Viewer", () => {
    const seen = collectAuthors(new Map(), [m("u1", author({ user_id: "u1", name: "Asha" })), m("u2", author({ user_id: "u2", handle: "ben" }))])
    expect(nameFromAuthors(seen, "u1")).toBe("Asha")
    expect(nameFromAuthors(seen, "u2")).toBe("@ben")
    expect(nameFromAuthors(seen, "u3")).toBe("Viewer")
    expect(nameFromAuthors(new Map(), "7f3a9c1e")).toBe("Viewer")
  })
  it("authors are remembered after their messages are gone (a ban removes them)", () => {
    const first = collectAuthors(new Map(), [m("u1", author({ user_id: "u1", name: "Asha" }))])
    const later = collectAuthors(first, [])
    expect(nameFromAuthors(later, "u1")).toBe("Asha")
  })
  it("a later card with no name does not erase a known name; a named one updates it", () => {
    const first = collectAuthors(new Map(), [m("u1", author({ user_id: "u1", name: "Asha" }))])
    expect(nameFromAuthors(collectAuthors(first, [m("u1", author({ user_id: "u1" }))]), "u1")).toBe("Asha")
    expect(nameFromAuthors(collectAuthors(first, [m("u1", author({ user_id: "u1", name: "Asha R" }))]), "u1")).toBe("Asha R")
    expect(collectAuthors(first, [m("u9", null)]).has("u9")).toBe(false)
  })
})
