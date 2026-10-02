/*
  First move (mechanic M5).

    GET/PUT /first-move   {enabled, questions: [{id, text}], max_questions, max_length}
                          404 MECHANIC_NOT_ENABLED while the mechanic is off: the feature is hidden.
    match.first_move      {you_move_first, deadline?, opening_questions?, can_extend}
                          present only while a match waits for its first message under the rule.
    POST /matches/:id/opening-answer  {question_id, answer} → {sent, conversation_id?}

  Someone who opts in starts every new match: until the first message only
  they may write (chat-service refuses the other person with 403
  FIRST_MOVE_PENDING). The person waiting can answer one of their opening
  questions — the answer becomes the first message — or, once a day, give
  them 24 more hours for free.

  Go omits zero values, so absent / null / "" / 0 all read as empty.
*/

import { copyFor } from "./errors"
import { arr, bool, num, obj, str, time, toDatingError, type DatingError } from "./wire"

/** The server's limits, used when its answer leaves them out. */
export const FIRST_MOVE_MAX_QUESTIONS = 3
export const OPENING_QUESTION_MAX = 140
export const OPENING_ANSWER_MAX = 500

export interface OpeningQuestion {
  id: string
  text: string
}

export function toOpeningQuestions(wire: unknown): OpeningQuestion[] {
  return arr(wire)
    .map((q) => ({ id: str(obj(q).id), text: str(obj(q).text) }))
    .filter((q) => q.id !== "" && q.text !== "")
}

/* ── settings ────────────────────────────────────────────────────── */

export interface FirstMoveSettings {
  enabled: boolean
  questions: OpeningQuestion[]
  maxQuestions: number
  maxLength: number
}

export function toFirstMoveSettings(wire: unknown): FirstMoveSettings {
  const w = obj(wire)
  return {
    enabled: bool(w.enabled),
    questions: toOpeningQuestions(w.questions),
    maxQuestions: num(w.max_questions) || FIRST_MOVE_MAX_QUESTIONS,
    maxLength: num(w.max_length) || OPENING_QUESTION_MAX,
  }
}

/** Characters as the server counts them (code points, not UTF-16 units). */
export function charCount(text: string): number {
  return [...text].length
}

/** "12/140" for a counter under a field. */
export function counterLine(text: string, max: number): string {
  return `${charCount(text.trim())}/${max}`
}

/** The drafts as the server will take them: trimmed, blanks dropped. */
export function cleanQuestions(drafts: string[]): string[] {
  return drafts.map((d) => d.trim()).filter(Boolean)
}

/** Why the drafts can't be saved, or "". */
export function questionsProblem(drafts: string[], maxQuestions: number, maxLength: number): string {
  const clean = cleanQuestions(drafts)
  if (clean.length > maxQuestions) return `You can have up to ${maxQuestions} questions.`
  if (clean.some((q) => charCount(q) > maxLength)) return `Keep each question to ${maxLength} characters.`
  return ""
}

/** PUT /first-move. An absent field is left as it is; `questions: []` removes them all. */
export function firstMoveBody(change: { enabled?: boolean; questions?: string[] }): { enabled?: boolean; questions?: string[] } {
  const body: { enabled?: boolean; questions?: string[] } = {}
  if (change.enabled !== undefined) body.enabled = change.enabled
  if (change.questions !== undefined) body.questions = cleanQuestions(change.questions)
  return body
}

/** Whether the drafts differ from what is saved. */
export function questionsChanged(saved: OpeningQuestion[], drafts: string[]): boolean {
  const clean = cleanQuestions(drafts)
  return clean.length !== saved.length || clean.some((q, i) => q !== saved[i].text)
}

/** True when the read says the mechanic is off: hide everything about it. */
export function isFirstMoveOff(error: unknown): boolean {
  return toDatingError(error).code === "MECHANIC_NOT_ENABLED"
}

/* ── on a match ──────────────────────────────────────────────────── */

export interface FirstMoveView {
  /** The viewer may write; otherwise they wait for the other person. */
  youMoveFirst: boolean
  /** When the match runs out unless someone writes; "" when not sent. */
  deadline: string
  /** The first mover's questions, for the person waiting. */
  openingQuestions: OpeningQuestion[]
  /** The person waiting still has today's free 24 hours. */
  canExtend: boolean
}

