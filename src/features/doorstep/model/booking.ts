/*
  Booking rules the screens follow (contracts/doorstep/openapi.yaml,
  x-doorstep-booking-states).

  OTPs. The START code is read out to the professional to begin the job: it
  is shown from `assigned` until the job starts (`assigned`, `en_route`,
  `arrived`), never before a professional accepted and never after the job
  began. The END code closes the job: it is shown only while the job is
  `in_progress`. A code the server sent outside its window is NOT shown —
  the screen does not trust that the server got it right.

  Extras. The professional proposes, the customer approves or declines.
  Approved (and billed) extras are what the customer owes on top of the
  booking; proposed ones are waiting for a decision; declined and withdrawn
  ones are nothing.
*/

import { addPaise } from "./money"
import type { Booking, BookingStatus, Extra } from "./wire"

/* ── status ───────────────────────────────────────────────────────── */

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending_payment: "Waiting for payment",
  confirmed: "Confirmed",
  assigned: "Professional assigned",
  en_route: "On the way",
  arrived: "Arrived",
  in_progress: "In progress",
  awaiting_extras_payment: "Extras payment due",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
  customer_no_show: "Missed visit",
  pro_no_show: "Professional didn't arrive",
}

export function statusLabel(status: string): string {
  return (STATUS_LABELS as Record<string, string>)[status] ?? status.replace(/_/g, " ")
}

export const TERMINAL: ReadonlySet<BookingStatus> = new Set(["completed", "cancelled", "expired", "customer_no_show", "pro_no_show"])

export function isTerminal(status: BookingStatus): boolean {
  return TERMINAL.has(status)
}

/** Statuses during which the booking is live (realtime + quick polling). */
export function isLive(status: BookingStatus): boolean {
  return !isTerminal(status) && status !== "pending_payment"
}

export type Tone = "neutral" | "good" | "warn" | "bad"

export function statusTone(status: BookingStatus): Tone {
  if (status === "completed") return "good"
  if (status === "pending_payment" || status === "awaiting_extras_payment") return "warn"
  if (status === "cancelled" || status === "expired" || status === "pro_no_show" || status === "customer_no_show") return "bad"
  return "neutral"
}

/** The happy path, in order; the timeline marks every step up to the current one. */
export const TIMELINE: readonly { status: BookingStatus; label: string }[] = [
  { status: "pending_payment", label: "Booked" },
  { status: "confirmed", label: "Payment confirmed" },
  { status: "assigned", label: "Professional assigned" },
  { status: "en_route", label: "On the way" },
  { status: "arrived", label: "Arrived" },
  { status: "in_progress", label: "Job started" },
  { status: "completed", label: "Completed" },
]

export interface TimelineStep {
  label: string
  state: "done" | "current" | "todo" | "stopped"
}

/**
  The timeline for a status. `awaiting_extras_payment` sits on "Job started";
  a booking that ended off the happy path keeps what was reached and closes
  with its own end (Cancelled, Expired…).
*/
export function timeline(status: BookingStatus, paid = true): TimelineStep[] {
  const happy = TIMELINE.map((s) => s.status)
  const pos = status === "awaiting_extras_payment" ? happy.indexOf("in_progress") : happy.indexOf(status)
  if (pos >= 0) {
    return TIMELINE.map((s, i) => ({
      label: i === pos && status === "awaiting_extras_payment" ? "Extras payment due" : s.label,
      state: i < pos || (i === pos && status === "completed") ? "done" : i === pos ? "current" : "todo",
    }))
  }
  // Off the path: "Booked" always happened; payment only when something was paid.
  const steps: TimelineStep[] = [{ label: "Booked", state: "done" }]
  if (status !== "expired" && paid) steps.push({ label: "Payment confirmed", state: "done" })
  steps.push({ label: statusLabel(status), state: "stopped" })
  return steps
}

/* ── OTPs ─────────────────────────────────────────────────────────── */

