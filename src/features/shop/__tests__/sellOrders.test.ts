import { describe, expect, it } from "bun:test"
import {
  CANCEL_REASON_MAX,
  FULFILLMENT_STAGES,
  SELLER_TRANSITIONS,
  addressIsRoutingOnly,
  buildTimeline,
  canBookShipment,
  cancelRequestBody,
  decodeAddressSnapshot,
  isFulfillmentStage,
  isNotFound,
  lineTotalMinor,
  nextOffset,
  normaliseHistoryRow,
  normaliseShipment,
  normaliseShipmentEvent,
  normaliseTracking,
  orderStatusUI,
  orderTotalMinor,
  sellerActionError,
  sellerActionPath,
  sellerActionsFor,
  sellerSubtotalMinor,
  shipRequestBody,
  shortId,
  timelineFromHistory,
  validateCancelReason,
  validateShipForm,
  variantSummary,
  type OrderHistoryRow,
} from "../model/sell"

// Ported from atpost-web-ui lib/seller.test.ts (the order half). Each block
// names the server fact it mirrors.

describe("sellerActionsFor mirrors migration 010 actor_type = seller", () => {
  it("lists exactly the four seller rows of order_status_transitions", () => {
    expect(SELLER_TRANSITIONS).toEqual([
      ["confirmed", "packed"],
      ["confirmed", "cancelled"],
      ["packed", "shipped"],
      ["packed", "cancelled"],
    ])
  })
  it("offers pack and cancel from confirmed, ship and cancel from packed, nothing after", () => {
    expect(sellerActionsFor("confirmed").map((a) => a.kind)).toEqual(["pack", "cancel"])
    expect(sellerActionsFor("packed").map((a) => a.kind)).toEqual(["ship", "cancel"])
    for (const s of ["shipped", "out_for_delivery", "delivered", "cancelled", "refunded", "payment_pending"]) expect(sellerActionsFor(s)).toEqual([])
  })
  it("has a seller route behind every action", () => {
    for (const a of [...sellerActionsFor("confirmed"), ...sellerActionsFor("packed")]) expect(a.route).toMatch(/^\/v1\/commerce\/seller\/orders\/\{id\}\//)
  })
})

describe("sellerActionPath", () => {
  it("fills the order id into the seller route and escapes it", () => {
    expect(sellerActionPath("pack", "o-1")).toBe("/v1/commerce/seller/orders/o-1/pack")
    expect(sellerActionPath("ship", "o-1")).toBe("/v1/commerce/seller/orders/o-1/ship")
    expect(sellerActionPath("cancel", "o-1")).toBe("/v1/commerce/seller/orders/o-1/cancel")
    expect(sellerActionPath("pack", "a/b")).toBe("/v1/commerce/seller/orders/a%2Fb/pack")
  })
})

describe("sellerActionError", () => {
  const refusal = (status: number, code: string, message = "server words") => ({ response: { status, data: { error: { code, message } } } })
  it("explains each 409 and the 400", () => {
    expect(sellerActionError("pack", refusal(409, "TRANSITION_NOT_PERMITTED"), "x")).toMatch(/marked as packed/)
    expect(sellerActionError("ship", refusal(409, "TRANSITION_NOT_PERMITTED"), "x")).toMatch(/shipped/)
    expect(sellerActionError("cancel", refusal(409, "CANCEL_NOT_PERMITTED"), "x")).toMatch(/no longer be cancelled/)
    expect(sellerActionError("ship", refusal(409, "TRACKING_NUMBER_IN_USE"), "x")).toMatch(/already on another shipment/)
    expect(sellerActionError("pack", refusal(409, "ORDER_SHARED"), "x")).toMatch(/other sellers/)
    expect(sellerActionError("cancel", refusal(400, "REASON_REQUIRED"), "x")).toMatch(/reason/)
  })
  it("falls back to the server message, then to the default", () => {
    expect(sellerActionError("pack", refusal(500, "INTERNAL", "db down"), "fallback")).toBe("db down")
    expect(sellerActionError("pack", { response: { status: 500 } }, "fallback")).toBe("fallback")
    expect(sellerActionError("pack", undefined, "fallback")).toBe("fallback")
  })
})

describe("ship form validation", () => {
  it("normalises a tracking number the way the label prints it", () => {
    expect(normaliseTracking(" ab 12 cd-34 ")).toBe("AB12CD-34")
  })
  it("accepts a real AWB and a courier name", () => {
    expect(validateShipForm({ courier: "Delhivery", tracking_number: "1234567890123" })).toEqual({})
    expect(validateShipForm({ courier: "DHL", tracking_number: "JD01-4600-0064-6987" })).toEqual({})
  })
  it("refuses an empty courier or number, and a number that is too short, too long or punctuated", () => {
    const e = validateShipForm({ courier: " ", tracking_number: "" })
    expect(e.courier).toBeTruthy()
    expect(e.tracking_number).toBeTruthy()
    expect(validateShipForm({ courier: "Bluedart", tracking_number: "12345" }).tracking_number).toBeTruthy()
    expect(validateShipForm({ courier: "Bluedart", tracking_number: "A".repeat(41) }).tracking_number).toBeTruthy()
    expect(validateShipForm({ courier: "Bluedart", tracking_number: "ABC#123456" }).tracking_number).toBeTruthy()
    expect(validateShipForm({ courier: "x".repeat(61), tracking_number: "1234567890" }).courier).toBeTruthy()
  })
  it("sends exactly {courier, tracking_number}, trimmed and normalised", () => {
    expect(shipRequestBody({ courier: " Delhivery ", tracking_number: "ab 12" })).toEqual({ courier: "Delhivery", tracking_number: "AB12" })
  })
})

describe("cancel reason", () => {
  it("accepts a few words and refuses nothing, whitespace, two characters, or past the cap", () => {
    expect(validateCancelReason("Out of stock")).toBeNull()
    expect(validateCancelReason("")).toBeTruthy()
    expect(validateCancelReason("   ")).toBeTruthy()
    expect(validateCancelReason("no")).toBeTruthy()
    expect(validateCancelReason("x".repeat(CANCEL_REASON_MAX))).toBeNull()
    expect(validateCancelReason("x".repeat(CANCEL_REASON_MAX + 1))).toBeTruthy()
    expect(cancelRequestBody("  why ")).toEqual({ reason: "why" })
  })
})

describe("canBookShipment follows CreateShipmentsForOrder", () => {
  it("is live for a paid confirmed or packed order with no shipment", () => {
    expect(canBookShipment({ status: "confirmed", payment_status: "paid" }, null)).toBe(true)
    expect(canBookShipment({ status: "packed", payment_status: "paid" }, undefined)).toBe(true)
  })
  it("refuses an unpaid order (cash on delivery is fenced)", () => {
    expect(canBookShipment({ status: "confirmed", payment_status: "pending" }, null)).toBe(false)
  })
  it("refuses once a shipment exists or from any other status", () => {
    expect(canBookShipment({ status: "confirmed", payment_status: "paid" }, { status: "booked" })).toBe(false)
    expect(canBookShipment({ status: "confirmed", payment_status: "paid" }, { status: "pending" })).toBe(false)
    for (const s of ["payment_pending", "shipped", "delivered", "cancelled"]) expect(canBookShipment({ status: s, payment_status: "paid" }, null)).toBe(false)
  })
})

describe("status labels", () => {
  it("names every status the contract lists without underscores", () => {
    for (const s of ["payment_pending", "payment_failed", "confirmed", "packed", "shipped", "out_for_delivery", "delivered", "cancelled", "expired", "refund_pending", "refunded"]) {
      expect(orderStatusUI(s).label).not.toMatch(/_/)
    }
  })
  it("tones: done is success, dead is danger, in motion is info", () => {
    expect(orderStatusUI("delivered").tone).toBe("success")
    expect(orderStatusUI("cancelled").tone).toBe("danger")
    expect(orderStatusUI("shipped").tone).toBe("info")
  })
  it("does not crash on a status it has never heard of", () => {
    expect(orderStatusUI("held_for_review")).toEqual({ label: "Held for review", tone: "muted" })
    expect(orderStatusUI(undefined).label).toBe("Unknown")
  })
})

describe("stage pills", () => {
  it("are the server's fulfillmentMatchesStage vocabulary", () => {
    expect(FULFILLMENT_STAGES.map((s) => s.id).sort()).toEqual(["all", "cancelled", "delivered", "in_transit", "unshipped"])
    expect(isFulfillmentStage("unshipped")).toBe(true)
    expect(isFulfillmentStage("packed")).toBe(false)
  })
  it("read as an alphabetical list", () => {
    const labels = FULFILLMENT_STAGES.map((s) => s.label)
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, "en")))
  })
})

