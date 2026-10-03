/*
  Feast's payment leg.

    POST /orders/:id/payments/intents  {method}  → the intent (+ client_session)
    Razorpay (src/lib/razorpay.ts) from client_session ONLY, or the dev stub
    GET  /orders/:id/payment           → confirming | paid | failed (+ refund_status)

  "Paid" comes from the GET alone. The Razorpay handler's success only ends
  the dialog; the page keeps saying "Confirming payment" until the server,
  which hears the signature-verified webhook, says paid. A failed attempt
  keeps the order pending (15 min on the server), so a retry pays the SAME
  order with a new intent key.
*/

import type { OrderPayment, PaymentIntent } from "./wire"

/** Feast's application id, stamped on every key so a Feast attempt never mixes with MStore's. */
export const FEAST_PAYMENT_APPLICATION = "feast"

export type PaymentMethod = "upi" | "card"

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "card", label: "Card" },
  { value: "upi", label: "UPI" },
]

/* ── the reading ──────────────────────────────────────────────────── */

export type PaymentReading = "confirming" | "paid" | "failed" | "refund_pending" | "refunded"

const REFUND_DONE: ReadonlySet<string> = new Set(["refunded", "succeeded", "processed", "completed"])

/** The server's payment status, read. The only way to "paid". A refund outranks paid; unknown keeps confirming. */
export function readPayment(p: Pick<OrderPayment, "status" | "refundStatus">): PaymentReading {
  const refund = (p.refundStatus ?? "").trim().toLowerCase()
  if (refund && REFUND_DONE.has(refund)) return "refunded"
  if (refund) return "refund_pending"
  if (p.status === "paid") return "paid"
  if (p.status === "failed") return "failed"
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

export type PaymentRoute =
  | { kind: "razorpay"; options: RazorpayOpen }
  | { kind: "stub" }
  | { kind: "unavailable"; message: string }

export interface RazorpayOpen {
  key: string
  order_id: string
  amount: number
  currency: string
  name: string
  description: string
  prefill?: { name?: string; email?: string }
}

export const MERCHANT_FALLBACK = "Feast"

/**
  The route for an intent. Razorpay only from a complete razorpay
  client_session — never a key from the bundle. The stub only when the
  build allows it (NEXT_PUBLIC_ENABLE_STUB_PAYMENTS=true, passed in) AND
  the server minted a stub order.
*/
export function paymentRoute(
  intent: PaymentIntent,
  input: { orderNumber: string; stubAllowed: boolean; prefill?: { name?: string; email?: string } },
): PaymentRoute {
  const s = intent.clientSession
  if (s && s.provider === "razorpay") {
    if (!s.keyId || !s.orderId) return { kind: "unavailable", message: "Online payment isn't available right now." }
    const options: RazorpayOpen = {
      key: s.keyId,
      order_id: s.orderId,
      amount: intent.amountPaise,
      currency: intent.currency || "INR",
      name: s.merchantDisplayName || MERCHANT_FALLBACK,
      description: `Feast order ${input.orderNumber}`.trim(),
    }
    if (input.prefill && (input.prefill.name || input.prefill.email)) options.prefill = { ...input.prefill }
    return { kind: "razorpay", options }
  }
  const isStub = s ? s.provider === "stub" : intent.providerOrderId.startsWith(STUB_ORDER_PREFIX)
  if (isStub && input.stubAllowed) return { kind: "stub" }
  return { kind: "unavailable", message: "Online payment isn't available right now." }
}

/** The dev settlement body: the provider order the server bound, any signature (the stub accepts it). */
export function stubConfirmBody(intent: PaymentIntent, now: () => number = Date.now) {
  return {
    razorpay_order_id: intent.clientSession?.orderId || intent.providerOrderId,
    razorpay_payment_id: `stub_pay_${now()}`,
    razorpay_signature: "stub",
    amount_minor: intent.amountPaise,
  }
}

/* ── the intent key, per order ────────────────────────────────────── */

export interface KeyStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const INTENT_KEY_PREFIX = `${FEAST_PAYMENT_APPLICATION}.payment.intentKey.`

/** The key for this order's current payment attempt, saved before use. */
export function intentKeyFor(store: KeyStore | null, orderId: string, mint: () => string): string {
  const slot = INTENT_KEY_PREFIX + orderId
  try {
    const saved = store?.getItem(slot)
    if (saved) return saved
  } catch {
    /* fall through */
  }
  const key = mint()
  try {
    store?.setItem(slot, key)
  } catch {
    /* an unsaved key still works once */
  }
  return key
}

/** A retry is a new attempt: the next intent gets a new key. */
export function forgetIntentKey(store: KeyStore | null, orderId: string): void {
  try {
    store?.removeItem(INTENT_KEY_PREFIX + orderId)
  } catch {
    /* nothing */
  }
}
