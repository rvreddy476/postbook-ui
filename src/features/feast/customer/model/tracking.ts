/*
  Order tracking rules.

  * The delivery code is shown only while the rider has the food:
    PICKED_UP or OUT_FOR_DELIVERY. The rider enters it (the customer route
    answers 410 FOOD_DELIVERY_CODE_ENTERED_BY_RIDER), so before pickup it
    would only leak, and after delivery it means nothing.
  * The rider's location moves only forward: a fix replaces the shown one
    only when its recorded_at is newer. SSE and polling race; an older
    frame must never pull the pin backwards.
*/

import type { Point } from "./wire"

export const CODE_VISIBLE_STATUSES: ReadonlySet<string> = new Set(["PICKED_UP", "OUT_FOR_DELIVERY"])

export function deliveryCodeVisible(status: string, code: string | null | undefined): boolean {
  return CODE_VISIBLE_STATUSES.has(status) && typeof code === "string" && code.trim().length > 0
}

export const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  "DELIVERED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_RESTAURANT",
  "CANCELLED_BY_ADMIN",
  "RESTAURANT_REJECTED",
  "PAYMENT_FAILED",
  "REFUND_PENDING",
  "REFUNDED",
  "FAILED",
])

export function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.has(status)
}

export const LIVE_POLL_MS = 10_000

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PLACED: "Placed",
  PAYMENT_PENDING: "Awaiting payment",
  PAYMENT_FAILED: "Payment failed",
  CONFIRMED: "Confirmed",
  RESTAURANT_REJECTED: "Declined by the restaurant",
  PREPARING: "Being prepared",
  READY_FOR_PICKUP: "Ready for pickup",
  DELIVERY_ASSIGNING: "Finding a delivery partner",
  DELIVERY_ASSIGNED: "Delivery partner assigned",
  PICKED_UP: "Picked up",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED_BY_CUSTOMER: "Cancelled",
  CANCELLED_BY_RESTAURANT: "Cancelled by the restaurant",
  CANCELLED_BY_ADMIN: "Cancelled",
  REFUND_PENDING: "Refund in progress",
  REFUNDED: "Refunded",
  FAILED: "Failed",
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? (status ? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ") : "")
}

/** The customer may cancel only before the restaurant accepts. */
export function canCancel(status: string): boolean {
  return status === "PAYMENT_PENDING" || status === "PLACED"
}

/**
  Timestamps arrive both as RFC 3339 ("2026-09-13T07:05:00Z") and as
  Postgres text ("2026-09-13 06:55:00+00"). Milliseconds since epoch, or
  null when unreadable.
*/
export function parseServerTime(raw: string | null | undefined): number | null {
  if (!raw) return null
  let s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2} /.test(s)) s = s.replace(" ", "T")
  s = s.replace(/([+-]\d{2})$/, "$1:00")
  const ms = Date.parse(s)
  return Number.isNaN(ms) ? null : ms
}

function validFix(p: Point | null | undefined): p is Point {
  return Boolean(
    p &&
      typeof p.latitude === "number" &&
      typeof p.longitude === "number" &&
      Math.abs(p.latitude) <= 90 &&
      Math.abs(p.longitude) <= 180 &&
      parseServerTime(p.recordedAt) !== null,
  )
}

/** The rider fix to show: `next` only when it is valid and strictly newer than `current`. */
export function newerRiderFix(current: Point | null, next: Point | null | undefined): Point | null {
  if (!validFix(next)) return current
  if (!validFix(current)) return next
  return (parseServerTime(next.recordedAt) as number) > (parseServerTime(current.recordedAt) as number) ? next : current
}

/** A plain maps link for a point; no key needed. */
export function mapsLink(p: Pick<Point, "latitude" | "longitude"> | null): string | null {
  if (!p || typeof p.latitude !== "number" || typeof p.longitude !== "number") return null
  return `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`
}
