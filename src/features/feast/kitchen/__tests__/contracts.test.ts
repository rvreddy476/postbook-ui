import { describe, expect, test } from "bun:test"

import { ContractError, envelopeData } from "../model/decode"
import { toFailure } from "../model/errors"
import {
  decodeAccepting,
  decodeAddonGroup,
  decodeCapabilities,
  decodeCompliance,
  decodeFssai,
  decodeKitchenQueue,
  decodeLocation,
  decodeMenuCategories,
  decodeMenuItemDetail,
  decodeOperatingHours,
  decodePartnerOrder,
  decodePartnerRestaurant,
  decodePayoutAccount,
  decodePricedOption,
  decodeReadiness,
  decodeRealtimeToken,
  decodeSettlements,
  decodeSubmit,
  decodeSummary,
} from "../model/wire"
import { axiosError, fixtureNames, readBackendBytes, readFixture, readFixtureBytes } from "./fixtures"

const data = (name: string) => envelopeData(readFixture(name))

describe("fixtures are byte-identical copies of food-service's goldens", () => {
  const names = fixtureNames()
  test("the lane carries the fixtures it decodes", () => {
    expect(names.length).toBe(50)
  })
  for (const name of names) {
    const backend = readBackendBytes(name)
    ;(backend ? test : test.skip)(`${name} matches the backend byte for byte`, () => {
      expect(readFixtureBytes(name).equals(backend!)).toBe(true)
    })
  }
})

describe("success fixtures decode strictly", () => {
  test("capabilities (owner and customer)", () => {
    expect(decodeCapabilities(data("me_capabilities_get_200_all_roles")).isRestaurantOwner).toBe(true)
    expect(decodeCapabilities(data("me_capabilities_get_200_customer")).isRestaurantOwner).toBe(false)
  })

  test("partner restaurant: float-rupee fees become paise through their decimal text", () => {
    const r = decodePartnerRestaurant(data("partner_restaurant_get_200"))
    expect(r.status).toBe("DRAFT")
    expect(r.minOrderPaise).toBe(9900)
    expect(r.packagingFeePaise).toBe(1000)
  })

  test("readiness and submit", () => {
    const r = decodeReadiness(data("readiness_get_200"))
    expect(r.missing).toEqual(["fssai_document", "payout_account"])
    expect(r.canSubmit).toBe(false)
    expect(decodeSubmit(data("submit_post_200")).status).toBe("PENDING_REVIEW")
  })

  test("accepting", () => {
    expect(decodeAccepting(data("accepting_patch_200")).isAcceptingOrders).toBe(true)
  })

  test("compliance: GET, PUT, PUT without GSTIN", () => {
    expect(decodeCompliance(data("compliance_get_200")).gstinRequired).toBe(false)
    const put = decodeCompliance(data("compliance_put_200"))
    expect(put.gstin).toBe("29ZZZPZ0000Z1Z6")
    expect(put.panMasked).toBe("****000Z")
    expect(decodeCompliance(data("compliance_put_200_eco_without_gstin")).gstin).toBeNull()
  })

  test("location GET/PUT", () => {
    expect(decodeLocation(data("location_get_200")).deliveryRadiusKm).toBe(6.5)
    expect(decodeLocation(data("location_put_200")).state).toBe("Karnataka")
  })

  test("operating hours: IST, an overnight window", () => {
    const h = decodeOperatingHours(data("operating_hours_get_200"))
    expect(h.timezone).toBe("Asia/Kolkata")
    expect(h.windows.find((w) => w.dayOfWeek === 5)?.overnight).toBe(true)
    decodeOperatingHours(data("operating_hours_put_200"))
  })

  test("FSSAI GET (rejected with a reason) and PUT (pending)", () => {
    const g = decodeFssai(data("fssai_get_200"))
    expect(g.documentStatus).toBe("REJECTED")
    expect(g.reviewReason).toBe("Licence photo is unreadable")
    expect(decodeFssai(data("fssai_put_200")).documentStatus).toBe("PENDING")
  })

  test("payout account: masked only", () => {
    const a = decodePayoutAccount(data("restaurant_payout_account_get_200"))
    expect(a.accountNumberMasked).toBe("****6789")
    expect(a.accountNumberMasked).not.toMatch(/\d{5,}/)
    expect(Object.keys(a)).not.toContain("accountNumber")
    decodePayoutAccount(data("restaurant_payout_account_put_200"))
  })

  test("payout account: an unmasked number fails closed", () => {
    const body = structuredClone(data("restaurant_payout_account_get_200")) as Record<string, unknown>
    body.account_number_masked = "123456789"
    expect(() => decodePayoutAccount(body)).toThrow(ContractError)
  })

  test("menu: categories and dishes priced from *_paise", () => {
    const cats = decodeMenuCategories(data("menu_categories_get_200"))
    expect(cats.map((c) => c.name)).toEqual(["Mains", "Desserts"])
    expect(cats[0].items[0].basePricePaise).toBe(25000)
    expect(cats[0].items[0].discountPricePaise).toBe(22550)
    const d = decodeMenuItemDetail(data("menu_item_get_200"))
    expect(d.variants[0].pricePaise).toBe(15000)
    expect(d.addonGroups[0].addons[0].pricePaise).toBe(3000)
    expect(decodePricedOption(data("menu_variant_post_201"), "v").name).toBe("Half")
    expect(decodeAddonGroup(data("addon_group_post_201")).addons).toEqual([])
    expect(decodePricedOption(data("addon_post_201"), "a").pricePaise).toBe(3000)
  })

  test("kitchen queue: paise and seconds_to_breach", () => {
    const [o] = decodeKitchenQueue(data("kitchen_queue_get_200"))
    expect(o.finalAmountPaise).toBe(64912)
    expect(o.secondsToBreach).toBe(300)
    expect(o.acceptDeadlineAt).toBe("2026-09-13T06:35:00Z")
  })

  test("partner order: totals in paise", () => {
    const o = decodePartnerOrder(data("partner_order_get_200"))
    expect(o.finalAmountPaise).toBe(64912)
    expect(o.items[0].lineTotalPaise).toBe(50000)
  })

  test("restaurant realtime token", () => {
    const t = decodeRealtimeToken(data("realtime_token_post_200_restaurant"))
    expect(t.scope).toBe("restaurant")
    expect(t.topics).toContain("food.restaurant.0b8f3c52-8d0a-4c55-9a55-3f3f0e1a0002.orders")
  })

  test("earnings summary and settlements in paise", () => {
    const s = decodeSummary(data("reports_summary_get_200"))
    expect(s.payoutPaise).toBe(597275)
    const [row] = decodeSettlements(data("settlements_get_200"))
    expect(row.refundAdjustmentPaise).toBe(64912)
    expect(row.paidAt).toBeNull()
    expect(row.paidReference).toBeNull()
  })

  test("a money field missing its paise sibling is a contract error, not a zero", () => {
    const body = structuredClone(data("kitchen_queue_get_200")) as { orders: Record<string, unknown>[] }
    delete body.orders[0].final_amount_paise
    expect(() => decodeKitchenQueue(body)).toThrow(ContractError)
    const half = structuredClone(data("kitchen_queue_get_200")) as { orders: Record<string, unknown>[] }
    half.orders[0].final_amount_paise = 649.12
    expect(() => decodeKitchenQueue(half)).toThrow(ContractError)
  })
})

