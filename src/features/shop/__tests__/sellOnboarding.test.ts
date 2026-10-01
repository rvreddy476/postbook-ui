import { describe, expect, it } from "bun:test"
import {
  DOCUMENT_TYPES,
  MISSING_CODES,
  SELLER_RAIL,
  SELLER_STATUSES,
  STOCK_REASONS,
  WIZARD_STEPS,
  activeRailHref,
  completedSteps,
  documentTypeOptions,
  documentsPayload,
  firstOpenStep,
  fulfillmentPayload,
  isNoSeller,
  looksLikeAadhaar,
  mapMissing,
  maskAccountNumber,
  missingFromSubmitError,
  payoutPayload,
  pickupAddressPayload,
  productRow,
  productStatusUI,
  railIsAlphabetical,
  sellerNeedsWizard,
  sellerStatusBanner,
  stepUnlocked,
  stockAdjustPayload,
  stockRows,
  submitOffered,
  submitProductError,
  validateDocuments,
  validatePayout,
  validatePickupAddress,
  validateStockAdjust,
  type WizardStep,
} from "../model/sell"

// ── The rail ────────────────────────────────────────────────────

describe("the rail", () => {
  it("is Coupons, Dashboard, Orders, Products, Stock — alphabetical, nothing fenced", () => {
    expect(SELLER_RAIL.map((e) => e.label)).toEqual(["Coupons", "Dashboard", "Orders", "Products", "Stock"])
    expect(railIsAlphabetical()).toBe(true)
    expect(railIsAlphabetical([{ label: "Stock", href: "/b" }, { label: "Orders", href: "/a" }])).toBe(false)
    for (const word of ["Earnings", "Payouts", "Returns", "RFQs", "Bulk import"]) expect(SELLER_RAIL.some((e) => e.label === word)).toBe(false)
  })
  it("marks the longest matching href active", () => {
    expect(activeRailHref("/shop/sell")).toBe("/shop/sell")
    expect(activeRailHref("/shop/sell/products/new")).toBe("/shop/sell/products")
    expect(activeRailHref("/shop/sell/orders/abc")).toBe("/shop/sell/orders")
    expect(activeRailHref("/shop/bag")).toBeNull()
  })
})

// ── The status banner ───────────────────────────────────────────

describe("sellerStatusBanner", () => {
  it("has a banner for every seller status the CHECK admits, and only approved can trade", () => {
    for (const status of SELLER_STATUSES) {
      const b = sellerStatusBanner({ status })
      expect(b.label.length).toBeGreaterThan(0)
      expect(b.body.length).toBeGreaterThan(0)
      expect(b.canTrade).toBe(status === "approved")
    }
  })
  it("maps each status to its label and tone", () => {
    expect(sellerStatusBanner({ status: "draft" })).toMatchObject({ label: "Draft", tone: "muted", action: { href: "/shop/sell/onboarding" } })
    expect(sellerStatusBanner({ status: "submitted" })).toMatchObject({ label: "Submitted", tone: "info" })
    expect(sellerStatusBanner({ status: "under_review" })).toMatchObject({ label: "Under review", tone: "info" })
    expect(sellerStatusBanner({ status: "changes_required", changes_requested: "Upload a clearer PAN." })).toMatchObject({ label: "Changes required", tone: "warning" })
    expect(sellerStatusBanner({ status: "changes_required", changes_requested: "Upload a clearer PAN." }).body).toContain("Upload a clearer PAN.")
    expect(sellerStatusBanner({ status: "approved" })).toMatchObject({ label: "Approved", tone: "success", canTrade: true })
    expect(sellerStatusBanner({ status: "rejected", rejection_reason: "Documents did not match." }).body).toContain("Documents did not match.")
    expect(sellerStatusBanner({ status: "suspended" })).toMatchObject({ label: "Suspended", tone: "danger" })
    expect(sellerStatusBanner({ status: "disabled" })).toMatchObject({ label: "Disabled", tone: "danger" })
  })
  it("says a person reads hand-uploaded documents while in review", () => {
    expect(sellerStatusBanner({ status: "submitted" }).body).toMatch(/person/i)
    expect(sellerStatusBanner({ status: "under_review" }).body).toMatch(/reviewer/i)
  })
  it("survives a status it has never heard of", () => {
    expect(sellerStatusBanner({ status: "frozen" })).toMatchObject({ label: "Frozen", tone: "muted", canTrade: false })
  })
  it("sends draft and changes_required to the wizard, nothing else", () => {
    expect(sellerNeedsWizard("draft")).toBe(true)
    expect(sellerNeedsWizard("changes_required")).toBe(true)
    for (const s of ["submitted", "under_review", "approved", "rejected", "suspended"]) expect(sellerNeedsWizard(s)).toBe(false)
  })
  it("recognises the no-profile answers", () => {
    expect(isNoSeller({ response: { status: 403, data: { error: { code: "NO_SELLER" } } } })).toBe(true)
    expect(isNoSeller({ response: { status: 404, data: { error: { code: "NOT_FOUND" } } } })).toBe(true)
    expect(isNoSeller({ response: { status: 500 } })).toBe(false)
  })
})

