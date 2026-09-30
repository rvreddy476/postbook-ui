/*
  The payment leg, on the wire (commerce-contract.md §4.3–4.7):

    POST /orders/:id/payment/intent  → the intent + `client_session`
    GET  /orders/:id/payment         → confirming | paid | failed  (C1)
    GET  /orders/:id/payment/status  → the legacy shape, the fallback
    POST /orders/:id/payment/confirm → stub only, dev only

  Two rules live here and are tested:

    * the Razorpay dialog is opened from `client_session` — the key, the
      order id, the merchant name — and from NOTHING compiled into the
      bundle. A key baked into the app can disagree with the environment
      that minted the order and fail in a way nobody can diagnose; the
      server's session always matches its own order. Nothing in this file
      reads the build environment, and a test holds it to that.
    * the "Simulate payment (dev)" button exists only for a stub intent.
*/

/* ── wire: POST /orders/:id/payment/intent ───────────────────────── */

export interface WireClientSession {
  provider?: string
  order_id?: string
  key_id?: string
  merchant_display_name?: string
}

export interface WirePaymentIntent {
  payment_intent_id: string
  amount_minor: number
  currency: string
  provider_ref?: string
  status: string
  client_session?: WireClientSession
}

export type PaymentProvider = "razorpay" | "stub" | "unknown"

/**
  The order ids the stub gateway mints all start with this
  (payments-service internal/gateway/stub.go StubOrderPrefix). In stub mode
  payments-service runs with no provider adapter, so today it sends no
  `client_session` at all; the prefix is the one fact that still says
  "stub". When C1 lands `client_session.provider = "stub"` that wins.
*/
export const STUB_ORDER_PREFIX = "order_stub_"

export interface PaymentIntent {
  id: string
  amountMinor: number
  currency: string
  providerRef: string
  status: string
  provider: PaymentProvider
  /** Razorpay only. */
  keyId: string
  providerOrderId: string
  merchantName: string
}

export function toPaymentIntent(wire: WirePaymentIntent): PaymentIntent {
  const session = wire.client_session || {}
  const providerRef = wire.provider_ref || ""
  let provider: PaymentProvider = "unknown"
  if (session.provider === "razorpay") provider = "razorpay"
  else if (session.provider === "stub") provider = "stub"
  else if (!session.provider && providerRef.startsWith(STUB_ORDER_PREFIX)) provider = "stub"
  return {
    id: wire.payment_intent_id || "",
    amountMinor: Number(wire.amount_minor) || 0,
    currency: wire.currency || "INR",
    providerRef,
    status: wire.status || "",
    provider,
    keyId: session.key_id || "",
    providerOrderId: session.order_id || providerRef,
    merchantName: session.merchant_display_name || "",
  }
}

/** The only condition under which the dev button is drawn. */
export function showsStubButton(intent: Pick<PaymentIntent, "provider"> | null | undefined): boolean {
  return intent?.provider === "stub"
}

/* ── Razorpay ────────────────────────────────────────────────────── */

export const MERCHANT_FALLBACK_NAME = "MStore"

export interface RazorpayOpenOptions {
  key: string
  order_id: string
  amount: number
  currency: string
  name: string
  description?: string
  prefill?: { name?: string; email?: string; contact?: string }
}

export interface PayerPrefill {
  name?: string
  email?: string
  contact?: string
}

/**
  The options handed to `new Razorpay(...)`, from the intent alone. Throws
  when the session is not a Razorpay one or is missing its key or order id:
  opening the dialog with a blank key shows the buyer a Razorpay error page
  that names nothing we can act on, so the refusal happens here, with a
  message the screen can show.
*/
export function razorpayOptions(intent: PaymentIntent, input: { orderNumber?: string; prefill?: PayerPrefill } = {}): RazorpayOpenOptions {
  if (intent.provider !== "razorpay") throw new Error("not a razorpay intent")
  if (!intent.keyId || !intent.providerOrderId) throw new Error("razorpay session incomplete")
  const options: RazorpayOpenOptions = {
    key: intent.keyId,
    order_id: intent.providerOrderId,
    amount: intent.amountMinor,
    currency: intent.currency,
    name: intent.merchantName || MERCHANT_FALLBACK_NAME,
  }
  if (input.orderNumber) options.description = `Order ${input.orderNumber}`
  const prefill: PayerPrefill = {}
  if (input.prefill?.name) prefill.name = input.prefill.name
  if (input.prefill?.email) prefill.email = input.prefill.email
  if (input.prefill?.contact) prefill.contact = input.prefill.contact
  if (Object.keys(prefill).length) options.prefill = prefill
  return options
}

