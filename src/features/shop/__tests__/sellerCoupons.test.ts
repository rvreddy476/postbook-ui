import { describe, expect, it } from "bun:test"

import { inrMinor } from "../money"
import { SELLER_RAIL, activeRailHref, railIsAlphabetical } from "../model/sell"
import {
  EMPTY_COUPON_DRAFT,
  activeBody,
  bpsToPercent,
  couponSaveError,
  couponState,
  createCouponBody,
  discountSummary,
  draftFromCoupon,
  hasErrors,
  isoToLocalInput,
  localInputToIso,
  patchCouponBody,
  percentToBps,
  toSellerCoupon,
  toSellerCoupons,
  usesSummary,
  validateCouponDraft,
  type CouponDraft,
  type SellerCoupon,
  type WireSellerCoupon,
} from "../model/sellerCoupons"

const draft = (over: Partial<CouponDraft> = {}): CouponDraft => ({ ...EMPTY_COUPON_DRAFT, code: "DIWALI20", discountValue: "20", ...over })

const savedWire: WireSellerCoupon = {
  id: "c1",
  code: "DIWALI20",
  description: "Festive",
  discount_type: "percentage",
  discount_value: 2000,
  max_discount_minor: 20000,
  min_order_minor: 99900,
  max_uses: 100,
  max_uses_per_user: 1,
  uses_count: 12,
  applicable_to: "all",
  applicable_ids: [],
  starts_at: "2026-10-01T04:30:00Z",
  expires_at: "2026-10-31T18:29:00Z",
  is_public: true,
  is_active: true,
  funded_by: "seller",
  seller_id: "s1",
}
const saved = toSellerCoupon(savedWire) as SellerCoupon

describe("the rail", () => {
  it("has Coupons, in alphabetical place", () => {
    expect(SELLER_RAIL.map((e) => e.label)).toEqual(["Coupons", "Dashboard", "Orders", "Products", "Stock"])
    expect(railIsAlphabetical()).toBe(true)
    expect(activeRailHref("/shop/sell/coupons")).toBe("/shop/sell/coupons")
  })
})

describe("percent → basis points, by integer arithmetic", () => {
  it("exact for every two-decimal percentage, including the ones a float gets wrong", () => {
    expect(percentToBps("10")).toBe(1000)
    expect(percentToBps("12.5")).toBe(1250)
    expect(percentToBps("0.29")).toBe(29) // 0.29 * 100 === 28.999999999999996
    expect(percentToBps("1.15")).toBe(115) // 1.15 * 100 === 114.99999999999999
    expect(percentToBps("4.35")).toBe(435) // 4.35 * 100 === 434.99999999999994
    expect(percentToBps("100")).toBe(10000)
    expect(percentToBps(" 7.5% ")).toBe(750)
    for (let bps = 0; bps <= 10000; bps += 1) {
      expect(percentToBps(bpsToPercent(bps))).toBe(bps)
    }
  })
  it("refuses three decimals, exponents, signs and words", () => {
    for (const raw of ["12.345", "1e2", "-5", "+5", "ten", "", ".", "1000"]) expect(percentToBps(raw)).toBeNull()
  })
  it("basis points back to the words", () => {
    expect(bpsToPercent(1250)).toBe("12.5")
    expect(bpsToPercent(1000)).toBe("10")
    expect(bpsToPercent(25)).toBe("0.25")
    expect(bpsToPercent(5)).toBe("0.05")
  })
})

