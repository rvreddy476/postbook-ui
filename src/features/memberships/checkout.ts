/*
  The join / renew / change-level checkout as a pure state machine. The hook
  (hooks.ts useMembershipCheckout) owns the network, the Razorpay dialog and
  the poll's timers; every decision about what the sheet says, and whether
  the Idempotency-Key survives, is here.

  "Paid" comes only from GET /memberships/payments/:id (the signed
  payment.succeeded event applied server side). The dialog ending, and the
  advisory /verify call, only start the poll. The poll itself is the shop's
  (features/shop/orders/paymentPoll.ts): 1, 2, 3, 4 s then every 5 s, give
  up at 180 s and say so, a permanent 4xx stops it.
*/

import { isTerminal, type PollState } from "@/features/shop/orders/paymentPoll"

import { checkoutAlreadyPaid, isMembershipsOff, keepKeyAfter, membershipErrorMessage, toMembershipError, type Checkout } from "./model"

export type CheckoutPhase =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "dialog" }
  | { phase: "confirming" }
  | { phase: "paid"; refunding: boolean }
  | { phase: "failed"; message: string }
  | { phase: "still_confirming" }
  /** The dialog closed without a payment: "Pay now" replays the same checkout (same key). */
  | { phase: "dismissed" }
  /** A downgrade: nothing charged, the new level starts next period. */
  | { phase: "scheduled"; effectiveAt: string }
  /** MEMBERSHIPS_NOT_ENABLED (503): the whole feature is switched off. */
  | { phase: "unavailable" }
  /** ALREADY_SUBSCRIBED (409). */
  | { phase: "already" }
  /** The start was refused or did not get an answer. */
  | { phase: "error"; message: string }

export type CheckoutEvent =
  | { type: "start" }
  | { type: "started"; checkout: Checkout; canOpen: boolean }
  | { type: "start_failed"; error: unknown }
  | { type: "scheduled"; effectiveAt: string }
  | { type: "upgraded" }
  | { type: "dialog_completed" }
  | { type: "dialog_dismissed" }
  | { type: "poll"; poll: PollState }
  | { type: "check_again" }
  | { type: "reset" }

export const idle: CheckoutPhase = { phase: "idle" }

export const NO_ONLINE_PAYMENT = "Online payment isn't available right now. Try again later."
export const PAYMENT_FAILED = "The payment didn't go through. Nothing was added to your membership."
export const PAYMENT_UNKNOWN = "We couldn't check this payment. If money left your account, it will be applied or refunded."

export function checkoutReducer(state: CheckoutPhase, event: CheckoutEvent): CheckoutPhase {
  switch (event.type) {
    case "start":
      return { phase: "starting" }
    case "started":
      if (event.canOpen) return { phase: "dialog" }
      if (checkoutAlreadyPaid(event.checkout)) return { phase: "paid", refunding: false }
      return { phase: "failed", message: NO_ONLINE_PAYMENT }
    case "start_failed": {
      const e = toMembershipError(event.error)
      if (isMembershipsOff(event.error)) return { phase: "unavailable" }
      if (e.code === "ALREADY_SUBSCRIBED") return { phase: "already" }
      return { phase: "error", message: membershipErrorMessage(event.error) }
    }
    case "scheduled":
      return { phase: "scheduled", effectiveAt: event.effectiveAt }
    case "upgraded":
      return { phase: "paid", refunding: false }
    case "dialog_completed":
      return { phase: "confirming" }
    case "dialog_dismissed":
      return state.phase === "dialog" ? { phase: "dismissed" } : state
    case "poll": {
      const p = event.poll
      if (!isTerminal(p)) return state.phase === "confirming" ? state : { phase: "confirming" }
      if (p.phase === "paid") return { phase: "paid", refunding: p.refundStatus !== "" }
      if (p.phase === "failed") return { phase: "failed", message: PAYMENT_FAILED }
      if (p.phase === "timed_out") return { phase: "still_confirming" }
      return { phase: "failed", message: PAYMENT_UNKNOWN }
    }
    case "check_again":
      return state.phase === "still_confirming" ? { phase: "confirming" } : state
    case "reset":
      return idle
  }
}

/**
  Whether the event ends the decision to pay, so the next press is a new
  checkout with a new key. Kept: a start that got no answer (or a 5xx — the
  checkout may exist), a dismissed dialog (Pay now reopens the same one), a
  poll still running or timed out (the payment may yet land). Closing the
  sheet ("reset") is not a verdict either: an open checkout reopened later
  must be the same one.
*/
export function resetsKey(event: CheckoutEvent): boolean {
  switch (event.type) {
    case "start_failed":
      return !keepKeyAfter(event.error)
    case "started":
      return !event.canOpen
    case "scheduled":
    case "upgraded":
      return true
    case "poll":
      return isTerminal(event.poll) && event.poll.phase !== "timed_out"
    default:
      return false
  }
}

/** The sheet is busy and must not take another press. */
export function checkoutBusy(s: CheckoutPhase): boolean {
  return s.phase === "starting" || s.phase === "dialog" || s.phase === "confirming"
}