export const START_OTP_STATUSES: ReadonlySet<BookingStatus> = new Set(["assigned", "en_route", "arrived"])
export const END_OTP_STATUSES: ReadonlySet<BookingStatus> = new Set(["in_progress"])

export type OtpShown = { kind: "start" | "end"; code: string } | null

function cleanCode(code: string | null | undefined): string | null {
  const c = typeof code === "string" ? code.trim() : ""
  return c ? c : null
}

/** The one code the customer should see now, or null. */
export function otpToShow(b: Pick<Booking, "status" | "startOtp" | "endOtp">): OtpShown {
  if (START_OTP_STATUSES.has(b.status)) {
    const code = cleanCode(b.startOtp)
    return code ? { kind: "start", code } : null
  }
  if (END_OTP_STATUSES.has(b.status)) {
    const code = cleanCode(b.endOtp)
    return code ? { kind: "end", code } : null
  }
  return null
}

/* ── extras ───────────────────────────────────────────────────────── */

export interface ExtrasTotals {
  /** Approved and billed: owed on top of the booking. */
  approvedPaise: number
  /** Proposed: waiting for the customer. */
  pendingPaise: number
  pendingCount: number
}

export function extrasTotals(extras: readonly Extra[]): ExtrasTotals {
  const approved: number[] = []
  const pending: number[] = []
  for (const e of extras) {
    if (e.status === "approved" || e.status === "billed") approved.push(e.totalPaise)
    else if (e.status === "proposed") pending.push(e.totalPaise)
  }
  return { approvedPaise: addPaise(...approved), pendingPaise: addPaise(...pending), pendingCount: pending.length }
}

/** Only a proposed extra on a running job can be decided. */
export function canDecideExtra(bookingStatus: BookingStatus, extra: Pick<Extra, "status">): boolean {
  return extra.status === "proposed" && (bookingStatus === "arrived" || bookingStatus === "in_progress")
}

/* ── after the visit ──────────────────────────────────────────────── */

export const RATING_WINDOW_DAYS = 7

/** Rating opens at completion and closes after 7 days (the server has the last word). */
export function canRate(status: BookingStatus): boolean {
  return status === "completed"
}

/** Rework is asked on a completed job; the window (rework_days) is the server's to enforce. */
export function canAskRework(status: BookingStatus, parentBookingId: string | null): boolean {
  return status === "completed" && parentBookingId === null
}

/** SOS and share-status are there from acceptance until the job ends. */
export function safetyOpen(status: BookingStatus): boolean {
  return status === "assigned" || status === "en_route" || status === "arrived" || status === "in_progress" || status === "awaiting_extras_payment"
}

/** Chat opens at acceptance; the server closes it 2 h after completion (MessagePage.open decides). */
export function chatMayOpen(status: BookingStatus): boolean {
  return safetyOpen(status) || status === "completed"
}

/* ── cancellation rules, in words ─────────────────────────────────── */

const CANCEL_RULES: Record<string, string> = {
  free_before_assignment: "Free: no professional has accepted yet.",
  free: "Free cancellation.",
  gte_3h: "Free: more than 3 hours before the visit.",
  lt_3h: "Less than 3 hours before the visit.",
  lt_1h_or_en_route: "Less than an hour before the visit, or the professional is on the way.",
  arrived: "The professional has arrived.",
}

export function cancelRuleText(rule: string): string {
  return CANCEL_RULES[rule] ?? ""
}

/* ── the professional's pin ───────────────────────────────────────── */

export interface ProFix {
  lat: number
  lng: number
  etaMinutes: number | null
  at: string
}

/** A newer fix replaces the shown one; SSE and polling race, so an older frame never wins. */
export function newerFix(current: ProFix | null, next: ProFix | null): ProFix | null {
  if (!next || Math.abs(next.lat) > 90 || Math.abs(next.lng) > 180) return current
  const n = Date.parse(next.at)
  if (Number.isNaN(n)) return current
  if (!current) return next
  const c = Date.parse(current.at)
  return Number.isNaN(c) || n > c ? next : current
}
