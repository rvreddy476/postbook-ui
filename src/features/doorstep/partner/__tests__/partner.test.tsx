import { describe, expect, test } from "bun:test"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NextRequest } from "next/server"
import { middleware } from "@/middleware"
import { authRedirect } from "@/components/auth/authRedirect"
import { STRICT, LENIENT, envelopeData, envelopeError, type Ctx } from "../../model/decode"
import { PARTNER_STEPS, applicationBody, canEditPartner, canWork, decodeArea, decodeBank, decodeDigiLocker, decodeDocument, decodeDuty, decodeEarnings, decodeHoursWindow, decodeJobs, decodeKyc, decodeMySkill, decodePartner, decodePrice, decodeReadiness, decodeServicePricing, decodeSkill, decodeZone, listOf, pricePaise, safeVerificationURL, stepState, validateBank, validateHours, validateImage } from "../model"
import { PartnerScreen } from "../PartnerScreen"
import { decodeApplicationState } from "../model"
import { PartnerEditor } from "../PartnerEditor"
import { decodeAlternateChallenge, decodeAlternateResult } from "../model"

const decoderCases: Record<string, (raw: unknown, c: Ctx) => unknown> = {
  pro_alternate_phone_request_200: decodeAlternateChallenge, pro_alternate_phone_verify_200: decodeAlternateResult,
  pro_application_states_200: listOf(decodeApplicationState), pro_application_post_201: decodePartner,
  pro_apply_201: decodePartner, pro_me_get_200: decodePartner, pro_me_patch_200: decodePartner,
  pro_readiness_200_draft: decodeReadiness, pro_readiness_200_pending_review: decodeReadiness, pro_readiness_200_approved: decodeReadiness,
  pro_skills_list_200: listOf(decodeSkill), pro_me_skills_get_200: listOf(decodeMySkill), pro_skills_put_200: listOf(decodeMySkill),
  pro_zones_get_200: listOf(decodeZone), pro_me_area_get_200: decodeArea, pro_area_put_200: decodeArea,
  pro_hours_get_200: listOf(decodeHoursWindow), pro_hours_put_200: listOf(decodeHoursWindow),
  pro_me_bank_get_200: decodeBank, pro_bank_put_200: decodeBank, pro_me_documents_get_200: listOf(decodeDocument),
  pro_police_certificate_201: decodeDocument, pro_trade_certificate_201: decodeDocument,
  pro_selfie_200_pending: decodeKyc, pro_digilocker_start_200: decodeDigiLocker, pro_digilocker_callback_200: decodeReadiness,
  pro_prices_get_200: listOf(decodeServicePricing), pro_price_post_201: decodePrice, pro_price_withdraw_200: decodePrice,
  pro_me_duty_get_200: decodeDuty, pro_jobs_get_200: decodeJobs, pro_earnings_get_200: decodeEarnings,
  pro_pan_put_200: decodeReadiness,
}
const errors = ["pro_agreement_409_deferred", "pro_me_get_404", "pro_apply_409_exists", "pro_digilocker_start_503", "pro_bank_put_503_pii", "pro_police_certificate_409_pending", "pro_price_post_403_skill"]
const local = (name: string) => resolve(import.meta.dir, "contracts", `${name}.json`)
const raw = (name: string) => envelopeData(JSON.parse(readFileSync(local(name), "utf8")), STRICT)
const p = () => decodePartner(raw("pro_me_get_200"), STRICT)
const r = () => decodeReadiness(raw("pro_readiness_200_draft"), STRICT)

describe("partner golden contracts", () => {
  for (const [name, decode] of Object.entries(decoderCases)) test(`${name}: captured handler body decodes`, () => { expect(() => decode(raw(name), STRICT)).not.toThrow() })
  for (const name of [...Object.keys(decoderCases), ...errors]) test(`${name}: byte-identical backend fixture`, () => {
    const backend = resolve("C:/workspace/modernsmapp/Architecture/services/doorstep-service/internal/http/testdata/contracts", `${name}.json`)
    if (existsSync(backend)) expect(readFileSync(local(name))).toEqual(readFileSync(backend))
  })
  for (const name of errors) test(`${name}: real refusal preserved`, () => { expect(envelopeError(JSON.parse(readFileSync(local(name), "utf8")), STRICT).code).toStartWith("DOORSTEP_") })
  test("missing approval signal never decodes as a ready account", () => {
    const value = { ...(raw("pro_readiness_200_approved") as object) }; delete (value as Record<string, unknown>).can_go_on_duty
    expect(() => decodeReadiness(value, LENIENT)).toThrow()
  })
  test("bank decoder contains only the masked number", () => { expect(decodeBank(raw("pro_bank_put_200"), STRICT)).not.toHaveProperty("account_number") })
  test("prices cannot silently accept fractional paise", () => { expect(() => decodePrice({ ...(raw("pro_price_post_201") as object), price_paise: 1.2 }, LENIENT)).toThrow() })
})

