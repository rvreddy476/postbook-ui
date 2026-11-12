import { describe, expect, test } from "bun:test"

import { createNoteBody, echoPaths, pageQuery } from "../api"
import {
  ECHO_ERROR_CODES,
  ECHO_RULES,
  ECHO_WORDS,
  MEDIA_LIMIT_MESSAGE,
  acceptedPicks,
  canEditText,
  compactCount,
  composerGate,
  echoErrorMessage,
  eligibilityWords,
  entryProblem,
  isAcceptedFile,
  mediaProblem,
  noteLength,
  parseEligibility,
  parseNote,
  rateLimitedMessage,
  remaining,
  shortAge,
  textSegments,
  threadProblem,
  verificationMark,
  withLike,
  withRepost,
  type Note,
} from "../model"

const img = (n: number) => Array.from({ length: n }, (_, i) => ({ key: `i${i}`, isGif: false, mediaId: `m${i}` }))
const gif = { key: "g", isGif: true, mediaId: "g1" }

function fail(code: string | null, status = 400, headers: Record<string, string> = {}) {
  return { isAxiosError: true, response: { status, headers, data: code ? { error: { code, message: "server words" } } : {} } }
}

describe("composer limits", () => {
  test("500 characters, counted as code points after trimming, like the server's runes", () => {
    expect(ECHO_RULES.maxChars).toBe(500)
    expect(noteLength("  hi  ")).toBe(2)
    expect(noteLength("😀😀")).toBe(2)
    expect(remaining("a".repeat(500))).toBe(0)
    expect(entryProblem("a".repeat(500))).toBeNull()
    expect(entryProblem("a".repeat(501))).toBe("Notes can be up to 500 characters.")
    expect(entryProblem("😀".repeat(500))).toBeNull()
    expect(entryProblem("😀".repeat(501))).not.toBeNull()
  })

  test("empty text needs a photo", () => {
    expect(entryProblem("   ")).toBe("Write something or add a photo.")
    expect(entryProblem("", img(1))).toBeNull()
  })

  test("up to 4 images, or exactly 1 GIF on its own", () => {
    expect(mediaProblem(img(4))).toBeNull()
    expect(mediaProblem(img(5))).toBe(MEDIA_LIMIT_MESSAGE)
    expect(mediaProblem([gif])).toBeNull()
    expect(mediaProblem([gif, ...img(1)])).toBe(MEDIA_LIMIT_MESSAGE)
    expect(mediaProblem([gif, gif])).toBe(MEDIA_LIMIT_MESSAGE)
    expect(entryProblem("x", img(5))).toBe(MEDIA_LIMIT_MESSAGE)
  })

  test("picks past the limit are left out, in pick order", () => {
    expect(acceptedPicks([], [false, false, false, false, false])).toBe(4)
    expect(acceptedPicks(img(3), [false, false])).toBe(1)
    expect(acceptedPicks([], [true, false])).toBe(1)
    expect(acceptedPicks(img(1), [true])).toBe(0)
    expect(acceptedPicks([gif], [false])).toBe(0)
  })

  test("photos and GIFs only, never video or audio", () => {
    expect(isAcceptedFile({ type: "image/png" })).toBe(true)
    expect(isAcceptedFile({ type: "image/gif" })).toBe(true)
    expect(isAcceptedFile({ type: "video/mp4" })).toBe(false)
    expect(isAcceptedFile({ type: "audio/mpeg" })).toBe(false)
  })

  test("a failed upload blocks posting until removed", () => {
    expect(entryProblem("x", [{ key: "a", isGif: false, failed: true }])).toBe("A photo didn't upload. Remove it and try again.")
  })

  test("a thread is 2 to 25 notes, each within the note rules", () => {
    const e = (text: string) => ({ text })
    expect(threadProblem([e("one")])).toBe("A thread needs 2 to 25 notes.")
    expect(threadProblem([e("one"), e("two")])).toBeNull()
    expect(threadProblem(Array.from({ length: 25 }, () => e("x")))).toBeNull()
    expect(threadProblem(Array.from({ length: 26 }, () => e("x")))).toBe("A thread needs 2 to 25 notes.")
    expect(threadProblem([e("one"), e("")])).toBe("Note 2: Write something or add a photo.")
    expect(threadProblem([e("a".repeat(501)), e("b")])).toBe("Note 1: Notes can be up to 500 characters.")
  })
})

