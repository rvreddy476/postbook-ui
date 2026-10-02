/*
  Allowances (mechanic M10): GET /allowances, one read of every daily
  allowance the viewer has.

    {data: {sparks: A, deck?: A, rewind?: A, super_spark?: A & {purchased_balance?}, fair_turn?: {owed, limit, paused}}}
    A = {unlimited, daily_limit?, remaining_today?, resets_at?}

  A mechanic whose server flag is off is ABSENT, and that is how this client
  decides whether Rewind and Super Spark exist at all: absent → null → no
  control. Go omits zeros, so an absent `remaining_today` is 0, and a pass
  holder's `unlimited: true` comes without counts.

  Also here: the three refusals that carry a limit (SPARK_RATE_LIMITED,
  REWIND_LIMIT_REACHED, SUPER_SPARK_LIMIT_REACHED), and how a refused rewind
  changes the deck.
*/

import { toFairTurn, type FairTurn } from "./fairTurn"
import { resetLine } from "./pulse"
import { bool, num, obj, time, type DatingError } from "./wire"

export interface Allowance {
  /** A pass lifts this allowance; the counts are then 0 and mean nothing. */
  unlimited: boolean
  dailyLimit: number
  /** Absent on the wire means 0. */
  remainingToday: number
  /** When the oldest use in the window comes back; "" while nothing is used. */
  resetsAt: string
}

export interface SuperSparkAllowance extends Allowance {
  /** Bought Super Sparks, spent once the daily allowance is used. */
  purchasedBalance: number
}

export interface Allowances {
  sparks: Allowance
  /** null: the mechanic is off on the server. */
  deck: Allowance | null
  rewind: Allowance | null
  superSpark: SuperSparkAllowance | null
  /** Mechanic M11: how many replies are owed, and whether new sparks are on hold. null: off, or not counted. */
  fairTurn: FairTurn | null
}

/** Present means a JSON object sits there; absent, null or anything else is "off". */
const present = (value: unknown): boolean => !!value && typeof value === "object" && !Array.isArray(value)

export function toAllowance(wire: unknown): Allowance {
  const w = obj(wire)
  const unlimited = bool(w.unlimited)
  return {
    unlimited,
    dailyLimit: unlimited ? 0 : num(w.daily_limit),
    remainingToday: unlimited ? 0 : num(w.remaining_today),
    resetsAt: time(w.resets_at),
  }
}

export function toAllowances(wire: unknown): Allowances {
  const w = obj(wire)
  return {
    sparks: toAllowance(w.sparks),
    deck: present(w.deck) ? toAllowance(w.deck) : null,
    rewind: present(w.rewind) ? toAllowance(w.rewind) : null,
    superSpark: present(w.super_spark) ? { ...toAllowance(w.super_spark), purchasedBalance: num(obj(w.super_spark).purchased_balance) } : null,
    fairTurn: toFairTurn(w.fair_turn),
  }
}

/** Before the read lands, or when it fails: every optional mechanic is off. */
export const NO_ALLOWANCES: Allowances = { sparks: { unlimited: false, dailyLimit: 0, remainingToday: 0, resetsAt: "" }, deck: null, rewind: null, superSpark: null, fairTurn: null }

/** "Unlimited today" / "3 left today" / "None left today". */
export function leftToday(a: Allowance): string {
  if (a.unlimited) return "Unlimited today"
  if (a.remainingToday <= 0) return "None left today"
  return `${a.remainingToday} left today`
}

/** The line under the deck's actions: what Super Sparks the viewer has. */
export function superSparkNote(a: SuperSparkAllowance): string {
  const today = leftToday(a)
  const parts = [`Super Sparks: ${today.charAt(0).toLowerCase()}${today.slice(1)}`]
  if (a.purchasedBalance > 0) parts.push(`${a.purchasedBalance} bought`)
  return parts.join(" · ")
}

/* ── refusals with a limit ───────────────────────────────────────── */

export interface UsageLimit {
  limit: number
  windowHours: number
  resetsAt: string
}

const LIMIT_CODES: ReadonlySet<string> = new Set(["SPARK_RATE_LIMITED", "REWIND_LIMIT_REACHED", "SUPER_SPARK_LIMIT_REACHED"])

/** The details of a 429 that carries a limit; null for any other refusal. */
export function toUsageLimit(error: DatingError): UsageLimit | null {
  if (!LIMIT_CODES.has(error.code)) return null
  return { limit: num(error.details.limit), windowHours: num(error.details.window_hours), resetsAt: time(error.details.resets_at) }
}

/** " More arrive at 6:30 pm." or " Try again later." — the local reset time when the server gave one. */
export function moreArrive(resetsAt: string, now?: Date, locale?: string): string {
  const when = resetLine(resetsAt, now, locale)
  return when ? ` More arrive ${when}.` : " Try again later."
}

export function rewindLimitLine(l: UsageLimit): string {
  if (l.limit > 0 && l.windowHours > 0) {
    return `You can undo ${l.limit === 1 ? "one pass" : `${l.limit} passes`} every ${l.windowHours} hours.`
  }
  return "You've used your undos for now."
}

export function superSparkLimitLine(l: UsageLimit): string {
  if (l.limit > 0 && l.windowHours > 0) {
    return `You get ${l.limit === 1 ? "one free Super Spark" : `${l.limit} free Super Sparks`} every ${l.windowHours} hours, and none you bought are left.`
  }
  return "You've used today's Super Sparks, and none you bought are left."
}

/* ── the undo control ────────────────────────────────────────────── */

/** What the last accepted deck action in this view was; null before any. */
export type LastDeckAction = "pass" | "other" | null

/**
  The Undo control shows only when the server has the mechanic on, it has not
  answered MECHANIC_NOT_ENABLED in this session, and the last thing accepted
  in this view was a pass (a spark is never undone, and undo is one step).
*/
export function showRewind(input: { rewind: Allowance | null; off: boolean; last: LastDeckAction }): boolean {
  return input.rewind !== null && !input.off && input.last === "pass"
}

export type RewindRefusal = "nothing" | "out" | "off" | "gone" | "other"

/**
  A refused rewind:
    REWIND_NOTHING_TO_UNDO → nothing: the control goes;
    REWIND_LIMIT_REACHED   → out: the out-of-undos state, the control stays;
    MECHANIC_NOT_ENABLED   → off: the control goes for the session;
    CANDIDATE_UNAVAILABLE  → gone: that person can't come back, the control goes;
    anything else          → other: say so, the control stays.
*/
export function rewindRefusal(error: DatingError): RewindRefusal {
  switch (error.code) {
    case "REWIND_NOTHING_TO_UNDO":
      return "nothing"
    case "REWIND_LIMIT_REACHED":
      return "out"
    case "MECHANIC_NOT_ENABLED":
      return "off"
    case "CANDIDATE_UNAVAILABLE":
      return "gone"
    default:
      return "other"
  }
}
