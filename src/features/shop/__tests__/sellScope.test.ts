import { describe, expect, it } from "bun:test"
import {
  businessAddressPayload,
  checklistCodes,
  completedSteps,
  documentsPayload,
  sellerScope,
  validateDocuments,
  type PickupAddressDraft,
} from "../model/sell"
import {
  bookOnlyTree,
  gstinCheckCharacter,
  gstinPAN,
  maskPAN,
  panHolderType,
  sellScopeFieldError,
  sellScopePayload,
  sellerScopeBooksOnlyFrom,
  validateGSTIN,
  validatePAN,
  validateSellScopeDraft,
  zeroRatedTaxClasses,
} from "../model/sellScope"

// commerce-service migration 045: the books-only seller path. Every vector
// below is one the Go side computes (shared/kyc GSTINCheckDigit, ValidatePAN).

describe("PAN", () => {
  it("checks the layout and the holder type, as shared/kyc ValidatePAN", () => {
    expect(validatePAN("ABCPE1234F")).toBeNull()
    expect(validatePAN(" abcpe1234f ")).toBeNull()
    expect(validatePAN("")).toMatch(/Enter/)
    for (const bad of ["ABCDE123", "ABCDE12345", "12345ABCDE"]) expect(validatePAN(bad)).toMatch(/five letters/)
    expect(validatePAN("ABCXE1234F")).toMatch(/holder type/)
  })
  it("names the holder type from the fourth character, and masks to the last four", () => {
    expect(panHolderType("ABCPE1234F")).toBe("Individual")
    expect(panHolderType("AAACM1234A")).toBe("Company")
    expect(panHolderType("nope")).toBeNull()
    expect(maskPAN("abcpe1234f")).toBe("XXXXXX234F")
  })
})

describe("GSTIN", () => {
  it("computes the same check character as shared/kyc", () => {
    expect(gstinCheckCharacter("27ABCPE1234F1Z")).toBe("B")
    expect(gstinCheckCharacter("29AAACM1234A1Z")).toBe("4")
    expect(gstinCheckCharacter("27PQRCS6789Z1Z")).toBe("0")
    expect(gstinCheckCharacter("short")).toBeNull()
  })
  it("refuses a wrong check character, a bad layout and a bad holder type", () => {
    expect(validateGSTIN("27ABCPE1234F1ZB")).toBeNull()
    expect(validateGSTIN("27abcpe1234f1zb")).toBeNull()
    expect(validateGSTIN("27ABCPE1234F1Z0")).toMatch(/last character/)
    expect(validateGSTIN("27ABCPE1234F1X0")).toMatch(/15 characters/)
    expect(validateGSTIN("")).toMatch(/Enter/)
    expect(gstinPAN("27ABCPE1234F1ZB")).toBe("ABCPE1234F")
  })
})

describe("the 'What will you sell?' step", () => {
  it("all categories needs a GSTIN and sends no PAN", () => {
    expect(validateSellScopeDraft({ scope: "all_categories", gstin: "", pan: "", businessName: "" }).gstin).toBeTruthy()
    expect(validateSellScopeDraft({ scope: "all_categories", gstin: "29AAACM1234A1Z4", pan: "", businessName: "" })).toEqual({})
    expect(sellScopePayload({ scope: "all_categories", gstin: " 29aaacm1234a1z4 ", pan: "ABCPE1234F", businessName: "" })).toEqual({ sell_scope: "all_categories", gstin: "29AAACM1234A1Z4" })
  })
  it("only books needs a PAN and the business name, and sends no GSTIN", () => {
    const e = validateSellScopeDraft({ scope: "books_only", gstin: "", pan: "", businessName: "" })
    expect(e.pan).toBeTruthy()
    expect(e.businessName).toBeTruthy()
    expect(e.gstin).toBeUndefined()
    expect(validateSellScopeDraft({ scope: "books_only", gstin: "", pan: "ABCPE1234F", businessName: "Asha Books" })).toEqual({})
    expect(sellScopePayload({ scope: "books_only", gstin: "29AAACM1234A1Z4", pan: "abcpe 1234f", businessName: " Asha Books " })).toEqual({
      sell_scope: "books_only", pan: "ABCPE1234F", business_name: "Asha Books",
    })
  })
  it("files the business address as address_type business, never as the pickup point", () => {
    const d: PickupAddressDraft = { contact_name: "Asha", phone: "9000000000", address_line_1: "2 Book Lane", address_line_2: "", city: "Pune", state: "MH", postal_code: "411001" }
    expect(businessAddressPayload(d).address_type).toBe("business")
  })
  it("reads the scope off the seller row; an older server sends none", () => {
    expect(sellerScope({ sell_scope: "books_only" })).toBe("books_only")
    expect(sellerScope({})).toBe("all_categories")
    expect(sellerScope(null)).toBe("all_categories")
  })
})

