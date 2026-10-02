/*
  Kind messages (mechanic M13).

    POST /kind-check {text}               → {kind, reasons[]}
    POST /matches/:id/bothered {bothered} → 201 {match_id, bothered, offer_report}
    GET/PUT /comment-filter {filter_unkind, words}

  Before a message goes out in a Pulse chat, the app asks kind-check. An
  unkind verdict shows a gentle "send anyway?" note; it never blocks. Any
  failure — a 404 (the flag is off), a 429 KIND_CHECK_RATE_LIMITED, a 400, the
  network, a slow answer — just sends: the check must never stop a message.

  A RECEIVED message is checked the same way (once per message). Unkind: the
  bubble is blurred behind "Tap to read" and the reader is asked "Did this
  bother you?". Yes is kept as safety evidence and offers the report flow;
  No unblurs it. A 404 from either route means the mechanic is off: no blur,
  no question.

  Spark comments: in incoming sparks and Liked you, the server marks a note
  the recipient's filter hides with `note_hidden` ("unkind" or "your_words")
  but still sends the note, so it is tucked behind a tap, never dropped.

  Everything here is a pure view function; the server decides every verdict.
*/

import { arr, bool, obj, str, strList, toDatingError } from "./wire"

/* ── the check ───────────────────────────────────────────────────── */

/** The longest text the server reads (400 INVALID_KIND_CHECK past it). */
export const KIND_TEXT_MAX = 2000

/** How long a send waits for the check before it goes anyway. */
export const KIND_CHECK_WAIT_MS = 3000

export interface KindCheck {
  kind: boolean
  reasons: string[]
}

/**
  Only a literal `kind: false` is unkind. Absent, null or anything else reads
  as kind: when in doubt nothing is held back or blurred.
*/
export function toKindCheck(wire: unknown): KindCheck {
  const w = obj(wire)
  return { kind: w.kind !== false, reasons: strList(w.reasons) }
}

export function kindCheckBody(text: string): { text: string } {
  return { text: text.trim() }
}

/** Whether a text is worth asking about: something to read, within the server's limit. */
export function shouldKindCheck(text: string): boolean {
  const t = text.trim()
  return t.length > 0 && [...t].length <= KIND_TEXT_MAX
}

/** What the composer does with the answer; null is a failed or slow check. */
export function sendVerdict(result: KindCheck | null): "send" | "nudge" {
  return result && !result.kind ? "nudge" : "send"
}

export type KindCheckFailure = "off" | "limited" | "other"

/**
    any 404 (MECHANIC_NOT_ENABLED)  → off:     stop asking in this chat;
    429 KIND_CHECK_RATE_LIMITED     → limited: stop asking for now;
    anything else                   → other.
  Every one of them sends the message as it is.
*/
export function kindCheckFailure(error: unknown): KindCheckFailure {
  const e = toDatingError(error)
  if (e.status === 404 || e.code === "MECHANIC_NOT_ENABLED") return "off"
  if (e.status === 429 || e.code === "KIND_CHECK_RATE_LIMITED") return "limited"
  return "other"
}

/** Resolves with the check, or null when it fails or takes longer than `ms`. Never rejects. */
export function checkWithin<T>(check: Promise<T>, ms: number, onError?: (error: unknown) => void): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms)
    check.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        onError?.(error)
        resolve(null)
      },
    )
  })
}

/**
    send:  the message goes now — a kind verdict, or ANY failure (`off` when
           the failure was a 404, so the chat stops asking);
    nudge: an unkind verdict — the note shows, with Edit and Send anyway.
*/
export type SendDecision = { kind: "send"; off: boolean } | { kind: "nudge"; text: string; reasons: string[] }

/** What the composer does with a text. Never rejects; never waits longer than `ms`. */
export async function decideSend(text: string, check: (text: string) => Promise<KindCheck>, ms: number = KIND_CHECK_WAIT_MS): Promise<SendDecision> {
  const t = text.trim()
  if (!shouldKindCheck(t)) return { kind: "send", off: false }
  let off = false
  let result: KindCheck | null = null
  try {
    result = await checkWithin(check(t), ms, (error) => {
      off = kindCheckFailure(error) === "off"
    })
  } catch {
    // check() itself threw before returning a promise: still send.
    result = null
  }
  if (result && sendVerdict(result) === "nudge") return { kind: "nudge", text: t, reasons: result.reasons }
  return { kind: "send", off }
}

