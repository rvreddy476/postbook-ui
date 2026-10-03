/*
  Which card a restaurant shows for the chosen address.

  * With a delivery point the restaurant routes judge serviceability by the
    same rule POST /orders applies, and `serviceable` /
    `unserviceable_reason_code` / `unserviceable_message` ARE the answer: the
    card shows the server's own message.
  * Without a point (no address chosen, or one with no pin) those fields are
    absent, and only then does the client read the restaurant's flags.
  * A refusal the server returned at add-to-cart (422 with one of the
    REFUSAL_CODES) is remembered per address and blocks further adds with the
    server's words; a fresh restaurant-route answer supersedes it only for
    the codes those routes judge.

  Browsing is never blocked: the card only disables "Add".
*/

import type { Restaurant } from "./wire"

export type CardKind = "open" | "out_of_range" | "closed" | "not_accepting" | "unavailable"

export interface ServiceCard {
  kind: CardKind
  /** The fixed heading for the kind; empty for "open". */
  title: string
  /** The server's words when it wrote any, else the client's wording. */
  message: string
  fromServer: boolean
  code: string | null
  /** ISO time the restaurant next opens, when the server said. */
  nextOpensAt: string | null
}

export const CARD_TITLES: Record<CardKind, string> = {
  open: "",
  out_of_range: "Doesn't deliver here",
  closed: "Closed",
  not_accepting: "Not accepting orders",
  unavailable: "Can't take orders right now",
}

/** The 422/503 codes by which the server refuses an order for a reason more food cannot fix. */
export const REFUSAL_CODES: ReadonlySet<string> = new Set([
  "FOOD_RESTAURANT_NOT_ACCEPTING",
  "FOOD_RESTAURANT_OUTSIDE_HOURS",
  "FOOD_ADDRESS_OUT_OF_RANGE",
  "FOOD_ADDRESS_LOCATION_REQUIRED",
  "FOOD_RESTAURANT_LOCATION_MISSING",
  "FOOD_RESTAURANT_TAX_CATEGORY_MISSING",
  "FOOD_RESTAURANT_STATE_UNKNOWN",
  "FOOD_RESTAURANT_GSTIN_MISSING",
  "FOOD_PLATFORM_GSTIN_NOT_CONFIGURED",
])

/** The refusals the restaurant routes judge for a point; a fresh answer from them supersedes a remembered one. */
const JUDGED_BY_RESTAURANT_ROUTES: ReadonlySet<string> = new Set([
  "FOOD_RESTAURANT_NOT_ACCEPTING",
  "FOOD_RESTAURANT_OUTSIDE_HOURS",
  "FOOD_ADDRESS_OUT_OF_RANGE",
  "FOOD_ADDRESS_LOCATION_REQUIRED",
  "FOOD_RESTAURANT_LOCATION_MISSING",
])

export function kindForCode(code: string | null): CardKind {
  switch (code) {
    case "FOOD_ADDRESS_OUT_OF_RANGE":
    case "FOOD_ADDRESS_LOCATION_REQUIRED":
    case "FOOD_RESTAURANT_LOCATION_MISSING":
      return "out_of_range"
    case "FOOD_RESTAURANT_OUTSIDE_HOURS":
      return "closed"
    case "FOOD_RESTAURANT_NOT_ACCEPTING":
      return "not_accepting"
    default:
      return "unavailable"
  }
}

const OPEN: ServiceCard = { kind: "open", title: "", message: "", fromServer: false, code: null, nextOpensAt: null }

function displayName(r: Pick<Restaurant, "name">): string {
  return r.name.trim() || "This restaurant"
}

/** The restaurant routes' answer for the point sent, or null when no point was sent. */
export function fromServer(r: Restaurant): ServiceCard | null {
  if (r.serviceable === null) return null
  if (r.serviceable) return OPEN
  const code = r.unserviceableReasonCode?.trim() || null
  const kind = kindForCode(code)
  const message = r.unserviceableMessage?.trim() || ""
  return {
    kind,
    title: CARD_TITLES[kind],
    message: message || `${displayName(r)} can't take your order right now.`,
    fromServer: Boolean(message),
    code,
    nextOpensAt: kind === "closed" ? r.nextOpensAt : null,
  }
}

