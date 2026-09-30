import { describe, expect, test } from "bun:test"

import { buildCheckoutBody, checkoutRefusal, quoteRefusal, REQUOTE_CODES, toQuote, type WireCheckoutResult, type WireQuote } from "@/features/shop/model/checkout"

import { hasFixture, readBackendFixture, readFixture, readLocalFixtureText } from "./contractFixtures"

/*
  checkout/ fixtures (lane C1):
    quote_post_200, quote_post_400_payment_method, quote_post_422_not_serviceable,
    quote_post_409_price_changed, checkout_v2_post_201, checkout_v2_post_409_quote_stale,
    checkout_v2_post_409_amount_mismatch, checkout_v2_post_400_missing_idempotency_key
*/
const AREA = "checkout"

const only = (name: string) => (hasFixture(AREA, name) ? test : test.skip)

describe("checkout fixtures parse through the mappers", () => {
  only("quote_post_200")("quote_post_200: every *_minor field, a quote id and an expiry the screen can count down", () => {
    const { data } = readFixture<WireQuote>(AREA, "quote_post_200")
    const q = toQuote(data)
    expect(q.quoteId).toBe(data.quote_id)
    expect(q.totalMinor).toBe(data.total_minor)
    expect(q.subtotalMinor).toBe(data.subtotal_minor)
    expect(q.shippingMinor).toBe(data.shipping_minor)
    expect(q.taxMinor).toBe(data.tax_minor)
    expect(q.discountMinor).toBe(data.discount_minor)
    expect(q.expiresAtMs).toBeGreaterThan(0)
    expect(Number.isInteger(q.totalMinor)).toBe(true)
    // What Pay sends: the quoted total, verbatim.
    expect(buildCheckoutBody({ quote: q, addressId: "a", paymentMethod: "upi" }).expected_total_minor).toBe(data.total_minor)
  })

  only("quote_post_422_not_serviceable")("quote_post_422_not_serviceable: NOT_SERVICEABLE is the pincode message", () => {
    const { error } = readFixture(AREA, "quote_post_422_not_serviceable")
    expect(error?.code).toBe("NOT_SERVICEABLE")
    expect(quoteRefusal(error!.code).kind).toBe("not_serviceable")
  })

  only("quote_post_409_price_changed")("quote_post_409_price_changed: PRICE_CHANGED sends the buyer to the bag", () => {
    const { error } = readFixture(AREA, "quote_post_409_price_changed")
    expect(error?.code).toBe("PRICE_CHANGED")
    expect(quoteRefusal(error!.code).kind).toBe("bag_changed")
  })

  only("quote_post_400_payment_method")("quote_post_400_payment_method: only UPI and card", () => {
    const { error } = readFixture(AREA, "quote_post_400_payment_method")
    expect(["PAYMENT_METHOD_NOT_SUPPORTED", "COD_NOT_SUPPORTED"]).toContain(error?.code)
    expect(quoteRefusal(error!.code).message).toBe("Pay by UPI or card.")
  })

  only("checkout_v2_post_201")("checkout_v2_post_201: an order id and number to navigate with", () => {
    const { data } = readFixture<WireCheckoutResult>(AREA, "checkout_v2_post_201")
    expect(data.order_id).toBeTruthy()
    expect(data.order_number).toBeTruthy()
    expect(Number.isInteger(data.total_minor)).toBe(true)
  })

  for (const name of ["checkout_v2_post_409_quote_stale", "checkout_v2_post_409_amount_mismatch"]) {
    only(name)(`${name}: re-quote, no order`, () => {
      const { error } = readFixture(AREA, name)
      expect(REQUOTE_CODES.has(error!.code)).toBe(true)
      expect(checkoutRefusal(error!.code).kind).toBe("requote")
    })
  }

  only("checkout_v2_post_400_missing_idempotency_key")("checkout_v2_post_400_missing_idempotency_key: the header is mandatory", () => {
    const { error } = readFixture(AREA, "checkout_v2_post_400_missing_idempotency_key")
    expect(error?.code).toBe("IDEMPOTENCY_KEY_REQUIRED")
  })
})

describe("checkout fixtures are byte-identical to the backend's", () => {
  for (const name of [
    "quote_post_200",
    "quote_post_400_payment_method",
    "quote_post_422_not_serviceable",
    "quote_post_409_price_changed",
    "checkout_v2_post_201",
    "checkout_v2_post_409_quote_stale",
    "checkout_v2_post_409_amount_mismatch",
    "checkout_v2_post_400_missing_idempotency_key",
  ]) {
    const backend = hasFixture(AREA, name) ? readBackendFixture(AREA, name) : null
    ;(backend === null ? test.skip : test)(name, () => {
      expect(readLocalFixtureText(AREA, name)).toBe(backend as string)
    })
  }
})
