import { describe, expect, it } from "bun:test"
import type { AttributeSchema } from "../model/attributes"
import {
  EDITOR_STEPS,
  arrangeGroups,
  attributeErrorsFrom,
  attributeValuesFromProduct,
  basicsFromProduct,
  editorStepUnlocked,
  emptyBasics,
  incompleteFrom,
  listingColumns,
  notPatchableFrom,
  revalidationFrom,
  singleVariantPayload,
  stepForGap,
  toAttributePayload,
  validateBasics,
  validateOffer,
  variationProblemsFrom,
} from "../model/sellListing"

// The listing editor's rules: the server's refusals decoded, the attribute
// answers on the wire, the built-in columns, and the money rule.

const refusal = (status: number, code: string, details?: Record<string, unknown>, message = "server words") => ({ response: { status, data: { error: { code, message, details } } } })

describe("the write routes' refusals", () => {
  it("422 ATTRIBUTE_VALUES_INVALID → per-code messages; anything else → null", () => {
    expect(attributeErrorsFrom(refusal(422, "ATTRIBUTE_VALUES_INVALID", { fields: [{ code: "pages", reason: "must be a whole number" }, { code: "", reason: "x" }] }))).toEqual({ pages: { message: "must be a whole number", code: "ATTRIBUTE_VALUES_INVALID" } })
    expect(attributeErrorsFrom(refusal(422, "ATTRIBUTE_VALUES_INVALID"))).toEqual({})
    expect(attributeErrorsFrom(refusal(400, "INVALID_BODY"))).toBeNull()
  })
  it("422 VARIATION_INVALID → every problem, in order", () => {
    expect(variationProblemsFrom(refusal(422, "VARIATION_INVALID", { problems: [{ variant: "TEE-M", code: "size", reason: "not an option" }, { reason: "" }] }))).toEqual([{ variant: "TEE-M", code: "size", reason: "not an option" }])
    expect(variationProblemsFrom(refusal(422, "ATTRIBUTE_VALUES_INVALID"))).toBeNull()
  })
  it("409 REVALIDATION_REQUIRED → the fields, and an empty list still means yes", () => {
    expect(revalidationFrom(refusal(409, "REVALIDATION_REQUIRED", { fields: ["title", 3] }))).toEqual({ fields: ["title"] })
    expect(revalidationFrom(refusal(409, "REVALIDATION_REQUIRED"))).toEqual({ fields: [] })
    expect(revalidationFrom(refusal(409, "CONFLICT"))).toBeNull()
  })
  it("400 FIELD_NOT_PATCHABLE → the message and the allowlist", () => {
    expect(notPatchableFrom(refusal(400, "FIELD_NOT_PATCHABLE", { fields: ["slug"], patchable: ["title", "hsn_code"] }, "no"))).toEqual({ message: "no", patchable: ["title", "hsn_code"] })
    expect(notPatchableFrom(refusal(400, "INVALID_BODY"))).toBeNull()
  })
  it("422 PRODUCT_INCOMPLETE → the gaps with the gate's labels", () => {
    expect(incompleteFrom(refusal(422, "PRODUCT_INCOMPLETE", { fields: [{ code: "listing.image", label: "Product image", reason: "no image" }, { code: "pages", reason: "required" }] }))).toEqual([
      { code: "listing.image", label: "Product image", reason: "no image" },
      { code: "pages", label: "pages", reason: "required" },
    ])
    expect(incompleteFrom(refusal(409, "SELLER_NOT_APPROVED"))).toBeNull()
  })
  it("maps the gate's built-in codes to the step that fixes them", () => {
    expect(stepForGap("listing.image")).toBe("images")
    expect(stepForGap("listing.price")).toBe("variants")
    expect(stepForGap("listing.stock")).toBe("variants")
    expect(stepForGap("listing.variant")).toBe("variants")
    expect(stepForGap("listing.tax_class")).toBe("details")
    expect(stepForGap("pages")).toBe("details")
  })
})

describe("attribute answers on the wire", () => {
  it("sends raw values under {code, value}, a unit beside a measure, and skips blanks", () => {
    expect(toAttributePayload({ pages: { type: "integer", value: 328 }, weight: { type: "measure", value: "250", unit: "g" }, brand: { type: "text", value: "" }, tags: { type: "multi_enum", value: [] }, gone: null, price: { type: "money_minor", value: 129900 } })).toEqual([
      { code: "pages", value: 328 },
      { code: "weight", value: "250", unit_code: "g" },
      { code: "price", value: 129900 },
    ])
  })
  it("re-tags the detail route's rows by their declared data_type and carries unknown types", () => {
    const values = attributeValuesFromProduct([
      { code: "weight", data_type: "measure", value: 250, unit_code: "g" },
      { code: "ratio", data_type: "decimal", value: 1.5 },
      { code: "pages", data_type: "integer", value: 328 },
      { code: "holo", data_type: "hologram", value: { a: 1 } },
      { code: "empty", data_type: "text", value: null },
    ])
    expect(values.weight).toEqual({ type: "measure", value: "250", unit: "g" })
    expect(values.ratio).toEqual({ type: "decimal", value: "1.5" })
    expect(values.pages).toEqual({ type: "integer", value: 328 })
    expect(values.holo).toEqual({ type: "unknown", data_type: "hologram", value: { a: 1 } })
    expect("empty" in values).toBe(false)
  })
  it("lifts offer-scope attributes out of the item groups", () => {
    const schema = {
      category_id: "c",
      category_path: [],
      schema_version: 1,
      variation_axes: [],
      groups: [
        { name: "Details", sort_order: 1, attributes: [{ code: "a", label: "A", data_type: "text", required: false, scope: "item", is_variant_axis: false, lookup_endpoint: null }, { code: "ship", label: "Ship", data_type: "text", required: false, scope: "offer", is_variant_axis: false, lookup_endpoint: null }] },
        { name: "Offer", sort_order: 0, attributes: [{ code: "w", label: "W", data_type: "text", required: false, scope: "offer", is_variant_axis: false, lookup_endpoint: null }] },
      ],
    } as unknown as AttributeSchema
    const { itemGroups, offerAttributes } = arrangeGroups(schema)
    expect(itemGroups.map((g) => g.name)).toEqual(["Details"])
    expect(itemGroups[0].attributes.map((d) => d.code)).toEqual(["a"])
    expect(offerAttributes.map((d) => d.code)).toEqual(["w", "ship"])
    expect(arrangeGroups(null)).toEqual({ itemGroups: [], offerAttributes: [] })
  })
})