describe("error fixtures map to stable failures", () => {
  const cases: [string, number, string, string | null][] = [
    ["accepting_patch_422_fssai_required", 422, "FOOD_FSSAI_REQUIRED", null],
    ["accepting_patch_422_not_live", 422, "FOOD_RESTAURANT_NOT_LIVE", null],
    ["compliance_put_422_gstin_pan_mismatch", 422, "FOOD_GSTIN_PAN_MISMATCH", "gstin"],
    ["compliance_put_422_gstin_required", 422, "FOOD_GSTIN_REQUIRED", "gstin"],
    ["compliance_put_503_pii_not_configured", 503, "PII_NOT_CONFIGURED", null],
    ["compliance_get_404_not_saved", 404, "FOOD_ONBOARDING_STEP_NOT_SAVED", null],
    ["location_put_422_radius", 422, "FOOD_DELIVERY_RADIUS_OUT_OF_RANGE", "delivery_radius_km"],
    ["location_put_422_state_invalid", 422, "FOOD_STATE_INVALID", "state"],
    ["location_put_422_state_required", 422, "FOOD_STATE_REQUIRED", "state"],
    ["operating_hours_put_422_day", 422, "FOOD_OPERATING_HOURS_DAY_INVALID", "windows[0].day_of_week"],
    ["fssai_put_422_expiry", 422, "FOOD_FSSAI_EXPIRY_INVALID", "expires_at"],
    ["payout_account_put_422_ifsc", 422, "INVALID_IFSC", "ifsc"],
    ["payout_account_put_503_pii_not_configured", 503, "PII_NOT_CONFIGURED", null],
    ["payout_account_get_404", 404, "FOOD_NOT_FOUND", null],
    ["submit_post_409_not_draft", 409, "FOOD_RESTAURANT_NOT_DRAFT", null],
    ["onboarding_400_invalid_body", 400, "INVALID_BODY", null],
    ["onboarding_404_not_owner", 404, "FOOD_NOT_FOUND", null],
    ["menu_variant_post_422_price_mismatch", 422, "FOOD_MENU_PRICE_MISMATCH", "price_paise"],
    ["partner_verify_pickup_post_409_not_accepted", 409, "FOOD_DELIVERY_ASSIGNMENT_NOT_READY", null],
    ["partner_verify_pickup_post_429_attempts_exceeded", 429, "FOOD_PICKUP_CODE_ATTEMPTS_EXCEEDED", null],
    ["realtime_token_post_404_foreign_restaurant", 404, "FOOD_NOT_FOUND", null],
    ["realtime_token_post_503_not_configured", 503, "FOOD_REALTIME_NOT_CONFIGURED", null],
  ]
  for (const [name, status, code, field] of cases) {
    test(name, () => {
      const f = toFailure(axiosError(status, name))
      expect(f.status).toBe(status)
      expect(f.code).toBe(code)
      expect(f.field).toBe(field)
      expect(f.message.length).toBeGreaterThan(0)
    })
  }

  test("422 not-ready carries missing[] for the checklist", () => {
    const f = toFailure(axiosError(422, "submit_post_422_not_ready"))
    expect(f.code).toBe("FOOD_RESTAURANT_NOT_READY")
    expect(f.missing).toEqual(["fssai_document", "payout_account"])
  })

  test("a 422's own server message is what the form shows", () => {
    const f = toFailure(axiosError(422, "location_put_422_radius"))
    expect(f.message).toBe("delivery_radius_km must be between 1 and 15")
  })

  test("no response at all is outcome-unknown (retry with the same key)", () => {
    expect(toFailure(new Error("network")).outcomeUnknown).toBe(true)
    expect(toFailure(axiosError(409, "submit_post_409_not_draft")).outcomeUnknown).toBe(false)
  })
})
