import { describe, expect, it } from "bun:test"

import {
  addressOneLine,
  buildCheckoutBody,
  checkoutAttemptKey,
  checkoutRefusal,
  errorCode,
  errorStatus,
  forgetCheckoutAttempt,
  formatCountdown,
  isPaymentMethod,
  PAYMENT_METHODS,
  payBlockReason,
  preselectedAddressId,
  quoteRefusal,
  quoteSecondsLeft,
  REQUOTE_CODES,
  toAddress,
  toBagSummary,
  toQuote,
  type KeyStore,
  type Quote,
  type WireQuote,
} from "@/features/shop/model/checkout"

const wireQuote: WireQuote = {
  quote_id: "q-1",
  subtotal_minor: 129900,
  discount_minor: 0,
  shipping_minor: 4900,
  tax_minor: 19815,
  total_minor: 134800,
  currency: "INR",
  courier_code: "stub",
  expires_at: "2026-09-30T10:15:00Z",
  serviceable: true,
}

function memoryStore(): KeyStore & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

describe("the quote", () => {
  it("maps every *_minor field as sent and parses the expiry", () => {
    const q = toQuote(wireQuote)
    expect(q.quoteId).toBe("q-1")
    expect(q.subtotalMinor).toBe(129900)
    expect(q.shippingMinor).toBe(4900)
    expect(q.taxMinor).toBe(19815)
    expect(q.discountMinor).toBe(0)
    expect(q.totalMinor).toBe(134800)
    expect(q.expiresAtMs).toBe(Date.parse("2026-09-30T10:15:00Z"))
  })
  it("falls through on Go zero values", () => {
    const q = toQuote({ ...wireQuote, currency: "", courier_code: "", expires_at: "" })
    expect(q.currency).toBe("INR")
    expect(q.expiresAtMs).toBe(0)
    expect(quoteSecondsLeft(q, Date.now())).toBe(0)
  })
  it("counts down in whole seconds and stops at zero", () => {
    const q = toQuote(wireQuote)
    expect(quoteSecondsLeft(q, q.expiresAtMs - 90_500)).toBe(91)
    expect(quoteSecondsLeft(q, q.expiresAtMs + 1)).toBe(0)
    expect(formatCountdown(91)).toBe("1:31")
    expect(formatCountdown(600)).toBe("10:00")
  })
})

describe("expected_total_minor is the quoted total", () => {
  it("copies the quote's total_minor and never sums the lines", () => {
    const quote: Quote = { ...toQuote(wireQuote), subtotalMinor: 1, shippingMinor: 1, taxMinor: 1, discountMinor: 0 }
    const body = buildCheckoutBody({ quote, addressId: "a-1", paymentMethod: "upi" })
    expect(body.expected_total_minor).toBe(134800)
    expect(body.expected_total_minor).not.toBe(quote.subtotalMinor + quote.shippingMinor + quote.taxMinor)
    expect(body).toEqual({ address_id: "a-1", quote_id: "q-1", payment_method: "upi", expected_total_minor: 134800 })
  })
  it("carries the coupon only when there is one", () => {
    const quote = toQuote(wireQuote)
    expect(buildCheckoutBody({ quote, addressId: "a", paymentMethod: "card", couponCode: "" })).not.toHaveProperty("coupon_code")
    expect(buildCheckoutBody({ quote, addressId: "a", paymentMethod: "card", couponCode: "SAVE" }).coupon_code).toBe("SAVE")
  })
})

