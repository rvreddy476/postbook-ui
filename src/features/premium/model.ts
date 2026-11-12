/*
  Momentum Premium on the wire, and every decision the /premium page makes,
  as pure functions (the tests live in __tests__/premium.test.tsx).

  Server: monetization-service internal/http/premium_handler.go, behind the
  gateway at /v1/monetization/premium. Every response is wrapped in
  {"data": …}; errors are {"error": {"code", "message"}}.

    GET  /premium/plans            {plans:[{code,name,duration_days,price_paise|null,taxable_paise|null,
                                            gst_paise|null,total_paise|null,gst_rate_bp|null,
                                            prices_exclude_gst,tax_provisional,currency,available}]}
    POST /premium/checkout         {"plan":"premium_30d"} and NOTHING else (DisallowUnknownFields)
                                   → 201 {pass_id,plan,duration_days,status:"pending_payment",
                                          amount_paise,currency,intent_id,client_session|null,
                                          taxable_paise,gst_paise,total_paise,gst_rate_bp,…}
    GET  /premium/me               {active,in_grace,ends_at|null,grace_ends_at|null,renewal_plans}
    GET  /premium/passes/:passId   {pass_id,plan,status:"confirming|paid|failed|refunded",amount_paise,
                                    taxable_paise,gst_paise,total_paise,gst_rate_bp,…}

  Prices EXCLUDE GST (founder, 13 Nov 2026). price_paise is the taxable
  value; GST is added on top and total_paise (= checkout amount_paise) is
  what the buyer pays. The page shows the server's numbers only: no tax is
  ever computed here. Golden bodies: monetization-service
  testdata/contracts/premium, copied into __tests__/fixtures.

  The money rule (founder): payments-service takes the money and a pass is
  granted only by its signed payment event. Nothing here confirms anything.
  The client never sends an amount: the checkout body is built by
  `checkoutRequest` alone and carries the plan code only. The amount in the
  Razorpay options is the server's `amount_paise`, handed back to Razorpay
  for its dialog, never sent to our server. After the dialog, the pass's
  status — read by polling — is the only verdict.
*/

import { delayForRead, isPermanentStatus } from "@/features/shop/orders/paymentPoll"
import { formatDate, formatPrice, MERCHANT_FALLBACK_NAME } from "@/features/memberships/model"

export const PREMIUM_BASE = "/v1/monetization/premium"

/* ── small readers ──────────────────────────────────────────────── */

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const str = (v: unknown): string => (typeof v === "string" ? v : "")
const int = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : 0)

/** The service's envelope: {"data": …}. A bare body is read as is. */
export function unwrap(body: unknown): unknown {
  const o = obj(body)
  return "data" in o ? o.data : body
}

/* ── GST (prices exclude it) ────────────────────────────────────── */

const paiseOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.trunc(v) : null)

/** The server's GST split of one price. Read, never computed. */
export interface PremiumTax {
  taxablePaise: number
  gstPaise: number
  totalPaise: number
  /** 1800 = 18%. */
  rateBp: number
  provisional: boolean
}

/**
  The breakdown from a plan, checkout or pass body, or null when the server
  sent none (a pass opened before 13 Nov 2026, a plan with no price). All
  four numbers must be there: a half breakdown is not shown.
*/
export function toTax(v: unknown): PremiumTax | null {
  const o = obj(v)
  const taxable = paiseOrNull(o.taxable_paise)
  const gst = paiseOrNull(o.gst_paise)
  const total = paiseOrNull(o.total_paise)
  const rate = paiseOrNull(o.gst_rate_bp)
  if (taxable === null || gst === null || total === null || rate === null || total <= 0) return null
  return { taxablePaise: taxable, gstPaise: gst, totalPaise: total, rateBp: rate, provisional: o.tax_provisional === true }
}

/** Rupees from paise, en-IN: "₹149", "₹26.82", "₹1,768.82". */
export const rupees = (paise: number): string => formatPrice(paise, "en-IN")

/** "18%" from 1800 basis points; "12.5%" from 1250. */
export function gstRate(rateBp: number): string {
  return `${Number((rateBp / 100).toFixed(2))}%`
}

/** "₹149 + ₹26.82 GST (18%) = ₹175.82", the server's numbers as they are. */
export function breakdownLine(t: PremiumTax): string {
  return `${rupees(t.taxablePaise)} + ${rupees(t.gstPaise)} GST (${gstRate(t.rateBp)}) = ${rupees(t.totalPaise)}`
}

/* ── plans ──────────────────────────────────────────────────────── */

