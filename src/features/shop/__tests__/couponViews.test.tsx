import { describe, expect, it } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { QuoteBreakdown } from "../components/checkout/CheckoutParts"
import { CouponBox } from "../components/coupons/CouponBox"
import { CouponChip } from "../components/coupons/CouponChip"
import { BankOffers, OrderOfferLine } from "../components/offers/BankOffers"
import { inrMinor } from "../money"
import { toQuote } from "../model/checkout"
import { bestCoupon, toCartCoupons } from "../model/coupons"
import { offersSheetNote, toPaymentOffers } from "../model/offers"

/*
  The rules that live in markup: the chip exists only with best_coupon, the
  discount row prints the quote's figure and names the code, the coupon
  list offers Apply on every row but the applied one, and the checkout's
  offer list carries the Razorpay-sheet note.
*/

const text = (html: string) => html.replace(/<[^>]+>/g, "")

describe("CouponChip", () => {
  it("renders only with best_coupon", () => {
    expect(renderToStaticMarkup(<CouponChip coupon={bestCoupon({})} />)).toBe("")
    const html = renderToStaticMarkup(<CouponChip coupon={bestCoupon({ best_coupon: { code: "SAVE10", price_after_minor: 28300, discount_minor: 3100 } })} />)
    expect(text(html)).toBe("You pay ₹283 with coupon SAVE10")
    expect(html).toContain("shop-coupon-chip")
  })
})

describe("QuoteBreakdown's discount row", () => {
  const quote = toQuote({ quote_id: "q", subtotal_minor: 259800, discount_minor: 25980, shipping_minor: 4900, tax_minor: 36000, total_minor: 238720, currency: "INR", expires_at: "2099-01-01T00:00:00Z", serviceable: true })
  it("prints the quote's discount_minor under the coupon's name", () => {
    const t = text(renderToStaticMarkup(<QuoteBreakdown quote={quote} secondsLeft={60} quoting={false} couponCode="SAVE10" />))
    expect(t).toContain("Coupon SAVE10−₹259.80")
    expect(t).toContain("Total₹2,387.20")
  })
  it("no discount ⇒ no row", () => {
    const t = text(renderToStaticMarkup(<QuoteBreakdown quote={{ ...quote, discountMinor: 0 }} secondsLeft={60} quoting={false} couponCode="SAVE10" />))
    expect(t).not.toContain("Coupon")
    expect(t).not.toContain("Discount")
  })
})

describe("CouponBox", () => {
  const coupons = toCartCoupons([
    { code: "BAG50", title: "₹50 off your bag", discount_minor: 5000 },
    { code: "TEN", description: "10% off", discount_minor: 12000 },
  ])
  const noop = () => {}
  it("lists the available coupons, best first, each with its saving and Apply", () => {
    const html = renderToStaticMarkup(
      <CouponBox coupons={coupons} loadingCoupons={false} applied="" appliedLine="" error="" busy={false} onApply={noop} onRemove={noop} />,
    )
    const t = text(html)
    expect(t.indexOf("TEN")).toBeLessThan(t.indexOf("BAG50"))
    expect(t).toContain("Save ₹120")
    expect(html).toContain('aria-label="Apply coupon TEN"')
    expect(html).toContain('aria-label="Apply coupon BAG50"')
    expect(html).toContain('aria-label="Coupon code"')
  })
  it("the applied code shows Remove and its line, and is marked Applied in the list", () => {
    const html = renderToStaticMarkup(
      <CouponBox coupons={coupons} loadingCoupons={false} applied="TEN" appliedLine="You save ₹120 on this order" error="" busy={false} onApply={noop} onRemove={noop} />,
    )
    expect(text(html)).toContain("You save ₹120 on this order")
    expect(text(html)).toContain("Remove")
    expect(html).not.toContain('aria-label="Apply coupon TEN"')
    expect(html).toContain('aria-label="Apply coupon BAG50"')
    expect(html).not.toContain('aria-label="Coupon code"')
  })
  it("a code that does not apply says why and offers no Apply", () => {
    const list = toCartCoupons([{ code: "MIN999", applicable: false, reason: "COUPON_MIN_ORDER", min_order_minor: 99900, discount_minor: 30000 }])
    const html = renderToStaticMarkup(
      <CouponBox coupons={list} loadingCoupons={false} applied="" appliedLine="" error="" busy={false} onApply={noop} onRemove={noop} />,
    )
    expect(text(html)).toContain("This coupon needs an order of ₹999 or more.")
    expect(text(html)).not.toContain("Save ₹300")
    expect(html).not.toContain('aria-label="Apply coupon MIN999"')
  })
  it("a refusal is an alert", () => {
    const html = renderToStaticMarkup(
      <CouponBox coupons={[]} loadingCoupons={false} applied="" appliedLine="" error="This coupon has expired." busy={false} onApply={noop} onRemove={noop} />,
    )
    expect(html).toContain('role="alert"')
    expect(text(html)).toContain("This coupon has expired.")
  })
})

describe("BankOffers", () => {
  const offers = toPaymentOffers([
    { id: "po_1", title: "10% off with HDFC credit cards", payment_method: "card", estimated_discount_minor: 15000 },
    { id: "po_2", title: "Flat ₹25 on UPI", payment_method: "upi" },
  ])
  it("title, 'Save up to ₹X' when the server gave a figure, and the method", () => {
    const t = text(renderToStaticMarkup(<BankOffers offers={offers} title="Bank offers" />))
    expect(t).toContain("Bank offers")
    expect(t).toContain("10% off with HDFC credit cards")
    expect(t).toContain("Save up to ₹150")
    expect(t).toContain("Card")
    expect(t).toContain("Flat ₹25 on UPI")
    expect(t.match(/Save up to/g)?.length).toBe(1)
  })
  it("checkout carries the 'applies in the Razorpay sheet' note", () => {
    const t = text(renderToStaticMarkup(<BankOffers offers={offers} title="Bank offers available" note={offersSheetNote(264700, inrMinor)} />))
    expect(t).toContain("Bank offers available")
    expect(t).toContain("Bank offers apply in the Razorpay payment window")
    expect(t).toContain("Your order total stays ₹2,647")
  })
  it("no offers ⇒ nothing", () => {
    expect(renderToStaticMarkup(<BankOffers offers={[]} title="Bank offers" />)).toBe("")
  })
  it("the order line", () => {
    const t = text(renderToStaticMarkup(<OrderOfferLine line="Bank offer −₹264.70 · Paid ₹2,382.30" title="10% off with HDFC" />))
    expect(t).toBe("Bank offer −₹264.70 · Paid ₹2,382.3010% off with HDFC")
  })
})
