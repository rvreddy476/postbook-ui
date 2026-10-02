/*
  Passes and Boost (lane P2), through payments-service:

    GET  /premium/catalogue               what is sold, priced by the server
    POST /premium/purchases               {product, idempotency_key} → purchase + client_session
    GET  /premium/purchases/:id/payment   confirming | paid | failed
    GET  /premium/me                      the pass, entitlements, boost balance

  Rules held here and tested:
    * the request never carries a price (the server refuses one);
    * the Razorpay dialog opens from `client_session` alone, never from the
      build environment;
    * "paid" comes only from GET …/payment. The dialog's result, and the
      status on the purchase POST, are not a verdict.
  These are one-off passes: nothing here recurs.
*/

import { arr, bool, num, obj, str, strList, time } from "./wire"

/* ── catalogue ───────────────────────────────────────────────────── */

export interface Product {
  id: string
  kind: string
  name: string
  amountMinor: number
  currency: string
  durationDays: number
  features: string[]
  /** How many Super Sparks a pack adds; 0 for every other product. */
  quantity: number
}

export function toCatalogue(wire: unknown): Product[] {
  return arr(obj(wire).products)
    .map((raw) => {
      const p = obj(raw)
      return {
        id: str(p.id),
        kind: str(p.kind),
        name: str(p.name),
        amountMinor: num(p.amount_minor),
        currency: str(p.currency) || "INR",
        durationDays: num(p.duration_days),
        features: strList(p.features),
        quantity: num(p.quantity),
      }
    })
    .filter((p) => p.id && p.amountMinor > 0)
}

const FEATURE_LABELS: Record<string, string> = {
  daily_boost: "One Boost every day",
  match_extend: "Extra time on a match",
}

/** Alphabetical; an unknown feature code is not drawn. */
export function featureLabels(features: string[]): string[] {
  return features
    .map((f) => FEATURE_LABELS[f] || "")
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
}

export function productTitle(p: Pick<Product, "kind" | "durationDays" | "name"> & { quantity?: number }): string {
  if (p.kind === "boost") return "Boost"
  if (p.kind === "super_spark" && (p.quantity ?? 0) > 0) return `${p.quantity} Super Sparks`
  if (p.kind === "pass" && p.durationDays > 0) return `${p.durationDays}-day pass`
  return p.name || "Pass"
}

export function productBlurb(p: Pick<Product, "kind" | "durationDays">): string {
  if (p.kind === "boost") return "Puts your profile near the top of decks for a while. One use."
  if (p.kind === "super_spark") return "Stand out: they see it marked and at the top of their list. Kept until you use them."
  if (p.durationDays > 0) return `One payment. Ends by itself after ${p.durationDays} days.`
  return "One payment."
}