export interface PremiumPlan {
  code: string
  name: string
  durationDays: number
  /** The price before GST; null while the founder has not set a price. */
  pricePaise: number | null
  /** The server's GST on top of it; null when it could not be worked out. */
  tax: PremiumTax | null
  currency: string
  available: boolean
}

export function toPlan(v: unknown): PremiumPlan | null {
  const o = obj(v)
  const code = str(o.code)
  if (!code) return null
  return {
    code,
    name: str(o.name),
    durationDays: int(o.duration_days),
    pricePaise: paiseOrNull(o.price_paise),
    tax: toTax(o),
    currency: str(o.currency) || "INR",
    available: o.available === true,
  }
}

function toPlanList(v: unknown): PremiumPlan[] {
  return (Array.isArray(v) ? v : []).map(toPlan).filter((p): p is PremiumPlan => p !== null)
}

export function toPlans(body: unknown): PremiumPlan[] {
  return toPlanList(obj(unwrap(body)).plans)
}

/**
  A plan can be bought only with a price the server set, its GST and total
  (never shown at the pre-tax price alone), AND its own yes.
*/
export function canBuy(plan: PremiumPlan): boolean {
  return plan.available && plan.pricePaise !== null && plan.pricePaise > 0 && plan.tax !== null
}

export const NOT_AVAILABLE = "Not available"

/** "₹149" (en-IN, before GST), or "Not available" when it can't be bought. */
export function planPrice(plan: PremiumPlan): string {
  if (!canBuy(plan) || plan.pricePaise === null) return NOT_AVAILABLE
  return rupees(plan.pricePaise)
}

/** The card's breakdown line, or "" when the plan can't be bought. */
export function planBreakdown(plan: PremiumPlan): string {
  return canBuy(plan) && plan.tax ? breakdownLine(plan.tax) : ""
}

/** The pass's length in words: "30 days", "365 days", "1 day". */
export function planLength(plan: Pick<PremiumPlan, "durationDays">): string {
  return `${plan.durationDays} ${plan.durationDays === 1 ? "day" : "days"}`
}

/** The card's heading: the server's name, else the length. */
export function planTitle(plan: PremiumPlan): string {
  return plan.name || `Premium for ${planLength(plan)}`
}

/* ── my status ──────────────────────────────────────────────────── */

export interface PremiumStatus {
  active: boolean
  inGrace: boolean
  endsAt: string | null
  graceEndsAt: string | null
  renewalPlans: PremiumPlan[]
}

export function toStatus(body: unknown): PremiumStatus {
  const o = obj(unwrap(body))
  return {
    active: o.active === true,
    inGrace: o.in_grace === true,
    endsAt: str(o.ends_at) || null,
    graceEndsAt: str(o.grace_ends_at) || null,
    renewalPlans: toPlanList(o.renewal_plans),
  }
}

export interface StatusWords {
  tone: "active" | "grace" | "none"
  title: string
  detail: string
}

/** What the page says about the viewer's Premium, from GET /premium/me. */
export function statusWords(s: PremiumStatus): StatusWords {
  if (s.active && s.inGrace) {
    const end = formatDate(s.graceEndsAt ?? s.endsAt ?? "")
    return {
      tone: "grace",
      title: end ? `Premium ends on ${end}` : "Premium is ending",
      detail: "Renew to keep posting on Echo.",
    }
  }
  if (s.active) {
    const end = formatDate(s.endsAt ?? "")
    return { tone: "active", title: end ? `Premium is active until ${end}` : "Premium is active", detail: "Buying another pass adds its days on top." }
  }
  return { tone: "none", title: "You don't have Premium", detail: "Buy a pass below to start posting on Echo." }
}

/** What Premium gives today. Honest: Echo posting is the only perk that exists. */
export const PREMIUM_PERKS: readonly string[] = [
  "Post on Echo: notes, threads and quotes.",
]

export const NO_AUTO_RENEW = "No auto-renew: we'll remind you 3 days before it ends."

/* ── checkout ───────────────────────────────────────────────────── */

/**
  The one checkout request. Its body is exactly {"plan": code}: the server
  refuses any other field with 400, and an amount from the client would
  break the money rule.
*/
export function checkoutRequest(planCode: string): { url: string; body: { plan: string } } {
  return { url: `${PREMIUM_BASE}/checkout`, body: { plan: planCode } }
}

export function passUrl(passId: string): string {
  return `${PREMIUM_BASE}/passes/${encodeURIComponent(passId)}`
}

