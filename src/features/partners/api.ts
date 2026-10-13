import api from "@/lib/api"
import { isMissingProfile, profile, record, review, registrationBody, vehicleBody, type Registration, type TransportModule } from "./model"

const root = (module: TransportModule) => module === "ride" ? "/v1/rider/partners/me" : "/v1/food/delivery"
export async function readProfile(module: TransportModule, signal?: AbortSignal) {
  try { return profile((await api.get(root(module) + (module === "delivery" ? "/profile" : ""), { signal })).data.data) }
  catch (error) {
    const e = error as { response?: { status?: number; data?: { error?: { code?: string; message?: string } } } }
    if (isMissingProfile(module, e.response?.status, e.response?.data?.error?.code, e.response?.data?.error?.message)) return null
    throw error
  }
}
export async function cities(signal?: AbortSignal) {
  const data: unknown = (await api.get("/v1/rider/cities", { signal })).data.data
  if (!Array.isArray(data)) throw Error("Available cities could not be read.")
  return data.map(value => {
    const city = record(value)
    if (typeof city.id !== "string" || typeof city.name !== "string" || typeof city.is_active !== "boolean") throw Error("Available cities could not be read.")
    return { id: city.id, name: city.name, active: city.is_active }
  }).filter(city => city.active)
}
export async function saveRegistration(module: TransportModule, form: Registration, cityIds: readonly string[]) {
  const body = registrationBody(module, form, cityIds)
  return profile((await api.post(module === "ride" ? "/v1/rider/partners" : "/v1/food/delivery/profile", body)).data.data)
}
export async function readReview(module: TransportModule, signal?: AbortSignal) {
  return review((await api.get(root(module) + (module === "ride" ? "/onboarding" : "/kyc/status"), { signal })).data.data, module)
}
export async function rideVehicles(signal?: AbortSignal) {
  const data: unknown = (await api.get("/v1/rider/partners/me/vehicles", { signal })).data.data
  if (data === null) return []
  if (!Array.isArray(data)) throw Error("Your vehicles could not be read.")
  return data.map(value => { const v = record(value); if (typeof v.id !== "string" || typeof v.registration_number !== "string" || typeof v.status !== "string") throw Error("Your vehicles could not be read."); return { id: v.id, registration: v.registration_number, status: v.status } })
}
export async function addRideVehicle(type: string, registration: string) {
  await api.post("/v1/rider/partners/me/vehicles", vehicleBody(type, registration))
}
export function partnerFailure(error: unknown) {
  const e = error as { response?: { status?: number; data?: { error?: { code?: string } } } }
  if (e.response?.status === 401) return "Your session has expired. Sign in again to continue."
  if (e.response?.status === 403) return "Your account does not have access to this partner module. Contact support."
  if (e.response?.status === 503) return "This service is temporarily unavailable. Your entered details are kept here; try again shortly."
  return error instanceof Error && !("response" in error) ? error.message : "We couldn’t complete this request. Please try again."
}