export function formatAmount(amountMinor: number, currency: string, locale = "en-IN"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: currency || "INR", maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2 }).format(amountMinor / 100)
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`
  }
}

/* ── purchase ────────────────────────────────────────────────────── */

export interface PurchaseBody {
  product: string
  idempotency_key: string
}

/** No amount, price or currency: the server answers CLIENT_PRICE_REFUSED to any of them. */
export function purchaseBody(productId: string, idempotencyKey: string): PurchaseBody {
  return { product: productId, idempotency_key: idempotencyKey }
}

export interface Purchase {
  id: string
  product: string
  amountMinor: number
  currency: string
  status: string
  provider: string
  keyId: string
  providerOrderId: string
  merchantName: string
}

export function toPurchase(wire: unknown): Purchase {
  const w = obj(wire)
  const p = obj(w.purchase)
  const session = obj(w.client_session)
  return {
    id: str(p.id),
    product: str(p.product),
    amountMinor: num(p.amount_minor),
    currency: str(p.currency) || "INR",
    status: str(p.status),
    provider: str(session.provider),
    keyId: str(session.key_id),
    providerOrderId: str(session.order_id),
    merchantName: str(session.merchant_display_name),
  }
}

export const MERCHANT_FALLBACK_NAME = "Pulse"

export interface RazorpayOpenOptions {
  key: string
  order_id: string
  amount: number
  currency: string
  name: string
  description?: string
}

/** The dialog's options from the purchase alone; null when there is no usable Razorpay session. */
export function razorpayOptions(purchase: Purchase, description?: string): RazorpayOpenOptions | null {
  if (purchase.provider !== "razorpay" || !purchase.keyId || !purchase.providerOrderId || purchase.amountMinor <= 0) return null
  const options: RazorpayOpenOptions = {
    key: purchase.keyId,
    order_id: purchase.providerOrderId,
    amount: purchase.amountMinor,
    currency: purchase.currency,
    name: purchase.merchantName || MERCHANT_FALLBACK_NAME,
  }
  if (description) options.description = description
  return options
}

/* ── the read that decides ───────────────────────────────────────── */

export type PaymentState = "confirming" | "paid" | "failed"

export interface PaymentReading {
  state: PaymentState
  /** "" | pending | partially_refunded | refunded */
  refundStatus: string
}

const REFUNDS: ReadonlySet<string> = new Set(["pending", "partially_refunded", "refunded"])

export function toPaymentReading(wire: unknown): PaymentReading {
  const w = obj(wire)
  const status = str(w.status)
  const refund = str(w.refund_status)
  return {
    state: status === "paid" ? "paid" : status === "failed" ? "failed" : "confirming",
    refundStatus: REFUNDS.has(refund) ? refund : "",
  }
}

/* ── the poll (the shop's schedule, restated for Pulse) ──────────── */

export const POLL_DELAYS_MS: readonly number[] = [1000, 2000, 3000, 4000]
export const POLL_STEADY_MS = 5000
export const POLL_TIMEOUT_MS = 180_000

export type PollPhase = "confirming" | "paid" | "failed" | "timed_out" | "stopped"

export interface PollState {
  phase: PollPhase
  reads: number
  elapsedMs: number
  refundStatus: string
}

export const initialPoll: PollState = { phase: "confirming", reads: 0, elapsedMs: 0, refundStatus: "" }

export const pollDone = (s: Pick<PollState, "phase">) => s.phase !== "confirming"

/** Wait this long then read; null when the poll is over, timed out or the tab is hidden. */
export function nextPollDelay(state: PollState, visible: boolean): number | null {
  if (pollDone(state) || !visible || state.elapsedMs >= POLL_TIMEOUT_MS) return null
  return state.reads < POLL_DELAYS_MS.length ? POLL_DELAYS_MS[state.reads] : POLL_STEADY_MS
}

const timedOut = (s: PollState): PollState => (s.elapsedMs >= POLL_TIMEOUT_MS ? { ...s, phase: "timed_out" } : s)

export function afterRead(state: PollState, waitedMs: number, reading: PaymentReading): PollState {
  const next: PollState = { ...state, reads: state.reads + 1, elapsedMs: state.elapsedMs + waitedMs, refundStatus: reading.refundStatus }
  if (reading.state === "paid") return { ...next, phase: "paid" }
  if (reading.state === "failed") return { ...next, phase: "failed" }
  return timedOut(next)
}

/** A read that failed: a permanent 4xx ends the poll; anything else is "not known yet". */
export function afterReadError(state: PollState, waitedMs: number, httpStatus: number): PollState {
  const next: PollState = { ...state, reads: state.reads + 1, elapsedMs: state.elapsedMs + waitedMs }
  const permanent = httpStatus >= 400 && httpStatus < 500 && httpStatus !== 408 && httpStatus !== 429
  return permanent ? { ...next, phase: "stopped" } : timedOut(next)
}

/* ── what I hold ─────────────────────────────────────────────────── */

export interface MyPremium {
  hasPass: boolean
  passProduct: string
  passExpiresAt: string
  boostBalance: number
  /** Purchased Super Sparks not yet used (absent on the wire means 0). */
  superSparkBalance: number
  features: string[]
}

export function toMyPremium(wire: unknown): MyPremium {
  const w = obj(wire)
  const pass = obj(w.pass)
  const active = bool(pass.active)
  return {
    hasPass: active,
    passProduct: active ? str(pass.product) : "",
    passExpiresAt: active ? time(pass.expires_at) : "",
    boostBalance: num(w.boost_balance),
    superSparkBalance: num(w.super_spark_balance),
    features: arr(w.entitlements)
      .map(obj)
      .filter((e) => bool(e.active))
      .map((e) => str(e.feature))
      .filter(Boolean),
  }
}

export function passLine(me: MyPremium, locale?: string): string {
  if (!me.hasPass) return "You don't have a pass right now."
  if (!me.passExpiresAt) return "Your pass is active."
  const date = new Date(me.passExpiresAt).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })
  return `Your pass is active until ${date}. It ends by itself.`
}

export function boostLine(me: Pick<MyPremium, "boostBalance">): string {
  return me.boostBalance === 1 ? "1 Boost to use" : `${me.boostBalance} Boosts to use`
}
