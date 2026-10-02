import { describe, expect, test } from "bun:test"
import React, { isValidElement, type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { BotheredPrompt, CommentFilterForm, HideKnownSetting, KindBubbleText, KindNudge, SparkNote } from "../components/KindMessages"
import { LikedYouGrid } from "../components/LikedYouGrid"
import { toClientConfig } from "../model/clientConfig"
import { dealbreakersToSend } from "../model/dealbreakers"
import { copyFor, datingErrorCopy, KNOWN_ERROR_CODES } from "../model/errors"
import { HIDE_KNOWN_UNAVAILABLE_COPY, hideKnownBody, hideKnownLine, hideKnownRefusal, toHideKnown } from "../model/hideKnown"
import {
  addWord,
  ASKING,
  BOTHERED_FAILED,
  botheredAfterError,
  botheredBody,
  botheredDone,
  botheredRefusal,
  checkWithin,
  commentFilterBody,
  commentFilterRefusal,
  decideSend,
  kindCheckBody,
  kindCheckFailure,
  kindReasonLines,
  needsReceivedCheck,
  normalizeWord,
  NOTE_HIDDEN_TITLE,
  noteHiddenLine,
  nudgeApplies,
  RECEIVED_CHECK_LIMIT,
  receivedKey,
  receivedToCheck,
  receivedView,
  removeWord,
  sameWords,
  sendVerdict,
  shouldKindCheck,
  toBothered,
  toCommentFilter,
  toKindCheck,
  toNoteHidden,
  type ChatMessageLike,
  type KindCheck,
} from "../model/kindMessages"
import { toLikedYou, lockLikedYou } from "../model/likedYou"
import { matchForConversation } from "../model/matches"
import { toIncomingSparks } from "../model/sparks"
import { errorFromEnvelope } from "../model/wire"
import { PersonRow } from "../screens/HomeScreen"

import { readFixture } from "./contractFixtures"

const html = (node: React.ReactElement) => renderToStaticMarkup(node)
const noop = () => {}
const axiosError = (status: number, code: string, details?: Record<string, unknown>) => ({ response: { status, data: { error: { code, message: "developer words", details } } } })
const KIND: KindCheck = { kind: true, reasons: [] }
const UNKIND: KindCheck = { kind: false, reasons: ["insult"] }

/** The props of the first element in a (function-component) tree whose children are exactly `text`. */
function findByText(node: ReactNode, text: string): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findByText(child, text)
      if (hit) return hit
    }
    return null
  }
  if (!isValidElement(node)) return null
  const props = (node as ReactElement<Record<string, unknown>>).props
  if (props.children === text) return props
  return findByText(props.children as ReactNode, text)
}

/* ── the check, before a message goes ────────────────────────────── */

