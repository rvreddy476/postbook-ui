/*
  B1: a booking whose professional is gone (`pro_unavailable`).

  The professional declined, let the offer lapse, gave the job back, was not
  on duty, did not turn up, or ops took the job off them. Nobody is moved in
  silently. The customer, before `choice_deadline` (30 minutes):

    * picks another professional (GET /bookings/{id}/professionals, each card
      with difference_paise against the booking's total) and a time or ASAP:
        - cheaper or the same: confirmed at once, the difference refunded
          (change.refund_paise);
        - dearer: the professional is held while the difference is paid as a
          `pro_change` extras bill (payments reference doorstep_extras). It
          is paid ONLY when GET /bookings/{id}/payment says so for that bill
          — never from the change's own status or the intent's;
    * or cancels for a full refund (cancel-preview rule pro_unavailable_free).

  No choice by the deadline: the server cancels and refunds in full. The
  countdown runs from the server's timestamp; an unreadable or missing one
  counts as closed, never as forever.
*/

import { attemptSignature } from "./bookingAttempt"
import { formatPaise } from "./money"
import type { ProPick } from "./professionals"
import type { Booking, PaymentIntent, ProChange, UnavailableCause } from "./wire"

/* ── why ──────────────────────────────────────────────────────────── */

const CAUSE_LINES: Record<UnavailableCause, string> = {
  declined: "Your professional declined this job.",
  offer_expired: "Your professional didn't accept the job in time.",
  pro_cancel: "Your professional gave the job back.",
  not_on_duty: "Your professional wasn't on duty in time for the visit.",
  pro_no_show: "Your professional didn't arrive.",
  ops_redispatch: "Our team took the job off your professional.",
  no_professional: "No professional could take this job.",
}

export function causeLine(cause: string | null): string {
  return (cause && (CAUSE_LINES as Record<string, string>)[cause]) || "Your professional can't make it."
}

/* ── the choice window ────────────────────────────────────────────── */

/** Milliseconds left to choose; 0 when the deadline passed, is missing, or is unreadable. */
export function choiceRemainingMs(deadline: string | null | undefined, now: number): number {
  if (!deadline) return 0
  const end = Date.parse(deadline)
  if (Number.isNaN(end)) return 0
  return Math.max(0, end - now)
}

export function choiceOpen(deadline: string | null | undefined, now: number): boolean {
  return choiceRemainingMs(deadline, now) > 0
}

export const CHOICE_CLOSED_LINE = "The 30 minutes to pick another professional are over. This booking is being cancelled and everything you paid will be refunded."

/* ── what a change costs ──────────────────────────────────────────── */

export type ChangeMoney = { kind: "refund"; paise: number } | { kind: "charge"; paise: number } | { kind: "same" } | { kind: "unknown" }

/** From a card's difference_paise (price − the booking's total). */
export function changeMoney(differencePaise: number | null): ChangeMoney {
  if (differencePaise === null || !Number.isSafeInteger(differencePaise)) return { kind: "unknown" }
  if (differencePaise < 0) return { kind: "refund", paise: -differencePaise }
  if (differencePaise > 0) return { kind: "charge", paise: differencePaise }
  return { kind: "same" }
}

export function changeMoneyLine(m: ChangeMoney): string {
  if (m.kind === "refund") return `${formatPaise(m.paise)} back to you`
  if (m.kind === "charge") return `Pay ${formatPaise(m.paise)} more`
  if (m.kind === "same") return "Same price"
  return ""
}

/* ── paying the difference ────────────────────────────────────────── */

export interface ChangePayTarget {
  /** The pro_change extras bill (the intent's reference id). */
  billId: string
  amountPaise: number
  intent: PaymentIntent
}

/**
  The extras-bill payment for a dearer change, or null when there is
  nothing to pay or the server's answer does not hang together: only a
  pending_payment change with a doorstep_extras intent for exactly the
  (positive) difference is paid for.
*/
export function changePayTarget(change: ProChange | null): ChangePayTarget | null {
  if (!change || change.status !== "pending_payment") return null
  const intent = change.paymentIntent
  if (!intent || intent.referenceType !== "doorstep_extras" || !intent.referenceId) return null
  if (change.differencePaise <= 0 || intent.amountPaise !== change.differencePaise) return null
  return { billId: intent.referenceId, amountPaise: intent.amountPaise, intent }
}

export type ChangeOutcome =
  /** Confirmed with the new professional; `refundPaise` > 0 when they are cheaper. */
  | { kind: "applied"; proName: string; refundPaise: number }
  /** Held while the difference is paid (the extras-bill flow). */
  | { kind: "pay"; proName: string; target: ChangePayTarget; holdExpiresAt: string | null }
  | { kind: "abandoned" }
  /** A pending change the client cannot pay for (no or a mismatched intent). */
  | { kind: "unpayable" }

export function changeOutcome(change: ProChange): ChangeOutcome {
  if (change.status === "applied") return { kind: "applied", proName: change.proFirstName, refundPaise: Math.max(0, change.refundPaise) }
  if (change.status === "abandoned") return { kind: "abandoned" }
  const target = changePayTarget(change)
  return target ? { kind: "pay", proName: change.proFirstName, target, holdExpiresAt: change.holdExpiresAt } : { kind: "unpayable" }
}

/** The booking's change waiting for its difference, or null. */
export function pendingChangeOf(b: Pick<Booking, "status" | "pendingChange">): ProChange | null {
  return b.status === "pro_unavailable" && b.pendingChange?.status === "pending_payment" ? b.pendingChange : null
}


/* ── the request ──────────────────────────────────────────────────── */

export interface ChangeBody {
  pro_id: string
  slot_start?: string
  asap?: true
}

/** POST /bookings/{id}/change-professional: exactly one of slot_start or asap=true. */
export function changeBody(pick: ProPick): ChangeBody {
  return pick.asap ? { pro_id: pick.proId, asap: true } : { pro_id: pick.proId, slot_start: pick.slotStart }
}

/** One Idempotency-Key per change decision: the booking, the professional and the time. */
export function changeSignature(bookingId: string, pick: ProPick): string {
  return attemptSignature({ quoteId: `change:${bookingId}`, addressId: pick.proId, slotStart: pick.asap ? "asap" : pick.slotStart, requireFemalePro: false })
}
