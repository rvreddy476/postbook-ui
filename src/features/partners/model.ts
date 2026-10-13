/** Partner selection never grants a role. All status and review data is server-owned. */
export type TransportModule = "ride" | "delivery"
export interface PartnerProfile { id: string; full_name: string; phone: string; status: string; email?: string; city?: string; vehicle_type?: string; vehicle_number?: string }
export interface Registration { full_name: string; phone: string; email: string; city: string; partner_type: string; vehicle_type: string; vehicle_number: string }
export const DRIVER_TYPES = ["individual_driver", "owner_driver", "fleet_owner", "fleet_driver"] as const
export const DELIVERY_VEHICLES = ["MOTORCYCLE", "SCOOTER", "EV_BIKE", "BICYCLE"] as const
export const RIDE_VEHICLES = ["bike", "auto", "mini_cab", "sedan", "suv", "premium", "ev_bike", "ev_car"] as const
export function registrationBody(module: TransportModule, form: Registration, activeCityIds: readonly string[] = []) {
  const full_name = form.full_name.trim(), phone = form.phone.trim(), email = form.email.trim()
  if (full_name.length < 2 || full_name.length > 120) throw Error("Enter your full name (2–120 characters).")
  if (!/^\+?[0-9][0-9 ()-]{7,19}$/.test(phone)) throw Error("Enter a valid phone number, including your country code.")
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error("Enter a valid email address.")
  if (module === "ride") {
    if (!(DRIVER_TYPES as readonly string[]).includes(form.partner_type)) throw Error("Choose a valid driver type.")
    if (!activeCityIds.includes(form.city)) throw Error("Choose an available operating city.")
    return { full_name, phone, ...(email ? { email } : {}), partner_type: form.partner_type, city_id: form.city }
  }
  if (!form.city.trim()) throw Error("Enter your operating city.")
  if (!(DELIVERY_VEHICLES as readonly string[]).includes(form.vehicle_type)) throw Error("Choose a supported delivery vehicle.")
  if (form.vehicle_type !== "BICYCLE" && !form.vehicle_number.trim()) throw Error("Enter your vehicle registration number.")
  return { full_name, phone, email, city: form.city.trim(), vehicle_type: form.vehicle_type, vehicle_number: form.vehicle_number.trim().toUpperCase() }
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("The server returned an unreadable response. Please try again.")
  return value as Record<string, unknown>
}
export function profile(value: unknown): PartnerProfile {
  const p = record(value)
  if (["id", "full_name", "phone", "status"].some(key => typeof p[key] !== "string" || !p[key])) throw Error("Your partner profile could not be read. Please try again.")
  return p as unknown as PartnerProfile
}
export interface Review { status: string; missing: string[]; pending: string[] }
export function review(value: unknown, module: TransportModule): Review {
  const p = record(value)
  const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === "string")
  if (typeof p.status !== "string" || !strings(p.missing) || (module === "ride" && !strings(p.pending))) throw Error("Your verification status could not be read. Please try again.")
  return { status: p.status, missing: p.missing, pending: module === "ride" ? p.pending as string[] : [] }
}
export function isMissingProfile(module: TransportModule, status: unknown, code: unknown, message: unknown) {
  return status === 404 && (module === "delivery" ? code === "FOOD_DELIVERY_PROFILE_NOT_FOUND" : code === "NOT_FOUND" && message === "no partner profile")
}
export function vehicleBody(type: string, registration: string) {
  if (!(RIDE_VEHICLES as readonly string[]).includes(type)) throw Error("Choose a supported vehicle.")
  if (!registration.trim()) throw Error("Enter the vehicle registration number.")
  return { vehicle_type: type, registration_number: registration.trim().toUpperCase() }
}
