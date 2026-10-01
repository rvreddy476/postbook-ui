/*
  Bank offers (Razorpay Offers) as the shop shows them (coupons-offers
  contract §A, 1 Oct 2026).

  An offer is a PAYMENT-side instrument: the order total does not move;
  the bank's discount is taken off what the card or UPI app is charged,
  inside the Razorpay payment sheet. So the shop only ever LISTS offers
  (GET /payment-offers?amount_minor=) and, after the fact, reads what the
  order says was applied (`payment_offer`, `amount_paid_minor`). Every
  figure is the server's; nothing here works a discount out.
*/

/** One row of GET /v1/commerce/payment-offers. */
export interface WirePaymentOffer {
  id?: string
  title?: string
  description?: string
  payment_method?: string
  discount_type?: string
  /** Basis points for a percentage, paise for a flat offer. Shown only through the server's estimate. */
  discount_value?: number
  max_discount_minor?: number | null
  min_amount_minor?: number | null
  ends_at?: string | null
  /** Integer paise: what this offer would take off the amount asked about. */
  estimated_discount_minor?: number
}

export type OfferMethod = "card" | "upi" | "any"

export interface PaymentOffer {
  id: string
  title: string
  description: string
  method: OfferMethod
  /** The "Save up to" figure: the server's estimate, else the offer's cap, else 0 (no figure drawn). */
  saveUpToMinor: number
  endsAt: string
}

function positiveInt(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : 0
}

function readMethod(value: unknown): OfferMethod {
  return value === "card" || value === "upi" ? value : "any"
}

export function toPaymentOffer(wire: WirePaymentOffer): PaymentOffer | null {
  const title = (wire.title || "").trim()
  if (!wire.id || !title) return null
  return {
    id: wire.id,
    title,
    description: (wire.description || "").trim(),
    method: readMethod(wire.payment_method),
    saveUpToMinor: positiveInt(wire.estimated_discount_minor) || positiveInt(wire.max_discount_minor),
    endsAt: wire.ends_at || "",
  }
}

/** The list, `[]` or `{items}`; rows without an id or a title are dropped. Server order is kept. */
export function toPaymentOffers(data: unknown): PaymentOffer[] {
  const rows: unknown[] = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)
      ? (data as { items: unknown[] }).items
      : []
  const out: PaymentOffer[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const offer = toPaymentOffer(row as WirePaymentOffer)
    if (!offer || seen.has(offer.id)) continue
    seen.add(offer.id)
    out.push(offer)
  }
  return out
}

/** The words for an offer's method. */
export const OFFER_METHOD_LABEL: Record<OfferMethod, string> = {
  any: "Card or UPI",
  card: "Card",
  upi: "UPI",
}

/** "Save up to ₹150", or "" when the server gave no figure. */
export function saveUpToLine(offer: Pick<PaymentOffer, "saveUpToMinor">, formatMinor: (minor: number) => string): string {
  return offer.saveUpToMinor > 0 ? `Save up to ${formatMinor(offer.saveUpToMinor)}` : ""
}

/** The amount the offers are asked for: a positive integer of paise, or null (no request). */
export function offersAmount(minor: number | null | undefined): number | null {
  return typeof minor === "number" && Number.isSafeInteger(minor) && minor > 0 ? minor : null
}

/** The sentence under the checkout's offer list. The total stays; the bank's discount comes off the charge. */
export function offersSheetNote(totalMinor: number, formatMinor: (minor: number) => string): string {
  return `Bank offers apply in the Razorpay payment window when you pay with an eligible card or UPI. Your order total stays ${formatMinor(totalMinor)}; the offer comes off what you're charged.`
}

/* ── the order: what was applied ─────────────────────────────────── */

export interface WireOrderPaymentOffer {
  title?: string
  discount_minor?: number
}

export interface OrderPaymentOffer {
  title: string
  discountMinor: number
  /** What the buyer was actually charged; 0 when the server did not say. */
  paidMinor: number
}

/**
  The order page's "Bank offer −₹X · Paid ₹Y" line, from `payment_offer`
  and `amount_paid_minor` exactly as the order sends them. No offer, or an
  offer with no discount, draws nothing.
*/
export function orderPaymentOffer(wire: { payment_offer?: WireOrderPaymentOffer | null; amount_paid_minor?: number | null }): OrderPaymentOffer | null {
  const offer = wire.payment_offer
  if (!offer || typeof offer !== "object") return null
  const discountMinor = positiveInt(offer.discount_minor)
  if (!discountMinor) return null
  return {
    title: (offer.title || "").trim(),
    discountMinor,
    paidMinor: positiveInt(wire.amount_paid_minor),
  }
}

/** "Bank offer −₹150 · Paid ₹1,349" (the "Paid" half only when the server said what was paid). */
export function orderOfferLine(offer: OrderPaymentOffer, formatMinor: (minor: number) => string): string {
  const off = `Bank offer −${formatMinor(offer.discountMinor)}`
  return offer.paidMinor > 0 ? `${off} · Paid ${formatMinor(offer.paidMinor)}` : off
}
