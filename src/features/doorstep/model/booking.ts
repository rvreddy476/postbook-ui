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
import type { Booking, BookingStatus, Extra, Photo } from "./wire"

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
  pro_unavailable: "Pick another professional",
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
  if (status === "pending_payment" || status === "awaiting_extras_payment" || status === "pro_unavailable") return "warn"
  if (status === "cancelled" || status === "expired" || status === "pro_no_show" || status === "customer_no_show") return "bad"
  return "neutral"
}

/** The happy path, in order: what is still ahead of a live booking. */
export const TIMELINE: readonly { status: BookingStatus; label: string }[] = [
  { status: "pending_payment", label: "Booked" },
  { status: "confirmed", label: "Payment confirmed" },
  { status: "assigned", label: "Professional assigned" },
  { status: "en_route", label: "On the way" },
  { status: "arrived", label: "Arrived" },
  { status: "in_progress", label: "Job started" },
  { status: "completed", label: "Completed" },
]

/** A step's words: the happy path's, else the status label (Cancelled, Extras payment due…). */
function stepLabel(status: BookingStatus): string {
  if (status === "awaiting_extras_payment") return "Extras payment due"
  if (status === "pro_unavailable") return "Professional unavailable"
  return TIMELINE.find((s) => s.status === status)?.label ?? statusLabel(status)
}

export interface TimelineStep {
  status: BookingStatus
  label: string
  state: "done" | "current" | "todo" | "stopped"
  /** When the server recorded it; null for a step still ahead. */
  at: string | null
}

/**
  The timeline from the server's status_history (oldest first): every
  recorded step is done, the last one is the current step (done when the
  booking completed, "stopped" when it ended off the happy path), and a live
  booking shows what is still ahead on the happy path. Nothing is inferred
  from the status alone: a step the server did not record is not drawn as
  reached. Should the history lag the status (a poll racing a transition),
  the booking's status is appended as the current step, time unknown.
*/
export function timeline(b: Pick<Booking, "status" | "statusHistory">): TimelineStep[] {
  const reached: { status: BookingStatus; at: string | null }[] = []
  for (const s of b.statusHistory) {
    if (reached.length && reached[reached.length - 1].status === s.toStatus) continue
    reached.push({ status: s.toStatus, at: s.createdAt })
  }
  if (!reached.length || reached[reached.length - 1].status !== b.status) reached.push({ status: b.status, at: null })

  const last = reached.length - 1
  const ended = isTerminal(b.status)
  const steps: TimelineStep[] = reached.map((s, i) => ({
    status: s.status,
    label: stepLabel(s.status),
    state: i < last ? "done" : b.status === "completed" ? "done" : ended ? "stopped" : "current",
    at: s.at,
  }))
  if (ended) return steps

  const happy = TIMELINE.map((s) => s.status)
  // Extras due sits after the job started; a booking waiting for a new
  // professional is paid and goes back to "assigned" once someone accepts.
  const along = b.status === "awaiting_extras_payment" ? "in_progress" : b.status === "pro_unavailable" ? "confirmed" : b.status
  const pos = happy.indexOf(along)
  for (const s of TIMELINE.slice(pos + 1)) steps.push({ status: s.status, label: s.label, state: "todo", at: null })
  return steps
}

/* ── OTPs ─────────────────────────────────────────────────────────── */

export const START_OTP_STATUSES: ReadonlySet<BookingStatus> = new Set(["assigned", "en_route", "arrived"])
export const END_OTP_STATUSES: ReadonlySet<BookingStatus> = new Set(["in_progress", "awaiting_extras_payment"])

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

/* ── photos ───────────────────────────────────────────────────────── */

/** The visit photos a customer sees: before and after only (kit seals and extra evidence are not theirs to browse here). */
export function customerPhotos(photos: readonly Photo[]): { before: Photo[]; after: Photo[] } {
  return { before: photos.filter((p) => p.phase === "before"), after: photos.filter((p) => p.phase === "after") }
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
  pro_late_free: "Free: the professional is late.",
  pro_unavailable_free: "Free: your professional can't make it, so everything you paid is refunded.",
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
