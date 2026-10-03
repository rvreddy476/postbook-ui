/*
  The delivery address: which one is chosen, and the add form.

  The chosen address id lives in localStorage (a per-browser convenience);
  when it is missing or no longer in the list, the default address wins,
  then the first one. Its pin (lat/lng) is what the restaurant routes judge
  serviceability for; an address without a pin lists restaurants unjudged.
*/

import type { AddressBody, LatLng } from "../api/client"
import type { Address } from "./wire"

export const CHOSEN_ADDRESS_KEY = "feast.address.chosen"

export interface SimpleStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function readChosenId(store: SimpleStore | null): string | null {
  try {
    return store?.getItem(CHOSEN_ADDRESS_KEY) || null
  } catch {
    return null
  }
}

export function writeChosenId(store: SimpleStore | null, id: string | null): void {
  try {
    if (!store) return
    if (id) store.setItem(CHOSEN_ADDRESS_KEY, id)
    else store.removeItem(CHOSEN_ADDRESS_KEY)
  } catch {
    /* storage refused */
  }
}

/** The chosen id if still listed, else the default, else the first; null with no addresses. */
export function resolveChosen(addresses: Address[], chosenId: string | null): Address | null {
  if (!addresses.length) return null
  return addresses.find((a) => a.id === chosenId) ?? addresses.find((a) => a.isDefault) ?? addresses[0]
}

export function pinOf(address: Address | null): LatLng | null {
  if (!address) return null
  const { latitude: lat, longitude: lng } = address
  if (typeof lat !== "number" || typeof lng !== "number") return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  if (lat === 0 && lng === 0) return null
  return { lat, lng }
}

export function addressTitle(a: Address): string {
  return a.label?.trim() || a.addressLine1 || "Address"
}

export function addressLine(a: Address): string {
  return [a.addressLine1, a.addressLine2, a.landmark, a.city, a.postalCode].filter((p) => p && p.trim()).join(", ")
}

/**
  PATCH /addresses/:id REPLACES every field (store UpdateAddress sets all
  columns), so "make default" resends the whole address, not just the flag.
*/
export function fullBody(a: Address, isDefault: boolean): AddressBody {
  const body: AddressBody = {
    label: a.label ?? "",
    address_line1: a.addressLine1,
    city: a.city,
    country: a.country || "India",
    is_default: isDefault,
  }
  if (a.receiverName) body.receiver_name = a.receiverName
  if (a.phone) body.phone = a.phone
  if (a.addressLine2) body.address_line2 = a.addressLine2
  if (a.landmark) body.landmark = a.landmark
  if (a.state) body.state = a.state
  if (a.postalCode) body.postal_code = a.postalCode
  if (typeof a.latitude === "number" && typeof a.longitude === "number") {
    body.latitude = a.latitude
    body.longitude = a.longitude
  }
  return body
}

/* ── the form ─────────────────────────────────────────────────────── */

export interface AddressForm {
  label: string
  receiverName: string
  phone: string
  addressLine1: string
  addressLine2: string
  landmark: string
  city: string
  state: string
  postalCode: string
  latitude: number | null
  longitude: number | null
  makeDefault: boolean
}

export const EMPTY_FORM: AddressForm = {
  label: "Home",
  receiverName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  landmark: "",
  city: "",
  state: "",
  postalCode: "",
  latitude: null,
  longitude: null,
  makeDefault: false,
}

export type FormErrors = Partial<Record<keyof AddressForm, string>>

const PIN = /^\d{6}$/
const PHONE = /^[+\d][\d\s-]{6,15}$/

export function validateForm(f: AddressForm): FormErrors {
  const e: FormErrors = {}
  if (!f.label.trim()) e.label = "Give this address a name."
  if (!f.addressLine1.trim()) e.addressLine1 = "Enter the house and street."
  if (!f.city.trim()) e.city = "Enter the city."
  if (f.postalCode.trim() && !PIN.test(f.postalCode.trim())) e.postalCode = "A pincode has 6 digits."
  if (f.phone.trim() && !PHONE.test(f.phone.trim())) e.phone = "Check the phone number."
  return e
}

export function formBody(f: AddressForm): AddressBody {
  const body: AddressBody = {
    label: f.label.trim(),
    address_line1: f.addressLine1.trim(),
    city: f.city.trim(),
    country: "India",
    is_default: f.makeDefault,
  }
  const opt = (v: string) => v.trim() || undefined
  if (opt(f.receiverName)) body.receiver_name = opt(f.receiverName)
  if (opt(f.phone)) body.phone = opt(f.phone)
  if (opt(f.addressLine2)) body.address_line2 = opt(f.addressLine2)
  if (opt(f.landmark)) body.landmark = opt(f.landmark)
  if (opt(f.state)) body.state = opt(f.state)
  if (opt(f.postalCode)) body.postal_code = opt(f.postalCode)
  if (f.latitude !== null && f.longitude !== null) {
    body.latitude = f.latitude
    body.longitude = f.longitude
  }
  return body
}