// ── The wizard ──────────────────────────────────────────────────

describe("wizard step gating", () => {
  const done = (...steps: WizardStep[]) => new Set<WizardStep>(steps)
  it("basic is always open; nothing else opens before basic is saved", () => {
    expect(stepUnlocked("basic", done())).toBe(true)
    for (const s of WIZARD_STEPS.filter((x) => x !== "basic")) expect(stepUnlocked(s, done())).toBe(false)
  })
  it("documents, fulfilment, payout and the optional storefront open after basic", () => {
    for (const s of ["storefront", "documents", "fulfillment", "payout"] as const) expect(stepUnlocked(s, done("basic"))).toBe(true)
    expect(stepUnlocked("readiness", done("basic"))).toBe(false)
  })
  it("review opens only when every required step is complete", () => {
    expect(stepUnlocked("readiness", done("basic", "documents", "fulfillment"))).toBe(false)
    expect(stepUnlocked("readiness", done("basic", "documents", "fulfillment", "payout"))).toBe(true)
  })
  it("firstOpenStep lands on the first incomplete required step, skipping storefront", () => {
    expect(firstOpenStep(done())).toBe("basic")
    expect(firstOpenStep(done("basic"))).toBe("documents")
    expect(firstOpenStep(done("basic", "documents"))).toBe("fulfillment")
    expect(firstOpenStep(done("basic", "documents", "fulfillment"))).toBe("payout")
    expect(firstOpenStep(done("basic", "documents", "fulfillment", "payout"))).toBe("readiness")
  })
  it("completedSteps reads the readiness detail", () => {
    expect([...completedSteps({ ready: false, missing: [], detail: { has_store_name: true, has_email: true, has_pickup_address: true, has_payout_account: false, has_kyc_document: true } })].sort()).toEqual(["basic", "documents", "fulfillment"])
    expect([...completedSteps({ ready: false, missing: [], detail: { has_store_name: true, has_email: false } })]).toEqual([])
    expect([...completedSteps(null)]).toEqual([])
  })
})

