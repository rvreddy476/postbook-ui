/*
  The status timeline on the order page: a fixed rail of the steps an order
  walks (placed → confirmed → packed → shipped → out for delivery →
  delivered), with the courier's events from GET /orders/:id/shipments
  hung under the steps they belong to, in the order they happened.

  Pure: the order's status, its dates and the shipments in; entries out.
  An order that ended early (cancelled, expired, payment failed, refunded)
  shows the steps it reached and then that ending, not the steps it never
  took.
*/

import { epochMs, type WireShipmentWithEvents } from "../model/orders"

export type StepState = "done" | "current" | "todo"

export interface TimelineEvent {
  key: string
  /** The courier's status word, as sent. */
  status: string
  label: string
  location: string
  remark: string
  atMs: number
}

export interface TimelineEntry {
  key: string
  label: string
  state: StepState
  atMs: number
  events: TimelineEvent[]
}

export interface TimelineInput {
  status: string
  paymentStatus: string
  createdAtMs: number
  shipments: WireShipmentWithEvents[] | null | undefined
}

/** The rail, in walking order, keyed by the order status that reaches it. */
const RAIL: ReadonlyArray<{ key: string; label: string }> = [
  { key: "placed", label: "Order placed" },
  { key: "confirmed", label: "Payment confirmed" },
  { key: "packed", label: "Packed" },
  { key: "shipped", label: "Shipped" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
]

/** How far along the rail each order status is (index of the last done step). */
const REACHED: Record<string, number> = {
  payment_pending: 0,
  payment_failed: 0,
  confirmed: 1,
  packed: 2,
  shipped: 3,
  out_for_delivery: 4,
  delivered: 5,
  // Endings: the steps before them count as reached only through the
  // shipments' evidence, see `reachedThroughShipments`.
  cancelled: 0,
  expired: 0,
  refund_pending: 0,
  refunded: 0,
}

const ENDINGS: Record<string, string> = {
  payment_failed: "Payment failed",
  cancelled: "Cancelled",
  expired: "Expired",
  refund_pending: "Refund pending",
  refunded: "Refunded",
}

/** Which rail step a courier event belongs under, by its status word. */
const EVENT_STEP: Record<string, string> = {
  created: "packed",
  booked: "packed",
  pickup_scheduled: "packed",
  picked_up: "shipped",
  shipped: "shipped",
  in_transit: "shipped",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
}

const EVENT_LABELS: Record<string, string> = {
  created: "Shipment created",
  booked: "Courier booked",
  pickup_scheduled: "Pickup scheduled",
  picked_up: "Picked up",
  shipped: "Shipped",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  failed_delivery: "Delivery attempted",
  rto: "Returning to seller",
  cancelled: "Shipment cancelled",
}

function eventLabel(status: string): string {
  if (EVENT_LABELS[status]) return EVENT_LABELS[status]
  const words = (status || "").replace(/_/g, " ").trim()
  return words ? words[0].toUpperCase() + words.slice(1) : "Update"
}

/** Every courier event across every shipment, oldest first. */
export function shipmentEvents(shipments: WireShipmentWithEvents[] | null | undefined): TimelineEvent[] {
  const out: TimelineEvent[] = []
  for (const sh of shipments || []) {
    for (const ev of sh.events || []) {
      if (!ev) continue
      out.push({
        key: ev.id || `${ev.shipment_id}-${ev.status}-${ev.occurred_at}`,
        status: ev.status || "",
        label: eventLabel(ev.status || ""),
        location: ev.location || "",
        remark: ev.remark || "",
        atMs: epochMs(undefined, ev.occurred_at || ev.created_at),
      })
    }
  }
  // Stable: two events at the same instant keep their wire order.
  return out
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.atMs - b.e.atMs || a.i - b.i)
    .map(({ e }) => e)
}

/** The furthest rail step the shipments prove, for orders that ended early. */
function reachedThroughShipments(events: TimelineEvent[]): number {
  let reached = 0
  for (const ev of events) {
    const step = EVENT_STEP[ev.status]
    if (!step) continue
    const idx = RAIL.findIndex((r) => r.key === step)
    if (idx > reached) reached = idx
  }
  return reached
}

/** When a rail step happened, from the shipments, or 0. */
function stepTime(key: string, events: TimelineEvent[], shipments: WireShipmentWithEvents[] | null | undefined): number {
  const first = events.find((e) => EVENT_STEP[e.status] === key)
  if (first) return first.atMs
  for (const sh of shipments || []) {
    const s = sh.shipment
    if (!s) continue
    if (key === "shipped" && s.shipped_at) return epochMs(undefined, s.shipped_at)
    if (key === "delivered" && s.delivered_at) return epochMs(undefined, s.delivered_at)
  }
  return 0
}

export function buildTimeline(input: TimelineInput): TimelineEntry[] {
  const events = shipmentEvents(input.shipments)
  const ending = ENDINGS[input.status] || ""
  const paidReached = input.paymentStatus === "paid" ? 1 : 0
  const reached = Math.max(REACHED[input.status] ?? 0, ending ? Math.max(paidReached, reachedThroughShipments(events)) : 0)

  const entries: TimelineEntry[] = []
  const lastShown = ending ? reached : RAIL.length - 1
  for (let i = 0; i <= lastShown; i++) {
    const step = RAIL[i]
    let state: StepState
    if (i < reached) state = "done"
    else if (i === reached) state = ending ? "done" : input.status === "delivered" ? "done" : "current"
    else state = "todo"
    if (i === 0 && input.status === "payment_pending") state = "current"
    const atMs = i === 0 ? input.createdAtMs : stepTime(step.key, events, input.shipments)
    entries.push({
      key: step.key,
      label: step.label,
      state,
      atMs: state === "todo" ? 0 : atMs,
      events: events.filter((e) => EVENT_STEP[e.status] === step.key),
    })
  }

  if (ending) {
    entries.push({
      key: input.status,
      label: ending,
      state: "current",
      atMs: 0,
      events: events.filter((e) => !EVENT_STEP[e.status]),
    })
  }
  return entries
}

/** Courier and tracking number for the tracking line, from the first shipment that has one. */
export function trackingSummary(shipments: WireShipmentWithEvents[] | null | undefined): { courier: string; trackingNumber: string; trackingUrl: string } | null {
  for (const sh of shipments || []) {
    const s = sh.shipment
    if (!s) continue
    if (s.courier || s.tracking_number || s.tracking_url) {
      return { courier: s.courier || "", trackingNumber: s.tracking_number || "", trackingUrl: s.tracking_url || "" }
    }
  }
  return null
}
