import { decodePartnerChange } from "./model"
import api from "@/lib/api"
import { decodeApplicationState } from "./model"
import type { bankBody } from "./BankDetails"
import { uploadMedia } from "@/lib/mediaUpload"
import { toDoorstepError } from "../api/client"
import { envelopeData, LENIENT, type Ctx } from "../model/decode"
import { obj, reqStr, reqPaise } from "../model/decode"
import { applicationBody, decodeArea, decodeBank, decodeDigiLocker, decodeDocument, decodeDuty, decodeEarnings, decodeHoursWindow, decodeJobs, decodeKyc, decodeMySkill, decodePartner, decodePrice, decodeReadiness, decodeServicePricing, decodeSkill, decodeZone, listOf, validateImage, type HoursWindow } from "./model"

const BASE = "/v1/doorstep/pro"
async function read<T>(run: () => Promise<{ data: unknown }>, decode: (v: unknown, c: Ctx) => T): Promise<T> {
  try { return decode(envelopeData((await run()).data, LENIENT), LENIENT) } catch (e) { throw toDoorstepError(e) }
}
export const partnerApi = {
  offers: () => read(() => api.get(`${BASE}/offers`), listOf((raw, c) => {
    const o = obj(raw, { ...c, strict: false }, [])
    return { id: reqStr(o, "id", c), booking_id: reqStr(o, "booking_id", c), status: reqStr(o, "status", c), service_name: reqStr(o, "service_name", c), locality: reqStr(o, "locality", c), slot_start: reqStr(o, "slot_start", c), expires_at: reqStr(o, "expires_at", c), earning_estimate_paise: reqPaise(o, "earning_estimate_paise", c) }
  })),
  respondOffer: async (id: string, accept: boolean) => {
    try { await api.post(`${BASE}/offers/${encodeURIComponent(id)}/${accept ? "accept" : "decline"}`, {}) } catch (e) { throw toDoorstepError(e) }
  },
  changes: () => read(() => api.get(`${BASE}/me/changes`), listOf(decodePartnerChange)),
  states: () => read(() => api.get(`${BASE}/application/states`), listOf(decodeApplicationState)),
  submitApplication: (body: {review_consent:boolean;first_name:string;last_name:string;gender:string;state_code:string;town:string;alternate_phone:string;skill_codes:string[];identity_kind:string;identity_media_id:string;selfie_media_id:string;introduction_media_id:string;experience_media_id:string;pan:string;bank:ReturnType<typeof bankBody>}) => read(() => api.post(`${BASE}/application`,body),decodePartner),
  me: () => read(() => api.get(`${BASE}/me`), decodePartner),
  apply: (name: string) => read(() => api.post(`${BASE}/apply`, applicationBody(name)), decodePartner),
  profile: (body: { display_name?: string; photo_media_id?: string }) => read(() => api.patch(`${BASE}/me`, body), decodePartner),
  readiness: () => read(() => api.get(`${BASE}/readiness`), decodeReadiness),
  skills: () => read(() => api.get(`${BASE}/skills`), listOf(decodeSkill)),
  mySkills: () => read(() => api.get(`${BASE}/me/skills`), listOf(decodeMySkill)),
  saveSkills: (skill_codes: string[]) => read(() => api.put(`${BASE}/me/skills`, { skill_codes }), listOf(decodeMySkill)),
  documents: () => read(() => api.get(`${BASE}/me/documents`), listOf(decodeDocument)),
  correctIdentity: (body: { kind: string; media_id: string }) => read(() => api.post(`${BASE}/application/identity`, body), decodeDocument),
  zones: () => read(() => api.get(`${BASE}/zones`), listOf(decodeZone)),
  area: () => read(() => api.get(`${BASE}/me/area`), decodeArea),
  saveArea: (body: { zone_ids: string[]; home_lat: number; home_lng: number; radius_m: number; area_label?: string }) => read(() => api.put(`${BASE}/me/area`, body), decodeArea),
  hours: () => read(() => api.get(`${BASE}/me/hours`), listOf(decodeHoursWindow)),
  saveHours: (items: HoursWindow[]) => read(() => api.put(`${BASE}/me/hours`, { items }), listOf(decodeHoursWindow)),
  bank: () => read(() => api.get(`${BASE}/me/bank`), decodeBank),
  saveBank: (body: ReturnType<typeof bankBody>) => read(() => api.put(`${BASE}/me/bank`, body), decodeBank),
  startIdentity: () => read(() => api.post(`${BASE}/digilocker/start`), decodeDigiLocker),
  finishIdentity: (code: string, state: string) => read(() => api.post(`${BASE}/digilocker/callback`, { code, state }), decodeReadiness),
  selfie: (media_id: string) => read(() => api.post(`${BASE}/selfie`, { media_id }), decodeKyc),
  certificate: (body: { media_id: string; issued_on: string }, skill?: string) => read(() => api.post(skill ? `${BASE}/me/skills/${encodeURIComponent(skill)}/certificate` : `${BASE}/me/police-certificate`, body), decodeDocument),
  pan: (pan: string) => read(() => api.put(`${BASE}/me/pan`, { pan }), decodeReadiness),
  prices: () => read(() => api.get(`${BASE}/me/prices`), listOf(decodeServicePricing)),
  submitPrice: (body: { service_id: string; item_kind: string; item_id: string; price_paise: number }) => read(() => api.post(`${BASE}/me/prices`, body), decodePrice),
  withdrawPrice: (id: string) => read(() => api.post(`${BASE}/me/prices/${encodeURIComponent(id)}/withdraw`), decodePrice),
  jobs: (cursor?: string) => read(() => api.get(`${BASE}/jobs`, { params: { limit: 20, cursor } }), decodeJobs),
  customerContact: (id: string, signal?: AbortSignal) => read(() => api.get(`${BASE}/jobs/${encodeURIComponent(id)}/customer-contact`, { signal }), (raw, c) => {
    const o = obj(raw, c, ["phone"])
    const phone = reqStr(o, "phone", c)
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error("Customer contact is unavailable. Please contact support.")
    return phone
  }),
  earnings: () => read(() => api.get(`${BASE}/earnings`), decodeEarnings),
  duty: () => read(() => api.get(`${BASE}/me/duty`), decodeDuty),
}

// Keep the uploaded media id in the mounted form for retry if processing is
// pending. Never persist certificates, bank numbers, PAN or KYC in storage.
export async function uploadPartnerImage(file: File): Promise<string> {
  const invalid = validateImage(file)
  if (invalid) throw new Error(invalid)
  return uploadMedia(file, "image", "general")
}
