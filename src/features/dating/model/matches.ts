/* Matches: GET /matches, GET /matches/:id, POST /matches/:id/close|extend. */

import { resetLine } from "./pulse"
import { spanUntil, toFirstMoveView, type FirstMoveView } from "./firstMove"
import { toPerson, type Person } from "./people"
import { arr, bool, num, obj, str, time, type DatingError } from "./wire"

export interface Match {
  id: string
  status: string
  conversationId: string
  matchedAt: string
  firstMessageAt: string
  expiresAt: string
  person: Person | null
  /** Mechanic M5, while the match waits for its first message under the rule; null for a normal match. */
  firstMove: FirstMoveView | null
}

export function toMatch(wire: unknown): Match | null {
  const w = obj(wire)
  const id = str(w.id)
  if (!id) return null
  return {
    id,
    status: str(w.status),
    conversationId: str(w.conversation_id),
    matchedAt: time(w.matched_at),
    firstMessageAt: time(w.first_message_at),
    expiresAt: time(w.expires_at),
    person: toPerson(w.person),
    firstMove: toFirstMoveView(w.first_move),
  }
}

export function toMatches(wire: unknown): Match[] {
  return arr(wire)
    .map(toMatch)
    .filter((m): m is Match => m !== null)
}

const OPEN_STATUSES: ReadonlySet<string> = new Set(["matched", "quiet"])

export function isOpen(match: Pick<Match, "status">): boolean {
  return OPEN_STATUSES.has(match.status)
}

export function toCloseResult(wire: unknown): { closed: boolean } {
  return { closed: bool(obj(wire).closed) }
}

/* ── more time ───────────────────────────────────────────────────── */

/**
  POST /matches/:id/extend. Two paths on the server:
    free    — the person waiting on a first-move match, once per rolling 24 h: {extra_hours: 24, free: true};
    premium — a pass holder's 7 days: {extra_days: 7, extra_hours: 168}.
  An older server sent only `extra_days`; the hours are worked out from it.
*/
export interface ExtendResult {
  extended: boolean
  extraDays: number
  extraHours: number
  expiresAt: string
  free: boolean
}

export function toExtendResult(wire: unknown): ExtendResult {
  const w = obj(wire)
  const extraDays = num(w.extra_days)
  return {
    extended: bool(w.extended),
    extraDays,
    extraHours: num(w.extra_hours) || extraDays * 24,
    expiresAt: time(w.expires_at),
    free: bool(w.free),
  }
}

/** The toast after more time is added. */
export function extendedLine(r: ExtendResult): string {
  if (r.extraDays > 0) return `${r.extraDays} more ${r.extraDays === 1 ? "day" : "days"} added`
  if (r.extraHours > 0) return `${r.extraHours} more ${r.extraHours === 1 ? "hour" : "hours"} added`
  return "More time added"
}

export interface ExtendLimit {
  limit: number
  windowHours: number
  resetsAt: string
}

/** 429 EXTEND_LIMIT_REACHED: the free extra time is used for now. null for any other refusal. */
export function toExtendLimit(error: DatingError): ExtendLimit | null {
  if (error.code !== "EXTEND_LIMIT_REACHED") return null
  return { limit: num(error.details.limit), windowHours: num(error.details.window_hours), resetsAt: time(error.details.resets_at) }
}

/** "You can give more time once every 24 hours. You can do it again at 6:30 pm." */
export function extendLimitLine(l: ExtendLimit, now?: Date, locale?: string): string {
  const rule =
    l.limit > 0 && l.windowHours > 0
      ? `You can give more time ${l.limit === 1 ? "once" : `${l.limit} times`} every ${l.windowHours} hours.`
      : "You've used your free extra time for now."
  const when = resetLine(l.resetsAt, now, locale)
  return when ? `${rule} You can do it again ${when}.` : `${rule} Try again later.`
}

/* ── the countdown ───────────────────────────────────────────────── */

/**
  The countdown until the first message. It runs only while nobody has
  written (`first_message_at` empty) and the server gave an `expires_at`.
*/
export interface Countdown {
  kind: "none" | "running" | "expired"
  text: string
}

export function countdown(match: Pick<Match, "expiresAt" | "firstMessageAt">, nowMs: number = Date.now()): Countdown {
  if (match.firstMessageAt || !match.expiresAt) return { kind: "none", text: "" }
  const span = spanUntil(match.expiresAt, nowMs)
  if (!span) return { kind: "expired", text: "This match has run out of time." }
  return { kind: "running", text: `${span} left to say hello` }
}

/**
  Where "Open chat" goes.

  The messenger has no way to open an existing conversation by id yet: its
  direct pane opens by PERSON and asks message-service to get-or-create a
  direct conversation, which is not the match's own conversation. Until the
  messenger can take `?conversation=<id>`, this is the messenger's front door.
  Flip the flag when that handler exists; nothing else changes.
*/
export const MESSENGER_OPENS_CONVERSATION_BY_ID = true

export function chatHref(conversationId: string): string {
  if (MESSENGER_OPENS_CONVERSATION_BY_ID && conversationId) {
    return `/messenger?conversation=${encodeURIComponent(conversationId)}`
  }
  return "/messenger"
}

export const matchHref = (matchId: string) => `/dating/matches/${encodeURIComponent(matchId)}`
