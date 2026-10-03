/*
  Order statuses as a kitchen reads them, and which action each allows
  (food-service orderstate; handler.go partner transitions).

    CONFIRMED          accept → PREPARING, reject → RESTAURANT_REJECTED
    PREPARING          mark ready → READY_FOR_PICKUP (chains to DELIVERY_ASSIGNING)
    READY_FOR_PICKUP,
    DELIVERY_ASSIGNING,
    DELIVERY_ASSIGNED  the rider's pickup code → PICKED_UP
*/

import type { Tone } from "./checklist"
import { humanise } from "./checklist"

export type OrderAction = "accept" | "reject" | "mark-preparing" | "mark-ready"

export const AWAITING_PICKUP: ReadonlySet<string> = new Set(["READY_FOR_PICKUP", "DELIVERY_ASSIGNING", "DELIVERY_ASSIGNED"])

/** Orders that belong on the live board (besides the CONFIRMED queue). */
export const ACTIVE_STATUSES: ReadonlySet<string> = new Set(["PREPARING", ...AWAITING_PICKUP])

export function orderStatusLabel(status: string): string {
  switch (status) {
    case "CONFIRMED":
      return "New"
    case "PREPARING":
      return "Preparing"
    case "READY_FOR_PICKUP":
      return "Ready for pickup"
    case "DELIVERY_ASSIGNING":
      return "Finding a rider"
    case "DELIVERY_ASSIGNED":
      return "Rider on the way"
    case "PICKED_UP":
      return "Picked up"
    case "OUT_FOR_DELIVERY":
      return "Out for delivery"
    case "DELIVERED":
      return "Delivered"
    case "RESTAURANT_REJECTED":
      return "Rejected"
    case "CANCELLED_BY_CUSTOMER":
      return "Cancelled by customer"
    case "CANCELLED_BY_RESTAURANT":
      return "Cancelled"
    case "CANCELLED_BY_ADMIN":
      return "Cancelled by Feast"
    case "REFUND_PENDING":
      return "Refund pending"
    case "REFUNDED":
      return "Refunded"
    default:
      return humanise(status)
  }
}

export function orderStatusTone(status: string): Tone {
  if (status === "CONFIRMED") return "warning"
  if (status === "PICKED_UP" || status === "OUT_FOR_DELIVERY" || status === "DELIVERED") return "positive"
  if (status.startsWith("CANCELLED") || status === "RESTAURANT_REJECTED" || status.startsWith("REFUND")) return "danger"
  return "neutral"
}

/** Reject reasons offered to the kitchen, alphabetical. */
export const REJECT_REASONS: readonly string[] = [
  "Closing soon",
  "Item out of stock",
  "Kitchen too busy",
  "Other",
].slice().sort((a, b) => a.localeCompare(b))

/** A pickup code as typed: digits and letters only, at most 8. */
export function normalisePickupCode(s: string): string {
  return s.replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 8)
}
