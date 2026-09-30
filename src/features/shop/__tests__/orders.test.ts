import { describe, expect, it } from "bun:test"

import {
  buildReviewBody,
  canRetryPayment,
  canShowInvoice,
  epochMs,
  HISTORY_STATUSES,
  isHistory,
  itemCountLabel,
  ORDER_STATUSES,
  retryPaymentLabel,
  reviewRefusalMessage,
  statusLabel,
  toDeliveryAddress,
  toInvoiceLink,
  toOrderDetail,
  toOrderItem,
  toOrdersPage,
  type WireOrderCard,
  type WireOrderDetail,
} from "@/features/shop/model/orders"

const card: WireOrderCard = {
  id: "o-1",
  order_number: "MS-1001",
  subtotal_minor: 129900,
  discount_minor: 0,
  shipping_minor: 4900,
  tax_minor: 19815,
  total_minor: 134800,
  currency: "INR",
  payment_method: "upi",
  payment_status: "paid",
  status: "shipped",
  item_count: 2,
  seller_count: 1,
  first_product_id: "p-1",
  first_product_title: "Cotton kurta",
  created_at: "2026-09-30T09:00:00Z",
  created_at_epoch: 1790758800,
}

const detail: WireOrderDetail = {
  id: "o-1",
  order_number: "MS-1001",
  subtotal_minor: 129900,
  discount_minor: 0,
  shipping_minor: 4900,
  tax_minor: 19815,
  total_minor: 134800,
  currency: "INR",
  payment_method: "upi",
  payment_status: "paid",
  status: "confirmed",
  items: [
    {
      id: "oi-1",
      product_id: "p-1",
      variant_id: "v-1",
      seller_id: "s-1",
      product_title: "Cotton kurta",
      sku: "KURTA-M-BLUE",
      quantity: 1,
      unit_mrp_minor: 159900,
      unit_price_minor: 129900,
      tax_minor: 19815,
      line_total_minor: 129900,
      status: "confirmed",
      thumbnail_url: "https://cdn/thumb.jpg",
    },
  ],
  delivery_address: { contact_name: "R", phone: "9876543210", address_line_1: "1 Main St", city: "Hyderabad", state: "Telangana", postal_code: "500001", country: "IN" },
  can_cancel: true,
  tracking_url: "",
  created_at: "2026-09-30T09:00:00Z",
  created_at_epoch: 1790758800,
}

describe("status labels", () => {
  it("map every status in the vocabulary to the buyer's word and a tone", () => {
    const expected: Record<string, string> = {
      payment_pending: "Confirming",
      payment_failed: "Payment failed",
      confirmed: "Confirmed",
      packed: "Packed",
      shipped: "Shipped",
      out_for_delivery: "Out for delivery",
      delivered: "Delivered",
      cancelled: "Cancelled",
      expired: "Expired",
      refund_pending: "Refund pending",
      refunded: "Refunded",
    }
    expect(Object.keys(expected).sort()).toEqual([...ORDER_STATUSES].sort())
    for (const status of ORDER_STATUSES) {
      const { label, tone } = statusLabel(status)
      expect(label, status).toBe(expected[status])
      expect(["info", "success", "warning", "danger", "muted"]).toContain(tone)
    }
    expect(statusLabel("delivered").tone).toBe("success")
    expect(statusLabel("payment_failed").tone).toBe("danger")
  })
  it("render an unknown status as itself rather than blank", () => {
    expect(statusLabel("return_requested")).toEqual({ label: "Return requested", tone: "muted" })
    expect(statusLabel("").label).toBe("Unknown")
  })
  it("history is delivered, cancelled, expired and refunded", () => {
    expect([...HISTORY_STATUSES].sort()).toEqual(["cancelled", "delivered", "expired", "refunded"])
    expect(isHistory("shipped")).toBe(false)
    expect(isHistory("refunded")).toBe(true)
  })
})

describe("the list", () => {
  it("reads data.items and data.next_cursor, with meta.next_cursor as the older spelling", () => {
    const page = toOrdersPage({ items: [card], next_cursor: "c2" }, { next_cursor: "" })
    expect(page.rows).toHaveLength(1)
    expect(page.nextCursor).toBe("c2")
    expect(toOrdersPage({ items: [card] }, { next_cursor: "m3" }).nextCursor).toBe("m3")
    expect(toOrdersPage({ items: null }, null)).toEqual({ rows: [], nextCursor: "" })
  })
  it("maps a row: number, date from the epoch, status, total, first item", () => {
    const row = toOrdersPage({ items: [card] }).rows[0]
    expect(row.orderNumber).toBe("MS-1001")
    expect(row.totalMinor).toBe(134800)
    expect(row.status).toBe("shipped")
    expect(row.itemCount).toBe(2)
    expect(row.firstProductTitle).toBe("Cotton kurta")
    expect(row.createdAtMs).toBe(1790758800 * 1000)
    expect(row.thumbnailUrl).toBe("")
  })
  it("counts items in English", () => {
    expect(itemCountLabel(1)).toBe("1 item")
    expect(itemCountLabel(3)).toBe("3 items")
  })
})