describe("kind messages: what the composer does", () => {
  test("only a literal kind:false is unkind; absent, null or junk reads as kind", () => {
    expect(toKindCheck({ kind: false, reasons: ["insult", "", 3] })).toEqual({ kind: false, reasons: ["insult"] })
    expect(toKindCheck({})).toEqual(KIND)
    expect(toKindCheck(null)).toEqual(KIND)
    expect(toKindCheck({ kind: "false" })).toEqual(KIND)
    expect(toKindCheck({ kind: true, reasons: null })).toEqual(KIND)
  })

  test("the body is trimmed; empty or too long is never asked", () => {
    expect(kindCheckBody("  hi  ")).toEqual({ text: "hi" })
    expect(shouldKindCheck("   ")).toBe(false)
    expect(shouldKindCheck("a".repeat(2000))).toBe(true)
    expect(shouldKindCheck("a".repeat(2001))).toBe(false)
  })

  test("a verdict: unkind nudges; kind, or no answer at all, sends", () => {
    expect(sendVerdict(UNKIND)).toBe("nudge")
    expect(sendVerdict(KIND)).toBe("send")
    expect(sendVerdict(null)).toBe("send")
  })

  test("failures: 404 is off, 429 is limited, anything else is other", () => {
    expect(kindCheckFailure(axiosError(404, "MECHANIC_NOT_ENABLED"))).toBe("off")
    expect(kindCheckFailure(axiosError(404, ""))).toBe("off")
    expect(kindCheckFailure(axiosError(429, "KIND_CHECK_RATE_LIMITED"))).toBe("limited")
    expect(kindCheckFailure(axiosError(400, "INVALID_KIND_CHECK"))).toBe("other")
    expect(kindCheckFailure(axiosError(500, "KIND_CHECK_FAILED"))).toBe("other")
    expect(kindCheckFailure(new Error("network"))).toBe("other")
  })

  test("decideSend: kind sends, unkind nudges with the trimmed text and the reasons", async () => {
    expect(await decideSend(" hello ", async () => KIND)).toEqual({ kind: "send", off: false })
    expect(await decideSend(" you idiot ", async () => UNKIND)).toEqual({ kind: "nudge", text: "you idiot", reasons: ["insult"] })
  })

  test("decideSend never blocks: every error, a 404, a 429 and a slow answer all send", async () => {
    const reject = (e: unknown) => async () => Promise.reject(e)
    expect(await decideSend("x y", reject(axiosError(404, "MECHANIC_NOT_ENABLED")))).toEqual({ kind: "send", off: true })
    expect(await decideSend("x y", reject(axiosError(429, "KIND_CHECK_RATE_LIMITED")))).toEqual({ kind: "send", off: false })
    expect(await decideSend("x y", reject(axiosError(400, "INVALID_KIND_CHECK")))).toEqual({ kind: "send", off: false })
    expect(await decideSend("x y", reject(axiosError(500, "")))).toEqual({ kind: "send", off: false })
    expect(await decideSend("x y", reject(new Error("offline")))).toEqual({ kind: "send", off: false })
    const never = () => new Promise<KindCheck>(() => {})
    expect(await decideSend("x y", never, 10)).toEqual({ kind: "send", off: false })
    // An unkind answer that arrives too late changes nothing.
    const late = () => new Promise<KindCheck>((resolve) => setTimeout(() => resolve(UNKIND), 50))
    expect(await decideSend("x y", late, 10)).toEqual({ kind: "send", off: false })
    const throws = () => {
      throw new Error("sync")
    }
    expect(await decideSend("x y", throws)).toEqual({ kind: "send", off: false })
  })

  test("decideSend asks nothing for an empty text", async () => {
    let asked = false
    const check = async () => {
      asked = true
      return UNKIND
    }
    expect(await decideSend("   ", check)).toEqual({ kind: "send", off: false })
    expect(asked).toBe(false)
  })

  test("checkWithin resolves the value, null on error (reporting it), null on time-out", async () => {
    expect(await checkWithin(Promise.resolve(5), 50)).toBe(5)
    let seen: unknown = null
    expect(await checkWithin(Promise.reject(new Error("x")), 50, (e) => (seen = e))).toBeNull()
    expect(seen).toBeInstanceOf(Error)
    expect(await checkWithin(new Promise(() => {}), 5)).toBeNull()
  })

  test("the note is about the text it checked: changing the text drops it", () => {
    expect(nudgeApplies("you idiot", "  you idiot ")).toBe(true)
    expect(nudgeApplies("you idiot", "you are lovely")).toBe(false)
    expect(nudgeApplies(null, "you idiot")).toBe(false)
  })

  test("reasons in our words, once each, unknown ones left out", () => {
    expect(kindReasonLines(["insult", "insult", "tone", "mystery"])).toEqual(["It may read as an insult.", "The tone may land harder than you mean."])
    expect(kindReasonLines(["slur", "sexual_pressure"])).toEqual(["It uses a word that hurts people.", "It may feel like pressure."])
    expect(kindReasonLines([])).toEqual([])
  })

  test("the note: our words, Send anyway and Edit, each wired to its own action", () => {
    const out = html(<KindNudge reasons={["insult"]} onEdit={noop} onSendAnyway={noop} />)
    expect(out).toContain("This might come across as unkind")
    expect(out).toContain("It may read as an insult.")
    expect(out).toContain(">Send anyway<")
    expect(out).toContain(">Edit<")
    expect(out).toContain('role="status"')
    // Nothing is disabled: the note never blocks.
    expect(out).not.toContain("disabled")
    const calls: string[] = []
    const tree = KindNudge({ reasons: [], onEdit: () => calls.push("edit"), onSendAnyway: () => calls.push("send") })
    ;(findByText(tree, "Send anyway")!.onClick as () => void)()
    ;(findByText(tree, "Edit")!.onClick as () => void)()
    expect(calls).toEqual(["send", "edit"])
    expect(html(<KindNudge reasons={[]} onEdit={noop} onSendAnyway={noop} />)).not.toContain("<ul")
  })

  test("error words exist for the new codes, never the server's", () => {
    for (const code of ["INVALID_KIND_CHECK", "KIND_CHECK_RATE_LIMITED", "INVALID_COMMENT_FILTER", "HIDE_KNOWN_UNAVAILABLE"]) expect(KNOWN_ERROR_CODES).toContain(code)
    expect(datingErrorCopy(axiosError(429, "KIND_CHECK_RATE_LIMITED"))).not.toBe("developer words")
    expect(datingErrorCopy(axiosError(400, "INVALID_COMMENT_FILTER"))).toBe("One of those words can't be used. Check the list and save again.")
    expect(copyFor(errorFromEnvelope(readFixture("comment_filter_put_400_invalid")))).toBe("Keep to 50 words, each 2 to 30 characters, with no repeats.")
  })
})