/** name/email for the dialog from the cached session user; email only if the login id is one. */
export function prefillFromSession(user: { name?: string; loginId?: string } | null | undefined): PayerPrefill {
  const out: PayerPrefill = {}
  if (user?.name) out.name = user.name
  if (user?.loginId && user.loginId.includes("@")) out.email = user.loginId
  return out
}

/* ── the stub settlement (dev) ───────────────────────────────────── */

export interface StubConfirmBody {
  payment_intent_id: string
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
  amount_minor: number
  gateway: "stub"
}

/**
  `POST /orders/:id/payment/confirm` binds all three razorpay_* fields as
  required (handler.go confirmPaymentReq) even for the stub, whose gateway
  accepts any signature. The order id is the intent's provider ref — the
  service checks the intent it bound, never one the client names.
*/
export function stubConfirmBody(intent: PaymentIntent, now: () => number = () => Date.now()): StubConfirmBody {
  if (intent.provider !== "stub") throw new Error("not a stub intent")
  return {
    payment_intent_id: intent.id,
    razorpay_order_id: intent.providerOrderId,
    razorpay_payment_id: `stub_pay_${now()}`,
    razorpay_signature: "stub",
    amount_minor: intent.amountMinor,
    gateway: "stub",
  }
}

/* ── the intent, handed from checkout to the order page ──────────── */

/** The slice of Storage the handoff needs; sessionStorage in the browser. */
export interface IntentStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const INTENT_PREFIX = "shop.payment.intent."

/**
  Checkout opens the intent, then goes straight to the order page. The
  page needs the same intent to draw the stub button (or to reopen
  Razorpay after a dismissed dialog) without a second POST on arrival, so
  the wire intent rides along in sessionStorage under the order id. Lost
  storage costs one extra intent POST on "Complete payment", nothing more.
*/
export function rememberIntent(store: IntentStore | null, orderId: string, wire: WirePaymentIntent): void {
  if (!store || !orderId) return
  try {
    store.setItem(INTENT_PREFIX + orderId, JSON.stringify(wire))
  } catch {
    /* storage refused; the order page will ask the server */
  }
}

export function recallIntent(store: IntentStore | null, orderId: string): WirePaymentIntent | null {
  if (!store || !orderId) return null
  try {
    const raw = store.getItem(INTENT_PREFIX + orderId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WirePaymentIntent
    return parsed && typeof parsed === "object" && parsed.payment_intent_id ? parsed : null
  } catch {
    return null
  }
}

export function forgetIntent(store: IntentStore | null, orderId: string): void {
  if (!store || !orderId) return
  try {
    store.removeItem(INTENT_PREFIX + orderId)
  } catch {
    /* nothing to forget */
  }
}

/* ── the three-state read, and the legacy one ────────────────────── */

export type PaymentState = "confirming" | "paid" | "failed"
export type RefundStatus = "" | "pending" | "partially_refunded" | "refunded"

/** GET /orders/:id/payment (C1; the shape of food-service order_payment_get_200_*). */
export interface WireOrderPayment {
  order_id: string
  status: string
  amount_minor: number
  currency: string
  refund_status: string | null
  updated_at: string
}

/** GET /orders/:id/payment/status (service/checkout_p0.go PaymentStatus). */
export interface WirePaymentStatus {
  order_id: string
  order_status: string
  payment_status: string
  provider_status?: string
}

export interface PaymentReading {
  state: PaymentState
  refundStatus: RefundStatus
}

const REFUNDS: ReadonlySet<string> = new Set(["pending", "partially_refunded", "refunded"])

export function readingFromPayment(wire: WireOrderPayment): PaymentReading {
  const state: PaymentState = wire.status === "paid" ? "paid" : wire.status === "failed" ? "failed" : "confirming"
  const refund = wire.refund_status || ""
  return { state, refundStatus: REFUNDS.has(refund) ? (refund as RefundStatus) : "" }
}

/** The order states in which an unpaid order will never be paid. */
const DEAD_ORDER_STATES: ReadonlySet<string> = new Set(["cancelled", "expired"])

/**
  The legacy route has no verdict of its own; this derives one the same way
  C1's route does: paid only from `payment_status === "paid"`, failed from
  `payment_status === "failed"` or an order that died before payment.
*/
export function readingFromLegacyStatus(wire: WirePaymentStatus): PaymentReading {
  if (wire.payment_status === "paid") return { state: "paid", refundStatus: "" }
  if (wire.payment_status === "failed" || DEAD_ORDER_STATES.has(wire.order_status)) {
    return { state: "failed", refundStatus: "" }
  }
  return { state: "confirming", refundStatus: "" }
}