describe("the create body", () => {
  test("only what is set; reply and quote are never both sent", () => {
    expect(createNoteBody({ text: "  hi " })).toEqual({ text: "hi" })
    expect(createNoteBody({ text: "hi", mediaIds: ["a", "a", "b"], replyPolicy: "mentioned" })).toEqual({ text: "hi", media_ids: ["a", "b"], reply_policy: "mentioned" })
    expect(createNoteBody({ text: "hi", replyToId: "r", quoteOfId: "q" })).toEqual({ text: "hi", reply_to_id: "r" })
    expect(createNoteBody({ text: "hi", quoteOfId: "q" })).toEqual({ text: "hi", quote_of_id: "q" })
  })

  test("routes and cursor paging", () => {
    expect(pageQuery(null)).toBe("limit=20")
    expect(echoPaths.timeline("following")).toBe("/v1/feed/notes/following?limit=20")
    expect(echoPaths.timeline("for-you", "c1")).toBe("/v1/feed/notes/for-you?cursor=c1&limit=20")
    expect(echoPaths.userNotes("u1", "replies", "c")).toBe("/v1/notes/users/u1?tab=replies&cursor=c&limit=20")
    expect(echoPaths.replies("n/1")).toBe("/v1/notes/n%2F1/replies?limit=20")
  })
})

describe("error mapping: every contract code has its own clear sentence", () => {
  test("each code maps to words that are not the server's and not the generic line", () => {
    for (const code of ECHO_ERROR_CODES) {
      const msg = echoErrorMessage(fail(code, code === "RATE_LIMITED" ? 429 : 400))
      expect(msg, code).not.toBe("server words")
      expect(msg, code).not.toBe(ECHO_WORDS.generic)
      expect(msg.length, code).toBeGreaterThan(10)
    }
  })

  test("the codes the contract added while building are covered", () => {
    for (const code of ["ACCOUNT_CHECK_UNAVAILABLE", "INVALID_REQUEST", "MEDIA_NOT_OWNED", "MEDIA_NOT_FOUND", "MEDIA_NOT_READY"]) {
      expect(ECHO_ERROR_CODES as readonly string[]).toContain(code)
    }
    expect(echoErrorMessage(fail("ACCOUNT_CHECK_UNAVAILABLE", 503))).toBe("We couldn't check your account. Try again in a moment.")
    expect(echoErrorMessage(fail("MEDIA_NOT_READY"))).toBe("Your photos are still processing. Try again in a moment.")
    expect(echoErrorMessage(fail("EDIT_WINDOW_CLOSED", 403))).toBe("Notes can only be edited for 30 minutes after posting.")
    expect(echoErrorMessage(fail("REPLY_NOT_ALLOWED", 403))).toBe(ECHO_WORDS.replyNotAllowed)
  })

  test("rate limits use Retry-After when sent", () => {
    expect(echoErrorMessage(fail("RATE_LIMITED", 429, { "retry-after": "90" }))).toBe("You're posting too fast. Try again in 2 minutes.")
    expect(echoErrorMessage(fail(null, 429, { "retry-after": "30" }))).toBe("You're posting too fast. Try again in 30 seconds.")
    expect(rateLimitedMessage(null)).toBe("You're posting too fast. Try again later.")
    expect(rateLimitedMessage(60)).toBe("You're posting too fast. Try again in 1 minute.")
  })

  test("no code: a 404 is a missing note, a 503 is Echo closed, no answer is the network, the rest generic", () => {
    expect(echoErrorMessage(fail(null, 404))).toBe(ECHO_WORDS.noteNotFound)
    expect(echoErrorMessage(fail(null, 503))).toBe("Echo isn't available right now.")
    expect(echoErrorMessage({ isAxiosError: true })).toBe(ECHO_WORDS.noNetwork)
    expect(echoErrorMessage(fail("SOMETHING_NEW", 500))).toBe(ECHO_WORDS.generic)
    expect(echoErrorMessage(new Error("x"))).toBe(ECHO_WORDS.generic)
  })
})

describe("eligibility before the composer opens", () => {
  test("can_post opens notes, threads and quotes; can_reply opens replies", () => {
    expect(composerGate({ canPost: true, canReply: true, reason: "" }, "note")).toEqual({ open: true })
    expect(composerGate({ canPost: false, canReply: true, reason: "premium_required" }, "reply")).toEqual({ open: true })
  })

  test("each reason has its words; Premium is the default refusal for posting", () => {
    expect(eligibilityWords("premium_required")?.title).toBe("Posting on Echo needs Momentum Premium")
    expect(eligibilityWords("account_too_new")?.detail).toBe("Accounts can reply once they are 7 days old.")
    expect(eligibilityWords("suspended")?.title).toBe("Your account can't post on Echo right now")
    expect(eligibilityWords("")).toBeNull()
    const tooNew = composerGate({ canPost: false, canReply: false, reason: "account_too_new" }, "reply")
    expect(tooNew).toMatchObject({ open: false, title: "Your account is too new to reply on Echo", premium: false })
    const suspended = composerGate({ canPost: false, canReply: false, reason: "suspended" }, "note")
    expect(suspended).toMatchObject({ open: false, title: "Your account can't post on Echo right now", premium: false })
    expect(composerGate({ canPost: false, canReply: true, reason: "" }, "note")).toMatchObject({ open: false, premium: true })
  })

  test("a malformed answer opens nothing", () => {
    const e = parseEligibility({ data: { can_post: "yes", reason: "vip" } })
    expect(e).toEqual({ canPost: false, canReply: false, reason: "" })
    expect(composerGate(e, "note").open).toBe(false)
    expect(composerGate(e, "reply").open).toBe(false)
    expect(parseEligibility(null)).toEqual({ canPost: false, canReply: false, reason: "" })
  })
})

