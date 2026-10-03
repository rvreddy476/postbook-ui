/*
  The Kitchen role gate. GET /v1/food/me/capabilities decides, and it FAILS
  CLOSED: the console renders only on an explicit, well-formed
  `is_restaurant_owner: true` AND a non-empty list of the caller's own
  restaurants. A network error, a non-2xx, a malformed body, a missing
  field, a truthy-but-not-true value — all keep the console shut.
*/

import { ContractError, envelopeData } from "./decode"
import { decodeCapabilities, decodeRestaurantList, type PartnerRestaurant } from "./wire"

export type GateDecision =
  | { kind: "owner"; restaurants: PartnerRestaurant[] }
  /** Signed in, not a partner: offer "Become a restaurant partner". */
  | { kind: "not-partner" }
  /** Anything we could not read. The console stays closed; the user may retry. */
  | { kind: "error"; message: string }

export interface GateInputs {
  /** The raw capabilities response body, or the thrown error. */
  capabilities: { ok: true; body: unknown } | { ok: false; error: unknown }
  /** The raw partner restaurant list body; only fetched for an owner. */
  restaurants?: { ok: true; body: unknown } | { ok: false; error: unknown }
}

export function decideGate(input: GateInputs): GateDecision {
  if (!input.capabilities.ok) return { kind: "error", message: "We couldn't check your restaurant access. Try again." }
  let isOwner: boolean
  try {
    isOwner = decodeCapabilities(envelopeData(input.capabilities.body)).isRestaurantOwner === true
  } catch (e) {
    return { kind: "error", message: e instanceof ContractError ? "The server sent an answer this page can't read." : "We couldn't check your restaurant access." }
  }
  if (!isOwner) return { kind: "not-partner" }
  if (!input.restaurants) return { kind: "error", message: "We couldn't load your restaurants. Try again." }
  if (!input.restaurants.ok) return { kind: "error", message: "We couldn't load your restaurants. Try again." }
  try {
    const restaurants = decodeRestaurantList(envelopeData(input.restaurants.body))
    // Capabilities said owner but the list is empty: trust the narrower answer.
    if (restaurants.length === 0) return { kind: "not-partner" }
    return { kind: "owner", restaurants }
  } catch {
    return { kind: "error", message: "The server sent an answer this page can't read." }
  }
}

/** Which restaurant to open: the remembered one if still owned, else the only one, else ask. */
export function pickRestaurant(restaurants: readonly PartnerRestaurant[], remembered: string | null): string | null {
  if (remembered && restaurants.some((r) => r.id === remembered)) return remembered
  return restaurants.length === 1 ? restaurants[0].id : null
}
