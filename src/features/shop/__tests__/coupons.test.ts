import { describe, expect, it } from "bun:test"

import { buildCheckoutBody, toQuote, type WireQuote } from "../model/checkout"
import {
  COUPON_ERROR_CODES,
  NO_COUPON,
  bagCouponLine,
  bestCoupon,
  checkoutCouponLine,
  couponErrorMessage,
  couponReducer,
  discountRow,
  isCouponError,
  listedSaving,
  looksLikeCouponCode,
  minOrderFromError,
  normaliseCouponCode,
  recallAppliedCoupon,
  rememberAppliedCoupon,
  toCartCoupons,
  unavailableLine,
  withCouponCode,
  type CouponBoxState,
  type CouponEvent,
} from "../model/coupons"
import { inrMinor } from "../money"

const step = (s: CouponBoxState, e: CouponEvent) => couponReducer(s, e, inrMinor)

function memoryStore() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
}

describe("bestCoupon: the product page chip is the server's best_coupon or nothing", () => {
  it("draws from best_coupon on the product row", () => {
    const c = bestCoupon({ best_coupon: { code: "SAVE10", discount_minor: 3100, price_after_minor: 28300, title: "10% off" } })
    expect(c).toEqual({ code: "SAVE10", discountMinor: 3100, priceAfterMinor: 28300, title: "10% off" })
  })
  it("falls back to the detail body when the product row has none", () => {
    expect(bestCoupon({ title: "x" }, { best_coupon: { code: "BODY", price_after_minor: 100 } })?.code).toBe("BODY")
  })
  it("no best_coupon, null best_coupon, an empty code, or no price after ⇒ no chip", () => {
    expect(bestCoupon({})).toBeNull()
    expect(bestCoupon({ best_coupon: null })).toBeNull()
    expect(bestCoupon({ best_coupon: { code: "", price_after_minor: 100 } })).toBeNull()
    expect(bestCoupon({ best_coupon: { code: "X1Y2", price_after_minor: 0 } })).toBeNull()
    expect(bestCoupon({ best_coupon: { code: "X1Y2", price_after_minor: 99.5 } })).toBeNull()
    expect(bestCoupon(null, undefined)).toBeNull()
  })
})

describe("GET /cart/coupons", () => {
  it("reads an array, {items} or {coupons}; best saving first; codes upper-cased and de-duplicated", () => {
    const rows = [
      { code: "small", title: "₹50 off", discount_minor: 5000 },
      { code: "BIG", description: "10% off", discount_minor: 12000 },
      { code: "BIG", discount_minor: 1 },
      { code: "", discount_minor: 99999 },
    ]
    for (const data of [rows, { items: rows }, { coupons: rows }]) {
      const list = toCartCoupons(data)
      expect(list.map((c) => c.code)).toEqual(["BIG", "SMALL"])
      expect(list[0]).toMatchObject({ discountMinor: 12000, text: "10% off" })
      expect(list[1]).toMatchObject({ discountMinor: 5000, text: "₹50 off" })
    }
    expect(toCartCoupons(null)).toEqual([])
    expect(toCartCoupons({})).toEqual([])
  })
  it("codes that do not apply are listed after, save nothing, and say why in the refusal's words", () => {
    const list = toCartCoupons([
      { code: "MIN999", discount_minor: 30000, applicable: false, reason: "COUPON_MIN_ORDER", min_order_minor: 99900 },
      { code: "TEN", discount_minor: 12000, applicable: true, reason: null },
      { code: "ODD", applicable: false },
    ])
    expect(list.map((c) => c.code)).toEqual(["TEN", "MIN999", "ODD"])
    expect(list[1]).toMatchObject({ applicable: false, discountMinor: 0, reason: "COUPON_MIN_ORDER", minOrderMinor: 99900 })
    expect(unavailableLine(list[1], inrMinor)).toBe("This coupon needs an order of ₹999 or more.")
    expect(unavailableLine(list[2], inrMinor)).toBe("This coupon doesn't apply to the items in your bag.")
    expect(unavailableLine(list[0], inrMinor)).toBe("")
    expect(listedSaving(list, "MIN999")).toBe(0)
  })
  it("a code's listed saving is the list's figure, 0 when it is not listed", () => {
    const list = toCartCoupons([{ code: "BIG", discount_minor: 12000 }])
    expect(listedSaving(list, " big ")).toBe(12000)
    expect(listedSaving(list, "SECRET1")).toBe(0)
  })
})