describe("partner safety and validation", () => {
  test("approval guard: a finished checklist or draft never enables work", () => {
    expect(canWork(p(), { ...r(), missing_steps: [], can_go_on_duty: true })).toBe(false)
    expect(canWork({ ...p(), status: "approved" }, { ...r(), status: "approved", can_go_on_duty: false })).toBe(false)
    expect(canWork({ ...p(), status: "approved" }, { ...r(), status: "approved", can_go_on_duty: true })).toBe(true)
  })
  test("blocked/rejected/suspended accounts do not get editable setup", () => { for (const status of ["blocked", "rejected", "suspended", "unknown"]) expect(canEditPartner(status)).toBe(false) })
  test("review guard: submitted documents stay awaiting human review", () => {
    expect(stepState("selfie_face_match", r(), [{ ...decodeDocument(raw("pro_police_certificate_201"), STRICT), kind: "selfie" }], [])).toBe("review")
    expect(stepState("selfie_face_match", r(), [], [])).toBe("needed")
  })
  test("application body never sends gender, identity id or password", () => { expect(applicationBody("  Devi  ")).toEqual({ display_name: "Devi", city_code: "HYD" }); expect(() => applicationBody("a")).toThrow(); expect(() => applicationBody("a".repeat(61))).toThrow() })
  test("price guard: exact integer conversion and valid service price bounds", () => {
    expect(pricePaise("1499.99")).toBe(149999); expect(pricePaise("1")).toBe(100); expect(pricePaise("100000")).toBe(10000000)
    for (const value of ["0", "1.005", "-1", "1e3", "100001", "NaN", "", "10000000000000000000"]) expect(() => pricePaise(value)).toThrow()
  })
  test("hours guard: overlapping, short, overnight and invalid shifts refused", () => {
    expect(validateHours([{ weekday: 1, start: "09:00", end: "13:00" }, { weekday: 1, start: "13:00", end: "18:00" }])).toBeNull()
    for (const items of [[{ weekday: 1, start: "09:00", end: "09:15" }], [{ weekday: 1, start: "23:00", end: "01:00" }], [{ weekday: 7, start: "09:00", end: "10:00" }], [{ weekday: 1, start: "09:00", end: "12:00" }, { weekday: 1, start: "11:00", end: "13:00" }]]) expect(validateHours(items)).not.toBeNull()
  })
  test("bank guard: confirmation, account length and IFSC checked", () => {
    expect(validateBank("Lakshmi Devi", "123456789", "123456789", "SBIN0001234")).toBeNull()
    expect(validateBank("Lakshmi", "123456789", "987654321", "SBIN0001234")).not.toBeNull()
    expect(validateBank("Lakshmi", "123", "123", "SBIN0001234")).not.toBeNull()
    expect(validateBank("Lakshmi", "123456789", "123456789", "invalid")).not.toBeNull()
  })
  test("document guard: PDFs, empty and oversized documents refused", () => {
    expect(validateImage({ type: "image/jpeg", size: 100 })).toBeNull()
    for (const file of [{ type: "application/pdf", size: 100 }, { type: "image/svg+xml", size: 100 }, { type: "image/jpeg", size: 0 }, { type: "image/png", size: 10 * 1024 * 1024 + 1 }]) expect(validateImage(file)).not.toBeNull()
  })
  test("verification links refuse scripts and insecure or credential URLs", () => {
    expect(safeVerificationURL("https://digilocker.gov.in/oauth")).toBe("https://digilocker.gov.in/oauth")
    for (const value of ["javascript:alert(1)", "http://example.com", "https://name:password@example.com"]) expect(() => safeVerificationURL(value)).toThrow()
  })
  test("partner return path is preserved and external returns are refused", () => { expect(authRedirect("/doorstep/partner")).toBe("/doorstep/partner"); expect(authRedirect("//evil.example")).toBe("/") })
})

describe("partner presentation and route boundaries", () => {
  function render(node: React.ReactNode) { return renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>) }
  test("partner workspace has no customer promotion or duplicate sign-in", () => {
    const html = render(<PartnerScreen />)
    expect(html).toContain("Loading your saved details")
    expect(html).not.toContain("Make your skills"); expect(html).not.toContain("Partner sign in")
    expect(html).not.toContain('type="password"')
  })
  test("deferred terms are not a required setup step", () => {
    expect(PARTNER_STEPS.map(s => s.code)).not.toContain("agreement")
  })
  test("all partner workspaces require sign-in without opening customer pages", () => {
    for (const path of ["/doorstep/partner", "/doorstep/partner/", "/mopedu/partner", "/feast/delivery", "/doorstep/partner/private"]) expect(middleware(new NextRequest(`https://cleestudio.com${path}`)).headers.get("location")).toContain("/api/postmatch/auth/logout?portal=")
    for (const path of ["/doorstep", "/doorstep/bookings", "/doorstep-pro/jobs"]) expect(middleware(new NextRequest(`https://cleestudio.com${path}`)).headers.get("location")).toContain("/login")
  })
  test("callback guard: credentials cannot leak through referrer or shared cache", () => {
    const response = middleware(new NextRequest("https://cleestudio.com/doorstep-pro/digilocker?code=one-time&state=opaque"))
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer"); expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(response.headers.get("location")).toBeNull()
  })
})