describe("the Idempotency-Key rule", () => {
  it("is the same key across a retry of one attempt (same quote)", () => {
    const store = memoryStore()
    let n = 0
    const gen = () => `key-${++n}`
    const first = checkoutAttemptKey(store, "q-1", gen)
    const retry = checkoutAttemptKey(store, "q-1", gen)
    expect(first).toBe("key-1")
    expect(retry).toBe(first)
    expect(n).toBe(1)
  })
  it("survives a reload: a fresh caller with the same store finds the key", () => {
    const store = memoryStore()
    const before = checkoutAttemptKey(store, "q-1", () => "reload-key")
    expect(checkoutAttemptKey(store, "q-1", () => "should-not-be-used")).toBe(before)
  })
  it("is a new key for a new quote", () => {
    const store = memoryStore()
    let n = 0
    const gen = () => `key-${++n}`
    const a = checkoutAttemptKey(store, "q-1", gen)
    const b = checkoutAttemptKey(store, "q-2", gen)
    expect(b).not.toBe(a)
    expect(checkoutAttemptKey(store, "q-1", gen)).toBe(a)
  })
  it("forgets an attempt, so the same quote id later mints again", () => {
    const store = memoryStore()
    let n = 0
    const gen = () => `key-${++n}`
    const a = checkoutAttemptKey(store, "q-1", gen)
    forgetCheckoutAttempt(store, "q-1")
    expect(checkoutAttemptKey(store, "q-1", gen)).not.toBe(a)
  })
  it("still answers a key with no storage, and never caches a blank quote id", () => {
    let n = 0
    const gen = () => `k${++n}`
    expect(checkoutAttemptKey(null, "q-1", gen)).toBe("k1")
    expect(checkoutAttemptKey(null, "q-1", gen)).toBe("k2")
    const store = memoryStore()
    checkoutAttemptKey(store, "", gen)
    expect(store.map.size).toBe(0)
  })
  it("mints a real uuid by default", () => {
    expect(checkoutAttemptKey(null, "q")).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe("refusals, by code", () => {
  it("quote: NOT_SERVICEABLE is a pincode message, the 409s send the buyer to the bag", () => {
    expect(quoteRefusal("NOT_SERVICEABLE")).toEqual({ kind: "not_serviceable", message: "We don't deliver to this pincode yet." })
    expect(quoteRefusal("PRICE_CHANGED").kind).toBe("bag_changed")
    expect(quoteRefusal("OUT_OF_STOCK").kind).toBe("bag_changed")
    expect((quoteRefusal("OUT_OF_STOCK") as { bagHref: string }).bagHref).toBe("/shop/bag")
    expect(quoteRefusal("CART_EMPTY").kind).toBe("empty_bag")
    expect(quoteRefusal("SOMETHING_ELSE").kind).toBe("message")
  })
  it("checkout: QUOTE_STALE and AMOUNT_MISMATCH re-quote and tell the buyer the total changed", () => {
    for (const code of ["QUOTE_STALE", "AMOUNT_MISMATCH", "QUOTE_EXPIRED"]) {
      expect(REQUOTE_CODES.has(code)).toBe(true)
      const r = checkoutRefusal(code)
      expect(r.kind).toBe("requote")
      expect(r.message).toContain("total changed")
    }
    expect(checkoutRefusal("OUT_OF_STOCK").kind).toBe("bag_changed")
    expect(checkoutRefusal("COD_NOT_SUPPORTED").message).toBe("Pay by UPI or card.")
  })
  it("reads the code and status off an axios error, and nothing off anything else", () => {
    const err = { response: { status: 409, data: { error: { code: "QUOTE_STALE", message: "x" } } } }
    expect(errorCode(err)).toBe("QUOTE_STALE")
    expect(errorStatus(err)).toBe(409)
    expect(errorCode(new Error("boom"))).toBe("")
    expect(errorStatus(null)).toBe(0)
  })
})

describe("payment methods", () => {
  it("are UPI and Card only, drawn in alphabetical order", () => {
    expect(PAYMENT_METHODS.map((m) => m.value)).toEqual(["card", "upi"])
    expect(PAYMENT_METHODS.map((m) => m.label)).toEqual([...PAYMENT_METHODS.map((m) => m.label)].sort())
    expect(isPaymentMethod("cod")).toBe(false)
    expect(isPaymentMethod("prepaid")).toBe(false)
    expect(isPaymentMethod("upi")).toBe(true)
  })
})

describe("the bag summary", () => {
  it("is ready only with lines that are all sellable", () => {
    const line = { variant_id: "v", product_id: "p", title: "T", quantity: 2, unit_price_minor: 100, line_total_minor: 200, available_qty: 3, sellable: true }
    expect(toBagSummary({ cart_id: "c", items: [line], subtotal_minor: 200, item_count: 2 }).ready).toBe(true)
    expect(toBagSummary({ cart_id: "c", items: [{ ...line, sellable: false }], subtotal_minor: 200, item_count: 2 }).ready).toBe(false)
    expect(toBagSummary({ cart_id: "c", items: null, subtotal_minor: 0, item_count: 0 }).ready).toBe(false)
    expect(toBagSummary(null).lines).toEqual([])
  })
  it("prefers the thumbnail and falls through to the image", () => {
    const line = { variant_id: "v", product_id: "p", title: "T", quantity: 1, unit_price_minor: 1, line_total_minor: 1, available_qty: 1, sellable: true, image_url: "big", thumbnail_url: "" }
    expect(toBagSummary({ cart_id: "c", items: [line], subtotal_minor: 1, item_count: 1 }).lines[0].imageUrl).toBe("big")
  })
})

describe("addresses", () => {
  it("preselects the default, else the first", () => {
    expect(preselectedAddressId([{ id: "a", isDefault: false }, { id: "b", isDefault: true }])).toBe("b")
    expect(preselectedAddressId([{ id: "a", isDefault: false }, { id: "b", isDefault: false }])).toBe("a")
    expect(preselectedAddressId([])).toBe("")
  })
  it("reads is_default as false when the wire omits it (omitempty)", () => {
    const a = toAddress({ id: "x", contact_name: "R", phone: "9876543210", address_line_1: "1 St", city: "Hyd", state: "TS", postal_code: "500001" })!
    expect(a.isDefault).toBe(false)
    expect(a.country).toBe("IN")
    expect(addressOneLine(a)).toBe("1 St, Hyd, TS 500001")
  })
})

describe("the Pay button", () => {
  const quote = toQuote(wireQuote)
  const bag = { ready: true, lines: [{}] as never[] }
  const now = quote.expiresAtMs - 60_000
  it("fires only with an address, a live quote and nothing in flight", () => {
    expect(payBlockReason({ addressId: "a", bag, quote, quoting: false, paying: false, nowMs: now })).toBeNull()
  })
  it("names the first thing missing", () => {
    expect(payBlockReason({ addressId: "", bag, quote, quoting: false, paying: false, nowMs: now })).toBe("Choose a delivery address.")
    expect(payBlockReason({ addressId: "a", bag, quote: null, quoting: true, paying: false, nowMs: now })).toContain("Checking")
    expect(payBlockReason({ addressId: "a", bag, quote: null, quoting: false, paying: false, nowMs: now })).toContain("checked before you pay")
    expect(payBlockReason({ addressId: "a", bag, quote, quoting: false, paying: true, nowMs: now })).toContain("Placing")
    expect(payBlockReason({ addressId: "a", bag, quote, quoting: false, paying: false, nowMs: quote.expiresAtMs + 1 })).toContain("expired")
    expect(payBlockReason({ addressId: "a", bag: { ready: false, lines: [{}] as never[] }, quote, quoting: false, paying: false, nowMs: now })).toContain("no longer available")
    expect(payBlockReason({ addressId: "a", bag: { ready: false, lines: [] }, quote, quoting: false, paying: false, nowMs: now })).toBe("Your bag is empty.")
  })
})