describe("the built-in columns", () => {
  it("seeds only what the editor shows, dropping Go zero values", () => {
    expect(basicsFromProduct({ title: "Tee", description: "d", tax_class_id: "t1", hsn_code: "6109", weight_grams: 0, length_cm: 12.5, return_policy_type: "" })).toEqual({ ...emptyBasics, title: "Tee", description: "d", taxClassId: "t1", hsnCode: "6109", lengthCm: "12.5", returnPolicy: "7_days" })
  })
  it("requires a title and a tax class, and checks the HSN and dimensions", () => {
    expect(Object.keys(validateBasics(emptyBasics)).sort()).toEqual(["taxClassId", "title"])
    expect(validateBasics({ ...emptyBasics, title: "Tee", taxClassId: "t", hsnCode: "61" }).hsnCode).toBeTruthy()
    expect(validateBasics({ ...emptyBasics, title: "Tee", taxClassId: "t", weightGrams: "-1" }).weightGrams).toBeTruthy()
    expect(validateBasics({ ...emptyBasics, title: "Tee", taxClassId: "t", weightGrams: "1.5" }).weightGrams).toBeTruthy()
    expect(validateBasics({ ...emptyBasics, title: "Tee", taxClassId: "t", hsnCode: "61091000", weightGrams: "180", lengthCm: "30" })).toEqual({})
  })
  it("sends exactly the createProductReq / patchable keys, with the numbers converted once", () => {
    expect(listingColumns("cat", { ...emptyBasics, title: " Tee ", taxClassId: "t1", hsnCode: "6109", weightGrams: "180", lengthCm: "30", returnPolicy: "no_return" })).toEqual({
      title: "Tee",
      description: "",
      category_id: "cat",
      tax_class_id: "t1",
      product_type: "physical",
      condition: "new",
      return_policy_type: "no_return",
      return_policy_days: 0,
      hsn_code: "6109",
      weight_grams: 180,
      length_cm: 30,
    })
    expect(listingColumns("cat", { ...emptyBasics, title: "T", taxClassId: "t", returnPolicy: "14_days" }).return_policy_days).toBe(14)
    expect("hsn_code" in listingColumns("cat", { ...emptyBasics, title: "T", taxClassId: "t" })).toBe(false)
  })
})

describe("the single offer and the money rule", () => {
  it("prices go through parseMinor: a typed 12.345 is refused, never rounded", () => {
    expect(validateOffer({ sku: "TEE", mrp: "999", price: "12.345", stock: "" }).price).toBeTruthy()
    expect(validateOffer({ sku: "TEE", mrp: "12.345", price: "10", stock: "" }).mrp).toBeTruthy()
    expect(validateOffer({ sku: "TEE", mrp: "999", price: "749.99", stock: "3" })).toEqual({})
    expect(singleVariantPayload({ sku: " TEE ", mrp: "999", price: "749.99", stock: "3" })).toEqual({ sku: "TEE", mrp_minor: 99900, selling_price_minor: 74999, stock_qty: 3, options: [] })
  })
  it("refuses zero, an MRP below the price, a missing SKU and a fractional stock", () => {
    expect(validateOffer({ sku: "", mrp: "0", price: "0", stock: "1.5" })).toMatchObject({ sku: expect.any(String), mrp: expect.any(String), price: expect.any(String), stock: expect.any(String) })
    expect(validateOffer({ sku: "T", mrp: "5", price: "10", stock: "" }).mrp).toMatch(/below/)
  })
})

describe("editor steps", () => {
  it("run category → details → price and variants → images → review", () => {
    expect([...EDITOR_STEPS]).toEqual(["category", "details", "variants", "images", "review"])
  })
  it("images and review need the draft on the server; details and variants need a category", () => {
    expect(editorStepUnlocked("details", { categoryId: null, productId: null })).toBe(false)
    expect(editorStepUnlocked("variants", { categoryId: "c", productId: null })).toBe(true)
    expect(editorStepUnlocked("images", { categoryId: "c", productId: null })).toBe(false)
    expect(editorStepUnlocked("review", { categoryId: "c", productId: "p" })).toBe(true)
  })
})
