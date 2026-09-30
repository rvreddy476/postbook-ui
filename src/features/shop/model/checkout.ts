/*
  Checkout on the wire, and the three rules the P0 contract puts on the
  client (commerce-contract.md §4, handler_p0.go PrepareQuote / CheckoutP0):

    1. the quote is the ONLY source of figures the screen may show, and
       `expected_total_minor` is the quote's `total_minor`, never a sum the
       client made;
    2. one Idempotency-Key per checkout ATTEMPT, kept across a retry of that
       attempt (a reload, a network error), fresh for a new quote;
    3. errors are branched on `code`, never on the message.

  Money is integer paise throughout (`*_minor`); nothing here touches a float.
*/

export type PaymentMethod = "upi" | "card"

/** The payment-method radio, in the order it is drawn. */
export const PAYMENT_METHODS: ReadonlyArray<{ value: PaymentMethod; label: string; hint: string }> = [
  { value: "card", label: "Card", hint: "Credit or debit card" },
  { value: "upi", label: "UPI", hint: "Google Pay, PhonePe, Paytm and every UPI app" },
]

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "upi" || value === "card"
}

/* ── wire: POST /checkout/quote ──────────────────────────────────── */

/** What `PrepareQuote` writes (service/checkout_p0.go QuoteResult). */
export interface WireQuote {
  quote_id: string
  subtotal_minor: number
  discount_minor: number
  shipping_minor: number
  tax_minor: number
  total_minor: number
  currency: string
  courier_code?: string
  expires_at: string
  serviceable: boolean
  reason?: string
}

export interface Quote {
  quoteId: string
  subtotalMinor: number
  discountMinor: number
  shippingMinor: number
  taxMinor: number
  totalMinor: number
  currency: string
  courierCode: string
  /** Epoch ms; 0 when the server sent nothing readable. */
  expiresAtMs: number
}

export function toQuote(wire: WireQuote): Quote {
  const expires = Date.parse(wire.expires_at || "")
  return {
    quoteId: wire.quote_id || "",
    subtotalMinor: Number(wire.subtotal_minor) || 0,
    discountMinor: Number(wire.discount_minor) || 0,
    shippingMinor: Number(wire.shipping_minor) || 0,
    taxMinor: Number(wire.tax_minor) || 0,
    totalMinor: Number(wire.total_minor) || 0,
    currency: wire.currency || "INR",
    courierCode: wire.courier_code || "",
    expiresAtMs: Number.isFinite(expires) ? expires : 0,
  }
}

