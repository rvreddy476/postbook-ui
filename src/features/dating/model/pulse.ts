/*
  The deck: GET /pulse/today is served as `{data: [cards], meta}` — the cards
  ARE `data`, not `data.cards` (handler_pulse.go envelopePulse).

  `meta.daily_limit`, `meta.remaining_today` and `meta.resets_at` are optional:
  a server flag adds them. An absent `remaining_today` means 0 when a limit is
  set (Go omits the zero).
*/

import { toPerson, type Person } from "./people"
import { arr, bool, num, obj, str, time } from "./wire"

export interface DeckCard {
  candidateId: string
  person: Person
  reasons: string[]
}

export interface Deck {
  cards: DeckCard[]
  cohortGated: boolean
  /** 0 = no daily limit in force. */
  dailyLimit: number
  remainingToday: number
  resetsAt: string
}

export function toDeckCard(wire: unknown): DeckCard | null {
  const w = obj(wire)
  const candidateId = str(w.candidate_id)
  const person = toPerson(w.profile)
  if (!candidateId || !person) return null
  return {
    candidateId,
    person,
    reasons: arr(w.match_reasons)
      .map((r) => str(obj(r).summary))
      .filter(Boolean),
  }
}

/** Takes the whole response body, envelope included. */
export function toDeck(body: unknown): Deck {
  const b = obj(body)
  const meta = obj(b.meta)
  return {
    cards: arr(b.data)
      .map(toDeckCard)
      .filter((c): c is DeckCard => c !== null),
    cohortGated: bool(meta.cohort_gated) || bool(b.cohort_gated),
    dailyLimit: num(meta.daily_limit),
    remainingToday: num(meta.remaining_today),
    resetsAt: time(meta.resets_at),
  }
}

export type DeckEmptyKind = "out_for_today" | "gathering" | "none_left"

/** Why there is nothing to show; null while a card remains. */
export function deckEmptyKind(deck: Pick<Deck, "cohortGated" | "dailyLimit" | "remainingToday">, visibleCards: number): DeckEmptyKind | null {
  if (visibleCards > 0) return null
  if (deck.dailyLimit > 0 && deck.remainingToday <= 0) return "out_for_today"
  if (deck.cohortGated) return "gathering"
  return "none_left"
}

/** "at 6:30 pm" / "tomorrow at 6:30 am" in the reader's locale; "" when unknown. */
export function resetLine(resetsAt: string, now: Date = new Date(), locale?: string): string {
  if (!resetsAt) return ""
  const at = new Date(resetsAt)
  if (Number.isNaN(at.getTime())) return ""
  const clock = at.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
  const sameDay = at.toDateString() === now.toDateString()
  return sameDay ? `at ${clock}` : `${at.toLocaleDateString(locale, { weekday: "long" })} at ${clock}`
}

/* ── pass, explain ───────────────────────────────────────────────── */

export interface PassResult {
  passed: boolean
  candidateId: string
  cooldownUntil: string
}

export function toPassResult(wire: unknown): PassResult {
  const w = obj(wire)
  return { passed: bool(w.passed), candidateId: str(w.candidate_id), cooldownUntil: time(w.cooldown_until) }
}

export interface Explain {
  reasons: string[]
  promoted: boolean
}

/**
  GET /pulse/:id/explain. The reason of kind `distance` is dropped: its
  sentence is the server's and may carry a figure, and distance is only ever
  drawn here as a bucket label.
*/
export function toExplain(wire: unknown): Explain {
  const w = obj(wire)
  return {
    reasons: arr(w.reasons)
      .map(obj)
      .filter((r) => str(r.kind) !== "distance")
      .map((r) => str(r.detail))
      .filter(Boolean),
    promoted: bool(w.is_promoted),
  }
}

/* ── swipe ───────────────────────────────────────────────────────── */

export type SwipeAction = "spark" | "pass" | "stash" | "open" | "super_spark" | "rewind"

export const SWIPE_THRESHOLD_PX = 96

/** A finished drag: right = spark, left = pass, anything short = nothing. */
export function actionForDrag(dx: number, threshold = SWIPE_THRESHOLD_PX): "spark" | "pass" | null {
  if (dx >= threshold) return "spark"
  if (dx <= -threshold) return "pass"
  return null
}

/**
  The deck's keys. ArrowUp sends a Super Spark only while that mechanic is on;
  Backspace and Z undo the last pass only while the Undo control is showing.
*/
export function actionForKey(key: string, superSparkEnabled = false, rewindEnabled = false): SwipeAction | null {
  switch (key) {
    case "Backspace":
    case "z":
    case "Z":
      return rewindEnabled ? "rewind" : null
    case "ArrowRight":
      return "spark"
    case "ArrowLeft":
      return "pass"
    case "ArrowUp":
      return superSparkEnabled ? "super_spark" : null
    case "Enter":
    case " ":
    case "Spacebar":
      return "open"
    default:
      return null
  }
}

/* ── rewind (mechanic M2) ────────────────────────────────────────── */

export interface RewindResult {
  rewound: boolean
  candidateId: string
  /** The card that came back, ready to go on top of the deck. */
  card: DeckCard | null
  unlimited: boolean
  dailyLimit: number
  /** Absent on the wire means 0. */
  remainingToday: number
  resetsAt: string
}

/** POST /pulse/rewind — undo the last pass. 404 MECHANIC_NOT_ENABLED while the server flag is off. */
export function toRewindResult(wire: unknown): RewindResult {
  const w = obj(wire)
  const allowance = obj(w.allowance)
  return {
    rewound: bool(w.rewound),
    candidateId: str(w.candidate_id),
    card: toDeckCard(w.card),
    unlimited: bool(allowance.unlimited),
    dailyLimit: num(allowance.daily_limit),
    remainingToday: num(allowance.remaining_today),
    resetsAt: time(allowance.resets_at),
  }
}
