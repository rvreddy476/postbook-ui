import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { PARTNER_MENU, partnerForDestination } from "@/components/auth/portalRoles"
import { AuthShell } from "@/components/auth/AuthShell"
import { isMissingProfile, profile, record, registrationBody, review, vehicleBody, type Registration } from "../model"

const form: Registration = { full_name: "Test Partner", phone: "+919876543210", email: "partner@example.test", city: "city-id", partner_type: "individual_driver", vehicle_type: "MOTORCYCLE", vehicle_number: "ka01ab1234" }
describe("partner registration", () => {
  test("exactly five partner options with separate routes and module-specific login", () => {
    expect(PARTNER_MENU.map(p => p.label)).toEqual(["Selling Partner", "Food Partner", "Ride Partner", "Delivery Partner", "Home Services Professional"])
    expect(partnerForDestination("/shop/selling")).toBeUndefined()
    expect(partnerForDestination("/feast/delivery")).toMatchObject({ id: "delivery-partner" })
    const html = renderToStaticMarkup(<AuthShell mode="login" redirectTo="/mopedu/partner">Sign in</AuthShell>)
    for (const item of PARTNER_MENU) expect(html).toContain(item.label)
    expect(html).toContain("Drive with Mopedu") // module menu description
    expect(html).not.toContain("Life is better")
    expect(html).not.toContain("auth-moment-card")
    expect(html).not.toContain("/account/roles")
  })
  test("ride creation sends server driver enum and a live city, never a role or status", () => {
    expect(registrationBody("ride", form, ["city-id"])).toEqual({ full_name: "Test Partner", phone: "+919876543210", email: "partner@example.test", partner_type: "individual_driver", city_id: "city-id" })
    expect(() => registrationBody("ride", form, [])).toThrow("available operating city")
    expect(() => registrationBody("ride", { ...form, partner_type: "admin" }, ["city-id"])).toThrow("driver type")
  })
  test("delivery requires supported vehicle and registration for motor vehicles", () => {
    const input = { ...form, city: "Bengaluru" }
    expect(registrationBody("delivery", input)).toMatchObject({ city: "Bengaluru", vehicle_number: "KA01AB1234", vehicle_type: "MOTORCYCLE" })
    expect(() => registrationBody("delivery", { ...input, vehicle_type: "truck" })).toThrow("supported delivery vehicle")
    expect(() => registrationBody("delivery", { ...input, vehicle_number: "" })).toThrow("registration number")
    expect(() => registrationBody("delivery", { ...input, city: " " })).toThrow("operating city")
    expect(registrationBody("delivery", { ...input, vehicle_type: "BICYCLE", vehicle_number: "" })).toMatchObject({ vehicle_type: "BICYCLE", vehicle_number: "" })
  })
  test("invalid contact data cannot be sent", () => {
    expect(() => registrationBody("delivery", { ...form, full_name: " " })).toThrow("full name")
    expect(() => registrationBody("delivery", { ...form, phone: "not-a-phone" })).toThrow("phone")
    expect(() => registrationBody("delivery", { ...form, email: "broken" })).toThrow("email")
  })
  test("ride vehicle guard refuses unsupported or empty registrations", () => {
    expect(() => vehicleBody("truck", "KA01AB1234")).toThrow("supported vehicle")
    expect(() => vehicleBody("bike", " ")).toThrow("registration number")
    expect(vehicleBody("bike", " ka01ab1234 ")).toEqual({ vehicle_type: "bike", registration_number: "KA01AB1234" })
  })
  test("only explicit missing-profile errors open the registration form", () => {
    expect(isMissingProfile("ride", 404, "NOT_FOUND", "no partner profile")).toBe(true)
    expect(isMissingProfile("ride", 404, "NOT_FOUND", "wrong city")).toBe(false)
    expect(isMissingProfile("delivery", 404, "FOOD_DELIVERY_PROFILE_NOT_FOUND", "")).toBe(true)
    for (const status of [401, 403, 500]) expect(isMissingProfile("delivery", status, "FOOD_DELIVERY_PROFILE_NOT_FOUND", "")).toBe(false)
  })
  test("malformed profile and review are refused, never treated as approved", () => {
    expect(() => record(null)).toThrow()
    expect(() => record([])).toThrow()
    expect(() => record("bad")).toThrow()
    expect(() => profile({ status: "approved" })).toThrow()
    expect(() => review({ status: "approved" }, "ride")).toThrow()
    expect(() => review({ status: "APPROVED", missing: "none" }, "delivery")).toThrow()
    expect(() => review({ status: "APPROVED", missing: [] }, "ride")).toThrow()
    expect(() => review({ status: false, missing: [], pending: [] }, "ride")).toThrow()
    expect(() => review({ status: "approved", missing: [1], pending: [] }, "ride")).toThrow()
    expect(() => review({ status: "approved", missing: [], pending: [1] }, "ride")).toThrow()
    expect(review({ status: "under_review", missing: [], pending: ["selfie"] }, "ride")).toEqual({ status: "under_review", missing: [], pending: ["selfie"] })
  })
  test("delivery review reads the byte-identical backend golden fixture", () => {
    const path = import.meta.dir + "/contracts/kyc_status_get_200.json"
    const body = JSON.parse(readFileSync(path, "utf8"))
    const backend = "C:/workspace/modernsmapp/Architecture/services/food-service/internal/http/testdata/contracts/kyc_status_get_200.json"
    expect(readFileSync(path).equals(readFileSync(backend))).toBe(true)
    expect(review(body.data, "delivery")).toEqual({ status: "PENDING_REVIEW", missing: ["selfie", "payout_account"], pending: [] })
  })
})