describe("nextOffset on a route that filters after it pages", () => {
  it("keeps going after a short page and stops only on an empty one", () => {
    expect(nextOffset({ count: 3, offset: 0, limit: 20 })).toBe(20)
    expect(nextOffset({ count: 0, offset: 40, limit: 20 })).toBeUndefined()
    expect(nextOffset({ count: 20, offset: 20, limit: 20 })).toBe(40)
  })
})

describe("money column selection after migration 007", () => {
  it("prefers paise, falls back to rupees, reads zero as zero", () => {
    expect(orderTotalMinor({ total_minor: 92900, final_amount: 0 })).toBe(92900)
    expect(sellerSubtotalMinor({ seller_subtotal_minor: 92900, seller_subtotal: 929 })).toBe(92900)
    expect(lineTotalMinor({ final_price_minor: 49900, final_price: 0 })).toBe(49900)
    expect(orderTotalMinor({ final_amount: 12.99 })).toBe(1299)
    expect(sellerSubtotalMinor({ seller_subtotal: 929 })).toBe(92900)
    expect(lineTotalMinor({ final_price: 0.1 })).toBe(10)
    expect(orderTotalMinor({ total_minor: 0, final_amount: 0 })).toBe(0)
  })
})

describe("decodeAddressSnapshot", () => {
  const full = { contact_name: "Asha Rao", phone: "9876543210", address_line_1: "12 MG Road", city: "Bengaluru", state: "KA", postal_code: "560001", country: "IN" }
  it("reads base64, JSON and an object", () => {
    expect(decodeAddressSnapshot(Buffer.from(JSON.stringify(full)).toString("base64"))).toMatchObject(full)
    expect(decodeAddressSnapshot(JSON.stringify(full))).toMatchObject(full)
    expect(decodeAddressSnapshot(full)).toMatchObject(full)
  })
  it("answers null for nothing, junk and an empty object", () => {
    expect(decodeAddressSnapshot(null)).toBeNull()
    expect(decodeAddressSnapshot("")).toBeNull()
    expect(decodeAddressSnapshot("not base64 and not json")).toBeNull()
    expect(decodeAddressSnapshot({})).toBeNull()
  })
  it("recognises a post-cutover routing-only snapshot", () => {
    const routing = decodeAddressSnapshot({ city: "Pune", state: "MH", postal_code: "411001", country: "IN" })
    expect(routing).not.toBeNull()
    expect(addressIsRoutingOnly(routing!)).toBe(true)
    expect(addressIsRoutingOnly(decodeAddressSnapshot(full)!)).toBe(false)
  })
})