describe("validation", () => {
  it("a good draft has no errors", () => {
    expect(validateCouponDraft(draft(), "create")).toEqual({})
  })
  it("code: 4–20 of A–Z 0–9, upper-cased before the check", () => {
    expect(validateCouponDraft(draft({ code: "" }), "create").code).toBe("Enter a code.")
    expect(validateCouponDraft(draft({ code: "AB1" }), "create").code).toBeDefined()
    expect(validateCouponDraft(draft({ code: "SAVE-10" }), "create").code).toBeDefined()
    expect(validateCouponDraft(draft({ code: "save 10" }), "create").code).toBeUndefined()
  })
  it("percentage: 0.01 to 100, two decimals at most", () => {
    expect(validateCouponDraft(draft({ discountValue: "0" }), "create").discountValue).toBeDefined()
    expect(validateCouponDraft(draft({ discountValue: "100.01" }), "create").discountValue).toBeDefined()
    expect(validateCouponDraft(draft({ discountValue: "12.345" }), "create").discountValue).toBeDefined()
    expect(validateCouponDraft(draft({ discountValue: "0.01" }), "create").discountValue).toBeUndefined()
    expect(validateCouponDraft(draft({ discountValue: "" }), "create").discountValue).toBe("Enter the percentage off.")
  })
  it("flat: positive rupees through parseMinor", () => {
    expect(validateCouponDraft(draft({ discountType: "flat", discountValue: "150" }), "create").discountValue).toBeUndefined()
    expect(validateCouponDraft(draft({ discountType: "flat", discountValue: "99.999" }), "create").discountValue).toBeDefined()
    expect(validateCouponDraft(draft({ discountType: "flat", discountValue: "0" }), "create").discountValue).toBeDefined()
  })
  it("limits, products and dates", () => {
    const e = validateCouponDraft(
      draft({ maxDiscount: "abc", minOrder: "1.234", maxUses: "0", maxUsesPerUser: "", appliesTo: "product", applicableIds: [], startsAt: "2026-10-10T10:00", expiresAt: "2026-10-09T10:00" }),
      "create",
    )
    expect(Object.keys(e).sort()).toEqual(["applicableIds", "expiresAt", "maxDiscount", "maxUses", "maxUsesPerUser", "minOrder"])
    expect(hasErrors(e)).toBe(true)
    expect(validateCouponDraft(draft({ description: "x".repeat(201) }), "create").description).toBeDefined()
  })
  it("edit skips the fixed fields but keeps the start date", () => {
    const d = { ...draftFromCoupon(saved), code: "", discountValue: "" }
    expect(validateCouponDraft(d, "edit")).toEqual({})
    expect(validateCouponDraft({ ...d, startsAt: "" }, "edit").startsAt).toBeDefined()
  })
})

describe("create body: rupees → paise, percent → bps, optional keys only when set", () => {
  it("percentage with a cap and a minimum", () => {
    const body = createCouponBody(draft({ code: " diwali20 ", discountValue: "12.5", maxDiscount: "200", minOrder: "999.00", maxUses: "100", maxUsesPerUser: "2", description: " Festive " }))
    expect(body).toEqual({
      code: "DIWALI20",
      description: "Festive",
      discount_type: "percentage",
      discount_value: 1250,
      max_discount_minor: 20000,
      min_order_minor: 99900,
      max_uses: 100,
      max_uses_per_user: 2,
      applicable_to: "all",
      applicable_ids: [],
      is_public: true,
    })
  })
  it("flat rupees are exact paise (no float), and a flat coupon never sends a cap", () => {
    const body = createCouponBody(draft({ discountType: "flat", discountValue: "1,299.99", maxDiscount: "50" }))
    expect(body.discount_value).toBe(129999)
    expect("max_discount_minor" in body).toBe(false)
    expect(createCouponBody(draft({ discountType: "flat", discountValue: "0.29" })).discount_value).toBe(29)
  })
  it("chosen products and dates", () => {
    const body = createCouponBody(draft({ appliesTo: "product", applicableIds: ["p1", "p2"], startsAt: "2026-10-01T10:00", expiresAt: "2026-10-31T23:59", isPublic: false }))
    expect(body.applicable_to).toBe("product")
    expect(body.applicable_ids).toEqual(["p1", "p2"])
    expect(body.starts_at).toBe(new Date("2026-10-01T10:00").toISOString())
    expect(body.expires_at).toBe(new Date("2026-10-31T23:59").toISOString())
    expect(body.is_public).toBe(false)
  })
  it("empty optionals are absent, not null or 0", () => {
    const body = createCouponBody(draft())
    for (const key of ["max_discount_minor", "min_order_minor", "max_uses", "starts_at", "expires_at"]) expect(key in body).toBe(false)
    expect(createCouponBody(draft({ appliesTo: "all", applicableIds: ["leftover"] })).applicable_ids).toEqual([])
  })
})