/** The fallback when the server was not asked about a point. */
export function fromFlags(r: Restaurant): ServiceCard {
  if (r.status && r.status !== "ACTIVE") {
    return { kind: "not_accepting", title: CARD_TITLES.not_accepting, message: `${displayName(r)} isn't taking orders.`, fromServer: false, code: null, nextOpensAt: null }
  }
  if (!r.isOpen || r.isOpenNow === false) {
    return { kind: "closed", title: CARD_TITLES.closed, message: `${displayName(r)} is closed right now.`, fromServer: false, code: null, nextOpensAt: r.nextOpensAt }
  }
  if (!r.isAcceptingOrders) {
    return { kind: "not_accepting", title: CARD_TITLES.not_accepting, message: `${displayName(r)} isn't accepting orders right now.`, fromServer: false, code: null, nextOpensAt: null }
  }
  return OPEN
}

/** A server refusal (add-to-cart, place order) as a card with the server's words, or null when it is not one. */
export function fromRefusal(code: string, message: string): ServiceCard | null {
  if (!REFUSAL_CODES.has(code)) return null
  const kind = kindForCode(code)
  const text = message.trim()
  return {
    kind,
    title: CARD_TITLES[kind],
    message: text || "This restaurant can't take your order right now.",
    fromServer: Boolean(text),
    code,
    nextOpensAt: null,
  }
}

/** The card to show: the server's answer, else the flags, with a remembered refusal taken into account. */
export function serviceCard(r: Restaurant, remembered: ServiceCard | null = null): ServiceCard {
  const server = fromServer(r)
  if (!remembered || remembered.kind === "open") return server ?? fromFlags(r)
  if (server && remembered.code && JUDGED_BY_RESTAURANT_ROUTES.has(remembered.code)) return server
  return remembered
}

export function canOrder(card: ServiceCard): boolean {
  return card.kind === "open"
}

/** "1.2 km" / "800 m". */
export function formatDistance(meters: number | null): string {
  if (meters === null || !Number.isFinite(meters) || meters < 0) return ""
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`
  const tenths = Math.round((meters / 1000) * 10)
  return `${Math.floor(tenths / 10)}.${tenths % 10} km`
}

/** "Opens 6:00 pm" (today) or "Opens Sat 6:00 pm". */
export function formatNextOpening(iso: string | null, now: Date = new Date()): string {
  if (!iso) return ""
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ""
  const time = at.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
  const sameDay = at.toDateString() === now.toDateString()
  if (sameDay) return `Opens ${time}`
  const day = at.toLocaleDateString("en-IN", { weekday: "short" })
  return `Opens ${day} ${time}`
}

/* ── remembered refusals, per address ─────────────────────────────── */

export interface RefusalStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const REFUSAL_PREFIX = "feast.refusal."

function refusalKey(restaurantId: string, addressId: string | null): string {
  return `${REFUSAL_PREFIX}${restaurantId}.${addressId ?? "none"}`
}

export function rememberRefusal(store: RefusalStore | null, restaurantId: string, addressId: string | null, card: ServiceCard): void {
  if (!store) return
  try {
    store.setItem(refusalKey(restaurantId, addressId), JSON.stringify(card))
  } catch {
    /* storage refused; the server will refuse again */
  }
}

export function recallRefusal(store: RefusalStore | null, restaurantId: string, addressId: string | null): ServiceCard | null {
  if (!store) return null
  try {
    const raw = store.getItem(refusalKey(restaurantId, addressId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as ServiceCard
    return parsed && typeof parsed.kind === "string" && typeof parsed.message === "string" ? parsed : null
  } catch {
    return null
  }
}