describe("missing[] mapping", () => {
  it("maps every code SellerReadiness.Missing() can name to a label and a step", () => {
    expect(Object.keys(MISSING_CODES).sort()).toEqual(["email", "kyc_document", "payout_account", "pickup_address", "store_name"])
    expect(mapMissing(["store_name", "email", "pickup_address", "payout_account", "kyc_document"]).map((m) => m.step)).toEqual(["basic", "basic", "fulfillment", "payout", "documents"])
  })
  it("keeps an unknown code rather than dropping it", () => {
    expect(mapMissing(["gst_number"])).toEqual([{ code: "gst_number", label: "Gst number", step: "readiness" }])
    expect(mapMissing(undefined)).toEqual([])
  })
  it("reads the 409 APPLICATION_INCOMPLETE the handler actually sends", () => {
    const err = { response: { status: 409, data: { error: { code: "APPLICATION_INCOMPLETE", message: "the seller application is incomplete: pickup_address, kyc_document" } } } }
    expect(missingFromSubmitError(err)).toEqual(["pickup_address", "kyc_document"])
  })
  it("reads a 422 with details.missing too, and nothing from any other error", () => {
    expect(missingFromSubmitError({ response: { status: 422, data: { error: { code: "VALIDATION", message: "x", details: { missing: ["email"] } } } } })).toEqual(["email"])
    expect(missingFromSubmitError({ response: { status: 500, data: { error: { code: "INTERNAL", message: "boom" } } } })).toBeNull()
  })
})

describe("documents", () => {
  it("offers exactly the handler's vocabulary, alphabetical by label", () => {
    expect([...DOCUMENT_TYPES].sort()).toEqual(["aadhaar", "address_proof", "business_registration", "cancelled_cheque", "gst_certificate", "other", "pan_card", "passport"])
    const labels = documentTypeOptions().map((o) => o.label)
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, "en")))
  })
  it("never sends an Aadhaar number, and leaves out rows with no upload", () => {
    expect(documentsPayload([{ document_type: "aadhaar", media_id: "m1", document_number: "1234 5678 9012" }, { document_type: "pan_card", media_id: "m2", document_number: " ABCDE1234F " }, { document_type: "other", media_id: "", document_number: "" }])).toEqual([
      { document_type: "aadhaar", media_id: "m1" },
      { document_type: "pan_card", media_id: "m2", document_number: "ABCDE1234F" },
    ])
  })
  it("refuses an Aadhaar-shaped number on any type but a cancelled cheque, and a duplicate type", () => {
    expect(looksLikeAadhaar("1234 5678 9012")).toBe(true)
    expect(looksLikeAadhaar("ABCDE1234F")).toBe(false)
    expect(validateDocuments([{ document_type: "pan_card", media_id: "m", document_number: "123456789012" }])).toMatch(/Aadhaar/)
    expect(validateDocuments([{ document_type: "cancelled_cheque", media_id: "m", document_number: "123456789012" }])).toBeNull()
    expect(validateDocuments([{ document_type: "pan_card", media_id: "a", document_number: "" }, { document_type: "pan_card", media_id: "b", document_number: "" }])).toMatch(/Only one/)
    expect(validateDocuments([])).toMatch(/at least one/)
  })
})

describe("fulfilment and the pickup address", () => {
  it("never switches COD on and defaults the SLA and window", () => {
    expect(fulfillmentPayload({ dispatch_sla_hours: 0, return_supported: true, return_window_days: 0 })).toEqual({ delivery_modes: ["platform"], cod_enabled: false, dispatch_sla_hours: 48, return_supported: true, return_window_days: 7 })
    expect(fulfillmentPayload({ dispatch_sla_hours: 24, return_supported: false, return_window_days: 30 }).return_window_days).toBe(7)
  })
  it("requires the fields that decide money", () => {
    const e = validatePickupAddress({ contact_name: "", phone: "12345", address_line_1: "", address_line_2: "", city: "", state: "", postal_code: "12" })
    expect(Object.keys(e).sort()).toEqual(["address_line_1", "city", "contact_name", "phone", "postal_code", "state"])
    expect(validatePickupAddress({ contact_name: "Asha", phone: "98765 43210", address_line_1: "12 MG Road", address_line_2: "", city: "Bengaluru", state: "Karnataka", postal_code: "560001" })).toEqual({})
  })
  it("sends the seller address body the handler binds", () => {
    expect(pickupAddressPayload({ contact_name: " Asha ", phone: "98765 43210", address_line_1: "12 MG Road", address_line_2: "", city: "Bengaluru", state: "KA", postal_code: "560001" })).toEqual({ address_type: "pickup", contact_name: "Asha", phone: "9876543210", address_line_1: "12 MG Road", city: "Bengaluru", state: "KA", postal_code: "560001", country: "IN", is_default: true })
  })
})