describe("coupon codes", () => {
  it("normalise: no spaces, upper case", () => {
    expect(normaliseCouponCode("  di wali 20 ")).toBe("DIWALI20")
    expect(normaliseCouponCode(null)).toBe("")
  })
  it("4–20 of A–Z and 0–9", () => {
    expect(looksLikeCouponCode("ABCD")).toBe(true)
    expect(looksLikeCouponCode("A".repeat(20))).toBe(true)
    expect(looksLikeCouponCode("ABC")).toBe(false)
    expect(looksLikeCouponCode("A".repeat(21))).toBe(false)
    expect(looksLikeCouponCode("SAVE-10")).toBe(false)
  })
})

describe("a refused code says why, by its error code", () => {
  const expected: Record<string, string> = {
    COUPON_INVALID: "That code isn't valid. Check it and try again.",
    COUPON_EXPIRED: "This coupon has expired.",
    COUPON_MIN_ORDER: "This coupon needs an order of ₹499 or more.",
    COUPON_USED_UP: "This coupon has been used up.",
    COUPON_NOT_APPLICABLE: "This coupon doesn't apply to the items in your bag.",
    COUPON_NOT_AVAILABLE: "This coupon can't be used right now.",
  }
  it("every contract code has its own sentence", () => {
    for (const code of COUPON_ERROR_CODES) {
      expect(couponErrorMessage(code, 49900, inrMinor)).toBe(expected[code])
    }
    expect(new Set(COUPON_ERROR_CODES.map((c) => couponErrorMessage(c, 49900, inrMinor))).size).toBe(COUPON_ERROR_CODES.length)
  })
  it("COUPON_MIN_ORDER without a figure still reads; the legacy 409 COUPON_UNAVAILABLE is 'used up'", () => {
    expect(couponErrorMessage("COUPON_MIN_ORDER", 0, inrMinor)).toBe("Your bag is below this coupon's minimum order.")
    expect(couponErrorMessage("COUPON_UNAVAILABLE", 0, inrMinor)).toBe("This coupon has been used up.")
    expect(couponErrorMessage("COUPON_SOMETHING_NEW", 0, inrMinor)).toBe("This coupon couldn't be applied.")
  })
  it("min_order_minor is read from error.details (or the error), integer paise only", () => {
    const axiosLike = (error: unknown) => ({ response: { status: 422, data: { error } } })
    expect(minOrderFromError(axiosLike({ code: "COUPON_MIN_ORDER", details: { min_order_minor: 49900 } }))).toBe(49900)
    expect(minOrderFromError(axiosLike({ code: "COUPON_MIN_ORDER", min_order_minor: 1000 }))).toBe(1000)
    expect(minOrderFromError(axiosLike({ code: "COUPON_MIN_ORDER", details: { min_order_minor: 499.5 } }))).toBe(0)
    expect(minOrderFromError(new Error("network"))).toBe(0)
  })
  it("only COUPON_* is a coupon refusal", () => {
    expect(isCouponError("COUPON_EXPIRED")).toBe(true)
    expect(isCouponError("NOT_SERVICEABLE")).toBe(false)
    expect(isCouponError("")).toBe(false)
  })
})

