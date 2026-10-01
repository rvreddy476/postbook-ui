// The delivery estimate on the product page, and the "Arrives by" line at
// checkout. Pure, so the two things that go wrong on their own are pinned
// by tests: which calendar day a date lands on (it is India's day, not the
// browser's) and what a pincode is.
//
// `GET /products/:id/delivery-estimate?pincode=NNNNNN` (shop-engagement
// contract §1) sends
//   {pincode, serviceable, deliver_by:"2026-10-04", min_days, max_days,
//    dispatch_days, courier, pincode_source:"query"|"default_address"}
// and refuses with 400 PINCODE_REQUIRED (signed out, no pincode), 400
// INVALID_PINCODE, 503 COURIER_UNAVAILABLE. Not serviceable is a 200 with
// `serviceable:false` and no date.

import { apiErrorCode } from "./storefront"

// ── Pincode ────────────────────────────────────────────────────────────

/** Where the shopper's last typed pincode is remembered, per browser. */
export const PINCODE_STORAGE_KEY = "shop.pincode"

/**
 * An Indian PIN: six digits, never starting with 0 (no postal zone is 0).
 * The server is the authority (INVALID_PINCODE); this only stops a request
 * that could never answer.
 */
const PINCODE = /^[1-9]\d{5}$/

/** Spaces and hyphens a person types ("500 081", "500-081") dropped. */
export function normalisePincode(raw: string | null | undefined): string {
  return (raw ?? "").replace(/[\s-]/g, "")
}

export function isValidPincode(raw: string | null | undefined): boolean {
  return PINCODE.test(normalisePincode(raw))
}

/** The part of `localStorage` this file needs, so a test can hand in a Map. */
export interface PincodeStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** `window.localStorage`, or null where touching it throws (private mode, blocked site data, the server). */
export function browserStore(): PincodeStore | null {
  try {
    if (typeof window === "undefined") return null
    return window.localStorage
  } catch {
    return null
  }
}

/** The remembered pincode, or null. A stored value that is not a pincode is ignored, not trusted. */
export function readStoredPincode(store: PincodeStore | null): string | null {
  if (!store) return null
  try {
    const value = normalisePincode(store.getItem(PINCODE_STORAGE_KEY))
    return PINCODE.test(value) ? value : null
  } catch {
    return null
  }
}

/** Remembers a valid pincode; answers whether it was kept. An invalid one is never written. */
export function writeStoredPincode(store: PincodeStore | null, raw: string): boolean {
  const value = normalisePincode(raw)
  if (!store || !PINCODE.test(value)) return false
  try {
    store.setItem(PINCODE_STORAGE_KEY, value)
    return true
  } catch {
    return false
  }
}

// ── Dates ──────────────────────────────────────────────────────────────

export const SHOP_TIME_ZONE = "Asia/Kolkata"

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

const PARTS = new Intl.DateTimeFormat("en-IN", { timeZone: SHOP_TIME_ZONE, weekday: "short", day: "numeric", month: "short" })

/**
 * "Sat, 3 Oct" for a delivery date, as a person in India reads it.
 *
 * `deliver_by` is a calendar date ("2026-10-04"): it is drawn as that day,
 * whatever zone the browser is in (noon UTC of that day is the same day in
 * Kolkata). A full timestamp, should one ever arrive, is converted to
 * Kolkata's day, so 18:30Z is already tomorrow. The parts are assembled
 * here, not left to the locale's pattern, so every runtime prints the same.
 * Answers "" for anything unreadable: no date is better than a wrong one.
 */
export function formatDeliverBy(value: string | null | undefined): string {
  if (!value) return ""
  const only = DATE_ONLY.exec(value)
  let at: Date
  if (only) {
    const [, y, m, d] = only
    at = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12))
    // Reject 2026-02-31 rather than draw 3 March.
    if (at.getUTCMonth() !== Number(m) - 1 || at.getUTCDate() !== Number(d)) return ""
  } else {
    at = new Date(value)
  }
  if (Number.isNaN(at.getTime())) return ""
  const parts = PARTS.formatToParts(at)
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ""
  const weekday = pick("weekday")
  const day = pick("day")
  const month = pick("month")
  if (!weekday || !day || !month) return ""
  return `${weekday}, ${day} ${month}`
}