describe("edit body: only what changed; null clears", () => {
  it("an untouched form sends nothing", () => {
    expect(patchCouponBody(saved, draftFromCoupon(saved))).toEqual({})
  })
  it("one changed field is the whole body", () => {
    expect(patchCouponBody(saved, { ...draftFromCoupon(saved), maxUses: "250" })).toEqual({ max_uses: 250 })
    expect(patchCouponBody(saved, { ...draftFromCoupon(saved), minOrder: "1499" })).toEqual({ min_order_minor: 149900 })
    expect(patchCouponBody(saved, { ...draftFromCoupon(saved), isPublic: false })).toEqual({ is_public: false })
    expect(patchCouponBody(saved, { ...draftFromCoupon(saved), maxUsesPerUser: "3" })).toEqual({ max_uses_per_user: 3 })
  })
  it("clearing max discount, max uses, the end date or the description sends null", () => {
    const d = { ...draftFromCoupon(saved), maxDiscount: "", maxUses: "", expiresAt: "", description: "" }
    expect(patchCouponBody(saved, d)).toEqual({ max_discount_minor: null, max_uses: null, expires_at: null, description: null })
  })
  it("clearing the minimum order sends 0 (not one of the nullable fields)", () => {
    expect(patchCouponBody(saved, { ...draftFromCoupon(saved), minOrder: "" })).toEqual({ min_order_minor: 0 })
  })
  it("a changed date is re-sent as ISO; an unchanged one is not", () => {
    const d = { ...draftFromCoupon(saved), expiresAt: "2026-11-30T23:59" }
    expect(patchCouponBody(saved, d)).toEqual({ expires_at: new Date("2026-11-30T23:59").toISOString() })
  })
  it("the fixed fields are never sent, whatever the form holds", () => {
    const d = { ...draftFromCoupon(saved), code: "OTHER", discountType: "flat" as const, discountValue: "1", appliesTo: "product" as const, applicableIds: ["p9"] }
    expect(patchCouponBody(saved, d)).toEqual({})
  })
  it("deactivate is a PATCH of is_active alone", () => {
    expect(activeBody(false)).toEqual({ is_active: false })
    expect(activeBody(true)).toEqual({ is_active: true })
  })
})

describe("reading the list", () => {
  it("tolerates the alternate key names the console accepts", () => {
    const c = toSellerCoupon({ id: "c2", code: "FLAT50", discount_type: "flat", discount_value_minor: 5000, min_order_amount_minor: 49900, max_discount_amount_minor: 100 })
    expect(c).toMatchObject({ discountType: "flat", discountValue: 5000, minOrderMinor: 49900, maxDiscountMinor: 100, maxUses: null, maxUsesPerUser: 1, isActive: true, isPublic: true })
    expect(toSellerCoupon({ id: "c3", code: "P", discount_type: "percentage", discount_basis_points: 750 })?.discountValue).toBe(750)
    expect(toSellerCoupons({ items: [savedWire, { code: "NOID" }] }).length).toBe(1)
    expect(toSellerCoupons([savedWire]).length).toBe(1)
  })
  it("summaries", () => {
    expect(discountSummary(saved, inrMinor)).toBe("20% off, up to ₹200")
    expect(discountSummary({ discountType: "flat", discountValue: 15050, maxDiscountMinor: null }, inrMinor)).toBe("₹150.50 off")
    expect(usesSummary(saved)).toBe("12 of 100 used")
    expect(usesSummary({ usesCount: 3, maxUses: null })).toBe("3 used")
  })
  it("the status: off beats dates, dates beat the cap", () => {
    const now = Date.parse("2026-10-15T00:00:00Z")
    expect(couponState(saved, now)).toBe("active")
    expect(couponState({ ...saved, isActive: false }, now)).toBe("inactive")
    expect(couponState(saved, Date.parse("2026-11-01T00:00:00Z"))).toBe("expired")
    expect(couponState(saved, Date.parse("2026-09-01T00:00:00Z"))).toBe("scheduled")
    expect(couponState({ ...saved, usesCount: 100 }, now)).toBe("used_up")
  })
  it("dates round-trip through the form", () => {
    expect(localInputToIso(isoToLocalInput("2026-10-01T04:30:00Z"))).toBe("2026-10-01T04:30:00.000Z")
    expect(isoToLocalInput("")).toBe("")
    expect(localInputToIso("2026-10-01")).toBeNull()
  })
  it("save refusals by code", () => {
    expect(couponSaveError("COUPON_CODE_TAKEN", 409)).toBe("That code is already taken. Try another.")
    expect(couponSaveError("", 409)).toBe("That code is already taken. Try another.")
    expect(couponSaveError("PRODUCT_NOT_OWNED", 422)).toBe("A coupon can only apply to your own products.")
    expect(couponSaveError("", 500)).toBe("The coupon couldn't be saved. Try again.")
  })
})
