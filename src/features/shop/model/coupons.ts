/*
  Buyer coupons on the wire, and the rules the shop puts on them
  (coupons-offers contract §B, 1 Oct 2026):

    - the product page's "You pay ₹X with coupon CODE" chip is drawn ONLY
      from the server's `best_coupon`; nothing here prices a coupon;
    - `GET /cart/coupons` lists the codes that apply to the bag, with the
      discount each would give (the server's figure);
    - the applied code travels in the quote AND the checkout body as
      `coupon_code`; the discount the buyer sees is the QUOTE's
      `discount_minor`, never a sum made here;
    - a refused code is answered by its error code, never by the message.

  Money is integer paise; nothing here touches a float.
*/

/* ── the product page chip: best_coupon ──────────────────────────── */

/** `best_coupon` on GET /products/:id and on product summaries. */
export interface WireBestCoupon {
  code?: string
  /** Integer paise off one unit. */
  discount_minor?: number
  /** Integer paise: what one unit costs with the code. */
  price_after_minor?: number
  title?: string
}

export interface BestCoupon {
  code: string
  discountMinor: number
  priceAfterMinor: number
  title: string
}

function positiveInt(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : 0
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

/**
  The chip's coupon, or null. Read from the product row first and the
  detail body second (the contract puts it "on GET /products/:id"; the
  golden fixture decides which) — and only when the server sent a code
  AND a price after it: a chip that cannot say what you pay is not drawn.
*/
export function bestCoupon(...sources: unknown[]): BestCoupon | null {
  for (const source of sources) {
    const raw = record(record(source)?.best_coupon)
    if (!raw) continue
    const code = typeof raw.code === "string" ? raw.code.trim() : ""
    const priceAfterMinor = positiveInt(raw.price_after_minor)
    if (!code || !priceAfterMinor) continue
    return {
      code,
      discountMinor: positiveInt(raw.discount_minor),
      priceAfterMinor,
      title: typeof raw.title === "string" ? raw.title : "",
    }
  }
  return null
}

/* ── GET /cart/coupons ───────────────────────────────────────────── */

export interface WireCartCoupon {
  code?: string
  title?: string
  description?: string
  discount_type?: string
  discount_value?: number
  /** Integer paise: what this code takes off the current bag. */
  discount_minor?: number
  min_order_minor?: number
  max_discount_minor?: number | null
  expires_at?: string | null
  funded_by?: string
  /** False when the code would be refused for this bag; `reason` then says why. */
  applicable?: boolean
  /** The refusal's COUPON_* code when not applicable (the same code applying it would answer). */
  reason?: string | null
}

export interface CartCoupon {
  code: string
  /** The line under the code: the title, else the description, else "". */
  text: string
  discountMinor: number
  expiresAt: string
  /** Whether the server says this code applies to the bag as it is. */
  applicable: boolean
  /** The COUPON_* code when it does not apply, else "". */
  reason: string
  /** For COUPON_MIN_ORDER: the minimum, in paise. */
  minOrderMinor: number
}

/** The list, whatever envelope shape the route settles on: `[]`, `{items}` or `{coupons}`. */
export function toCartCoupons(data: unknown): CartCoupon[] {
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(record(data)?.items)
      ? (record(data)!.items as unknown[])
      : Array.isArray(record(data)?.coupons)
        ? (record(data)!.coupons as unknown[])
        : []
  const seen = new Set<string>()
  const out: CartCoupon[] = []
  for (const row of rows) {
    const r = record(row) as WireCartCoupon | null
    const code = normaliseCouponCode(typeof r?.code === "string" ? r.code : "")
    if (!r || !code || seen.has(code)) continue
    seen.add(code)
    const applicable = r.applicable !== false
    out.push({
      code,
      text: (typeof r.title === "string" && r.title) || (typeof r.description === "string" && r.description) || "",
      // A code that does not apply saves nothing, whatever the row says.
      discountMinor: applicable ? positiveInt(r.discount_minor) : 0,
      expiresAt: typeof r.expires_at === "string" ? r.expires_at : "",
      applicable,
      reason: applicable ? "" : (typeof r.reason === "string" && r.reason) || "COUPON_NOT_APPLICABLE",
      minOrderMinor: positiveInt(r.min_order_minor),
    })
  }
  // The ones that apply first, best saving first; a tie reads in code order
  // so the list never shuffles (the server sends the same order).
  return out.sort(
    (a, b) => Number(b.applicable) - Number(a.applicable) || b.discountMinor - a.discountMinor || a.code.localeCompare(b.code),
  )
}

/** Why a listed code cannot be used on this bag, in the same words applying it would get. "" when it applies. */
export function unavailableLine(c: Pick<CartCoupon, "applicable" | "reason" | "minOrderMinor">, formatMinor: (minor: number) => string): string {
  return c.applicable ? "" : couponErrorMessage(c.reason, c.minOrderMinor, formatMinor)
}

/** What the buyer typed, as the server compares it: trimmed and upper-cased. "" for nothing. */
export function normaliseCouponCode(raw: string | null | undefined): string {
  return (raw || "").replace(/\s+/g, "").toUpperCase()
}

/** The one shape a code can have (seller codes are 4–20 of A–Z and 0–9); anything else is not worth a request. */
export const COUPON_CODE_PATTERN = /^[A-Z0-9]{4,20}$/

export function looksLikeCouponCode(code: string): boolean {
  return COUPON_CODE_PATTERN.test(code)
}

/* ── refusals, by code ───────────────────────────────────────────── */

export const COUPON_ERROR_CODES = [
  "COUPON_EXPIRED",
  "COUPON_INVALID",
  "COUPON_MIN_ORDER",
  "COUPON_NOT_APPLICABLE",
  "COUPON_NOT_AVAILABLE",
  "COUPON_USED_UP",
] as const

/** Every refusal that is about the code, including the pre-contract checkout one (409 COUPON_UNAVAILABLE). */
export function isCouponError(code: string): boolean {
  return code.startsWith("COUPON_")
}

/** `min_order_minor` from the error's details (or the error itself), else 0. */
export function minOrderFromError(error: unknown): number {
  const err = record(record(record(record(error)?.response)?.data)?.error)
  return positiveInt(record(err?.details)?.min_order_minor) || positiveInt(err?.min_order_minor)
}

/**
  The sentence under the coupon box for a refused code. `formatMinor` is
  passed in so this stays a pure, testable rule (the screen passes inrMinor).
*/
export function couponErrorMessage(code: string, minOrderMinor: number, formatMinor: (minor: number) => string): string {
  switch (code) {
    case "COUPON_INVALID":
      return "That code isn't valid. Check it and try again."
    case "COUPON_EXPIRED":
      return "This coupon has expired."
    case "COUPON_MIN_ORDER":
      return minOrderMinor > 0
        ? `This coupon needs an order of ${formatMinor(minOrderMinor)} or more.`
        : "Your bag is below this coupon's minimum order."
    case "COUPON_USED_UP":
    case "COUPON_UNAVAILABLE":
      return "This coupon has been used up."
    case "COUPON_NOT_APPLICABLE":
      return "This coupon doesn't apply to the items in your bag."
    case "COUPON_NOT_AVAILABLE":
      return "This coupon can't be used right now."
    default:
      return "This coupon couldn't be applied."
  }
}

/* ── the applied code, carried from the bag to checkout ──────────── */

/** The slice of Storage the rule needs; sessionStorage in the browser. */
export interface CodeStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const APPLIED_KEY = "shop.coupon.applied"

/** The code the buyer applied in this tab, or "". */
export function recallAppliedCoupon(store: CodeStore | null): string {
  if (!store) return ""
  try {
    return normaliseCouponCode(store.getItem(APPLIED_KEY))
  } catch {
    return ""
  }
}

/** Remember (or, with "", forget) the applied code for this tab. */
export function rememberAppliedCoupon(store: CodeStore | null, code: string): void {
  if (!store) return
  const clean = normaliseCouponCode(code)
  try {
    if (clean) store.setItem(APPLIED_KEY, clean)
    else store.removeItem(APPLIED_KEY)
  } catch {
    /* unwritable storage: the code lives for this screen only */
  }
}

/* ── the discount row ────────────────────────────────────────────── */

/**
  The price box's discount row, from the QUOTE alone: the label names the
  code the quote was taken with, the amount is the quote's
  `discount_minor`. No quote, or a quote with no discount, draws no row.
*/
export function discountRow(quote: { discountMinor: number } | null, quotedCode: string): { label: string; minor: number } | null {
  if (!quote || !(quote.discountMinor > 0)) return null
  return { label: quotedCode ? `Coupon ${quotedCode}` : "Discount", minor: quote.discountMinor }
}

/* ── the checkout's coupon state ─────────────────────────────────── */

/**
  What checkout knows about the coupon:
    - `code`: the code the NEXT quote is asked with ("" for none);
    - `quotedCode`: the code the CURRENT quote was taken with — the one the
      checkout body sends, because the server binds a quote to its code;
    - `error`: the sentence under the box after a refusal.
*/
export interface CouponBoxState {
  code: string
  quotedCode: string
  error: string
}

export type CouponEvent =
  | { type: "apply"; code: string }
  | { type: "remove" }
  | { type: "quoted"; code: string }
  | { type: "refused"; errorCode: string; minOrderMinor: number }

export const NO_COUPON: CouponBoxState = { code: "", quotedCode: "", error: "" }

/**
  The coupon box's state machine. A refused code is DROPPED (the next quote
  goes without it, so the buyer still has a price) and the refusal is said
  once, by its code. A refusal that is not about the coupon leaves the
  coupon alone. A malformed code never reaches the server.
*/
export function couponReducer(state: CouponBoxState, event: CouponEvent, formatMinor: (minor: number) => string): CouponBoxState {
  switch (event.type) {
    case "apply": {
      const code = normaliseCouponCode(event.code)
      if (!looksLikeCouponCode(code)) return { ...state, error: "Enter a code of 4 to 20 letters and numbers." }
      return { ...state, code, error: "" }
    }
    case "remove":
      return { ...state, code: "", error: "" }
    case "quoted":
      return { ...state, quotedCode: normaliseCouponCode(event.code) }
    case "refused":
      if (!isCouponError(event.errorCode)) return state
      return { code: "", quotedCode: "", error: couponErrorMessage(event.errorCode, event.minOrderMinor, formatMinor) }
  }
}

/** The quote (or checkout) body with `coupon_code` only when there is a code. */
export function withCouponCode<T extends object>(body: T, code: string): T & { coupon_code?: string } {
  const clean = normaliseCouponCode(code)
  return clean ? { ...body, coupon_code: clean } : { ...body }
}

/** What the list says a code would save on this bag (the server's figure), or 0 when it is not listed. */
export function listedSaving(coupons: readonly CartCoupon[], code: string): number {
  const clean = normaliseCouponCode(code)
  return coupons.find((c) => c.code === clean)?.discountMinor ?? 0
}

/**
  The line under an applied code in the bag. The bag has no quote, so it
  never subtracts anything: it repeats the list's saving when the code is
  listed, and otherwise says the code is checked at checkout.
*/
export function bagCouponLine(savingMinor: number, formatMinor: (minor: number) => string): string {
  return savingMinor > 0 ? `Saves ${formatMinor(savingMinor)} · confirmed at checkout` : "Checked at checkout"
}

/**
  The line under an applied code at checkout, from the quote: the quote's
  discount when the quote was taken with this code, else "Checking…" while
  a quote is on its way.
*/
export function checkoutCouponLine(input: {
  applied: string
  quotedCode: string
  quote: { discountMinor: number } | null
  quoting: boolean
  formatMinor: (minor: number) => string
}): string {
  if (!input.applied) return ""
  if (input.quoting || !input.quote || input.quotedCode !== input.applied) return "Checking…"
  return input.quote.discountMinor > 0 ? `You save ${input.formatMinor(input.quote.discountMinor)} on this order` : "Applied"
}