// ── The estimate ───────────────────────────────────────────────────────

export interface WireDeliveryEstimate {
  pincode?: string
  serviceable?: boolean
  /** "YYYY-MM-DD" in Asia/Kolkata; absent when not serviceable. */
  deliver_by?: string | null
  min_days?: number
  max_days?: number
  dispatch_days?: number
  courier?: string
  pincode_source?: "query" | "default_address" | string
}

export interface DeliveryEstimate {
  pincode: string
  serviceable: boolean
  /** "Sat, 3 Oct", or "" when there is no date. */
  deliverBy: string
  /** The raw date for a <time dateTime>. */
  deliverByIso: string
  maxDays: number | null
  fromDefaultAddress: boolean
}

export function toDeliveryEstimate(wire: WireDeliveryEstimate | null | undefined): DeliveryEstimate {
  const serviceable = wire?.serviceable === true
  const iso = serviceable ? wire?.deliver_by || "" : ""
  return {
    pincode: normalisePincode(wire?.pincode),
    serviceable,
    deliverBy: formatDeliverBy(iso),
    deliverByIso: iso,
    maxDays: typeof wire?.max_days === "number" && wire.max_days > 0 ? wire.max_days : null,
    fromDefaultAddress: wire?.pincode_source === "default_address",
  }
}

/** What the block shows. `ask` means "we need a pincode first". */
export type DeliveryView =
  | { kind: "ask" }
  | { kind: "loading"; pincode: string | null }
  | { kind: "by"; pincode: string; date: string; iso: string }
  | { kind: "deliverable"; pincode: string }
  | { kind: "not_serviceable"; pincode: string }
  | { kind: "invalid"; pincode: string | null }
  | { kind: "unavailable"; pincode: string | null }

/**
 * Whether the page asks the server at all. A typed or remembered pincode is
 * always asked; with none, only a signed-in shopper is (the server reads
 * their default address). A signed-out shopper with no pincode is never
 * sent: the answer would be PINCODE_REQUIRED.
 */
export function shouldAskEstimate(input: { pincode: string | null; signedIn: boolean; known: boolean }): boolean {
  if (input.pincode) return isValidPincode(input.pincode)
  return input.known && input.signedIn
}

/** The block's state from the query's state. Errors branch on the code. */
export function deliveryView(input: {
  pincode: string | null
  asked: boolean
  isLoading: boolean
  estimate: DeliveryEstimate | null
  error: unknown
}): DeliveryView {
  const { pincode } = input
  if (!input.asked) return { kind: "ask" }
  if (input.error) {
    switch (apiErrorCode(input.error)) {
      case "PINCODE_REQUIRED":
        return { kind: "ask" }
      case "INVALID_PINCODE":
        return { kind: "invalid", pincode }
      default:
        return { kind: "unavailable", pincode }
    }
  }
  if (input.isLoading || !input.estimate) return { kind: "loading", pincode }
  const shown = input.estimate.pincode || pincode || ""
  if (!input.estimate.serviceable) return { kind: "not_serviceable", pincode: shown }
  if (input.estimate.deliverBy) return { kind: "by", pincode: shown, date: input.estimate.deliverBy, iso: input.estimate.deliverByIso }
  return { kind: "deliverable", pincode: shown }
}

/** The headline sentence for a state. */
export function deliveryHeadline(view: DeliveryView): string {
  switch (view.kind) {
    case "ask":
      return "Enter a pincode to see when it arrives"
    case "loading":
      return "Checking delivery…"
    case "by":
      return `Delivery by ${view.date}`
    case "deliverable":
      return `Deliverable to ${view.pincode}`
    case "not_serviceable":
      return `Not deliverable to ${view.pincode}`
    case "invalid":
      return view.pincode ? `${view.pincode} is not a valid pincode` : "That pincode is not valid"
    case "unavailable":
      return "Delivery date not available right now"
  }
}

/** "Arrives by Sat, 3 Oct" for checkout, or null when the quote carries no date. */
export function arrivesByLine(deliverBy: string | null | undefined): string | null {
  const date = formatDeliverBy(deliverBy)
  return date ? `Arrives by ${date}` : null
}