/* ── the composer's note ─────────────────────────────────────────── */

export const KIND_NUDGE_TITLE = "This might come across as unkind"
export const KIND_NUDGE_BODY = "Kind words tend to get warmer replies. Want to change it before it goes?"

const REASON_LINES: Record<string, string> = {
  insult: "It may read as an insult.",
  sexual_pressure: "It may feel like pressure.",
  slur: "It uses a word that hurts people.",
  tone: "The tone may land harder than you mean.",
}

/** One line per reason the server named, in our words; unknown reasons are left out. */
export function kindReasonLines(reasons: readonly string[]): string[] {
  return [...new Set(reasons)].map((r) => REASON_LINES[r] ?? "").filter(Boolean)
}

/** The note is about the text it checked: once the text changes, it goes. */
export function nudgeApplies(nudgeText: string | null, input: string): boolean {
  return nudgeText !== null && nudgeText === input.trim()
}

/* ── a received message ──────────────────────────────────────────── */

export interface ChatMessageLike {
  id: string
  senderId: string
  text: string
  type?: string
  mediaId?: string
  isDeleted?: boolean
}

/** Someone else's text message, still there, with words to read. Optimistic copies are mine, so never checked. */
export function needsReceivedCheck(msg: ChatMessageLike, myId: string): boolean {
  if (!msg.id || msg.id.startsWith("opt-") || !myId || msg.senderId === myId) return false
  if (msg.isDeleted || msg.mediaId || msg.type === "system") return false
  return shouldKindCheck(msg.text)
}

/** The cache key: the message, as it reads now (an edit is a new text). */
export function receivedKey(msg: Pick<ChatMessageLike, "id" | "text">): string {
  return `${msg.id}\u0000${msg.text.trim()}`
}

/** At most this many received messages are checked per chat, newest first. */
export const RECEIVED_CHECK_LIMIT = 50

/** The received messages still to check, newest first. */
export function receivedToCheck(messages: readonly ChatMessageLike[], myId: string, known: (key: string) => boolean): ChatMessageLike[] {
  const out: ChatMessageLike[] = []
  for (let i = messages.length - 1; i >= 0 && out.length < RECEIVED_CHECK_LIMIT; i--) {
    const m = messages[i]
    if (needsReceivedCheck(m, myId) && !known(receivedKey(m))) out.push(m)
  }
  return out
}

/**
    plain:    not checked, kind, or the mechanic is off — the text as it is;
    blurred:  unkind and not opened — "Tap to read";
    revealed: unkind, opened (or answered "No").
  A check still in flight is plain: the check never stands in the way of reading.
*/
export type ReceivedView = "plain" | "blurred" | "revealed"

export function receivedView(verdict: KindCheck | undefined, revealed: boolean, off: boolean): ReceivedView {
  if (off || !verdict || verdict.kind) return "plain"
  return revealed ? "revealed" : "blurred"
}

export const TAP_TO_READ = "Tap to read"
export const BLURRED_LABEL = "This message may be unkind. Tap to read it."
export const BOTHERED_QUESTION = "Did this bother you?"
export const BOTHERED_THANKS = "Thanks for telling us. It helps keep Pulse kind."

/* ── "did this bother you?" ──────────────────────────────────────── */

export interface Bothered {
  matchId: string
  bothered: boolean
  /** They said yes: offer the report flow. */
  offerReport: boolean
}

export function toBothered(wire: unknown): Bothered {
  const w = obj(wire)
  return { matchId: str(w.match_id), bothered: bool(w.bothered), offerReport: bool(w.offer_report) }
}

export function botheredBody(bothered: boolean): { bothered: boolean } {
  return { bothered }
}

/**
    asking:    the question under the bubble;
    sending:   an answer on its way;
    thanks:    answered yes — thanks, and the report when the server offers it;
    dismissed: answered no, or nothing more to ask.
*/
export type BotheredState =
  | { kind: "asking"; error: string }
  | { kind: "sending"; answer: boolean }
  | { kind: "thanks"; offerReport: boolean }
  | { kind: "dismissed" }

export const ASKING: BotheredState = { kind: "asking", error: "" }