describe("payout", () => {
  const good = { account_holder_name: "Asha Rao", account_number: "1234 5678 9012", ifsc_code: "hdfc0001234", bank_name: "", upi_id: "" }
  it("requires holder, account and IFSC (readiness counts the account only with an IFSC)", () => {
    expect(validatePayout(good)).toEqual({})
    expect(validatePayout({ ...good, ifsc_code: "" }).ifsc_code).toBeTruthy()
    expect(validatePayout({ ...good, account_number: "12" }).account_number).toBeTruthy()
    expect(validatePayout({ ...good, upi_id: "not-a-upi" }).upi_id).toBeTruthy()
    expect(validatePayout({ ...good, upi_id: "asha@okhdfc" })).toEqual({})
  })
  it("sends the number without spaces and the IFSC upper-cased, optional fields only when set", () => {
    expect(payoutPayload(good)).toEqual({ account_holder_name: "Asha Rao", account_number: "123456789012", ifsc_code: "HDFC0001234" })
    expect(payoutPayload({ ...good, bank_name: "HDFC", upi_id: "asha@okhdfc" })).toMatchObject({ bank_name: "HDFC", upi_id: "asha@okhdfc" })
  })
  it("shows only the last four digits afterwards", () => {
    expect(maskAccountNumber("1234 5678 9012")).toBe("•••• 9012")
    expect(maskAccountNumber("12")).toBe("••••")
  })
})

// ── Products ────────────────────────────────────────────────────

describe("product rows", () => {
  it("maps approval_status to the five labels and the extra terminal ones", () => {
    expect(productStatusUI("draft").label).toBe("Draft")
    expect(productStatusUI("pending").label).toBe("Draft")
    expect(productStatusUI("submitted").label).toBe("Submitted")
    expect(productStatusUI("under_review").label).toBe("Submitted")
    expect(productStatusUI("approved").label).toBe("Active")
    expect(productStatusUI("live").label).toBe("Active")
    expect(productStatusUI("changes_requested").label).toBe("Changes required")
    expect(productStatusUI("flagged").label).toBe("Changes required")
    expect(productStatusUI("rejected").label).toBe("Rejected")
    expect(productStatusUI("hidden").label).toBe("Hidden")
    expect(productStatusUI("").label).toBe("Unknown")
  })
  it("reads the summary projection and falls through on Go zero values", () => {
    const row = productRow({ id: "p1", title: "Tee", approval_status: "draft", min_price_minor: 0, mrp_minor: 0, total_stock: 0, in_stock: false, thumbnail_url: "", image_url: "https://cdn/x.jpg" })
    expect(row).toMatchObject({ title: "Tee", statusLabel: "Draft", priceMinor: null, mrpMinor: null, stock: 0, inStock: false, imageUrl: "https://cdn/x.jpg", submittable: true })
    expect(productRow({ id: "p2", approval_status: "approved", min_price_minor: 74900, total_stock: 3, in_stock: true }).priceMinor).toBe(74900)
    expect(productRow({ id: "p3" }).title).toBe("Untitled listing")
  })
  it("offers submit only for a submittable status whose readiness passes", () => {
    const ready = { ready: true, missing: [] }
    const missing = { ready: false, missing: [{ code: "listing.image", label: "Product image", reason: "no image" }] }
    expect(submitOffered({ submittable: true }, ready)).toBe(true)
    expect(submitOffered({ submittable: true }, missing)).toBe(false)
    expect(submitOffered({ submittable: true }, null)).toBe(false)
    expect(submitOffered({ submittable: false }, ready)).toBe(false)
    expect(submitOffered({ submittable: true }, { ready: true, missing: [{ code: "x", reason: "y" }] })).toBe(false)
  })
  it("explains the submit route's refusals", () => {
    expect(submitProductError({ response: { status: 422, data: { error: { code: "PRODUCT_INCOMPLETE", message: "x", details: { fields: [{ code: "listing.image", label: "Product image", reason: "r" }] } } } } })).toBe("Still needed: Product image.")
    expect(submitProductError({ response: { status: 409, data: { error: { code: "SELLER_NOT_APPROVED", message: "x" } } } })).toMatch(/not approved/)
    expect(submitProductError({ response: { status: 409, data: { error: { code: "PRODUCT_NOT_SUBMITTABLE", message: "x" } } } })).toMatch(/cannot be sent/)
    expect(submitProductError({ response: { status: 500, data: { error: { code: "INTERNAL", message: "boom" } } } })).toBe("boom")
  })
})

