import { describe, expect, it } from "bun:test"

import { inrMinor } from "../money"
import { toOrderDetail, type WireOrderDetail } from "../model/orders"
import {
  OFFER_METHOD_LABEL,
  offersAmount,
  offersSheetNote,
  orderOfferLine,
  orderPaymentOffer,
  saveUpToLine,
  toPaymentOffers,
} from "../model/offers"

describe("GET /payment-offers", () => {
  const rows = [
    { id: "po_1", title: "10% off with HDFC credit cards", description: "Min ₹1,000", payment_method: "card", discount_type: "percentage", discount_value: 1000, max_discount_minor: 150000, min_amount_minor: 100000, ends_at: "2026-10-31T18:29:59Z", estimated_discount_minor: 26470 },
    { id: "po_2", title: "₹50 off on UPI", payment_method: "upi", discount_type: "flat", discount_value: 5000, estimated_discount_minor: 0, max_discount_minor: 5000 },
    { id: "po_3", title: "Any bank", payment_method: "" },
    { id: "", title: "no id" },
    { id: "po_4", title: "" },
    { id: "po_1", title: "duplicate" },
  ]
  it("keeps the server's order, drops rows without an id or a title, and de-duplicates", () => {
    const offers = toPaymentOffers(rows)
    expect(offers.map((o) => o.id)).toEqual(["po_1", "po_2", "po_3"])
    expect(toPaymentOffers({ items: rows }).length).toBe(3)
    expect(toPaymentOffers(null)).toEqual([])
  })
  it("'Save up to' is the server's estimate, else the offer's cap, else no figure", () => {
    const [a, b, c] = toPaymentOffers(rows)
    expect(saveUpToLine(a, inrMinor)).toBe("Save up to ₹264.70")
    expect(saveUpToLine(b, inrMinor)).toBe("Save up to ₹50")
    expect(saveUpToLine(c, inrMinor)).toBe("")
  })
  it("methods: card, UPI, and anything else is 'Card or UPI'", () => {
    const [a, b, c] = toPaymentOffers(rows)
    expect([a.method, b.method, c.method]).toEqual(["card", "upi", "any"])
    expect(OFFER_METHOD_LABEL[c.method]).toBe("Card or UPI")
  })
  it("asks only for a positive integer amount", () => {
    expect(offersAmount(264700)).toBe(264700)
    expect(offersAmount(0)).toBeNull()
    expect(offersAmount(null)).toBeNull()
    expect(offersAmount(12.5)).toBeNull()
  })
  it("the checkout note says the offer is taken in the Razorpay sheet and the total stays", () => {
    const note = offersSheetNote(264700, inrMinor)
    expect(note).toContain("Razorpay payment window")
    expect(note).toContain("Your order total stays ₹2,647")
    expect(note).toContain("comes off what you're charged")
  })
})

describe("the order's bank offer line", () => {
  const base: WireOrderDetail = {
    id: "o1",
    order_number: "MS-1",
    subtotal_minor: 264700,
    discount_minor: 0,
    shipping_minor: 0,
    tax_minor: 0,
    total_minor: 264700,
    currency: "INR",
    payment_status: "paid",
    status: "confirmed",
    items: [],
    can_cancel: false,
    created_at: "2026-10-01T10:00:00Z",
    created_at_epoch: 0,
  }
  it("'Bank offer −₹X · Paid ₹Y' from payment_offer and amount_paid_minor", () => {
    const order = toOrderDetail({ ...base, payment_offer: { title: "10% off with HDFC", discount_minor: 26470 }, amount_paid_minor: 238230 })
    expect(order.paymentOffer).toEqual({ title: "10% off with HDFC", discountMinor: 26470, paidMinor: 238230 })
    expect(orderOfferLine(order.paymentOffer!, inrMinor)).toBe("Bank offer −₹264.70 · Paid ₹2,382.30")
    // The order total is unchanged: the offer is a payment-side instrument.
    expect(order.totalMinor).toBe(264700)
  })
  it("without amount_paid_minor the line stops at the offer", () => {
    const offer = orderPaymentOffer({ payment_offer: { title: "", discount_minor: 5000 } })
    expect(offer).toEqual({ title: "", discountMinor: 5000, paidMinor: 0 })
    expect(orderOfferLine(offer!, inrMinor)).toBe("Bank offer −₹50")
  })
  it("no offer, a null offer, or a zero discount ⇒ no line", () => {
    expect(toOrderDetail(base).paymentOffer).toBeNull()
    expect(orderPaymentOffer({ payment_offer: null, amount_paid_minor: 100 })).toBeNull()
    expect(orderPaymentOffer({ payment_offer: { title: "x", discount_minor: 0 } })).toBeNull()
  })
})