/* ── a received message ──────────────────────────────────────────── */

const ME = "me"
const msg = (over: Partial<ChatMessageLike> = {}): ChatMessageLike => ({ id: "m1", senderId: "them", text: "hello", type: "text", ...over })

describe("kind messages: a received message", () => {
  test("only someone else's text message is checked", () => {
    expect(needsReceivedCheck(msg(), ME)).toBe(true)
    expect(needsReceivedCheck(msg({ senderId: ME }), ME)).toBe(false)
    expect(needsReceivedCheck(msg({ id: "opt-1" }), ME)).toBe(false)
    expect(needsReceivedCheck(msg({ isDeleted: true }), ME)).toBe(false)
    expect(needsReceivedCheck(msg({ mediaId: "x", text: "" }), ME)).toBe(false)
    expect(needsReceivedCheck(msg({ mediaId: "x" }), ME)).toBe(false)
    expect(needsReceivedCheck(msg({ type: "system" }), ME)).toBe(false)
    expect(needsReceivedCheck(msg({ text: "  " }), ME)).toBe(false)
    expect(needsReceivedCheck(msg(), "")).toBe(false)
  })

  test("cached per message, and an edit is a new text", () => {
    expect(receivedKey(msg())).toBe(receivedKey(msg({ text: " hello " })))
    expect(receivedKey(msg())).not.toBe(receivedKey(msg({ text: "hello again" })))
    expect(receivedKey(msg())).not.toBe(receivedKey(msg({ id: "m2" })))
  })

  test("what is checked: newest first, skipping what is known, capped", () => {
    const list = [msg({ id: "a" }), msg({ id: "b", senderId: ME }), msg({ id: "c" }), msg({ id: "d" })]
    expect(receivedToCheck(list, ME, () => false).map((m) => m.id)).toEqual(["d", "c", "a"])
    expect(receivedToCheck(list, ME, (k) => k.startsWith("d")).map((m) => m.id)).toEqual(["c", "a"])
    const many = Array.from({ length: 80 }, (_, i) => msg({ id: `m${i}` }))
    const todo = receivedToCheck(many, ME, () => false)
    expect(todo).toHaveLength(RECEIVED_CHECK_LIMIT)
    expect(todo[0].id).toBe("m79")
  })

  test("the bubble: blurred only for an unkind verdict, unopened, with the mechanic on", () => {
    expect(receivedView(undefined, false, false)).toBe("plain") // not checked yet, or the check failed
    expect(receivedView(KIND, false, false)).toBe("plain")
    expect(receivedView(UNKIND, false, false)).toBe("blurred")
    expect(receivedView(UNKIND, true, false)).toBe("revealed")
    expect(receivedView(UNKIND, false, true)).toBe("plain") // 404: no blur
  })

  test("the blurred bubble: Tap to read, the words hidden from screen readers too", () => {
    const blurred = html(<KindBubbleText view="blurred" text="you idiot" onReveal={noop} />)
    expect(blurred).toContain(">Tap to read<")
    expect(blurred).toContain('aria-label="This message may be unkind. Tap to read it."')
    expect(blurred).toMatch(/<span class="pulse-kind-blur__text" aria-hidden="true">you idiot<\/span>/)
    expect(html(<KindBubbleText view="revealed" text="you idiot" onReveal={noop} />)).toBe("you idiot")
    expect(html(<KindBubbleText view="plain" text="hello" onReveal={noop} />)).toBe("hello")
  })

  test("Tap to read reveals without opening the message actions", () => {
    let revealed = 0
    let stopped = 0
    const tree = KindBubbleText({ view: "blurred", text: "x", onReveal: () => revealed++ }) as ReactElement<{ children: ReactNode[] }>
    const button = (tree.props.children as ReactElement<{ onClick: (e: unknown) => void }>[])[1]
    button.props.onClick({ stopPropagation: () => stopped++ })
    expect([revealed, stopped]).toEqual([1, 1])
  })
})

