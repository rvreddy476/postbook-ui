/*
  Dealbreakers (mechanic M12). A preference marked as a dealbreaker works both
  ways: the viewer's deck already keeps to it, and now people who don't fit
  it don't see the viewer either.

  GET/PUT /preferences carry `dealbreakers: string[]` only while the flag is
  on; absent means the feature is hidden (Preferences.dealbreakers === null).
  PUT replaces the whole list. Age, distance and intent are free; the pass
  filters (verified only, height, languages, the lifestyle basics) need a
  pass — 403 DEALBREAKERS_REQUIRE_PASS without one, 400 INVALID_DEALBREAKER
  for an unknown or repeated code, 404 MECHANIC_NOT_ENABLED once the flag is
  off. The server decides all of it; this file only decides what to draw and
  what to send.
*/

import { INTENT_OPTIONS } from "./labels"
import type { FiltersForm, Preferences } from "./profile"
import { toDatingError } from "./wire"

export const FREE_DEALBREAKERS = ["age", "distance", "intent"] as const
export const PASS_DEALBREAKERS = ["verified", "height", "languages", "drinking", "smoking", "exercise", "diet"] as const

export type FreeDealbreaker = (typeof FREE_DEALBREAKERS)[number]
export type PassDealbreaker = (typeof PASS_DEALBREAKERS)[number]
export type DealbreakerCode = FreeDealbreaker | PassDealbreaker

/** The server's order: free codes first, then the pass ones. */
export const DEALBREAKER_ORDER: readonly DealbreakerCode[] = [...FREE_DEALBREAKERS, ...PASS_DEALBREAKERS]

export const DEALBREAKER_HELP = "People who don't fit this won't see you either."
export const DEALBREAKERS_PASS_COPY = "Dealbreakers on height, languages, lifestyle and verified-only come with a pass."
export const DEALBREAKERS_OFF_COPY = "Dealbreakers aren't available right now. Save again to keep your other changes."

/** What each switch is about, for its screen-reader name. */
export const DEALBREAKER_SUBJECT: Record<DealbreakerCode, string> = {
  age: "age range",
  distance: "distance",
  intent: "what they're looking for",
  verified: "verified people only",
  height: "height",
  languages: "languages",
  drinking: "drinking",
  smoking: "smoking",
  exercise: "exercise",
  diet: "diet",
}

export function isDealbreakerCode(code: string): code is DealbreakerCode {
  return (DEALBREAKER_ORDER as readonly string[]).includes(code)
}

export function isPassDealbreaker(code: string): code is PassDealbreaker {
  return (PASS_DEALBREAKERS as readonly string[]).includes(code)
}

/** The flag is on when the server sends the member (a list, even an empty one). */
export function dealbreakersEnabled(p: Pick<Preferences, "dealbreakers"> | null | undefined): boolean {
  return Array.isArray(p?.dealbreakers)
}

/**
  Whether the preference behind a code is set on the filters form, so its
  switch is offered. The age range and the distance always hold a value on
  this form; the rest are set only when something is picked.
*/
export function dealbreakerSetInForm(form: FiltersForm, code: DealbreakerCode): boolean {
  switch (code) {
    case "age":
    case "distance":
      return true
    case "intent":
      return form.intentFilter.length > 0
    case "verified":
      return form.verifiedOnly
    case "height":
      return form.minHeightCm > 0 || form.maxHeightCm > 0
    case "languages":
      return form.languages.length > 0
    case "drinking":
    case "smoking":
    case "exercise":
    case "diet":
      return form[code].length > 0
  }
}

/** The same, from the saved preferences alone (the filters flag off: only the free codes exist). */
export function dealbreakerSetInPreferences(p: Preferences, code: FreeDealbreaker): boolean {
  switch (code) {
    case "age":
      return p.minAge > 0 || p.maxAge > 0
    case "distance":
      return p.distanceKm > 0 || p.distanceBucket !== ""
    case "intent":
      return p.intentFilter.length > 0
  }
}

