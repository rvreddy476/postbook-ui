/*
  Sparks: POST /sparks, GET /sparks/incoming, POST /sparks/:id/accept|decline;
  and the stash (save for later).
*/

import { SPARK_NOTE_MAX } from "./labels"
import { toPerson, type Person } from "./people"
import { arr, bool, num, obj, str, time, type DatingError } from "./wire"

/**
  Where a spark or a pass was made (mechanic M7). Only a deck action spends a
  deck card, so picks, liked-you and a profile opened from elsewhere name
  themselves. The deck is the server's default and is never sent, so a deck
  body stays exactly as it was before sources existed. Anything else is
  refused with 400 INVALID_SOURCE.
*/
export type ActionSource = "deck" | "picks" | "liked_you" | "profile"

export const ACTION_SOURCES: readonly ActionSource[] = ["deck", "liked_you", "picks", "profile"]

export interface SparkBody {
  to_user_id: string
  target_kind: "photo"
  target_ref: "0"
  note?: string
  /** Mechanic M3: sent only when true, so an ordinary spark's body is unchanged. */
  super?: true
  /** Mechanic M7: sent only when it is not the deck. */
  source?: Exclude<ActionSource, "deck">
}

/** A spark on someone's primary photo (handler_sparks.go createSparkRequest; Android DatingRepository.spark). */
export function sparkBody(toUserId: string, note?: string, superSpark = false, source: ActionSource = "deck"): SparkBody {
  const body: SparkBody = { to_user_id: toUserId, target_kind: "photo", target_ref: "0" }
  const n = (note ?? "").trim()
  if (n) body.note = n
  if (superSpark) body.super = true
  if (source !== "deck") body.source = source
  return body
}

/** POST /pulse/:id/pass — `{}` from the deck, `{source}` from anywhere else. */
export function passBody(source: ActionSource = "deck"): { source?: Exclude<ActionSource, "deck"> } {
  return source === "deck" ? {} : { source }
}

export function noteProblem(note: string): string {
  return note.trim().length > SPARK_NOTE_MAX ? `Keep your note to ${SPARK_NOTE_MAX} characters.` : ""
}

export interface SparkOutcome {
  sparkId: string
  /** True only with a match id: the server sends both or neither. */
  matched: boolean
  matchId: string
  /** Sent as a Super Spark (absent on the wire means no). */
  isSuper: boolean
}

/** The answer to creating or accepting a spark. */
export function toSparkOutcome(wire: unknown): SparkOutcome {
  const w = obj(wire)
  const spark = obj(w.spark)
  const matchId = str(w.match_id)
  return { sparkId: str(spark.id), matched: bool(w.matched) && matchId !== "", matchId, isSuper: bool(spark.super) }
}

export interface IncomingSpark {
  id: string
  fromUserId: string
  note: string
  createdAt: string
  person: Person | null
  /** A Super Spark: the server already lists these first. */
  isSuper: boolean
}

export function toIncomingSparks(wire: unknown): IncomingSpark[] {
  return arr(wire)
    .map((raw) => {
      const w = obj(raw)
      return {
        id: str(w.id),
        fromUserId: str(w.from_user_id),
        note: str(w.note),
        createdAt: time(w.created_at),
        person: toPerson(w.person),
        isSuper: bool(w.super),
      }
    })
    .filter((s) => s.id)
}

export interface DeclineResult {
  declined: boolean
  sparkId: string
}

export function toDeclineResult(wire: unknown): DeclineResult {
  const w = obj(wire)
  return { declined: bool(w.declined), sparkId: str(w.spark_id) }
}

/* ── the limit ───────────────────────────────────────────────────── */

export interface SparkLimit {
  limit: number
  windowHours: number
  resetsAt: string
}

/** 429 SPARK_RATE_LIMITED details; null for any other refusal. */
export function toSparkLimit(error: DatingError): SparkLimit | null {
  if (error.code !== "SPARK_RATE_LIMITED") return null
  return { limit: num(error.details.limit), windowHours: num(error.details.window_hours), resetsAt: time(error.details.resets_at) }
}

export function sparkLimitLine(limit: SparkLimit): string {
  if (limit.limit > 0 && limit.windowHours > 0) {
    return `You can send ${limit.limit} sparks every ${limit.windowHours} hours.`
  }
  return "You've reached the spark limit."
}

/* ── what a refused deck action does to the card ─────────────────── */

export type CardVerdict = "drop" | "keep" | "limit" | "super_limit" | "onboarding"

/**
  After the server refuses a spark, Super Spark, pass or stash:
    CANDIDATE_UNAVAILABLE     → the card goes (the person is gone for this viewer);
    SPARK_RATE_LIMITED        → the card stays and the out-of-sparks state shows;
    SUPER_SPARK_LIMIT_REACHED → the card stays and the out-of-Super-Sparks state shows;
    ONBOARDING_INCOMPLETE     → back through the gate;
    anything else             → the card rolls back where it was.
*/
export function verdictFor(error: DatingError): CardVerdict {
  if (error.code === "CANDIDATE_UNAVAILABLE") return "drop"
  if (error.code === "SPARK_RATE_LIMITED") return "limit"
  if (error.code === "SUPER_SPARK_LIMIT_REACHED") return "super_limit"
  if (error.code === "ONBOARDING_INCOMPLETE") return "onboarding"
  return "keep"
}

/* ── stash ───────────────────────────────────────────────────────── */

export interface StashEntry {
  candidateId: string
  stashedAt: string
  expiresAt: string
}

export function toStashEntry(wire: unknown): StashEntry | null {
  const w = obj(wire)
  const candidateId = str(w.candidate_id)
  return candidateId ? { candidateId, stashedAt: time(w.stashed_at), expiresAt: time(w.expires_at) } : null
}

export function toStash(wire: unknown): StashEntry[] {
  return arr(wire)
    .map(toStashEntry)
    .filter((s): s is StashEntry => s !== null)
}
