/*
  Travel mode (mechanic M8): GET / PUT / DELETE /v1/dating/travel, every one
  answering the same shape:

    {active?: {city: {code, label}, starts_at, ends_at}, available, cities: [{code, label}], max_days}

  A pass holder picks a city from the server's fixed list and browses it for
  1 to `max_days` days; their deck and picks become that city's. The client
  never decides who may travel: `available` (and a 403 TRAVEL_REQUIRES_PASS)
  does. A trip stops applying the moment the pass runs out, so a trip with
  `available: false` is shown as ended-in-effect, with only "End trip" left.

    404 MECHANIC_NOT_ENABLED → travel is hidden;
    400 INVALID_CITY / INVALID_TRAVEL_DAYS → said in our words.
*/

import { arr, bool, num, obj, str, time } from "./wire"

/** The longest trip (dating-service MaxTravelDays), used when the server sends none. */
export const MAX_TRAVEL_DAYS = 7

export interface TravelCity {
  code: string
  label: string
}

export interface TravelTrip {
  city: TravelCity
  startsAt: string
  endsAt: string
}

export interface TravelState {
  /** null: no trip. */
  active: TravelTrip | null
  /** The caller holds a pass, so they may start a trip. */
  available: boolean
  /** Alphabetical by label. */
  cities: TravelCity[]
  maxDays: number
}

function toTravelCity(wire: unknown): TravelCity | null {
  const w = obj(wire)
  const code = str(w.code)
  return code ? { code, label: str(w.label) || code } : null
}

export function toTravelState(wire: unknown): TravelState {
  const w = obj(wire)
  const seen = new Set<string>()
  const cities = arr(w.cities)
    .map(toTravelCity)
    .filter((c): c is TravelCity => c !== null && !seen.has(c.code) && !!seen.add(c.code))
    .sort((a, b) => a.label.localeCompare(b.label))
  const a = obj(w.active)
  const city = toTravelCity(a.city)
  const max = Math.floor(num(w.max_days))
  return {
    active: city ? { city, startsAt: time(a.starts_at), endsAt: time(a.ends_at) } : null,
    available: bool(w.available),
    cities,
    maxDays: max > 0 ? max : MAX_TRAVEL_DAYS,
  }
}

/* ── what the page shows ─────────────────────────────────────────── */

/**
    locked: no pass (or a 403 since the page loaded): the upsell, and "End
            trip" if a trip is still on record;
    active: a trip in effect: where, until when, and "End trip";
    ready:  a pass and no trip: the form.
*/
export type TravelView = "locked" | "active" | "ready"

export function travelView(state: Pick<TravelState, "active" | "available">, lockedByServer = false): TravelView {
  if (lockedByServer || !state.available) return "locked"
  return state.active ? "active" : "ready"
}

/** The trip in effect for the deck's banner: a pass, a trip, and an end still ahead. */
export function activeTrip(state: TravelState | null | undefined, nowMs: number = Date.now()): TravelTrip | null {
  if (!state?.available || !state.active) return null
  const end = state.active.endsAt ? Date.parse(state.active.endsAt) : Number.NaN
  if (!Number.isNaN(end) && end <= nowMs) return null
  return state.active
}

/** 1 … maxDays, for the days select. */
export function dayChoices(maxDays: number): number[] {
  const max = maxDays > 0 ? Math.floor(maxDays) : MAX_TRAVEL_DAYS
  return Array.from({ length: max }, (_, i) => i + 1)
}

export function daysLabel(days: number): string {
  return days === 1 ? "1 day" : `${days} days`
}

/** The days picked when the form opens: three, or fewer when the server allows fewer. */
export function defaultDays(maxDays: number): number {
  return Math.min(3, Math.max(1, Math.floor(maxDays) || 1))
}

export interface TravelForm {
  city: string
  days: number
}

/** Why the form can't be sent yet; "" when it can. Checked against the server's own list. */
export function travelProblem(form: TravelForm, state: Pick<TravelState, "cities" | "maxDays">): string {
  if (!form.city) return "Pick a city."
  if (!state.cities.some((c) => c.code === form.city)) return "Pick a city from the list."
  if (!Number.isInteger(form.days) || form.days < 1 || form.days > state.maxDays) return `Choose a trip of 1 to ${state.maxDays} days.`
  return ""
}

/** PUT /travel. */
export function travelBody(form: TravelForm): { city: string; days: number } {
  return { city: form.city, days: form.days }
}

/** "Thu, 9 Oct, 6:30 pm" in the reader's locale; "" when unknown. */
export function tripUntil(endsAt: string, locale?: string): string {
  if (!endsAt) return ""
  const at = new Date(endsAt)
  if (Number.isNaN(at.getTime())) return ""
  const day = at.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })
  const clock = at.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
  return `${day}, ${clock}`
}

/** The deck's banner: "Browsing Mumbai until Thu, 9 Oct, 6:30 pm". */
export function tripBanner(trip: TravelTrip, locale?: string): string {
  const until = tripUntil(trip.endsAt, locale)
  return until ? `Browsing ${trip.city.label} until ${until}` : `Browsing ${trip.city.label}`
}