describe("the checkout's coupon flow", () => {
  it("apply → the next quote asks with the code; quoted → Pay sends it", () => {
    let s = step(NO_COUPON, { type: "apply", code: " save10 " })
    expect(s).toEqual({ code: "SAVE10", quotedCode: "", error: "" })
    expect(withCouponCode({ address_id: "a", payment_method: "upi" }, s.code)).toEqual({ address_id: "a", payment_method: "upi", coupon_code: "SAVE10" })
    s = step(s, { type: "quoted", code: s.code })
    expect(s.quotedCode).toBe("SAVE10")
    const quote = toQuote({ quote_id: "q1", subtotal_minor: 100000, discount_minor: 10000, shipping_minor: 0, tax_minor: 0, total_minor: 90000, currency: "INR", expires_at: "2026-10-01T10:00:00Z", serviceable: true })
    const body = buildCheckoutBody({ quote, addressId: "a", paymentMethod: "upi", couponCode: s.quotedCode })
    expect(body.coupon_code).toBe("SAVE10")
    expect(body.expected_total_minor).toBe(90000)
  })
  it("an available coupon applied from the list goes the same way", () => {
    const list = toCartCoupons([{ code: "BAG50", discount_minor: 5000 }])
    const s = step(NO_COUPON, { type: "apply", code: list[0].code })
    expect(s.code).toBe("BAG50")
  })
  it("a refused code is dropped and said; the re-quote goes without it", () => {
    let s = step(step(NO_COUPON, { type: "apply", code: "OLD1" }), { type: "quoted", code: "OLD1" })
    s = step(s, { type: "refused", errorCode: "COUPON_MIN_ORDER", minOrderMinor: 49900 })
    expect(s).toEqual({ code: "", quotedCode: "", error: "This coupon needs an order of ₹499 or more." })
    expect(withCouponCode({ address_id: "a" }, s.code)).toEqual({ address_id: "a" })
  })
  it("a refusal that is not about the coupon leaves it alone", () => {
    const s = step(NO_COUPON, { type: "apply", code: "KEEP1" })
    expect(step(s, { type: "refused", errorCode: "NOT_SERVICEABLE", minOrderMinor: 0 })).toBe(s)
  })
  it("a malformed code never reaches the server; remove clears code and error", () => {
    const bad = step(NO_COUPON, { type: "apply", code: "a!" })
    expect(bad.code).toBe("")
    expect(bad.error).toBe("Enter a code of 4 to 20 letters and numbers.")
    const s = step(step(NO_COUPON, { type: "apply", code: "GOOD1" }), { type: "remove" })
    expect(s.code).toBe("")
    expect(s.error).toBe("")
  })
  it("no code ⇒ no coupon_code key in either body", () => {
    expect("coupon_code" in withCouponCode({ a: 1 }, "")).toBe(false)
    const quote = toQuote({ quote_id: "q", subtotal_minor: 1, discount_minor: 0, shipping_minor: 0, tax_minor: 0, total_minor: 1, currency: "INR", expires_at: "", serviceable: true })
    expect("coupon_code" in buildCheckoutBody({ quote, addressId: "a", paymentMethod: "card", couponCode: "" })).toBe(false)
  })
})

describe("the discount row is the quote's figure", () => {
  const wire: WireQuote = { quote_id: "q", subtotal_minor: 259800, discount_minor: 25980, shipping_minor: 4900, tax_minor: 36000, total_minor: 238720, currency: "INR", expires_at: "", serviceable: true }
  it("names the quoted code and shows discount_minor verbatim", () => {
    expect(discountRow(toQuote(wire), "SAVE10")).toEqual({ label: "Coupon SAVE10", minor: 25980 })
    expect(discountRow(toQuote(wire), "")).toEqual({ label: "Discount", minor: 25980 })
  })
  it("never a sum made here: a quote whose figures do not add up is still shown as sent", () => {
    // subtotal − discount + shipping ≠ total here on purpose; the row still says the quote's discount.
    const odd = toQuote({ ...wire, discount_minor: 777 })
    expect(discountRow(odd, "SAVE10")?.minor).toBe(777)
  })
  it("no quote or no discount ⇒ no row", () => {
    expect(discountRow(null, "SAVE10")).toBeNull()
    expect(discountRow(toQuote({ ...wire, discount_minor: 0 }), "SAVE10")).toBeNull()
  })
  it("the line under the applied code follows the quote", () => {
    const q = toQuote(wire)
    expect(checkoutCouponLine({ applied: "SAVE10", quotedCode: "SAVE10", quote: q, quoting: false, formatMinor: inrMinor })).toBe("You save ₹259.80 on this order")
    expect(checkoutCouponLine({ applied: "SAVE10", quotedCode: "", quote: q, quoting: false, formatMinor: inrMinor })).toBe("Checking…")
    expect(checkoutCouponLine({ applied: "SAVE10", quotedCode: "SAVE10", quote: q, quoting: true, formatMinor: inrMinor })).toBe("Checking…")
    expect(checkoutCouponLine({ applied: "SAVE10", quotedCode: "SAVE10", quote: toQuote({ ...wire, discount_minor: 0 }), quoting: false, formatMinor: inrMinor })).toBe("Applied")
    expect(checkoutCouponLine({ applied: "", quotedCode: "", quote: q, quoting: false, formatMinor: inrMinor })).toBe("")
  })
  it("the bag never subtracts: it repeats the list's saving or defers to checkout", () => {
    expect(bagCouponLine(12000, inrMinor)).toBe("Saves ₹120 · confirmed at checkout")
    expect(bagCouponLine(0, inrMinor)).toBe("Checked at checkout")
  })
})

describe("the applied code is carried from the bag to checkout in this tab", () => {
  it("remember, recall, forget", () => {
    const store = memoryStore()
    rememberAppliedCoupon(store, " save10 ")
    expect(recallAppliedCoupon(store)).toBe("SAVE10")
    rememberAppliedCoupon(store, "")
    expect(recallAppliedCoupon(store)).toBe("")
    expect(store.m.size).toBe(0)
    expect(recallAppliedCoupon(null)).toBe("")
  })
})