describe("normaliseShipment", () => {
  it("maps the snake_case keys, still reads PascalCase, prefers snake_case", () => {
    expect(normaliseShipment({ id: "sh-1", order_id: "o-1", seller_id: "s-1", courier: "delhivery", tracking_number: "AWB123456", courier_order_id: "co-9", label_url: "https://x/label.pdf", tracking_url: null, status: "in_transit", eta: null, shipped_at: "2026-09-10T10:00:00Z", delivered_at: null, last_event_at: "2026-09-10T11:00:00Z", created_at: "2026-09-10T09:00:00Z", updated_at: "2026-09-10T11:00:00Z" })).toEqual({
      id: "sh-1", order_id: "o-1", seller_id: "s-1", courier: "delhivery", tracking_number: "AWB123456", courier_order_id: "co-9", tracking_url: null, label_url: "https://x/label.pdf", status: "in_transit", eta: null, shipped_at: "2026-09-10T10:00:00Z", delivered_at: null, last_event_at: "2026-09-10T11:00:00Z", created_at: "2026-09-10T09:00:00Z", updated_at: "2026-09-10T11:00:00Z",
    })
    expect(normaliseShipment({ ID: "sh-1", Courier: "delhivery", TrackingNumber: "AWB123456", Status: "in_transit", ShippedAt: "2026-09-10T10:00:00Z" })).toMatchObject({ id: "sh-1", courier: "delhivery", tracking_number: "AWB123456", status: "in_transit", courier_order_id: null })
    expect(normaliseShipment({ id: "new", ID: "old", courier: "dhl", Courier: "stale", status: "booked" })).toMatchObject({ id: "new", courier: "dhl", status: "booked" })
    expect(normaliseShipment(null)).toBeNull()
    expect(normaliseShipment({})).toBeNull()
  })
  it("normalises events with either spelling and refuses one with no time", () => {
    expect(normaliseShipmentEvent({ id: "e1", shipment_id: "sh-1", status: "delivered", location: "Pune", remark: null, occurred_at: "2026-09-11T00:00:00Z" })).toEqual({ id: "e1", shipment_id: "sh-1", status: "delivered", location: "Pune", remark: null, occurred_at: "2026-09-11T00:00:00Z" })
    expect(normaliseShipmentEvent({ ID: "e1", Status: "delivered", Location: "Pune", OccurredAt: "2026-09-11T00:00:00Z" })).toEqual({ id: "e1", shipment_id: null, status: "delivered", location: "Pune", remark: null, occurred_at: "2026-09-11T00:00:00Z" })
    expect(normaliseShipmentEvent({ status: "x" })).toBeNull()
  })
})