/** After the server answered a "yes". */
export function botheredDone(result: Bothered): BotheredState {
  return result.bothered ? { kind: "thanks", offerReport: result.offerReport } : { kind: "dismissed" }
}

/** A 404 (the mechanic is off, or the match is gone) hides the question and the blur. */
export function botheredRefusal(error: unknown): "off" | "other" {
  const e = toDatingError(error)
  return e.status === 404 || e.code === "MECHANIC_NOT_ENABLED" ? "off" : "other"
}

export const BOTHERED_FAILED = "That didn't go through. Try again."

/**
  After a refused answer: a 404 switches the mechanic off for the chat; a
  failed "yes" asks again with an error; a failed "no" has nothing more to
  ask (the bubble is already open).
*/
export function botheredAfterError(answer: boolean, error: unknown): BotheredState | "off" {
  if (botheredRefusal(error) === "off") return "off"
  return answer ? { kind: "asking", error: BOTHERED_FAILED } : { kind: "dismissed" }
}

/* ── spark comments ──────────────────────────────────────────────── */

/** Why a note is tucked away; "" when it isn't. A reason this client doesn't know is still hidden. */
export type NoteHidden = "" | "unkind" | "your_words" | "other"

export function toNoteHidden(value: unknown): NoteHidden {
  const s = str(value)
  if (!s) return ""
  return s === "unkind" || s === "your_words" ? s : "other"
}

export const NOTE_HIDDEN_TITLE = "Comment hidden — tap to show"

const NOTE_HIDDEN_LINES: Record<Exclude<NoteHidden, "">, string> = {
  other: "Your comment filter tucked this one away.",
  unkind: "It may be unkind.",
  your_words: "It uses a word you chose to hide.",
}

export function noteHiddenLine(reason: NoteHidden): string {
  return reason ? NOTE_HIDDEN_LINES[reason] : ""
}

/* ── the comment filter ──────────────────────────────────────────── */

export const MAX_HIDDEN_WORDS = 50
export const MIN_WORD_LEN = 2
export const MAX_WORD_LEN = 30

export const COMMENT_FILTER_TITLE = "Comment filter"
export const COMMENT_FILTER_SUB = "Spark comments you'd rather not see are tucked away. You can still open them."
export const FILTER_UNKIND_LABEL = "Hide unkind comments"
export const FILTER_UNKIND_HELP = "Comments that may be unkind stay closed until you tap them."

export interface CommentFilter {
  filterUnkind: boolean
  words: string[]
}

export function toCommentFilter(wire: unknown): CommentFilter {
  const w = obj(wire)
  return { filterUnkind: bool(w.filter_unkind), words: arr(w.words).map(str).filter(Boolean) }
}

export function commentFilterBody(f: CommentFilter): { filter_unkind: boolean; words: string[] } {
  return { filter_unkind: f.filterUnkind, words: f.words.map(normalizeWord) }
}

/** The server stores words trimmed and lower-cased; so does the editor. */
export function normalizeWord(raw: string): string {
  return raw.trim().toLowerCase()
}

export function wordProblem(words: readonly string[], raw: string): string {
  const w = normalizeWord(raw)
  const n = [...w].length
  if (n < MIN_WORD_LEN || n > MAX_WORD_LEN) return `Each word needs ${MIN_WORD_LEN} to ${MAX_WORD_LEN} characters.`
  if (words.includes(w)) return "That word is already on your list."
  if (words.length >= MAX_HIDDEN_WORDS) return `You can hide up to ${MAX_HIDDEN_WORDS} words.`
  return ""
}

/** Adds a word, or says why not. */
export function addWord(words: readonly string[], raw: string): { words: string[]; problem: string } {
  const problem = wordProblem(words, raw)
  return problem ? { words: [...words], problem } : { words: [...words, normalizeWord(raw)], problem: "" }
}

export function removeWord(words: readonly string[], word: string): string[] {
  return words.filter((w) => w !== word)
}

export function sameWords(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((w, i) => w === b[i])
}

/** 400 INVALID_COMMENT_FILTER → an inline error; a 404 hides the section; anything else → other. */
export function commentFilterRefusal(error: unknown): "invalid" | "off" | "other" {
  const e = toDatingError(error)
  if (e.code === "INVALID_COMMENT_FILTER") return "invalid"
  if (e.status === 404 || e.code === "MECHANIC_NOT_ENABLED") return "off"
  return "other"
}