describe("the 30-minute edit window", () => {
  const created = Date.parse("2026-11-12T09:30:00Z")
  const note = { authorId: "me", createdAt: "2026-11-12T09:30:00Z" }

  test("the author, inside 30 minutes", () => {
    expect(canEditText(note, "me", created)).toBe(true)
    expect(canEditText(note, "me", created + 29 * 60_000 + 59_000)).toBe(true)
    expect(canEditText(note, "me", created + 30 * 60_000)).toBe(false)
    expect(canEditText(note, "me", created + 2 * 3_600_000)).toBe(false)
  })

  test("never anyone else, never signed out, never a time that does not parse or is in the future", () => {
    expect(canEditText(note, "someone", created + 60_000)).toBe(false)
    expect(canEditText(note, null, created + 60_000)).toBe(false)
    expect(canEditText(note, "", created + 60_000)).toBe(false)
    expect(canEditText({ authorId: "me", createdAt: "not a time" }, "me", created)).toBe(false)
    expect(canEditText(note, "me", created - 60_000)).toBe(false)
  })
})

describe("text, marks and counts", () => {
  test("mentions, hashtags and links are split out; the rest stays plain", () => {
    expect(textSegments("Rain all week in #Bengaluru")).toEqual([
      { kind: "text", text: "Rain all week in " },
      { kind: "hashtag", text: "#Bengaluru", tag: "Bengaluru" },
    ])
    expect(textSegments("hi @alice, see https://example.com/a.")).toEqual([
      { kind: "text", text: "hi " },
      { kind: "mention", text: "@alice", username: "alice" },
      { kind: "text", text: ", see " },
      { kind: "link", text: "https://example.com/a", href: "https://example.com/a" },
      { kind: "text", text: "." },
    ])
    expect(textSegments("mail a@b.com and C#")).toEqual([{ kind: "text", text: "mail a@b.com and C#" }])
  })

  test("only http(s) becomes a link", () => {
    expect(textSegments("javascript:alert(1)").every((s) => s.kind === "text")).toBe(true)
  })

  test("marks: Premium alone shows nothing", () => {
    expect(verificationMark(false, "person")).toBe("none")
    expect(verificationMark(true, "")).toBe("person")
    expect(verificationMark(true, "organisation")).toBe("official")
    expect(verificationMark(true, "government")).toBe("government")
  })

  test("short counts and ages", () => {
    expect(compactCount(0)).toBe("")
    expect(compactCount(999)).toBe("999")
    expect(compactCount(1200)).toBe("1.2K")
    expect(compactCount(2000)).toBe("2K")
    expect(compactCount(3_400_000)).toBe("3.4M")
    const t = Date.parse("2026-11-12T09:30:00Z")
    expect(shortAge("2026-11-12T09:30:00Z", t + 30_000)).toBe("now")
    expect(shortAge("2026-11-12T09:30:00Z", t + 5 * 60_000)).toBe("5m")
    expect(shortAge("2026-11-12T09:30:00Z", t + 3 * 3_600_000)).toBe("3h")
    expect(shortAge("2026-11-12T09:30:00Z", t + 2 * 86_400_000)).toBe("2d")
    expect(shortAge("2026-11-12T09:30:00Z", t + 9 * 86_400_000)).toBe("2026-11-12")
  })
})

describe("optimistic like and repost", () => {
  const base = parseNote({ id: "n1", author_id: "a", like_count: 3, repost_count: 1, viewer_has_liked: false, quoted_note: { id: "n1", like_count: 3 } }) as Note

  test("a like moves the count by one, on the note and on a quote of the same note", () => {
    const liked = withLike(base, "n1", true)
    expect([liked.liked, liked.likeCount, liked.quoted?.likeCount]).toEqual([true, 4, 4])
    expect(withLike(liked, "n1", true).likeCount).toBe(4)
    expect(withLike(base, "n1", true, 10).likeCount).toBe(10)
    expect(withLike(base, "other", true)).toEqual(base)
  })

  test("a repost too, never below zero", () => {
    expect(withRepost(base, "n1", true).repostCount).toBe(2)
    expect(withRepost({ ...base, repostCount: 0, reposted: true }, "n1", false).repostCount).toBe(0)
  })
})