export interface ClientSession {
  provider: string
  orderId: string
  keyId: string
  merchantName: string
}

export interface PremiumCheckout {
  passId: string
  plan: string
  durationDays: number
  status: string
  amountPaise: number
  currency: string
  intentId: string
  session: ClientSession | null
  /** The GST split of amountPaise; null on a pass opened before 13 Nov 2026. */
  tax: PremiumTax | null
}

export function toCheckout(body: unknown): PremiumCheckout {
  const o = obj(unwrap(body))
  const s = o.client_session ? obj(o.client_session) : null
  return {
    passId: str(o.pass_id),
    plan: str(o.plan),
    durationDays: int(o.duration_days),
    status: str(o.status),
    amountPaise: int(o.amount_paise),
    currency: str(o.currency) || "INR",
    intentId: str(o.intent_id),
    tax: toTax(o),
    session: s
      ? { provider: str(s.provider), orderId: str(s.order_id), keyId: str(s.key_id), merchantName: str(s.merchant_display_name) }
      : null,
  }
}

export interface RazorpayOpen {
  key: string
  order_id: string
  amount: number
  currency: string
  name: string
  description: string
}

/**
  The Razorpay dialog's options, from the server's client_session only (the
  same rule as memberships and the shop: no key from the build). null when
  there is nothing the web can open.
*/
export function razorpayOptions(c: PremiumCheckout, description: string): RazorpayOpen | null {
  const s = c.session
  if (!c.passId || !s || s.provider !== "razorpay" || !s.keyId || !s.orderId || c.amountPaise <= 0) return null
  if (checkoutAmountsDisagree(c)) return null
  return { key: s.keyId, order_id: s.orderId, amount: c.amountPaise, currency: c.currency, name: s.merchantName || MERCHANT_FALLBACK_NAME, description }
}

/**
  The server says the charge (amount_paise) is the GST total; if the two
  ever disagree the dialog is not opened (the server answers
  PREMIUM_AMOUNT_MISMATCH for the same thing on its side).
*/
export function checkoutAmountsDisagree(c: Pick<PremiumCheckout, "amountPaise" | "tax">): boolean {
  return c.tax !== null && c.tax.totalPaise !== c.amountPaise
}

/* ── the pass poll ──────────────────────────────────────────────── */

export type PassStatus = "confirming" | "paid" | "failed" | "refunded"

/** What a paid pass cost: the total charged and, when sent, its GST split. */
export interface PremiumReceipt {
  amountPaise: number
  tax: PremiumTax | null
}

export interface PassReading {
  passId: string
  status: PassStatus
  endsAt: string | null
  receipt: PremiumReceipt | null
}

export function toPass(body: unknown): PassReading {
  const o = obj(unwrap(body))
  const raw = str(o.status)
  const status: PassStatus = raw === "paid" || raw === "failed" || raw === "refunded" ? raw : "confirming"
  const amount = int(o.amount_paise)
  const tax = toTax(o)
  const receipt = amount > 0 || tax ? { amountPaise: amount > 0 ? amount : (tax?.totalPaise ?? 0), tax } : null
  return { passId: str(o.pass_id), status, endsAt: str(o.ends_at) || null, receipt }
}

export interface ReceiptLine {
  label: string
  value: string
}

/** The success view's lines: Price, GST (18%), Total paid. */
export function receiptLines(r: PremiumReceipt): ReceiptLine[] {
  if (!r.tax) return [{ label: "Total paid", value: rupees(r.amountPaise) }]
  return [
    { label: "Price", value: rupees(r.tax.taxablePaise) },
    { label: `GST (${gstRate(r.tax.rateBp)})`, value: rupees(r.tax.gstPaise) },
    { label: "Total paid", value: rupees(r.amountPaise) },
  ]
}

/** The confirm step's lines: Price, GST (18%), Total to pay — the checkout's numbers. */
export function checkoutLines(c: Pick<PremiumCheckout, "amountPaise" | "tax">): ReceiptLine[] {
  if (!c.tax) return [{ label: "Total to pay", value: rupees(c.amountPaise) }]
  return [
    { label: "Price", value: rupees(c.tax.taxablePaise) },
    { label: `GST (${gstRate(c.tax.rateBp)})`, value: rupees(c.tax.gstPaise) },
    { label: "Total to pay", value: rupees(c.amountPaise) },
  ]
}

/** About two minutes, then "still confirming" (the payment may yet land). */
export const PASS_POLL_TIMEOUT_MS = 120_000