/** Whole seconds left on a quote; 0 once it has expired or has no expiry. */
export function quoteSecondsLeft(quote: Pick<Quote, "expiresAtMs">, nowMs: number): number {
  if (!quote.expiresAtMs) return 0
  return Math.max(0, Math.ceil((quote.expiresAtMs - nowMs) / 1000))
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

/* ── wire: POST /v2/orders/checkout ──────────────────────────────── */

export interface CheckoutBody {
  address_id: string
  quote_id: string
  payment_method: PaymentMethod
  expected_total_minor: number
  coupon_code?: string
  terms_version?: string
}

/**
  The body the Pay button sends. `expected_total_minor` is copied from the
  quote — the figure the buyer was shown — and from nowhere else: the
  server refuses a total it never quoted (409 AMOUNT_MISMATCH), which is the
  whole protection, and a client that re-added the lines itself would be
  the thing that protection exists to catch.
*/
export function buildCheckoutBody(input: {
  quote: Pick<Quote, "quoteId" | "totalMinor">
  addressId: string
  paymentMethod: PaymentMethod
  couponCode?: string
}): CheckoutBody {
  const body: CheckoutBody = {
    address_id: input.addressId,
    quote_id: input.quote.quoteId,
    payment_method: input.paymentMethod,
    expected_total_minor: input.quote.totalMinor,
  }
  if (input.couponCode) body.coupon_code = input.couponCode
  return body
}

/** What `CheckoutP0` writes on 201 (service/checkout_p0.go CheckoutOutputP0). */
export interface WireCheckoutResult {
  order_id: string
  order_number: string
  total_minor: number
  tax_minor: number
  shipping_minor: number
  currency: string
  payment_intent_id?: string
  /** Declared but not filled by checkout; the intent route is always called. */
  client_session?: Record<string, string>
}

/* ── the idempotency key ─────────────────────────────────────────── */

/** The slice of Storage the key rule needs; sessionStorage in the browser. */
export interface KeyStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const ATTEMPT_KEY_PREFIX = "shop.checkout.attempt."

/**
  The Idempotency-Key for a checkout attempt, keyed by the quote.

  One quote is one attempt: a retry of the same attempt — a reload, a lost
  response, clicking Pay again after a network error — must send the SAME
  key so the server answers with the order it already made instead of
  making a second one. A new quote is a new attempt, and reusing the old
  key against it would be refused as IDEMPOTENCY_CONFLICT (same key,
  different body), so the key lives under the quote id and a new quote id
  finds nothing and mints.

  sessionStorage rather than memory so a reload keeps it, and rather than
  localStorage so a later, unrelated visit does not.
*/
export function checkoutAttemptKey(
  store: KeyStore | null,
  quoteId: string,
  generate: () => string = () => crypto.randomUUID(),
): string {
  if (!quoteId) return generate()
  const slot = ATTEMPT_KEY_PREFIX + quoteId
  if (store) {
    try {
      const existing = store.getItem(slot)
      if (existing) return existing
    } catch {
      /* private mode etc.: fall through and mint */
    }
  }
  const key = generate()
  if (store) {
    try {
      store.setItem(slot, key)
    } catch {
      /* unwritable storage still gets a key for this call */
    }
  }
  return key
}

/** Forget an attempt once its order exists or its quote is dead. */
export function forgetCheckoutAttempt(store: KeyStore | null, quoteId: string): void {
  if (!store || !quoteId) return
  try {
    store.removeItem(ATTEMPT_KEY_PREFIX + quoteId)
  } catch {
    /* nothing to forget */
  }
}

/* ── errors, by code ─────────────────────────────────────────────── */

/** How the checkout screen answers a refused quote or checkout. */
export type CheckoutRefusal =
  | { kind: "not_serviceable"; message: string }
  | { kind: "bag_changed"; message: string; bagHref: string }
  | { kind: "requote"; message: string }
  | { kind: "empty_bag"; message: string; bagHref: string }
  | { kind: "message"; message: string }

export const BAG_HREF = "/shop/bag"

/**
  Quote refusals. 422 NOT_SERVICEABLE is a state, not an outage; the two
  409s mean the bag no longer matches what was priced and the bag page is
  where that gets fixed.
*/
export function quoteRefusal(code: string): CheckoutRefusal {
  switch (code) {
    case "NOT_SERVICEABLE":
      return { kind: "not_serviceable", message: "We don't deliver to this pincode yet." }
    case "PRICE_CHANGED":
      return { kind: "bag_changed", message: "Some prices in your bag changed. Check your bag before paying.", bagHref: BAG_HREF }
    case "OUT_OF_STOCK":
    case "PRODUCT_UNAVAILABLE":
      return { kind: "bag_changed", message: "Something in your bag is no longer available.", bagHref: BAG_HREF }
    case "CART_EMPTY":
      return { kind: "empty_bag", message: "Your bag is empty.", bagHref: BAG_HREF }
    case "MULTIPLE_SELLERS":
      return { kind: "bag_changed", message: "Your bag has items from more than one seller. Keep one seller's items to check out.", bagHref: BAG_HREF }
    case "PAYMENT_METHOD_NOT_SUPPORTED":
    case "COD_NOT_SUPPORTED":
      return { kind: "message", message: "Pay by UPI or card." }
    case "PLACE_OF_SUPPLY_UNKNOWN":
    case "PRODUCT_TAX_UNCONFIGURED":
      return { kind: "message", message: "This seller can't be checked out from yet." }
    case "COURIER_UNAVAILABLE":
    case "TRY_AGAIN":
      return { kind: "message", message: "Delivery couldn't be checked right now. Try again." }
    default:
      return { kind: "message", message: "We couldn't price your bag. Try again." }
  }
}

/** Whether a checkout refusal means "get a fresh quote and try again". */
export const REQUOTE_CODES: ReadonlySet<string> = new Set(["QUOTE_STALE", "AMOUNT_MISMATCH", "QUOTE_EXPIRED", "QUOTE_CONSUMED"])

/**
  Checkout refusals. The re-quote family creates NO order: the buyer sees
  the new total and presses Pay again, with a new key for the new quote.
*/
export function checkoutRefusal(code: string): CheckoutRefusal {
  if (REQUOTE_CODES.has(code)) {
    return { kind: "requote", message: "The total changed. Check the new total and pay again." }
  }
  switch (code) {
    // At checkout, a total that no longer matches the quote comes back as
    // 409 PRICE_CHANGED with the new total (the golden
    // checkout_v2_post_409_amount_mismatch). The bag is unchanged, so the
    // answer is a fresh quote, not a trip back to the bag.
    case "PRICE_CHANGED":
      return { kind: "requote", message: "The total changed. Check the new total and pay again." }
    case "IDEMPOTENCY_CONFLICT":
      return { kind: "requote", message: "That attempt is out of date. Check the total and pay again." }
    default:
      return quoteRefusal(code)
  }
}

/** `error.response?.data?.error?.code` from an axios error, or "". */
export function errorCode(error: unknown): string {
  if (!error || typeof error !== "object") return ""
  const response = (error as { response?: { data?: { error?: { code?: unknown } } } }).response
  const code = response?.data?.error?.code
  return typeof code === "string" ? code : ""
}

/** HTTP status from an axios error, or 0 when there was no response. */
export function errorStatus(error: unknown): number {
  if (!error || typeof error !== "object") return 0
  const status = (error as { response?: { status?: unknown } }).response?.status
  return typeof status === "number" ? status : 0
}

/* ── the bag, as checkout reads it ───────────────────────────────── */

// TODO(lead): merge with W1's bag model (src/features/shop/model/bag.ts).
// Checkout needs only the lines and the subtotal; this is the slice of
// store/postgres/cartview.go CartView it reads.
export interface WireCartLine {
  variant_id: string
  product_id: string
  title: string
  sku?: string
  image_url?: string
  thumbnail_url?: string
  quantity: number
  unit_price_minor: number
  line_total_minor: number
  price_was_minor?: number
  available_qty: number
  sellable: boolean
}

export interface WireCart {
  cart_id: string
  items: WireCartLine[] | null
  subtotal_minor: number
  item_count: number
  seller_id?: string
  seller_name?: string
}

export interface BagLine {
  variantId: string
  productId: string
  title: string
  sku: string
  imageUrl: string
  quantity: number
  unitPriceMinor: number
  lineTotalMinor: number
  sellable: boolean
}

export interface BagSummary {
  lines: BagLine[]
  subtotalMinor: number
  itemCount: number
  sellerName: string
  /** Empty, or a line is no longer sellable: checkout must send the buyer back. */
  ready: boolean
}

export function toBagSummary(wire: WireCart | null | undefined): BagSummary {
  const lines = (wire?.items || []).map((l) => ({
    variantId: l.variant_id || "",
    productId: l.product_id || "",
    title: l.title || "",
    sku: l.sku || "",
    imageUrl: l.thumbnail_url || l.image_url || "",
    quantity: Number(l.quantity) || 0,
    unitPriceMinor: Number(l.unit_price_minor) || 0,
    lineTotalMinor: Number(l.line_total_minor) || 0,
    sellable: l.sellable !== false,
  }))
  return {
    lines,
    subtotalMinor: Number(wire?.subtotal_minor) || 0,
    itemCount: Number(wire?.item_count) || lines.reduce((n, l) => n + l.quantity, 0),
    sellerName: wire?.seller_name || "",
    ready: lines.length > 0 && lines.every((l) => l.sellable),
  }
}

/* ── addresses: one model, W1's (model/addresses.ts) ───────────────── */

export type { Address, AddressFormValues, AddressRequest as NewAddressValues, WireAddress } from "./addresses"
export { EMPTY_ADDRESS_FORM, toAddress, toAddressRequest as toNewAddressBody, validateAddress as validateAddressLite } from "./addresses"
import type { Address } from "./addresses"

/** The address checkout preselects: the default, else the first. "" when there is none. */
export function preselectedAddressId(addresses: ReadonlyArray<Pick<Address, "id" | "isDefault">>): string {
  const def = addresses.find((a) => a.isDefault && a.id)
  if (def) return def.id
  return addresses.find((a) => a.id)?.id || ""
}

/** One line, as it reads on the checkout card. */
export function addressOneLine(a: Pick<Address, "line1" | "line2" | "landmark" | "city" | "state" | "pincode">): string {
  return [a.line1, a.line2, a.landmark, a.city, a.state ? `${a.state} ${a.pincode}`.trim() : a.pincode]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ")
}

/**
  Whether the Pay button may fire, and if not, why (shown under it). Ported
  from atpost-web-ui `lib/checkout.ts getCheckoutBlockReason`, minus COD and
  credit, which the launch loop does not have.
*/
export function payBlockReason(input: {
  addressId: string
  bag: Pick<BagSummary, "ready" | "lines">
  quote: Quote | null
  quoting: boolean
  paying: boolean
  nowMs: number
}): string | null {
  if (input.bag.lines.length === 0) return "Your bag is empty."
  if (!input.bag.ready) return "Something in your bag is no longer available."
  if (!input.addressId) return "Choose a delivery address."
  if (input.paying) return "Placing your order…"
  if (input.quoting) return "Checking the price and delivery…"
  if (!input.quote) return "The price has to be checked before you pay."
  if (quoteSecondsLeft(input.quote, input.nowMs) === 0) return "This price has expired. Refresh it to pay."
  return null
}
