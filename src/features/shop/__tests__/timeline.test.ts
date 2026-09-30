import { describe, expect, it } from "bun:test"

import type { WireShipmentWithEvents } from "@/features/shop/model/orders"
import { buildTimeline, shipmentEvents, trackingSummary } from "@/features/shop/orders/timeline"

const T0 = Date.parse("2026-09-30T09:00:00Z")

function event(id: string, status: string, at: string, extra: Partial<{ location: string; remark: string }> = {}) {
  return { id, shipment_id: "sh-1", status, location: extra.location ?? null, remark: extra.remark ?? null, occurred_at: at, created_at: at }
}

const shipments: WireShipmentWithEvents[] = [
  {
    shipment: {
      id: "sh-1",
      order_id: "o-1",
      seller_id: "s-1",
      courier: "Delhivery",
      tracking_number: "AWB123",
      tracking_url: "https://track.example/AWB123",
      status: "in_transit",
      shipped_at: "2026-09-30T12:00:00Z",
      created_at: "2026-09-30T11:00:00Z",
    },
    // Deliberately out of order on the wire.
    events: [
      event("e3", "in_transit", "2026-09-30T18:00:00Z", { location: "Hyderabad hub" }),
      event("e1", "booked", "2026-09-30T11:00:00Z"),
      event("e2", "picked_up", "2026-09-30T12:00:00Z", { location: "Seller" }),
    ],
  },
]

describe("shipment events", () => {
  it("are flattened across shipments and sorted oldest first", () => {
    const events = shipmentEvents(shipments)
    expect(events.map((e) => e.key)).toEqual(["e1", "e2", "e3"])
    expect(events.map((e) => e.label)).toEqual(["Courier booked", "Picked up", "In transit"])
    expect(events[2].location).toBe("Hyderabad hub")
  })
  it("keep wire order for two events at the same instant, and cope with nulls", () => {
    const same = [{ shipment: null, events: [event("a", "x", "2026-09-30T10:00:00Z"), event("b", "y", "2026-09-30T10:00:00Z")] }]
    expect(shipmentEvents(same).map((e) => e.key)).toEqual(["a", "b"])
    expect(shipmentEvents(null)).toEqual([])
    expect(shipmentEvents([{ shipment: null, events: null }])).toEqual([])
  })
})

describe("the rail", () => {
  it("is placed → confirmed → packed → shipped → out for delivery → delivered, in that order", () => {
    const keys = buildTimeline({ status: "confirmed", paymentStatus: "paid", createdAtMs: T0, shipments: [] }).map((e) => e.key)
    expect(keys).toEqual(["placed", "confirmed", "packed", "shipped", "out_for_delivery", "delivered"])
  })
  it("marks the steps reached as done, the last reached as current, the rest to do", () => {
    const entries = buildTimeline({ status: "shipped", paymentStatus: "paid", createdAtMs: T0, shipments })
    expect(entries.map((e) => e.state)).toEqual(["done", "done", "done", "current", "todo", "todo"])
    expect(entries[0].atMs).toBe(T0)
    // "Shipped" takes its time from the first shipped-family event.
    expect(entries[3].atMs).toBe(Date.parse("2026-09-30T12:00:00Z"))
    expect(entries[3].events.map((e) => e.key)).toEqual(["e2", "e3"])
    expect(entries[2].events.map((e) => e.key)).toEqual(["e1"])
    expect(entries[5].atMs).toBe(0)
  })
  it("a confirming order is current at 'Order placed'", () => {
    const entries = buildTimeline({ status: "payment_pending", paymentStatus: "pending", createdAtMs: T0, shipments: [] })
    expect(entries[0].state).toBe("current")
    expect(entries.slice(1).every((e) => e.state === "todo")).toBe(true)
  })
  it("delivered is all done, with the delivered time from the shipment", () => {
    const delivered = [{ ...shipments[0], shipment: { ...shipments[0].shipment!, delivered_at: "2026-10-02T10:00:00Z" } }]
    const entries = buildTimeline({ status: "delivered", paymentStatus: "paid", createdAtMs: T0, shipments: delivered })
    expect(entries.every((e) => e.state === "done")).toBe(true)
    expect(entries[5].atMs).toBe(Date.parse("2026-10-02T10:00:00Z"))
  })
})

describe("endings", () => {
  it("payment failed: placed, then the ending; nothing it never reached", () => {
    const entries = buildTimeline({ status: "payment_failed", paymentStatus: "failed", createdAtMs: T0, shipments: [] })
    expect(entries.map((e) => e.key)).toEqual(["placed", "payment_failed"])
    expect(entries[1]).toMatchObject({ label: "Payment failed", state: "current" })
  })
  it("cancelled after shipping keeps the steps the shipments prove, then Cancelled", () => {
    const entries = buildTimeline({ status: "cancelled", paymentStatus: "paid", createdAtMs: T0, shipments })
    expect(entries.map((e) => e.key)).toEqual(["placed", "confirmed", "packed", "shipped", "cancelled"])
    expect(entries.slice(0, 4).every((e) => e.state === "done")).toBe(true)
    expect(entries[4].state).toBe("current")
  })
  it("cancelled before payment is just placed → Cancelled; expired and refunded read the same way", () => {
    expect(buildTimeline({ status: "cancelled", paymentStatus: "pending", createdAtMs: T0, shipments: [] }).map((e) => e.key)).toEqual(["placed", "cancelled"])
    expect(buildTimeline({ status: "expired", paymentStatus: "pending", createdAtMs: T0, shipments: [] }).at(-1)?.label).toBe("Expired")
    const refunded = buildTimeline({ status: "refunded", paymentStatus: "paid", createdAtMs: T0, shipments: [] })
    expect(refunded.map((e) => e.key)).toEqual(["placed", "confirmed", "refunded"])
    expect(buildTimeline({ status: "refund_pending", paymentStatus: "paid", createdAtMs: T0, shipments: [] }).at(-1)?.label).toBe("Refund pending")
  })
  it("events with no rail step hang under the ending", () => {
    const rto = [{ shipment: null, events: [event("r", "rto", "2026-10-01T00:00:00Z")] }]
    const entries = buildTimeline({ status: "cancelled", paymentStatus: "paid", createdAtMs: T0, shipments: rto })
    expect(entries.at(-1)?.events.map((e) => e.label)).toEqual(["Returning to seller"])
  })
})

describe("tracking", () => {
  it("names the courier, the AWB and the link from the first shipment that has one", () => {
    expect(trackingSummary(shipments)).toEqual({ courier: "Delhivery", trackingNumber: "AWB123", trackingUrl: "https://track.example/AWB123" })
    expect(trackingSummary([])).toBeNull()
    expect(trackingSummary([{ shipment: null, events: [] }])).toBeNull()
  })
})