export interface PassPoll {
  phase: "confirming" | "paid" | "failed" | "refunded" | "timed_out" | "stopped"
  reads: number
  elapsedMs: number
  endsAt: string | null
  /** What the pass cost, from the read that ended the poll. */
  receipt: PremiumReceipt | null
  /** The HTTP status that ended a `stopped` poll. */
  stoppedByStatus: number
}

export const initialPassPoll: PassPoll = { phase: "confirming", reads: 0, elapsedMs: 0, endsAt: null, receipt: null, stoppedByStatus: 0 }

export const passPollDone = (p: Pick<PassPoll, "phase">) => p.phase !== "confirming"

/**
  The wait before the next read, or null when the poll is over. The waits
  are the shop's (1, 2, 3, 4 s, then every 5 s); the ceiling is ours and is
  never overshot: a wait that would pass it is cut short to land on it.
*/
export function nextPassWait(p: PassPoll): number | null {
  if (passPollDone(p) || p.elapsedMs >= PASS_POLL_TIMEOUT_MS) return null
  return Math.min(delayForRead(p.reads), PASS_POLL_TIMEOUT_MS - p.elapsedMs)
}

function dueOut(p: PassPoll): PassPoll {
  return p.phase === "confirming" && p.elapsedMs >= PASS_POLL_TIMEOUT_MS ? { ...p, phase: "timed_out" } : p
}

/** A read that answered, after a wait of `waitedMs`. */
export function passPollRead(p: PassPoll, waitedMs: number, reading: PassReading): PassPoll {
  const next: PassPoll = { ...p, reads: p.reads + 1, elapsedMs: p.elapsedMs + waitedMs }
  if (reading.status !== "confirming") return { ...next, phase: reading.status, endsAt: reading.endsAt, receipt: reading.receipt }
  return dueOut(next)
}

/** A read that failed: a permanent 4xx ends it; anything else keeps asking. */
export function passPollError(p: PassPoll, waitedMs: number, httpStatus: number): PassPoll {
  const next: PassPoll = { ...p, reads: p.reads + 1, elapsedMs: p.elapsedMs + waitedMs }
  if (isPermanentStatus(httpStatus)) return { ...next, phase: "stopped", stoppedByStatus: httpStatus }
  return dueOut(next)
}

/* ── errors ─────────────────────────────────────────────────────── */

export interface PremiumError {
  status: number
  code: string
}

export function toPremiumError(err: unknown): PremiumError {
  const response = obj(obj(err).response)
  const e = obj(obj(response.data).error)
  return { status: int(response.status), code: str(e.code) }
}

/** PREMIUM_NOT_ENABLED: the whole feature is switched off on the server. */
export function isPremiumOff(err: unknown): boolean {
  return toPremiumError(err).code === "PREMIUM_NOT_ENABLED"
}

export const PREMIUM_WORDS = {
  notEnabled: "Premium is not available yet",
  notEnabledDetail: "We'll let you know when you can get it.",
  priceNotSet: "This pass can't be bought yet.",
  taxUnavailable: "This pass can't be bought right now: we couldn't work out its GST. You haven't been charged. Try again later.",
  amountMismatch: "The price changed while checkout was opening. You haven't been charged. Reload the page and try again.",
  unknownPlan: "That pass isn't on sale any more. Pick another one.",
  paymentsUnavailable: "Payments are unavailable right now. Try again in a few minutes.",
  sessionUnavailable: "Checkout could not be opened. Try again.",
  notFound: "We couldn't find this payment.",
  maintenance: "Premium is paused for maintenance. Try again later.",
  badRequest: "Something went wrong starting checkout. Try again.",
  network: "No connection. Check your network and try again.",
  generic: "Something went wrong. Try again.",
  noOnlinePayment: "Online payment isn't available right now. Try again later.",
  failed: "The payment didn't go through. You haven't been charged for Premium.",
  refunded: "This payment was refunded, so Premium wasn't added.",
  stillConfirming: "We're still confirming your payment. If money left your account, Premium will be added or the money refunded. You can check again or come back later.",
  dismissed: "Payment wasn't completed.",
} as const