/** Switch a code on or off; the list stays in the server's order. */
export function toggleDealbreaker(list: readonly string[], code: DealbreakerCode, on: boolean): string[] {
  const set = new Set(list.filter(isDealbreakerCode))
  if (on) set.add(code)
  else set.delete(code)
  return DEALBREAKER_ORDER.filter((c) => set.has(c))
}

/**
  The whole list to PUT: known codes only, once each, in the server's order,
  only for preferences that are set (a dealbreaker on nothing means nothing),
  and without the pass codes when the viewer holds no pass (the server would
  refuse the lot).
*/
export function dealbreakersToSend(list: readonly string[], isSet: (code: DealbreakerCode) => boolean, withPass: boolean): string[] {
  const set = new Set(list)
  return DEALBREAKER_ORDER.filter((c) => set.has(c) && isSet(c) && (withPass || !isPassDealbreaker(c)))
}

export function sameDealbreakers(a: readonly string[], b: readonly string[]): boolean {
  const x = [...new Set(a)].sort()
  const y = [...new Set(b)].sort()
  return x.length === y.length && x.every((c, i) => c === y[i])
}

/**
  Adds `dealbreakers` to a PUT /preferences body, and only when the switches
  were touched: the member is never sent while the flag is off (that is a
  404), and an untouched list is left as the server holds it (so pass codes
  saved earlier survive a save made without a pass). When sent, it is the
  whole list, cleaned by dealbreakersToSend.
*/
export function withDealbreakers(
  body: Record<string, unknown>,
  input: { enabled: boolean; saved: readonly string[]; chosen: readonly string[]; isSet: (code: DealbreakerCode) => boolean; withPass: boolean },
): Record<string, unknown> {
  if (!input.enabled || sameDealbreakers(input.saved, input.chosen)) return body
  return { ...body, dealbreakers: dealbreakersToSend(input.chosen, input.isSet, input.withPass) }
}

/* ── the free-only view (filters flag off) ───────────────────────── */

export interface FreeDealbreakerRow {
  code: FreeDealbreaker
  title: string
  value: string
}

/** The free preferences that are set, with their saved values in words. */
export function freeDealbreakerRows(p: Preferences): FreeDealbreakerRow[] {
  const rows: FreeDealbreakerRow[] = []
  if (dealbreakerSetInPreferences(p, "age")) {
    const range = p.minAge > 0 && p.maxAge > 0 ? `${p.minAge} to ${p.maxAge}` : p.minAge > 0 ? `${p.minAge} and over` : `Up to ${p.maxAge}`
    rows.push({ code: "age", title: "Age", value: range })
  }
  if (p.distanceKm > 0) rows.push({ code: "distance", title: "Distance", value: `Within ${p.distanceKm} km` })
  if (dealbreakerSetInPreferences(p, "intent")) {
    const labels = p.intentFilter.map((c) => INTENT_OPTIONS.find((o) => o.value === c)?.label ?? "").filter(Boolean)
    rows.push({ code: "intent", title: "Looking for", value: labels.join(", ") || "Chosen" })
  }
  return rows
}

/* ── refusals ────────────────────────────────────────────────────── */

export type DealbreakerRefusal = "pass" | "invalid" | "off" | "other"

/**
    DEALBREAKERS_REQUIRE_PASS → pass:    lock the pass codes, show the upsell;
    INVALID_DEALBREAKER       → invalid: an inline error by the switches;
    MECHANIC_NOT_ENABLED      → off:     the switches go;
    anything else             → other.
*/
export function dealbreakerRefusal(error: unknown): DealbreakerRefusal {
  switch (toDatingError(error).code) {
    case "DEALBREAKERS_REQUIRE_PASS":
      return "pass"
    case "INVALID_DEALBREAKER":
      return "invalid"
    case "MECHANIC_NOT_ENABLED":
      return "off"
    default:
      return "other"
  }
}