/** null when the member is absent: a normal match. */
export function toFirstMoveView(wire: unknown): FirstMoveView | null {
  if (!wire || typeof wire !== "object" || Array.isArray(wire)) return null
  const w = obj(wire)
  const youMoveFirst = bool(w.you_move_first)
  return {
    youMoveFirst,
    deadline: time(w.deadline),
    // The questions are for the person waiting; a first mover never answers their own.
    openingQuestions: youMoveFirst ? [] : toOpeningQuestions(w.opening_questions),
    canExtend: !youMoveFirst && bool(w.can_extend),
  }
}

/** "2h 30m" until `iso`; "" when there is no time or it has passed. */
export function spanUntil(iso: string, nowMs: number): string {
  if (!iso) return ""
  const left = Date.parse(iso) - nowMs
  if (!(left > 0)) return ""
  const minutes = Math.floor(left / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  return days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` : `${Math.max(mins, 1)}m`
}

/**
  What the viewer of one match sees about the rule:
    none    — no rule on this match (absent `first_move`), or it has ended;
    yours   — they start: chat is theirs to open;
    waiting — the other person starts: answer a question or give more time;
    expired — the deadline passed before anyone wrote.
*/
export type FirstMoveState =
  | { kind: "none" }
  | { kind: "yours"; left: string }
  | { kind: "waiting"; left: string; questions: OpeningQuestion[]; canExtend: boolean }
  | { kind: "expired" }

export function firstMoveState(
  match: { status: string; firstMessageAt: string; expiresAt: string; firstMove: FirstMoveView | null },
  nowMs: number = Date.now(),
): FirstMoveState {
  const fm = match.firstMove
  if (!fm || match.firstMessageAt || match.status !== "matched") return { kind: "none" }
  const deadline = fm.deadline || match.expiresAt
  if (deadline && !(Date.parse(deadline) > nowMs)) return { kind: "expired" }
  const left = spanUntil(deadline, nowMs)
  if (fm.youMoveFirst) return { kind: "yours", left }
  return { kind: "waiting", left, questions: fm.openingQuestions, canExtend: fm.canExtend }
}

/** The matches-list line: "You start · 5h 10m left" / "Waiting for them · 5h 10m left". "" for no rule. */
export function firstMoveListLine(state: FirstMoveState): string {
  switch (state.kind) {
    case "yours":
      return state.left ? `You start · ${state.left} left` : "You start"
    case "waiting":
      return state.left ? `Waiting for them · ${state.left} left` : "Waiting for them"
    case "expired":
      return "Out of time"
    default:
      return ""
  }
}

/* ── the opening answer ──────────────────────────────────────────── */

export interface OpeningAnswerResult {
  sent: boolean
  conversationId: string
}

export function toOpeningAnswerResult(wire: unknown): OpeningAnswerResult {
  const w = obj(wire)
  return { sent: bool(w.sent), conversationId: str(w.conversation_id) }
}

export function openingAnswerBody(questionId: string, answer: string): { question_id: string; answer: string } {
  return { question_id: questionId, answer: answer.trim() }
}

export function openingAnswerProblem(answer: string): string {
  const a = answer.trim()
  if (!a) return "Write an answer first."
  if (charCount(a) > OPENING_ANSWER_MAX) return `Keep your answer to ${OPENING_ANSWER_MAX} characters.`
  return ""
}

/**
  After a refused answer, whether the match on screen is out of date and
  should be read again (the rule ended, or the question changed).
*/
export function answerRefusalRefetches(error: DatingError): boolean {
  return error.code === "FIRST_MOVE_NOT_PENDING" || error.code === "OPENING_QUESTION_UNKNOWN" || error.code === "NOT_FOUND"
}

/** The words for a refused answer; a vanished match gets its own line. */
export function openingAnswerCopy(error: unknown): string {
  const e = toDatingError(error)
  if (e.code === "NOT_FOUND") return "This match isn't available any more."
  return copyFor(e)
}
