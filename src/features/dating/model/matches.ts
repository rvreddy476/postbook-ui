/* Matches: GET /matches, GET /matches/:id, POST /matches/:id/close|extend. */

import { toPerson, type Person } from "./people"
import { arr, bool, num, obj, str, time } from "./wire"

export interface Match {
  id: string
  status: string
  conversationId: string
  matchedAt: string
  firstMessageAt: string
  expiresAt: string
  person: Person | null
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

export function toExtendResult(wire: unknown): { extended: boolean; extraDays: number } {
  const w = obj(wire)
  return { extended: bool(w.extended), extraDays: num(w.extra_days) }
}

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
  const left = Date.parse(match.expiresAt) - nowMs
  if (!(left > 0)) return { kind: "expired", text: "This match has run out of time." }
  const minutes = Math.floor(left / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  const span = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` : `${Math.max(mins, 1)}m`
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
