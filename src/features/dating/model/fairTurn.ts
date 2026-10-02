/*
  Fair turn (mechanic M11). While someone owes replies in `limit` or more open
  matches, the server refuses their NEW sparks (a Super Spark included) with
  409 FAIR_TURN_LIMIT {details: {owed, limit}}. Accepting a spark and sparking
  back someone who sparked them are never paused, so this client only
  disables the deck's Spark and Super Spark; everywhere else a refusal just
  says why.

  GET /allowances carries `fair_turn: {owed, limit, paused}` while the
  mechanic is on and the count could be had. Absent → null → nothing drawn.
*/

import { bool, num, obj, type DatingError } from "./wire"

export interface FairTurn {
  /** Open matches whose newest message is the other person's. */
  owed: number
  limit: number
  /** New sparks are refused until `owed` drops below `limit`. */
  paused: boolean
}

export const FAIR_TURN_CODE = "FAIR_TURN_LIMIT"
/** DATING_BASE + "/matches", written out so the error words need no profile import. */
export const FAIR_TURN_MATCHES_HREF = "/dating/matches"

/** The `fair_turn` member of GET /allowances; absent, null or not an object is "off". */
export function toFairTurn(wire: unknown): FairTurn | null {
  if (!wire || typeof wire !== "object" || Array.isArray(wire)) return null
  const w = obj(wire)
  return { owed: num(w.owed), limit: num(w.limit), paused: bool(w.paused) }
}

export function isFairTurnRefusal(e: DatingError): boolean {
  return e.code === FAIR_TURN_CODE
}

/** The refusal's details as a paused state; null for any other refusal. */
export function fairTurnFromRefusal(e: DatingError): FairTurn | null {
  if (!isFairTurnRefusal(e)) return null
  return { owed: num(e.details.owed), limit: num(e.details.limit), paused: true }
}

/**
  What the deck shows. The newer of the two answers decides: a refusal made
  after the last allowances read stands until a read comes back after it;
  then the read alone decides (not paused, or no member at all, is "go").
*/
export function currentFairTurn(read: FairTurn | null, readAt: number, refused: { turn: FairTurn; at: number } | null): FairTurn | null {
  if (refused && refused.at >= readAt) return refused.turn
  return read && read.paused ? read : null
}

/** "6 matches are waiting for your reply." — 0 (Go omitted it) reads without a number. */
export function fairTurnHeadline(t: Pick<FairTurn, "owed">): string {
  if (t.owed === 1) return "1 match is waiting for your reply"
  if (t.owed > 1) return `${t.owed} matches are waiting for your reply`
  return "Some of your matches are waiting for your reply"
}

export const FAIR_TURN_BODY = "New sparks are on hold until you answer a few of them. Sparking back someone who sparked you still works."

/** The disabled Spark and Super Spark say why, in their title and label. */
export const FAIR_TURN_PAUSED_REASON = "On hold until you reply to your matches"

/** The words for the refusal wherever it surfaces as a toast. */
export function fairTurnCopy(e: DatingError): string {
  const owed = num(e.details.owed)
  return `${fairTurnHeadline({ owed })}. Reply to a few, then send new sparks.`
}