describe("readiness per scope", () => {
  const base = { has_store_name: true, has_email: true, has_pickup_address: true, has_payout_account: true, has_kyc_document: true }
  it("all categories: 'What you sell' is done by the GSTIN", () => {
    expect(completedSteps({ ready: false, missing: [], detail: { ...base, sell_scope: "all_categories" } }).has("scope")).toBe(false)
    expect(completedSteps({ ready: true, missing: [], detail: { ...base, sell_scope: "all_categories", has_gstin: true } }).has("scope")).toBe(true)
  })
  it("only books: PAN, name and address do the step, and the documents step needs the proof", () => {
    const books = { ...base, sell_scope: "books_only", has_pan: true, has_business_name: true, has_business_address: true }
    const s = completedSteps({ ready: false, missing: [], detail: books })
    expect(s.has("scope")).toBe(true)
    expect(s.has("documents")).toBe(false)
    expect(completedSteps({ ready: true, missing: [], detail: { ...books, has_address_proof: true } }).has("documents")).toBe(true)
    expect(completedSteps({ ready: false, missing: [], detail: { ...books, has_business_address: false } }).has("scope")).toBe(false)
    // A GSTIN does not stand in for the books path's requirements.
    expect(completedSteps({ ready: false, missing: [], detail: { ...base, sell_scope: "books_only", has_gstin: true } }).has("scope")).toBe(false)
  })
  it("the review checklist is the scope's, in the server's order", () => {
    expect(checklistCodes("all_categories")).toEqual(["gstin", "store_name", "email", "pickup_address", "payout_account", "kyc_document"])
    expect(checklistCodes("books_only")).toEqual(["pan", "business_name", "business_address", "address_proof", "store_name", "email", "pickup_address", "payout_account", "kyc_document"])
    expect(checklistCodes("books_only")).not.toContain("gstin")
  })
})

describe("proof of address", () => {
  it("a books-only shop needs one, and a voter ID or passport needs its back", () => {
    expect(validateDocuments([{ document_type: "pan_card", media_id: "m", document_number: "" }], "books_only")).toMatch(/proof of address/)
    expect(validateDocuments([{ document_type: "voter_id", media_id: "m", document_number: "" }], "books_only")).toMatch(/back/)
    expect(validateDocuments([{ document_type: "voter_id", media_id: "m", document_number: "", back_media_id: "b" }], "books_only")).toBeNull()
    expect(validateDocuments([{ document_type: "electricity_bill", media_id: "m", document_number: "" }], "books_only")).toBeNull()
    expect(validateDocuments([{ document_type: "passport", media_id: "m", document_number: "", back_media_id: "m" }], "books_only")).toMatch(/different photo/)
    // An all-categories shop is not asked for one.
    expect(validateDocuments([{ document_type: "pan_card", media_id: "m", document_number: "" }])).toBeNull()
  })
  it("sends a back only on a two-sided document, and no number on a bill or statement", () => {
    expect(documentsPayload([
      { document_type: "voter_id", media_id: "f", document_number: " ABC1234567 ", back_media_id: "b" },
      { document_type: "bank_statement", media_id: "s", document_number: "50100012345678", back_media_id: "x" },
      { document_type: "pan_card", media_id: "p", document_number: "", back_media_id: "y" },
    ])).toEqual([
      { document_type: "voter_id", media_id: "f", document_number: "ABC1234567", back_media_id: "b" },
      { document_type: "bank_statement", media_id: "s" },
      { document_type: "pan_card", media_id: "p" },
    ])
  })
})

describe("listing as a books-only shop", () => {
  const node = (id: string, children: ReturnType<typeof node>[] = [], is_listable = true) => ({ id, name: id, slug: id, display_order: 0, is_active: true, is_featured: false, is_listable, product_count: 0, depth: 0, children })
  it("keeps the allowed categories and the headings above them, nothing else", () => {
    const tree = [
      node("books", [node("textbooks", [node("engineering")]), node("notebooks")], false),
      node("electronics", [node("phones")]),
    ]
    const out = bookOnlyTree(tree, ["textbooks", "engineering"])
    expect(out.map((n) => n.id)).toEqual(["books"])
    expect(out[0].is_listable).toBe(false)
    expect(out[0].children.map((n) => n.id)).toEqual(["textbooks"])
    expect(out[0].children[0].children.map((n) => n.id)).toEqual(["engineering"])
    expect(bookOnlyTree(tree, [])).toEqual([])
  })
  it("offers only the zero-rated tax class", () => {
    expect(zeroRatedTaxClasses([{ id: "0", rate_percent: 0 }, { id: "5", rate_percent: 5 }, { id: "18", rate_percent: 18 }]).map((t) => t.id)).toEqual(["0"])
  })
})

describe("the refusals", () => {
  const err = (status: number, code: string, message: string, details: Record<string, unknown> = {}) => ({ response: { status, data: { error: { code, message, details } } } })
  it("claims 403 SELLER_SCOPE_BOOKS_ONLY with its field", () => {
    expect(sellerScopeBooksOnlyFrom(err(403, "SELLER_SCOPE_BOOKS_ONLY", "books only", { field: "tax_class_id", sell_scope: "books_only" }))).toEqual({ field: "tax_class_id", message: "books only" })
    expect(sellerScopeBooksOnlyFrom(err(403, "NO_SELLER", "x"))).toBeNull()
    // The code alone is enough; details may be trimmed by a proxy.
    expect(sellerScopeBooksOnlyFrom(err(403, "SELLER_SCOPE_BOOKS_ONLY", "books only"))).toEqual({ field: "", message: "books only" })
  })
  it("puts each step refusal under its field, and says the mismatch plainly", () => {
    expect(sellScopeFieldError(err(400, "PAN_INVALID", "that is not a valid PAN", { field: "pan" }))).toEqual({ field: "pan", message: "that is not a valid PAN" })
    expect(sellScopeFieldError(err(400, "GSTIN_PAN_MISMATCH", "x", { field: "gstin" }))?.field).toBe("gstin")
    expect(sellScopeFieldError(err(409, "SELL_SCOPE_LOCKED", "x"))?.field).toBe("")
    expect(sellScopeFieldError(err(500, "INTERNAL", "x"))).toBeNull()
  })
})
