import { arr, obj, optNum, optObj, optStr, reqBool, reqNum, reqPaise, reqStr, strArr, type Ctx } from "../model/decode"

export function decodePartnerChange(raw: unknown, c: Ctx) {
  const o = obj(raw, c, ["id", "pro_id", "kind", "payload", "status", "reason", "created_at"])
  return { id: reqStr(o,"id",c), kind: reqStr(o,"kind",c), status: reqStr(o,"status",c), reason: optStr(o,"reason",c), payload: obj(o.payload,c,[],["profile","skills","area","hours","pan_last4"]) }
}

export function decodePartner(raw: unknown, c: Ctx) {
  const o = obj(raw, c, ["id", "user_id", "status", "display_name", "city_code", "gender", "photo_media_id", "rating_avg", "rating_count", "jobs_completed", "max_jobs_per_day", "created_at", "updated_at"], ["application"])
  return { application: optObj(o,"application",c,decodeApplication), id: reqStr(o, "id", c), user_id: reqStr(o, "user_id", c), status: reqStr(o, "status", c), display_name: reqStr(o, "display_name", c), city_code: reqStr(o, "city_code", c), gender: optStr(o, "gender", c), photo_media_id: optStr(o, "photo_media_id", c), rating_avg: optNum(o, "rating_avg", c), rating_count: reqNum(o, "rating_count", c), jobs_completed: reqNum(o, "jobs_completed", c), max_jobs_per_day: reqNum(o, "max_jobs_per_day", c), created_at: reqStr(o, "created_at", c), updated_at: reqStr(o, "updated_at", c) }
}
export type Partner = ReturnType<typeof decodePartner>
export function decodeAlternateChallenge(raw: unknown, c: Ctx) {
  const o = obj(raw, c, ["delivery", "expires_in", "resend_after"])
  return { delivery: reqStr(o, "delivery", c), expires_in: reqNum(o, "expires_in", c), resend_after: reqNum(o, "resend_after", c) }
}
export function decodeAlternateResult(raw: unknown, c: Ctx) {
  const o = obj(raw, c, ["verified"])
  return { verified: reqBool(o, "verified", c) }
}
export function decodeApplication(raw: unknown,c:Ctx) {
  const o=obj(raw,c,["first_name","last_name","declared_gender","state_code","state_name","town","primary_phone_last4","alternate_phone_last4","alternate_phone_verified_at","submitted_at"])
  return {first_name:reqStr(o,"first_name",c),last_name:reqStr(o,"last_name",c),declared_gender:reqStr(o,"declared_gender",c),state_code:reqStr(o,"state_code",c),state_name:reqStr(o,"state_name",c),town:reqStr(o,"town",c),primary_phone_last4:reqStr(o,"primary_phone_last4",c),alternate_phone_last4:optStr(o,"alternate_phone_last4",c),alternate_phone_verified_at:optStr(o,"alternate_phone_verified_at",c),submitted_at:reqStr(o,"submitted_at",c)}
}
export function decodeReadiness(raw: unknown, c: Ctx) {
  const o = obj(raw, c, ["status", "missing_steps", "completed_steps", "recommended_steps", "can_go_on_duty"])
  return { status: reqStr(o, "status", c), missing_steps: strArr(o, "missing_steps", c), completed_steps: strArr(o, "completed_steps", c), recommended_steps: strArr(o, "recommended_steps", c), can_go_on_duty: reqBool(o, "can_go_on_duty", c) }
}
export type Readiness = ReturnType<typeof decodeReadiness>
export function decodeSkill(raw: unknown, c: Ctx) {
  const o = obj(raw, c, ["code", "name", "description", "requires_certificate"], ["categories"])
  return { code: reqStr(o, "code", c), name: reqStr(o, "name", c), description: reqStr(o, "description", c), requires_certificate: reqBool(o, "requires_certificate", c), categories: arr(o, "categories", c, (raw, at) => { const category = obj(raw, at, ["id", "name"]); return { id: reqStr(category, "id", at), name: reqStr(category, "name", at) } }) }
}
export function decodeApplicationState(raw: unknown, c: Ctx) {
  const o = obj(raw, c, ["code", "name"])
  return { code: reqStr(o, "code", c), name: reqStr(o, "name", c) }
}
export function decodeMySkill(raw: unknown, c: Ctx) {
  const o = obj(raw, c, ["skill_code", "status", "verified_at"])
  return { skill_code: reqStr(o, "skill_code", c), status: reqStr(o, "status", c), verified_at: optStr(o, "verified_at", c) }
}
export function decodeZone(raw: unknown, c: Ctx) {
  const o = obj(raw, c, ["id", "city_code", "name", "slug", "boundary"])
  return { id: reqStr(o, "id", c), name: reqStr(o, "name", c), city_code: reqStr(o, "city_code", c), slug: reqStr(o, "slug", c) }
}
export function decodeArea(raw: unknown, c: Ctx) {
  const o = obj(raw, c, ["zone_ids", "home_lat", "home_lng", "radius_m"], ["area_label"])
  return { area_label: optStr(o, "area_label", c), zone_ids: strArr(o, "zone_ids", c), home_lat: optNum(o, "home_lat", c), home_lng: optNum(o, "home_lng", c), radius_m: reqNum(o, "radius_m", c) }
}
export type HoursWindow = { weekday: number; start: string; end: string }
export function decodeHoursWindow(raw: unknown, c: Ctx): HoursWindow {
  const o = obj(raw, c, ["weekday", "start", "end"])
  return { weekday: reqNum(o, "weekday", c), start: reqStr(o, "start", c), end: reqStr(o, "end", c) }
}
export function decodeBank(raw: unknown, c: Ctx) {
  if (raw === null) return null
  const o = obj(raw, c, ["account_holder", "account_last4", "ifsc", "status"], ["bank_name", "branch_name", "proof_kind", "proof_document_id", "reason", "history"])
  return { history: o.history === undefined ? [] : arr(o, "history", c, decodeBankRecord), account_holder: reqStr(o, "account_holder", c), account_last4: reqStr(o, "account_last4", c), ifsc: reqStr(o, "ifsc", c), status: reqStr(o, "status", c), bank_name: optStr(o,"bank_name",c), branch_name: optStr(o,"branch_name",c), proof_kind: optStr(o,"proof_kind",c), proof_document_id: optStr(o,"proof_document_id",c), reason: optStr(o,"reason",c) }
}
export function decodeBankRecord(raw: unknown, c: Ctx) {
  const o = obj(raw, c, ["id", "account_holder", "account_last4", "ifsc", "bank_name", "status", "active", "submitted_at", "reviewed_at", "reason"], ["superseded", "proof_document_id", "proof_kind"])
  return { superseded: o.superseded === undefined ? !reqBool(o,"active",c) && reqStr(o,"status",c) === "pending" : reqBool(o,"superseded",c), proof_document_id: optStr(o,"proof_document_id",c), proof_kind: optStr(o,"proof_kind",c), id: reqStr(o,"id",c), account_holder: reqStr(o,"account_holder",c), account_last4: reqStr(o,"account_last4",c), ifsc: reqStr(o,"ifsc",c), bank_name: reqStr(o,"bank_name",c), status: reqStr(o,"status",c), active: reqBool(o,"active",c), submitted_at: reqStr(o,"submitted_at",c), reviewed_at: optStr(o,"reviewed_at",c), reason: optStr(o,"reason",c) }
}
export function decodeDocument(raw: unknown, c: Ctx) {
  const o = obj(raw, c, ["id", "pro_id", "kind", "skill_code", "media_id", "status", "issued_on", "expires_on", "reason", "created_at"])
  return { id: reqStr(o, "id", c), pro_id: reqStr(o, "pro_id", c), kind: reqStr(o, "kind", c), skill_code: optStr(o, "skill_code", c), media_id: reqStr(o, "media_id", c), status: reqStr(o, "status", c), issued_on: optStr(o, "issued_on", c), expires_on: optStr(o, "expires_on", c), reason: optStr(o, "reason", c), created_at: reqStr(o, "created_at", c) }
}
export type PartnerDocument = ReturnType<typeof decodeDocument>
export function decodeDuty(raw: unknown, c: Ctx) {
  const o = obj(raw, c, ["on_duty", "since"])
  return { on_duty: reqBool(o, "on_duty", c), since: optStr(o, "since", c) }
}
export function decodeDigiLocker(raw: unknown, c: Ctx) {
  const o = obj(raw, c, ["authorization_url", "state"])
  return { authorization_url: reqStr(o, "authorization_url", c), state: reqStr(o, "state", c) }
}
export function decodeKyc(raw: unknown, c: Ctx) {
  const o = obj(raw, c, ["kind", "status", "score", "verified_at"])
  return { kind: reqStr(o, "kind", c), status: reqStr(o, "status", c), score: optNum(o, "score", c), verified_at: optStr(o, "verified_at", c) }
}
export function decodePrice(raw: unknown, c: Ctx) {
  const o = obj(raw, c, ["id", "service_id", "item_kind", "item_id", "unit", "price_paise", "status", "effective_from", "effective_to", "submitted_at", "reviewed_at", "reason"])
  return { id: reqStr(o, "id", c), service_id: reqStr(o, "service_id", c), item_kind: reqStr(o, "item_kind", c), item_id: reqStr(o, "item_id", c), unit: reqStr(o, "unit", c), price_paise: reqPaise(o, "price_paise", c), status: reqStr(o, "status", c), effective_from: optStr(o, "effective_from", c), effective_to: optStr(o, "effective_to", c), submitted_at: reqStr(o, "submitted_at", c), reviewed_at: optStr(o, "reviewed_at", c), reason: optStr(o, "reason", c) }
}
export function decodePriceItem(raw: unknown, c: Ctx) {
  const o = obj(raw, c, ["item_kind", "item_id", "name", "unit", "max_quantity", "suggested_price_paise", "approved", "pending", "rejected"])
  return { item_kind: reqStr(o, "item_kind", c), item_id: reqStr(o, "item_id", c), name: reqStr(o, "name", c), unit: reqStr(o, "unit", c), max_quantity: reqNum(o, "max_quantity", c), suggested_price_paise: optNum(o, "suggested_price_paise", c), approved: optObj(o, "approved", c, decodePrice), pending: optObj(o, "pending", c, decodePrice), rejected: optObj(o, "rejected", c, decodePrice) }
}
export type PriceItem = ReturnType<typeof decodePriceItem>
export function decodeServicePricing(raw: unknown, c: Ctx) {
  const o = obj(raw, c, ["service_id", "service_name", "category_slug", "category_name", "family", "skill_code", "skill_status", "same_day", "bookable", "items"], ["pricing_mode"])
  return { pricing_mode: optStr(o, "pricing_mode", c), service_id: reqStr(o, "service_id", c), service_name: reqStr(o, "service_name", c), category_slug: reqStr(o, "category_slug", c), category_name: reqStr(o, "category_name", c), family: reqStr(o, "family", c), skill_code: reqStr(o, "skill_code", c), skill_status: reqStr(o, "skill_status", c), same_day: reqBool(o, "same_day", c), bookable: reqBool(o, "bookable", c), items: arr(o, "items", c, decodePriceItem) }
}
export function decodeJobs(raw: unknown, c: Ctx) {
  const o = obj(raw, c, ["items", "next_cursor"])
  return { items: arr(o, "items", c, (raw, c) => {
    const j = obj(raw, { ...c, strict: false }, [])
    return { booking_id: reqStr(j, "booking_id", c), service_name: reqStr(j, "service_name", c), status: reqStr(j, "status", c), slot_start: reqStr(j, "slot_start", c), locality: reqStr(j, "locality", c), earning_estimate_paise: reqPaise(j, "earning_estimate_paise", c) }
  }), next_cursor: optStr(o, "next_cursor", c) }
}
export function decodeEarnings(raw: unknown, c: Ctx) {
  const o = obj(raw, c, ["total_paise", "lines"])
  return { total_paise: reqPaise(o, "total_paise", c), lines: arr(o, "lines", c, (raw, c) => {
    const l = obj(raw, c, ["id", "booking_id", "kind", "amount_paise", "created_at"])
    return { id: reqStr(l, "id", c), booking_id: reqStr(l, "booking_id", c), kind: reqStr(l, "kind", c), amount_paise: reqPaise(l, "amount_paise", c), created_at: reqStr(l, "created_at", c) }
  }) }
}
export const listOf = <T>(decode: (raw: unknown, c: Ctx) => T) => (raw: unknown, c: Ctx): T[] => arr(obj(raw, c, ["items"]), "items", c, decode)

