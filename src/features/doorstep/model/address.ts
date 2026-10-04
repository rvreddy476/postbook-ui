/*
  Doorstep's own addresses (GET/POST/PATCH/DELETE /v1/doorstep/addresses),
  not Feast's or the shop's: a Doorstep address must carry a pin inside a
  service zone, and only its locality is ever shown to a professional
  before they accept.

  The pin comes from the browser's location (asked after a rationale, on the
  customer's tap) or is typed by hand as "lat, lng" (copied from any maps
  app). Before saving, POST /serviceability says whether the pin is served;
  the server checks again on save.
*/

import type { Address } from "./wire"

export interface AddressForm {
  label: string
  line1: string
  line2: string
  landmark: string
  locality: string
  pincode: string
  pin: string
  isDefault: boolean
}

export const EMPTY_FORM: AddressForm = { label: "Home", line1: "", line2: "", landmark: "", locality: "", pincode: "", pin: "", isDefault: false }

export type FormErrors = Partial<Record<keyof AddressForm, string>>

export interface LatLng {
  lat: number
  lng: number
}

/** "17.4401, 78.3489" (or with a space only) → a point; null when it is not one. */
export function parsePin(raw: string): LatLng | null {
  const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(raw)
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

/** A point as the form shows it: 6 decimals (≈ 10 cm) is plenty. */
export function formatPin(p: LatLng): string {
  return `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`
}

export function validateForm(f: AddressForm): FormErrors {
  const e: FormErrors = {}
  if (!f.label.trim()) e.label = "Give it a name, like Home."
  if (!f.line1.trim()) e.line1 = "Enter the house or flat and street."
  if (!f.locality.trim()) e.locality = "Enter the locality."
  if (!/^\d{6}$/.test(f.pincode.trim())) e.pincode = "Enter the 6-digit pincode."
  if (!parsePin(f.pin)) e.pin = "Use your location, or paste the pin as “lat, lng”."
  return e
}

export interface AddressBody {
  label: string
  line1: string
  line2?: string
  landmark?: string
  locality: string
  pincode: string
  lat: number
  lng: number
  is_default: boolean
}

/** The POST body; null while the form has a problem. */
export function formBody(f: AddressForm): AddressBody | null {
  const pin = parsePin(f.pin)
  if (!pin || Object.keys(validateForm(f)).length) return null
  const body: AddressBody = {
    label: f.label.trim(),
    line1: f.line1.trim(),
    locality: f.locality.trim(),
    pincode: f.pincode.trim(),
    lat: pin.lat,
    lng: pin.lng,
    is_default: f.isDefault,
  }
  if (f.line2.trim()) body.line2 = f.line2.trim()
  if (f.landmark.trim()) body.landmark = f.landmark.trim()
  return body
}

/** The full body for an existing address (PATCH replaces the address). */
export function fullBody(a: Address, isDefault: boolean): AddressBody {
  const body: AddressBody = { label: a.label, line1: a.line1, locality: a.locality, pincode: a.pincode, lat: a.lat, lng: a.lng, is_default: isDefault }
  if (a.line2) body.line2 = a.line2
  if (a.landmark) body.landmark = a.landmark
  return body
}

export function addressLine(a: Address): string {
  return [a.line1, a.line2, a.landmark, a.locality, a.pincode].filter(Boolean).join(", ")
}

/* ── the chosen address, per browser ──────────────────────────────── */

export const CHOSEN_KEY = "doorstep.address.chosen"

export interface ChoiceStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function readChosenId(store: ChoiceStore | null): string | null {
  try {
    return store?.getItem(CHOSEN_KEY) || null
  } catch {
    return null
  }
}

export function writeChosenId(store: ChoiceStore | null, id: string): void {
  try {
    store?.setItem(CHOSEN_KEY, id)
  } catch {
    /* in-memory only */
  }
}

/** The chosen address: the saved choice if it still exists, else the default, else the first. */
export function resolveChosen(list: readonly Address[], chosenId: string | null): Address | null {
  return list.find((a) => a.id === chosenId) ?? list.find((a) => a.isDefault) ?? list[0] ?? null
}

/** Addresses in menu order: alphabetical by label, then line. */
export function sortAddresses(list: readonly Address[]): Address[] {
  return [...list].sort((a, b) => a.label.localeCompare(b.label) || a.line1.localeCompare(b.line1))
}
