/*
  Doorstep's payment leg (application `doorstep`).

    booking: POST /bookings (or POST /bookings/:id/payment/intent to reopen)
    extras:  POST /extras-bills/:id/payment/intent   (also how outstanding is paid)
    then Razorpay (src/lib/razorpay.ts) from the intent's `checkout` ONLY, or the dev stub
    then GET /bookings/:id/payment until the server says succeeded | failed.

  "Paid" comes from that GET alone: the row for THIS reference
  (doorstep_booking + booking id, or doorstep_extras + bill id) must say
  `succeeded`. The server marks it so only on the signed payment.succeeded
  event. The Razorpay handler's success only ends the dialog; the page keeps
  saying "Confirming payment" until the server agrees. An intent's own
  `status` in the POST answer is NOT trusted for "paid" either.
*/

import type { BookingPayments, PaymentIntent } from "./wire"

export const DOORSTEP_PAYMENT_APPLICATION = "doorstep"

export interface PaymentRef {
  referenceType: "doorstep_booking" | "doorstep_extras"
  referenceId: string
}

export type PaymentReading = "confirming" | "paid" | "failed" | "refund_pending" | "refunded"

/**
  The server's verdict for one reference. A refund outranks paid (a late
  capture on an expired hold is refunded in full); several rows (a retry)
  read as the best one: any succeeded → paid; all failed → failed.
*/
export function readPayment(p: BookingPayments, ref: PaymentRef): PaymentReading {
  const rows = p.payments.filter((r) => r.referenceType === ref.referenceType && r.referenceId === ref.referenceId)
  if (!rows.length) return "confirming"
  const ids = new Set(rows.map((r) => r.paymentId))
  const refunds = p.refunds.filter((r) => ids.has(r.paymentId) && r.status !== "failed")
  if (rows.some((r) => r.status === "refunded")) return "refunded"
  if (refunds.length) return refunds.every((r) => r.status === "succeeded") ? "refunded" : "refund_pending"
  if (rows.some((r) => r.status === "partially_refunded")) return "refund_pending"
  if (rows.some((r) => r.status === "succeeded")) return "paid"
  if (rows.every((r) => r.status === "failed")) return "failed"
  return "confirming"
}

export function isSettled(reading: PaymentReading): boolean {
  return reading !== "confirming"
}

export const PAYMENT_LINES: Record<PaymentReading, string> = {
  confirming: "Confirming payment…",
  paid: "Paid",
  failed: "Payment didn't go through",
  refund_pending: "Refund in progress",
  refunded: "Refunded",
}

/* ── the poll schedule ────────────────────────────────────────────── */

export const PAYMENT_POLL_TIMEOUT_MS = 180_000

/** 2 s for the first 30 s, then 5 s; null once the window is over. */
export function nextPaymentPollDelay(elapsedMs: number): number | null {
  if (elapsedMs >= PAYMENT_POLL_TIMEOUT_MS) return null
  return elapsedMs < 30_000 ? 2_000 : 5_000
}

/* ── how to open it ───────────────────────────────────────────────── */

export const STUB_ORDER_PREFIX = "order_stub_"
export const MERCHANT_FALLBACK = "Doorstep"

export interface RazorpayOpen {
  key: string
  order_id: string
  amount: number
  currency: string
  name: string
  description: string
  prefill?: { name?: string; email?: string }
}

export type PaymentRoute = { kind: "razorpay"; options: RazorpayOpen } | { kind: "stub" } | { kind: "unavailable"; message: string }

/**
  The route for an intent. Razorpay only from a complete razorpay checkout
  session — never a key from the bundle. The stub only when the build allows
  it (NEXT_PUBLIC_ENABLE_STUB_PAYMENTS=true, passed in) AND the server minted
  a stub order. Anything else: "unavailable".
*/
export function paymentRoute(intent: PaymentIntent, input: { description: string; stubAllowed: boolean; prefill?: { name?: string; email?: string } }): PaymentRoute {
  const s = intent.checkout
  if (s && s.provider === "razorpay") {
    if (!s.keyId || !s.orderId) return { kind: "unavailable", message: "Online payment isn't available right now." }
    const options: RazorpayOpen = {
      key: s.keyId,
      order_id: s.orderId,
      amount: intent.amountPaise,
      currency: "INR",
      name: s.merchantDisplayName || MERCHANT_FALLBACK,
      description: input.description,
    }
    if (input.prefill && (input.prefill.name || input.prefill.email)) options.prefill = { ...input.prefill }
    return { kind: "razorpay", options }
  }
  const isStub = s ? s.provider === "stub" || (!s.provider && s.orderId.startsWith(STUB_ORDER_PREFIX)) : false
  if (isStub && input.stubAllowed) return { kind: "stub" }
  return { kind: "unavailable", message: "Online payment isn't available right now." }
}