export const PARTNER_STEPS = [
  { code: "profile", label: "Your profile", hint: "Name and profile photo" },
  { code: "identity_review", label: "Identity review", hint: "PAN and selfie reviewed by an admin" },
  { code: "selfie_face_match", label: "Selfie check", hint: "A clear photo for identity review" },
  { code: "skills", label: "Services & skills", hint: "Choose what you do best" },
  { code: "service_area", label: "Working area", hint: "Choose zones and travel distance" },
  { code: "weekly_hours", label: "Working hours", hint: "Set your weekly availability" },
  { code: "bank", label: "Bank account", hint: "Your payout details" },
  { code: "pan", label: "PAN number", hint: "Required · no PAN-card upload" },
] as const
export type StepCode = typeof PARTNER_STEPS[number]["code"]
export function stepState(code: StepCode, readiness: Readiness, documents: PartnerDocument[], skills: ReturnType<typeof decodeMySkill>[], area?: ReturnType<typeof decodeArea>, bank?: ReturnType<typeof decodeBank>) {
  if (readiness.completed_steps.includes(code)) return "complete"
  if (code === "bank" && (bank?.status === "pending" || bank?.history.some(r => r.status === "pending" && !r.superseded))) return "review"
  if (code === "service_area" && area && area.home_lat !== null && area.home_lng !== null && Number.isFinite(area.home_lat) && Number.isFinite(area.home_lng) && Math.abs(area.home_lat) <= 90 && Math.abs(area.home_lng) <= 180 && area.radius_m >= 1000 && area.radius_m <= 15000) return "saved"
  const kind = code === "selfie_face_match" ? "selfie" : null
  if (kind && documents.some(d => d.kind === kind && d.status === "pending")) return "review"
  // Pending skills may still need a trade certificate. Only the server's
  // pending_verification state confirms that review is all that remains.
  if (code === "skills" && readiness.status === "pending_verification" && skills.length > 0 && skills.every(s => s.status === "pending" || s.status === "verified")) return "review"
  if (code === "identity_review" && readiness.completed_steps.includes("pan") && documents.some(d => d.kind === "selfie" && (d.status === "pending" || d.status === "approved"))) return "review"
  return "needed"
}
export const canEditPartner = (status: string) => ["draft", "pending_verification", "approved"].includes(status)
// An empty missing-step list is not approval. Both live server signals must agree.
export const canWork = (p: Partner, r: Readiness) => p.status === "approved" && r.status === "approved" && r.can_go_on_duty === true
export function applicationBody(name: string) {
  const display_name = name.trim()
  if ([...display_name].length < 2 || [...display_name].length > 60) throw new Error("Enter a name between 2 and 60 characters.")
  return { display_name, city_code: "HYD" }
}
export function pricePaise(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) throw new Error("Enter a price with no more than two decimal places.")
  const [rupees, fraction = ""] = value.trim().split(".")
  const paise = Number(rupees) * 100 + Number(fraction.padEnd(2, "0"))
  if (!Number.isSafeInteger(paise) || paise < 100 || paise > 10_000_000) throw new Error("Enter a price from ₹1 to ₹1,00,000.")
  return paise
}
export function validateHours(items: HoursWindow[]): string | null {
  const sorted = [...items].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start))
  const counts = new Map<number, number>()
  for (let i = 0; i < sorted.length; i++) {
    const w = sorted[i]
    if (!Number.isInteger(w.weekday) || w.weekday < 0 || w.weekday > 6 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(w.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(w.end)) return "Choose a day and valid start and end times."
    const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3))
    if (minutes(w.end) - minutes(w.start) < 30) return "Each shift must be at least 30 minutes and end on the same day."
    counts.set(w.weekday, (counts.get(w.weekday) ?? 0) + 1)
    if (counts.get(w.weekday)! > 6) return "Use no more than six shifts per day."
    const prev = sorted[i - 1]
    if (prev?.weekday === w.weekday && w.start < prev.end) return "Shifts on the same day cannot overlap."
  }
  return null
}
export function validateBank(holder: string, number: string, confirm: string, ifsc: string): string | null {
  if (!/^[\p{L} .'-]{2,100}$/u.test(holder.trim())) return "Enter the account holder’s name using letters, spaces, apostrophes, dots or hyphens."
  if (!/^\d{9,18}$/.test(number)) return "Enter an account number with 9 to 18 digits."
  if (number !== confirm) return "The account numbers do not match."
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim().toUpperCase())) return "Enter an 11-character IFSC, such as SBIN0001234."
  return null
}
export function validateImage(file: Pick<File, "type" | "size">): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "Choose a JPG, PNG or WebP image. PDFs are not supported."
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) return "Choose a non-empty image smaller than 10 MB."
  return null
}
export function safeVerificationURL(value: string): string {
  const url = new URL(value)
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("The verification link is invalid. Please try again later.")
  return url.href
}