const ERROR_WORDS: Record<string, string> = {
  PREMIUM_NOT_ENABLED: PREMIUM_WORDS.notEnabled,
  PREMIUM_PRICE_NOT_SET: PREMIUM_WORDS.priceNotSet,
  PREMIUM_TAX_UNAVAILABLE: PREMIUM_WORDS.taxUnavailable,
  PREMIUM_AMOUNT_MISMATCH: PREMIUM_WORDS.amountMismatch,
  UNKNOWN_PLAN: PREMIUM_WORDS.unknownPlan,
  PREMIUM_PAYMENTS_UNAVAILABLE: PREMIUM_WORDS.paymentsUnavailable,
  PAYMENT_SESSION_UNAVAILABLE: PREMIUM_WORDS.sessionUnavailable,
  NOT_FOUND: PREMIUM_WORDS.notFound,
  MAINTENANCE: PREMIUM_WORDS.maintenance,
  BAD_REQUEST: PREMIUM_WORDS.badRequest,
  INTERNAL_ERROR: PREMIUM_WORDS.generic,
}

export function premiumErrorMessage(err: unknown): string {
  const e = toPremiumError(err)
  if (e.code && ERROR_WORDS[e.code]) return ERROR_WORDS[e.code]
  if (e.status === 0) return PREMIUM_WORDS.network
  return PREMIUM_WORDS.generic
}

/* ── the purchase, as a state machine ───────────────────────────── */

export type PurchasePhase =
  | { phase: "idle" }
  | { phase: "starting"; plan: string }
  /** The server's checkout is open: the breakdown is shown, nothing paid yet. */
  | { phase: "review"; plan: string; checkout: PremiumCheckout }
  | { phase: "dialog"; plan: string }
  | { phase: "confirming"; plan: string }
  | { phase: "paid"; endsAt: string | null; receipt: PremiumReceipt | null }
  | { phase: "failed"; message: string }
  | { phase: "still_confirming" }
  | { phase: "dismissed"; plan: string }
  /** PREMIUM_NOT_ENABLED at checkout: the switch went off under us. */
  | { phase: "unavailable" }
  | { phase: "error"; plan: string; message: string }

export type PurchaseEvent =
  | { type: "start"; plan: string }
  | { type: "started"; canOpen: boolean; checkout: PremiumCheckout }
  | { type: "start_failed"; error: unknown }
  /** Pay pressed on the review: the Razorpay dialog opens. */
  | { type: "pay" }
  | { type: "dialog_completed" }
  | { type: "dialog_dismissed" }
  | { type: "poll"; poll: PassPoll }
  | { type: "check_again" }
  | { type: "reset" }

export const idlePurchase: PurchasePhase = { phase: "idle" }

const planOf = (s: PurchasePhase): string => ("plan" in s ? s.plan : "")

export function purchaseReducer(state: PurchasePhase, event: PurchaseEvent): PurchasePhase {
  switch (event.type) {
    case "start":
      return { phase: "starting", plan: event.plan }
    case "started":
      if (checkoutAmountsDisagree(event.checkout)) return { phase: "failed", message: PREMIUM_WORDS.amountMismatch }
      return event.canOpen ? { phase: "review", plan: planOf(state), checkout: event.checkout } : { phase: "failed", message: PREMIUM_WORDS.noOnlinePayment }
    case "pay":
      return state.phase === "review" ? { phase: "dialog", plan: state.plan } : state
    case "start_failed":
      if (isPremiumOff(event.error)) return { phase: "unavailable" }
      return { phase: "error", plan: planOf(state), message: premiumErrorMessage(event.error) }
    case "dialog_completed":
      return { phase: "confirming", plan: planOf(state) }
    case "dialog_dismissed":
      return state.phase === "dialog" ? { phase: "dismissed", plan: state.plan } : state
    case "poll": {
      const p = event.poll
      if (!passPollDone(p)) return state.phase === "confirming" ? state : { phase: "confirming", plan: planOf(state) }
      if (p.phase === "paid") return { phase: "paid", endsAt: p.endsAt, receipt: p.receipt }
      if (p.phase === "failed") return { phase: "failed", message: PREMIUM_WORDS.failed }
      if (p.phase === "refunded") return { phase: "failed", message: PREMIUM_WORDS.refunded }
      if (p.phase === "timed_out") return { phase: "still_confirming" }
      return { phase: "failed", message: p.stoppedByStatus === 404 ? PREMIUM_WORDS.notFound : PREMIUM_WORDS.generic }
    }
    case "check_again":
      return state.phase === "still_confirming" ? { phase: "confirming", plan: "" } : state
    case "reset":
      return idlePurchase
  }
}

/** Busy: the page must not take another Buy press. */
export function purchaseBusy(s: PurchasePhase): boolean {
  return s.phase === "starting" || s.phase === "review" || s.phase === "dialog" || s.phase === "confirming"
}

export function paidWords(endsAt: string | null): string {
  const end = endsAt ? formatDate(endsAt) : ""
  return end ? `Premium is active until ${end}` : "Premium is active"
}