describe("the detail", () => {
  it("maps items, address, totals and the flags", () => {
    const o = toOrderDetail(detail)
    expect(o.items[0]).toMatchObject({ id: "oi-1", productId: "p-1", sellerId: "s-1", title: "Cotton kurta", optionsLabel: "KURTA-M-BLUE", unitPriceMinor: 129900, imageUrl: "https://cdn/thumb.jpg", delivered: false })
    expect(o.address).toEqual({ contactName: "R", phone: "9876543210", lines: ["1 Main St", "Hyderabad, Telangana, 500001", "IN"] })
    expect(o.totalMinor).toBe(134800)
    expect(o.canCancel).toBe(true)
    expect(o.canRetryPayment).toBe(false)
    expect(o.trackingUrl).toBe("")
  })
  it("joins options when a server sends them, else shows the SKU", () => {
    expect(toOrderItem({ ...detail.items![0], option_1: "Blue", option_2: "M" }).optionsLabel).toBe("Blue · M")
    expect(toOrderItem({ ...detail.items![0], sku: "" }).optionsLabel).toBe("")
  })
  it("marks delivered from the item status or delivered_at", () => {
    expect(toOrderItem({ ...detail.items![0], status: "delivered" }).delivered).toBe(true)
    expect(toOrderItem({ ...detail.items![0], delivered_at: "2026-10-01T00:00:00Z" }).delivered).toBe(true)
  })
  it("renders without an address (nil before the snapshot or the cipher)", () => {
    expect(toOrderDetail({ ...detail, delivery_address: null }).address).toBeNull()
    expect(toDeliveryAddress({})).toBeNull()
  })
  it("offers the payment action for a pending order, and for a failed one only on the server's word", () => {
    expect(canRetryPayment({ status: "payment_pending", payment_status: "pending" })).toBe(true)
    expect(canRetryPayment({ status: "payment_failed", payment_status: "failed" })).toBe(false)
    expect(canRetryPayment({ status: "payment_failed", payment_status: "failed", can_retry_payment: true })).toBe(true)
    expect(canRetryPayment({ status: "confirmed", payment_status: "paid" })).toBe(false)
    expect(canRetryPayment({ status: "payment_pending", payment_status: "paid" })).toBe(false)
    expect(retryPaymentLabel({ status: "payment_failed" })).toBe("Try again")
    expect(retryPaymentLabel({ status: "payment_pending" })).toBe("Complete payment")
  })
  it("shows the invoice only when paid", () => {
    expect(canShowInvoice({ paymentStatus: "paid" })).toBe(true)
    expect(canShowInvoice({ paymentStatus: "pending" })).toBe(false)
    expect(toInvoiceLink({ invoice: { InvoiceNumber: "INV-1" }, download_url: "https://signed" })).toEqual({ number: "INV-1", url: "https://signed" })
    expect(toInvoiceLink({ invoice: { InvoiceNumber: "INV-1" }, download_url: "" })).toBeNull()
  })
  it("reads the epoch in seconds or milliseconds and falls back to RFC3339", () => {
    expect(epochMs(1790758800, "")).toBe(1790758800000)
    expect(epochMs(1790758800000, "")).toBe(1790758800000)
    expect(epochMs(0, "2026-09-30T09:00:00Z")).toBe(Date.parse("2026-09-30T09:00:00Z"))
    expect(epochMs(undefined, "")).toBe(0)
  })
})

describe("the review", () => {
  it("posts seller_id, order_item_id and a clamped rating; title and body only when given", () => {
    const item = toOrderItem(detail.items![0])
    expect(buildReviewBody(item, { rating: 5, title: " Great ", body: "" })).toEqual({ seller_id: "s-1", order_item_id: "oi-1", rating: 5, title: "Great" })
    expect(buildReviewBody(item, { rating: 9, title: "", body: "ok" })).toEqual({ seller_id: "s-1", order_item_id: "oi-1", rating: 5, body: "ok" })
    expect(buildReviewBody(item, { rating: 0, title: "", body: "" }).rating).toBe(1)
  })
  it("says 'once it is delivered' for either refusal code the handler uses", () => {
    expect(reviewRefusalMessage("REVIEW_ITEM_NOT_DELIVERED")).toBe("You can review this once it is delivered.")
    expect(reviewRefusalMessage("REVIEW_NOT_ELIGIBLE")).toBe("You can review this once it is delivered.")
    expect(reviewRefusalMessage("INTERNAL_ERROR")).not.toContain("delivered")
  })
})