// ── Stock ───────────────────────────────────────────────────────

describe("stock", () => {
  it("lists every non-archived variant with its available_qty, null when there is no inventory row", () => {
    const rows = stockRows({ id: "p", title: "Tee" }, [
      { id: "v1", sku: "TEE-S", option_1_name: "Size", option_1_value: "S", selling_price_minor: 74900, available_qty: 4 },
      { id: "v2", sku: "TEE-M", status: "archived", available_qty: 9 },
      { id: "v3", sku: "TEE-L", selling_price: 749, available_qty: null },
    ])
    expect(rows.map((r) => r.variantId)).toEqual(["v1", "v3"])
    expect(rows[0]).toMatchObject({ options: "Size: S", priceMinor: 74900, available: 4 })
    expect(rows[1]).toMatchObject({ priceMinor: 74900, available: null })
  })
  it("requires a non-zero integer delta and an explicit reason", () => {
    expect(validateStockAdjust({ delta: "", reason: "purchase", notes: "" }, 5).delta).toBeTruthy()
    expect(validateStockAdjust({ delta: "0", reason: "purchase", notes: "" }, 5).delta).toBeTruthy()
    expect(validateStockAdjust({ delta: "1.5", reason: "purchase", notes: "" }, 5).delta).toBeTruthy()
    expect(validateStockAdjust({ delta: "5", reason: "", notes: "" }, 5).reason).toBeTruthy()
    expect(validateStockAdjust({ delta: "5", reason: "sale", notes: "" }, 5).reason).toBeTruthy()
    expect(validateStockAdjust({ delta: "+5", reason: "purchase", notes: "" }, 5)).toEqual({})
    expect(validateStockAdjust({ delta: "-3", reason: "damage", notes: "" }, 5)).toEqual({})
  })
  it("refuses to write down more than is available, and keeps the sign on the wire", () => {
    expect(validateStockAdjust({ delta: "-6", reason: "damage", notes: "" }, 5).delta).toMatch(/Only 5/)
    expect(validateStockAdjust({ delta: "-6", reason: "damage", notes: "" }, null)).toEqual({})
    expect(stockAdjustPayload({ delta: "-3", reason: "damage", notes: " water " })).toEqual({ delta: -3, reason: "damage", notes: "water" })
    expect(stockAdjustPayload({ delta: "+7", reason: "purchase", notes: "" })).toEqual({ delta: 7, reason: "purchase" })
  })
  it("offers exactly the server's reason codes, alphabetical", () => {
    expect([...STOCK_REASONS]).toEqual(["correction", "damage", "purchase", "recount", "theft"])
  })
})

describe("business types", () => {
  it("offer exactly the sellers.business_type CHECK vocabulary, each with a label", async () => {
    const { BUSINESS_TYPES, BUSINESS_TYPE_LABEL } = await import("../model/sell")
    expect([...BUSINESS_TYPES].sort()).toEqual(["brand", "home_business", "individual", "manufacturer", "retailer", "wholesaler"])
    for (const t of BUSINESS_TYPES) expect(BUSINESS_TYPE_LABEL[t].length).toBeGreaterThan(0)
  })
})
