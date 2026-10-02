/*
  After-date check-ins (mechanic M14).

    GET  /date-checkins                  the asks still waiting for an answer
    POST /matches/:id/date-feedback      {met, again?, felt_safe?} → 201

  A few hours after a planned meet the server asks both people how it went
  (the notification deep-links to /dating/matches/{id}?checkin=1); anyone may
  also answer for a match of theirs unasked. `met` is yes, no or not_yet;
  `again` (yes, no, unsure) and `felt_safe` only follow met=yes and are
  optional. felt_safe=false comes back with `offer_report: true`, and the
  app offers the report flow; nothing is decided automatically.

  Refusals: 400 INVALID_DATE_FEEDBACK (inline), 429 DATE_FEEDBACK_LIMIT
  (already answered enough), 404 (MECHANIC_NOT_ENABLED, or not their match)
  hides the check-in.
*/

import { arr, bool, obj, str, time, toDatingError } from "./wire"
import { DATING_BASE } from "./profile"

export type MetAnswer = "yes" | "no" | "not_yet"
export type AgainAnswer = "yes" | "no" | "unsure"

/** Alphabetical would break the question's own order; these read as answers to it. */
export const MET_OPTIONS: readonly { value: MetAnswer; label: string }[] = [
  { value: "yes", label: "Yes, we met" },
  { value: "no", label: "No" },
  { value: "not_yet", label: "Not yet" },
]

export const AGAIN_OPTIONS: readonly { value: AgainAnswer; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Not sure" },
]

export const SAFE_OPTIONS: readonly { value: "yes" | "no"; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
]

export interface CheckinPerson {
  userId: string
  firstName: string
}

export interface DateCheckin {
  matchId: string
  meetId: string
  person: CheckinPerson
  askedAt: string
}

function toCheckinPerson(wire: unknown): CheckinPerson {
  const w = obj(wire)
  return { userId: str(w.user_id), firstName: str(w.first_name) }
}

/** GET /date-checkins. A row without a match id can't be answered, so it is dropped. */
export function toDateCheckins(wire: unknown): DateCheckin[] {
  return arr(wire)
    .map((raw) => {
      const w = obj(raw)
      return { matchId: str(w.match_id), meetId: str(w.meet_id), person: toCheckinPerson(w.person), askedAt: time(w.asked_at) }
    })
    .filter((c) => c.matchId)
}

/* ── the sheet ───────────────────────────────────────────────────── */

export interface CheckinForm {
  met: MetAnswer | ""
  again: AgainAnswer | ""
  /** null: not answered (it's optional). */
  feltSafe: boolean | null
}

export const EMPTY_CHECKIN: CheckinForm = { met: "", again: "", feltSafe: null }

/** The two follow-up questions appear only after "yes, we met". */
export function showFollowUps(form: CheckinForm): boolean {
  return form.met === "yes"
}

/** Choosing anything but yes clears the follow-ups, so they are never sent with it. */
export function chooseMet(form: CheckinForm, met: MetAnswer): CheckinForm {
  return met === "yes" ? { ...form, met } : { met, again: "", feltSafe: null }
}

export interface DateFeedbackBody {
  met: MetAnswer
  again?: AgainAnswer
  felt_safe?: boolean
}

/** The POST body, or null until "Did you meet?" is answered. */
export function checkinBody(form: CheckinForm): DateFeedbackBody | null {
  if (!form.met) return null
  const body: DateFeedbackBody = { met: form.met }
  if (form.met !== "yes") return body
  if (form.again) body.again = form.again
  if (form.feltSafe !== null) body.felt_safe = form.feltSafe
  return body
}

export interface DateFeedback {
  matchId: string
  met: string
  again: string
  /** null: not answered. */
  feltSafe: boolean | null
  createdAt: string
  /** They did not feel safe: offer the report flow. */
  offerReport: boolean
}

export function toDateFeedback(wire: unknown): DateFeedback {
  const w = obj(wire)
  return {
    matchId: str(w.match_id),
    met: str(w.met),
    again: str(w.again),
    feltSafe: typeof w.felt_safe === "boolean" ? w.felt_safe : null,
    createdAt: time(w.created_at),
    offerReport: bool(w.offer_report),
  }
}

/** What the sheet shows once the answer is in. */
export type CheckinDone = { kind: "report" } | { kind: "thanks"; line: string }

export function checkinDone(result: DateFeedback): CheckinDone {
  if (result.offerReport) return { kind: "report" }
  if (result.met === "not_yet") return { kind: "thanks", line: "Thanks. You can tell us later from your match." }
  return { kind: "thanks", line: "Thanks for telling us. It helps keep Pulse a good place to meet." }
}

export function supportLine(name: string): string {
  return `We're sorry it didn't feel safe. If ${name} did something that worried you, you can report them. Reports are confidential, and they won't know it was you.`
}

/* ── refusals ────────────────────────────────────────────────────── */

export type CheckinRefusal = "invalid" | "limit" | "off" | "other"

/**
    400 INVALID_DATE_FEEDBACK → invalid: an inline error, the sheet stays;
    429 DATE_FEEDBACK_LIMIT   → limit:   "you've already told us";
    any 404                   → off:     the check-in is hidden;
    anything else             → other:   an inline error.
*/
export function checkinRefusal(error: unknown): CheckinRefusal {
  const e = toDatingError(error)
  if (e.code === "INVALID_DATE_FEEDBACK") return "invalid"
  if (e.code === "DATE_FEEDBACK_LIMIT") return "limit"
  if (e.status === 404 || e.code === "MECHANIC_NOT_ENABLED") return "off"
  return "other"
}

/* ── where it lives ──────────────────────────────────────────────── */

export const CHECKIN_PARAM = "checkin"

/** The deep link a check-in notification opens. */
export function checkinHref(matchId: string): string {
  return `${DATING_BASE}/matches/${encodeURIComponent(matchId)}?${CHECKIN_PARAM}=1`
}

/** `?checkin=1` (Next hands a repeated parameter over as a list). */
export function wantsCheckin(value: string | string[] | undefined): boolean {
  const v = Array.isArray(value) ? value[0] : value
  return v === "1"
}

export function checkinName(firstName: string): string {
  return firstName || "your match"
}

export function checkinCardTitle(firstName: string): string {
  return firstName ? `How did it go with ${firstName}?` : "How did your date go?"
}