describe("kind messages: did this bother you?", () => {
  test("the wire, with Go's zeros", () => {
    expect(botheredBody(true)).toEqual({ bothered: true })
    expect(botheredBody(false)).toEqual({ bothered: false })
    expect(toBothered({})).toEqual({ matchId: "", bothered: false, offerReport: false })
  })

  test("after an answer: yes thanks (with the report when offered), no dismisses", () => {
    expect(botheredDone({ matchId: "m", bothered: true, offerReport: true })).toEqual({ kind: "thanks", offerReport: true })
    expect(botheredDone({ matchId: "m", bothered: true, offerReport: false })).toEqual({ kind: "thanks", offerReport: false })
    expect(botheredDone({ matchId: "m", bothered: false, offerReport: false })).toEqual({ kind: "dismissed" })
  })

  test("after a refusal: 404 is off (no blur, no question), a failed yes asks again, a failed no is done", () => {
    expect(botheredRefusal(axiosError(404, "MECHANIC_NOT_ENABLED"))).toBe("off")
    expect(botheredRefusal(axiosError(404, "MATCH_NOT_FOUND"))).toBe("off")
    expect(botheredRefusal(axiosError(500, ""))).toBe("other")
    expect(botheredAfterError(true, axiosError(404, "MECHANIC_NOT_ENABLED"))).toBe("off")
    expect(botheredAfterError(false, axiosError(404, ""))).toBe("off")
    expect(botheredAfterError(true, new Error("offline"))).toEqual({ kind: "asking", error: BOTHERED_FAILED })
    expect(botheredAfterError(false, new Error("offline"))).toEqual({ kind: "dismissed" })
  })

  test("the question, its answers, and the report once offered", () => {
    const asking = html(<BotheredPrompt state={ASKING} name="Asha" canReport onAnswer={noop} onReport={noop} />)
    expect(asking).toContain("Did this bother you?")
    expect(asking).toContain(">Yes<")
    expect(asking).toContain(">No<")
    expect(asking).not.toContain("Report")
    const answers: boolean[] = []
    const tree = BotheredPrompt({ state: ASKING, name: "Asha", canReport: true, onAnswer: (b) => answers.push(b), onReport: noop })
    ;(findByText(tree, "Yes")!.onClick as () => void)()
    ;(findByText(tree, "No")!.onClick as () => void)()
    expect(answers).toEqual([true, false])

    const failed = html(<BotheredPrompt state={{ kind: "asking", error: BOTHERED_FAILED }} name="Asha" canReport onAnswer={noop} onReport={noop} />)
    expect(failed).toMatch(/role="alert">That didn&#x27;t go through/)
    const sending = html(<BotheredPrompt state={{ kind: "sending", answer: true }} name="Asha" canReport onAnswer={noop} onReport={noop} />)
    expect((sending.match(/disabled=""/g) ?? []).length).toBe(2)

    const thanks = html(<BotheredPrompt state={{ kind: "thanks", offerReport: true }} name="Asha" canReport onAnswer={noop} onReport={noop} />)
    expect(thanks).toContain("Thanks for telling us.")
    expect(thanks).toContain(">Report Asha<")
    let reported = 0
    const thanksTree = BotheredPrompt({ state: { kind: "thanks", offerReport: true }, name: "Asha", canReport: true, onAnswer: noop, onReport: () => reported++ })
    ;(findByText(thanksTree, "Report Asha")!.onClick as () => void)()
    expect(reported).toBe(1)
    expect(html(<BotheredPrompt state={{ kind: "thanks", offerReport: false }} name="Asha" canReport onAnswer={noop} onReport={noop} />)).not.toContain("Report")
    expect(html(<BotheredPrompt state={{ kind: "thanks", offerReport: true }} name="Asha" canReport={false} onAnswer={noop} onReport={noop} />)).not.toContain("Report")
    expect(html(<BotheredPrompt state={{ kind: "dismissed" }} name="Asha" canReport onAnswer={noop} onReport={noop} />)).toBe("")
  })
})

/* ── which chat is a Pulse chat ──────────────────────────────────── */

describe("kind messages: a Pulse chat is one of the viewer's matches", () => {
  test("the match that names the conversation, or nothing", () => {
    const matches = [
      { id: "m1", conversationId: "c1" },
      { id: "m2", conversationId: "" },
    ]
    expect(matchForConversation(matches, "c1")).toBe("m1")
    expect(matchForConversation(matches, "c9")).toBe("")
    // An empty id never matches a match whose conversation isn't allocated yet.
    expect(matchForConversation(matches, "")).toBe("")
    expect(matchForConversation([], "c1")).toBe("")
  })
})

/* ── spark comments ──────────────────────────────────────────────── */

describe("kind messages: spark comments the filter tucked away", () => {
  test("the reason: known ones, an unknown one still hidden, empty is shown", () => {
    expect(toNoteHidden("unkind")).toBe("unkind")
    expect(toNoteHidden("your_words")).toBe("your_words")
    expect(toNoteHidden("something_new")).toBe("other")
    expect(toNoteHidden("")).toBe("")
    expect(toNoteHidden(null)).toBe("")
    expect(noteHiddenLine("your_words")).toBe("It uses a word you chose to hide.")
    expect(noteHiddenLine("other")).toBe("Your comment filter tucked this one away.")
    expect(noteHiddenLine("")).toBe("")
  })

  test("a note_hidden with no note means nothing", () => {
    expect(toIncomingSparks([{ id: "s", note_hidden: "unkind" }])[0].noteHidden).toBe("")
    expect(toIncomingSparks([{ id: "s", note: "hi", note_hidden: "your_words" }])[0].noteHidden).toBe("your_words")
  })

  test("Liked you carries it when unlocked; locked never has a note", () => {
    const unlocked = toLikedYou({ unlocked: true, total: 1, items: [{ spark_id: "s", note: "you look stupid", note_hidden: "unkind", person: (readFixture("sparks_incoming_get_200_note_hidden").data as { person: unknown }[])[0].person }] })
    expect(unlocked.cards[0].noteHidden).toBe("unkind")
    const locked = toLikedYou({ unlocked: false, total: 1, items: [{ spark_id: "s", note: "x", note_hidden: "unkind" }] })
    expect(locked.cards[0]).toMatchObject({ note: "", noteHidden: "" })
    expect(lockLikedYou(unlocked).cards[0]).toMatchObject({ note: "", noteHidden: "" })
  })

  test("collapsed with the reason; open on tap; a plain note as before", () => {
    const closed = html(<SparkNote note="you look stupid" hidden="unkind" className="pulse-like__note" />)
    expect(closed).toContain(NOTE_HIDDEN_TITLE)
    expect(closed).toContain("It may be unkind.")
    expect(closed).toContain('aria-expanded="false"')
    expect(closed).not.toContain("you look stupid")
    const open = html(<SparkNote note="you look stupid" hidden="unkind" className="pulse-like__note" defaultOpen />)
    expect(open).toContain("“you look stupid”")
    expect(open).toContain("It may be unkind.")
    expect(html(<SparkNote note="Loved your answer" hidden="" className="pulse-like__note" />)).toBe('<p class="pulse-like__note">“Loved your answer”</p>')
    expect(html(<SparkNote note="" hidden="unkind" className="pulse-like__note" />)).toBe("")
  })

  test("the Liked you grid draws a tucked-away note collapsed", () => {
    const data = toLikedYou({ unlocked: true, total: 1, items: [{ spark_id: "s", note: "you look stupid", note_hidden: "unkind", person: (readFixture("sparks_incoming_get_200_note_hidden").data as { person: unknown }[])[0].person }] })
    const out = html(<LikedYouGrid data={data} onOpen={noop} onUpsell={noop} onAccept={noop} onDecline={noop} />)
    expect(out).toContain(NOTE_HIDDEN_TITLE)
    expect(out).not.toContain("you look stupid")
    const plain = html(<LikedYouGrid data={toLikedYou(readFixture("liked_you_get_200_unlocked").data)} onOpen={noop} onUpsell={noop} onAccept={noop} onDecline={noop} />)
    expect(plain).toContain("“Loved your answer”")
    expect(plain).not.toContain(NOTE_HIDDEN_TITLE)
  })

  test("a person row keeps the tap-to-show button outside its link", () => {
    const spark = toIncomingSparks(readFixture("sparks_incoming_get_200_note_hidden").data)[0]
    const out = html(<PersonRow person={spark.person} href="/dating/people/x" note={spark.note} noteHidden={spark.noteHidden} />)
    expect(out).toContain(NOTE_HIDDEN_TITLE)
    expect(out).not.toContain("you look stupid")
    // The link closes before the button opens.
    expect(out.indexOf("</a>")).toBeLessThan(out.indexOf('class="pulse-note-hidden"'))
    const plain = html(<PersonRow person={spark.person} note="Loved your answer" />)
    expect(plain).toContain("“Loved your answer”")
  })
})

/* ── the comment filter ──────────────────────────────────────────── */

describe("kind messages: the comment filter", () => {
  test("the wire: lower-cased words sent, Go's zeros read", () => {
    expect(toCommentFilter({})).toEqual({ filterUnkind: false, words: [] })
    expect(toCommentFilter({ filter_unkind: true, words: null })).toEqual({ filterUnkind: true, words: [] })
    expect(commentFilterBody({ filterUnkind: false, words: [" Ex ", "CRICKET"] })).toEqual({ filter_unkind: false, words: ["ex", "cricket"] })
    expect(normalizeWord("  HeLLo ")).toBe("hello")
  })

  test("adding a word: 2 to 30 characters, distinct, up to 50", () => {
    expect(addWord([], "Ex")).toEqual({ words: ["ex"], problem: "" })
    expect(addWord(["ex"], " EX ").problem).toBe("That word is already on your list.")
    expect(addWord([], "a").problem).toBe("Each word needs 2 to 30 characters.")
    expect(addWord([], "a".repeat(31)).problem).toBe("Each word needs 2 to 30 characters.")
    expect(addWord([], "a".repeat(30)).problem).toBe("")
    const fifty = Array.from({ length: 50 }, (_, i) => `w${i}`)
    expect(addWord(fifty, "another").problem).toBe("You can hide up to 50 words.")
    expect(addWord(fifty, "another").words).toEqual(fifty)
    expect(removeWord(["ex", "cricket"], "ex")).toEqual(["cricket"])
    expect(sameWords(["a", "b"], ["a", "b"])).toBe(true)
    expect(sameWords(["a", "b"], ["b", "a"])).toBe(false)
  })

  test("refusals: 400 invalid inline, 404 hides, anything else other", () => {
    expect(commentFilterRefusal(axiosError(400, "INVALID_COMMENT_FILTER"))).toBe("invalid")
    expect(commentFilterRefusal(axiosError(404, "MECHANIC_NOT_ENABLED"))).toBe("off")
    expect(commentFilterRefusal(axiosError(500, ""))).toBe("other")
  })

  const form = (over: Partial<React.ComponentProps<typeof CommentFilterForm>> = {}) =>
    html(<CommentFilterForm filterUnkind words={["ex", "cricket"]} draft="" error="" toggleBusy={false} saveBusy={false} dirty={false} onToggle={noop} onDraft={noop} onAdd={noop} onRemove={noop} onSave={noop} {...over} />)

  test("the switch, the words with their remove buttons, the count", () => {
    const out = form()
    expect(out).toMatch(/<input id="pulse-filter-unkind" type="checkbox" role="switch" class="pulse-switch" checked=""/)
    expect(out).toContain("Hide unkind comments")
    expect(out).toContain('aria-label="Remove ex"')
    expect(out).toContain('aria-label="Remove cricket"')
    expect(out).toContain("2/50")
    expect(out).not.toContain("Save words")
    expect(form({ filterUnkind: false })).not.toMatch(/id="pulse-filter-unkind"[^>]*checked/)
    expect(form({ words: [] })).toContain("No hidden words yet.")
  })

  test("edited: Save words appears; an error is inline; a full list can't take more", () => {
    expect(form({ dirty: true })).toContain(">Save words<")
    expect(form({ error: "Keep to 50 words, each 2 to 30 characters, with no repeats." })).toMatch(/<p class="pulse-field__error" role="alert">Keep to 50 words/)
    const full = form({ words: Array.from({ length: 50 }, (_, i) => `w${i}`) })
    expect(full).toMatch(/<input id="pulse-hidden-word"[^>]*disabled=""/)
    // The Add button waits for a word.
    expect(form({ draft: "" })).toMatch(/<button type="submit"[^>]*disabled=""/)
    expect(form({ draft: "ex2" })).not.toMatch(/<button type="submit"[^>]*disabled=""/)
  })
})

/* ── hide from people I know (M16) ───────────────────────────────── */

describe("hide from people I know", () => {
  test("the wire, with Go's zeros", () => {
    expect(toHideKnown({})).toEqual({ enabled: false, hiddenCount: 0, refreshedAt: "" })
    expect(toHideKnown({ enabled: true, hidden_count: 1, refreshed_at: "2026-10-01T00:00:00Z" })).toEqual({ enabled: true, hiddenCount: 1, refreshedAt: "2026-10-01T00:00:00Z" })
    expect(hideKnownBody(true)).toEqual({ enabled: true })
  })

  test("the line: only while on; one, many, none", () => {
    expect(hideKnownLine({ enabled: false, hiddenCount: 4, refreshedAt: "" })).toBe("")
    expect(hideKnownLine({ enabled: true, hiddenCount: 1, refreshedAt: "" })).toBe("Hidden from 1 connection")
    expect(hideKnownLine({ enabled: true, hiddenCount: 12, refreshedAt: "" })).toBe("Hidden from 12 connections")
    expect(hideKnownLine({ enabled: true, hiddenCount: 0, refreshedAt: "" })).toBe("None of your connections are on Pulse right now.")
  })

  test("refusals: 503 unavailable with our words, 404 hides, anything else other", () => {
    expect(hideKnownRefusal(axiosError(503, "HIDE_KNOWN_UNAVAILABLE"))).toBe("unavailable")
    expect(hideKnownRefusal(axiosError(404, "MECHANIC_NOT_ENABLED"))).toBe("off")
    expect(hideKnownRefusal(axiosError(500, ""))).toBe("other")
    expect(datingErrorCopy(axiosError(503, "HIDE_KNOWN_UNAVAILABLE"))).toBe(HIDE_KNOWN_UNAVAILABLE_COPY)
    expect(HIDE_KNOWN_UNAVAILABLE_COPY).toBe("We couldn't read your connections just now — try again.")
  })

  test("the setting: the switch with its one line, the count while on, the error", () => {
    const on = html(<HideKnownSetting state={{ enabled: true, hiddenCount: 2, refreshedAt: "" }} busy={false} error="" onChange={noop} />)
    expect(on).toContain("Hide me from people I know")
    expect(on).toContain("Momentum connections won&#x27;t see you on Pulse and you won&#x27;t see them.")
    expect(on).toMatch(/id="pulse-hide-known"[^>]*checked=""/)
    expect(on).toContain("Hidden from 2 connections")
    const off = html(<HideKnownSetting state={{ enabled: false, hiddenCount: 0, refreshedAt: "" }} busy={false} error={HIDE_KNOWN_UNAVAILABLE_COPY} onChange={noop} />)
    expect(off).not.toContain("Hidden from")
    expect(off).not.toMatch(/id="pulse-hide-known"[^>]*checked/)
    expect(off).toContain("We couldn&#x27;t read your connections just now — try again.")
    expect(html(<HideKnownSetting state={{ enabled: true, hiddenCount: 2, refreshedAt: "" }} busy error="" onChange={noop} />)).toMatch(/id="pulse-hide-known"[^>]*disabled=""/)
  })
})

/* ── client config (M18) and dealbreakers (M12) ──────────────────── */

describe("client config and the M12 change", () => {
  test("screen protection is read and kept; absent is off", () => {
    expect(toClientConfig({})).toEqual({ screenProtection: false })
    expect(toClientConfig({ screen_protection: "true" })).toEqual({ screenProtection: false })
    expect(toClientConfig({ screen_protection: true })).toEqual({ screenProtection: true })
  })

  test("without a pass, saved pass dealbreakers stay and new ones don't go", () => {
    const all = () => true
    expect(dealbreakersToSend(["age", "diet", "height"], all, false, ["diet"])).toEqual(["age", "diet"])
    expect(dealbreakersToSend(["age", "diet", "height"], all, true, ["diet"])).toEqual(["age", "height", "diet"])
  })
})