describe("history and timelines", () => {
  const row = (id: string, to: string, at: string, extra: Partial<OrderHistoryRow> = {}) => normaliseHistoryRow({ id, to_status: to, created_at: at, ...extra })!
  const history = [
    row("h1", "created", "2026-09-01T09:00:00Z", { actor_type: "system" }),
    row("h2", "paid", "2026-09-01T09:05:00Z", { actor_type: "system" }),
    row("h3", "confirmed", "2026-09-01T09:05:01Z", { actor_type: "system" }),
    row("h4", "packed", "2026-09-02T09:00:00Z", { actor_type: "seller", notes: "packed by seller" }),
    row("h5", "shipped", "2026-09-02T12:00:00Z", { actor_type: "seller" }),
  ]
  it("normaliseHistoryRow keeps every field, nulls the omitempty ones, refuses a row with no status or time", () => {
    expect(normaliseHistoryRow({ id: "h1", order_id: "o-1", to_status: "created", actor_type: "system", created_at: "2026-09-01T09:00:00Z" })).toEqual({ id: "h1", order_id: "o-1", from_status: null, to_status: "created", changed_by: null, actor_type: "system", notes: null, created_at: "2026-09-01T09:00:00Z" })
    expect(normaliseHistoryRow({ id: "h", created_at: "2026-09-01T09:00:00Z" })).toBeNull()
    expect(normaliseHistoryRow({ id: "h", to_status: "paid" })).toBeNull()
  })
  it("walks the history in time order with the seller-facing labels", () => {
    const t = timelineFromHistory(history)
    expect(t.map((e) => e.label)).toEqual(["Order placed", "Payment received", "Order confirmed", "Packed", "Handed to courier"])
    expect(t[3].detail).toBe("by you: packed by seller")
    expect(t[0].detail).toBe("by the platform")
  })
  it("merges courier events the status never recorded and drops the ones it did", () => {
    const events = [normaliseShipmentEvent({ id: "a", status: "in_transit", location: "Hub", occurred_at: "2026-09-03T08:00:00Z" })!, normaliseShipmentEvent({ id: "d", status: "delivered", occurred_at: "2026-09-05T10:00:00Z" })!]
    const keys = timelineFromHistory([...history, row("h6", "delivered", "2026-09-05T10:00:00Z")], events).map((e) => e.key)
    expect(keys).toContain("event-a")
    expect(keys).not.toContain("event-d")
    expect(keys).toContain("history-h6")
    expect(timelineFromHistory([])).toEqual([])
  })
  it("buildTimeline is the fallback: placed, paid (no time), booked, shipped, events, cancelled", () => {
    const order = { created_at: "2026-09-01T09:00:00Z", updated_at: "2026-09-03T09:00:00Z", status: "shipped", payment_status: "paid" }
    const shipment = normaliseShipment({ ID: "sh", Courier: "delhivery", TrackingNumber: "AWB1", Status: "in_transit", CreatedAt: "2026-09-02T09:00:00Z", ShippedAt: "2026-09-02T12:00:00Z" })!
    const events = [normaliseShipmentEvent({ ID: "b", Status: "out_for_delivery", OccurredAt: "2026-09-04T08:00:00Z" })!, normaliseShipmentEvent({ ID: "a", Status: "in_transit", OccurredAt: "2026-09-03T08:00:00Z" })!]
    expect(buildTimeline(order, shipment, events).map((e) => e.key)).toEqual(["placed", "paid", "booked", "shipped", "event-a", "event-b"])
    expect(buildTimeline(order, null).find((e) => e.key === "paid")?.at).toBeNull()
    const t = buildTimeline({ ...order, status: "cancelled", cancelled_by: "customer", cancellation_reason: "changed mind" }, null)
    expect(t[t.length - 1]).toMatchObject({ key: "cancelled", at: order.updated_at, detail: "by customer: changed mind" })
    expect(buildTimeline({ status: "created" }, null)).toEqual([])
  })
})

describe("small helpers", () => {
  it("variantSummary renders option pairs from base64, JSON or an object, nothing otherwise", () => {
    const obj = { size: "M", colour: "Navy" }
    expect(variantSummary(obj)).toBe("Size: M · Colour: Navy")
    expect(variantSummary(JSON.stringify(obj))).toBe("Size: M · Colour: Navy")
    expect(variantSummary(Buffer.from(JSON.stringify(obj)).toString("base64"))).toBe("Size: M · Colour: Navy")
    expect(variantSummary(null)).toBe("")
    expect(variantSummary({})).toBe("")
  })
  it("isNotFound is any 404 and shortId is the first uuid block", () => {
    expect(isNotFound({ response: { status: 404 } })).toBe(true)
    expect(isNotFound({ response: { status: 403 } })).toBe(false)
    expect(isNotFound(undefined)).toBe(false)
    expect(shortId("7cd6ea3a-9c80-4f20-806f-5d08de0f914b")).toBe("7CD6EA3A")
    expect(shortId(undefined)).toBe("unknown")
  })
})
