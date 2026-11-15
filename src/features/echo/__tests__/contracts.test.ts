import { describe, expect, test } from "bun:test"

import { parseEligibility, parseNote, parseNotePage, readFailure, echoErrorMessage, ECHO_WORDS, composerGate } from "../model"
import { backendContractsDir, fixtureNames, readFixture, readFixtureText } from "./contractFixtures"

/*
  The four golden fixtures of modernsmapp echo-contract.md, read the way
  the screens read them.
*/

describe("the fixtures are the backend's, byte for byte", () => {
  test("the contract files (phase 1 and v2) are here", () => {
    expect(fixtureNames()).toEqual(["eligibility", "error_poll_closed", "error_premium_required", "note", "note_list", "note_scheduled", "note_v2", "trends"])
  })

  test("each matches post-service testdata/contracts/notes when the checkout is on this machine", () => {
    const dir = backendContractsDir()
    if (!dir) return
    expect(fixtureNames(dir)).toEqual(fixtureNames())
    for (const name of fixtureNames()) expect(readFixtureText(name), name).toBe(readFixtureText(name, dir))
  })
})

describe("note.json", () => {
  const note = parseNote(readFixture("note"))!

  test("the note's own fields", () => {
    expect(note.id).toBe("f1111111-1111-4111-8111-111111111111")
    expect(note.authorId).toBe("a1111111-1111-4111-8111-111111111111")
    expect(note.text).toBe("Rain all week in #Bengaluru")
    expect(note.createdAt).toBe("2026-11-12T09:30:00Z")
    expect(note.editedAt).toBeNull()
    expect(note.replyToId).toBeNull()
    expect(note.conversationId).toBe(note.id)
    expect(note.quoteOfId).toBe("f4444444-4444-4444-8444-444444444444")
    expect(note.replyPolicy).toBe("everyone")
    expect([note.replyCount, note.likeCount, note.repostCount]).toEqual([2, 4, 1])
    expect([note.liked, note.reposted, note.viewerCanReply]).toEqual([true, false, true])
  })

  test("the author, with the Verified person mark", () => {
    expect(note.author).toEqual({
      id: "a1111111-1111-4111-8111-111111111111",
      username: "alice",
      displayName: "Alice Rao",
      avatarUrl: "https://cdn.example.test/avatars/alice.jpg",
      mark: "person",
    })
  })

  test("one image, by media id", () => {
    expect(note.media).toEqual([
      { mediaId: "e1111111-1111-4111-8111-111111111111", isGif: false, altText: "", isVideo: false, durationMs: 0, hlsUrl: null },
    ])
  })

  test("the quoted note is read one level deep", () => {
    expect(note.quoted?.id).toBe("f4444444-4444-4444-8444-444444444444")
    expect(note.quoted?.text).toBe("Monsoon is here.")
    expect(note.quoted?.quoted).toBeNull()
    expect(note.quoted?.media).toEqual([])
  })
})

describe("note_list.json", () => {
  const page = parseNotePage(readFixture("note_list"))

  test("two replies, and the empty cursor means the last page", () => {
    expect(page.items.map((n) => n.id)).toEqual(["f2222222-2222-4222-8222-222222222222", "f3333333-3333-4333-8333-333333333333"])
    expect(page.nextCursor).toBeNull()
    for (const n of page.items) {
      expect(n.replyToId).toBe("f1111111-1111-4111-8111-111111111111")
      expect(n.conversationId).toBe("f1111111-1111-4111-8111-111111111111")
    }
  })

  test("an unverified author carries no mark", () => {
    expect(page.items[0].author?.mark).toBe("none")
    expect(page.items[1].author?.mark).toBe("person")
  })
})

describe("eligibility.json", () => {
  test("can reply, may not post, because Premium is required", () => {
    const e = parseEligibility(readFixture("eligibility"))
    expect(e).toEqual({ canPost: false, canReply: true, reason: "premium_required" })
    expect(composerGate(e, "reply")).toEqual({ open: true })
    const gate = composerGate(e, "note")
    expect(gate.open).toBe(false)
    if (!gate.open) {
      expect(gate.title).toBe("Posting on Echo needs Momentum Premium")
      expect(gate.premium).toBe(true)
    }
  })
})

describe("error_premium_required.json", () => {
  test("the code maps to our own words, the same as the app", () => {
    const err = { isAxiosError: true, response: { status: 403, data: readFixture("error_premium_required"), headers: {} } }
    expect(readFailure(err).code).toBe("PREMIUM_REQUIRED")
    expect(echoErrorMessage(err)).toBe(ECHO_WORDS.premiumRequired)
  })
})
