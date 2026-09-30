import { describe, expect, it } from "bun:test"
import {
  emptyValueFor,
  fieldErrorMessage,
  groupProgress,
  isEmptyValue,
  isValidGtin,
  mergeServerErrors,
  validate,
  validateField,
  type AttributeDefinition,
  type AttributeGroup,
  type AttributeSchema,
  type AttributeValueMap,
} from "../model/attributes"

// Ported from atpost-web-ui packages/form validate.test.ts and re-keyed to the
// wire commerce-service actually sends (service/attributes.go
// AttributeFieldDoc): min_num/max_num, min_len/max_len, max_values, options
// under `code`.

function def(over: Partial<AttributeDefinition> & Pick<AttributeDefinition, "code" | "data_type">): AttributeDefinition {
  return { label: over.code, required: false, scope: "item", is_variant_axis: false, lookup_endpoint: null, ...over } as AttributeDefinition
}
function group(attributes: AttributeDefinition[], name = "Details"): AttributeGroup {
  return { name, sort_order: 0, attributes }
}
function schema(groups: AttributeGroup[]): AttributeSchema {
  return { category_id: "cat-1", category_path: ["Electronics", "Headphones"], schema_version: 7, variation_axes: [], groups }
}

describe("validateField — presence", () => {
  it("flags a required field that is absent or blank", () => {
    const d = def({ code: "brand", data_type: "text", required: true })
    expect(validateField(d, null)).toEqual({ kind: "required" })
    expect(validateField(d, undefined)).toEqual({ kind: "required" })
    expect(validateField(d, { type: "text", value: "   " })).toEqual({ kind: "required" })
  })
  it("leaves an absent optional field alone", () => {
    expect(validateField(def({ code: "brand", data_type: "text" }), null)).toBeNull()
    expect(validateField(def({ code: "brand", data_type: "text" }), { type: "text", value: "" })).toBeNull()
  })
  it("treats a false boolean as answered", () => {
    expect(validateField(def({ code: "returnable", data_type: "boolean", required: true }), { type: "boolean", value: false })).toBeNull()
  })
})

describe("validateField — type mismatch", () => {
  it("reports the value type it did not expect", () => {
    expect(validateField(def({ code: "launched", data_type: "date" }), { type: "text", value: "x" })).toEqual({ kind: "type_mismatch", expected: "date", received: "text" })
  })
  it("expects an unknown-typed value for an unknown data type", () => {
    expect(validateField(def({ code: "holo", data_type: "hologram" }), { type: "text", value: "x" })).toEqual({ kind: "type_mismatch", expected: "unknown", received: "text" })
  })
})

describe("validateField — text uses min_len / max_len / regex", () => {
  const d = def({ code: "title", data_type: "text", min_len: 3, max_len: 10, regex: "^[A-Z]" })
  it("accepts a value inside every bound", () => {
    expect(validateField(d, { type: "text", value: "Acme" })).toBeNull()
  })
  it("flags too short and too long", () => {
    expect(validateField(d, { type: "text", value: "Ac" })).toEqual({ kind: "too_short", min: 3, actual: 2 })
    expect(validateField(d, { type: "text", value: "Abcdefghijk" })).toEqual({ kind: "too_long", max: 10, actual: 11 })
  })
  it("flags a pattern miss", () => {
    expect(validateField(d, { type: "text", value: "acme" })).toEqual({ kind: "pattern", regex: "^[A-Z]" })
  })
  it("ignores a regex this engine cannot compile", () => {
    expect(validateField(def({ code: "t", data_type: "text", regex: "([a-z" }), { type: "text", value: "anything" })).toBeNull()
  })
  it("applies the same rules to long_text", () => {
    const l = def({ code: "body", data_type: "long_text", max_len: 4 })
    expect(validateField(l, { type: "long_text", value: "abcde" })).toEqual({ kind: "too_long", max: 4, actual: 5 })
    expect(validateField(l, { type: "long_text", value: "abcd" })).toBeNull()
  })
})

describe("validateField — numbers use min_num / max_num", () => {
  it("accepts an integer inside range and flags outside it", () => {
    const d = def({ code: "pack", data_type: "integer", min_num: 1, max_num: 10 })
    expect(validateField(d, { type: "integer", value: 5 })).toBeNull()
    expect(validateField(d, { type: "integer", value: 0 })).toEqual({ kind: "out_of_range", min: 1, max: 10, actual: "0" })
    expect(validateField(d, { type: "integer", value: 11 })).toEqual({ kind: "out_of_range", min: 1, max: 10, actual: "11" })
  })
  it("flags a non-integer in an integer field", () => {
    expect(validateField(def({ code: "pack", data_type: "integer" }), { type: "integer", value: 1.5 })).toEqual({ kind: "pattern", regex: null })
  })
  it("keeps decimals as exact strings", () => {
    const d = def({ code: "weight", data_type: "decimal", min_num: 0, max_num: 5 })
    expect(validateField(d, { type: "decimal", value: "2.5" })).toBeNull()
    expect(validateField(d, { type: "decimal", value: "5.0001" })).toEqual({ kind: "out_of_range", min: 0, max: 5, actual: "5.0001" })
    expect(validateField(d, { type: "decimal", value: "2,5" })).toEqual({ kind: "pattern", regex: null })
  })
  it("treats money bounds as minor units too", () => {
    const d = def({ code: "mrp", data_type: "money_minor", min_num: 10000 })
    expect(validateField(d, { type: "money_minor", value: 129900 })).toBeNull()
    expect(validateField(d, { type: "money_minor", value: 9999 })).toEqual({ kind: "out_of_range", min: 10000, max: null, actual: "9999" })
    expect(validateField(d, { type: "money_minor", value: 1299.5 })).toEqual({ kind: "pattern", regex: null })
  })
})

describe("validateField — choices read the option CODE", () => {
  const options = [
    { code: "red", label: "Red" },
    { code: "blue", label: "Blue" },
  ]
  it("accepts a listed enum choice and rejects an unlisted one", () => {
    const d = def({ code: "colour", data_type: "enum", values: options })
    expect(validateField(d, { type: "enum", value: "red" })).toBeNull()
    expect(validateField(d, { type: "enum", value: "teal" })).toEqual({ kind: "not_in_enum", allowed: ["red", "blue"], received: ["teal"] })
  })
  it("cannot check membership when the options live behind a lookup", () => {
    expect(validateField(def({ code: "brand", data_type: "enum", lookup_endpoint: "/v1/brands" }), { type: "enum", value: "anything" })).toBeNull()
  })
  it("names every stray choice in a multi_enum", () => {
    const d = def({ code: "tags", data_type: "multi_enum", values: options })
    expect(validateField(d, { type: "multi_enum", value: ["red", "teal", "lime"] })).toEqual({ kind: "not_in_enum", allowed: ["red", "blue"], received: ["teal", "lime"] })
  })
  it("uses max_values as the element cap for a multi_enum", () => {
    const d = def({ code: "tags", data_type: "multi_enum", values: options, max_values: 1 })
    expect(validateField(d, { type: "multi_enum", value: ["red"] })).toBeNull()
    expect(validateField(d, { type: "multi_enum", value: ["red", "blue"] })).toEqual({ kind: "too_long", max: 1, actual: 2 })
  })
  it("treats an empty multi_enum as blank", () => {
    const required = def({ code: "tags", data_type: "multi_enum", values: options, required: true })
    expect(validateField(def({ code: "tags", data_type: "multi_enum", values: options }), { type: "multi_enum", value: [] })).toBeNull()
    expect(validateField(required, { type: "multi_enum", value: [] })).toEqual({ kind: "required" })
  })
})

describe("validateField — dates, measures, media, gtin", () => {
  it("accepts a real calendar date and rejects an impossible one", () => {
    const d = def({ code: "launched", data_type: "date" })
    expect(validateField(d, { type: "date", value: "2026-02-28" })).toBeNull()
    expect(validateField(d, { type: "date", value: "2024-02-29" })).toBeNull()
    expect(validateField(d, { type: "date", value: "2026-02-29" })).not.toBeNull()
    expect(validateField(d, { type: "date", value: "2026-13-01" })).not.toBeNull()
    expect(validateField(d, { type: "date", value: "2026-04-31" })).not.toBeNull()
    expect(validateField(d, { type: "date", value: "01-02-2026" })).not.toBeNull()
  })
  it("checks a measure amount, its unit and its range", () => {
    const d = def({ code: "weight", data_type: "measure", unit_family: "mass", default_unit: "g", units: [{ code: "g", label: "g" }, { code: "kg", label: "kg" }], max_num: 1000 })
    expect(validateField(d, { type: "measure", value: "250", unit: "g" })).toBeNull()
    expect(validateField(d, { type: "measure", value: "250", unit: "lb" })).toEqual({ kind: "not_in_enum", allowed: ["g", "kg"], received: ["lb"] })
    expect(validateField(d, { type: "measure", value: "1200", unit: "g" })).toEqual({ kind: "out_of_range", min: null, max: 1000, actual: "1200" })
    expect(validateField(d, { type: "measure", value: "heavy", unit: "g" })).toEqual({ kind: "pattern", regex: null })
  })
  it("counts media against max_values", () => {
    const d = def({ code: "photos", data_type: "media", max_values: 3 })
    expect(validateField(d, { type: "media", value: ["a", "b"] })).toBeNull()
    expect(validateField(d, { type: "media", value: ["a", "b", "c", "d"] })).toEqual({ kind: "too_long", max: 3, actual: 4 })
  })
  it("checks the GTIN check digit", () => {
    expect(isValidGtin("4006381333931")).toBe(true)
    expect(isValidGtin("036000291452")).toBe(true)
    expect(isValidGtin("4006381333932")).toBe(false)
    expect(isValidGtin("40063813339")).toBe(false)
    expect(isValidGtin("40063813339AB")).toBe(false)
    const d = def({ code: "gtin", data_type: "gtin" })
    expect(validateField(d, { type: "gtin", value: "4006381333931" })).toBeNull()
    expect(validateField(d, { type: "gtin", value: "4006381333932" })).toEqual({ kind: "pattern", regex: null })
  })
})

describe("validateField — unknown data types", () => {
  const d = def({ code: "holo", data_type: "hologram", min_num: 1, max_num: 2, required: true })
  it("carries a value it cannot interpret", () => {
    expect(validateField(d, { type: "unknown", data_type: "hologram", value: { a: 1 } })).toBeNull()
  })
  it("still enforces required on it", () => {
    expect(validateField(d, null)).toEqual({ kind: "required" })
    expect(validateField(d, { type: "unknown", data_type: "hologram", value: "" })).toEqual({ kind: "required" })
  })
})

describe("validate", () => {
  const s = schema([
    group([def({ code: "brand", data_type: "text", required: true }), def({ code: "pack", data_type: "integer", min_num: 1 })]),
    group([def({ code: "colour", data_type: "enum", values: [{ code: "red", label: "Red" }] })], "Variants"),
  ])
  it("returns an empty map when everything passes", () => {
    const values: AttributeValueMap = { brand: { type: "text", value: "Acme" }, pack: { type: "integer", value: 2 }, colour: { type: "enum", value: "red" } }
    expect(validate(s, values)).toEqual({})
  })
  it("keys one error per failing field across every group", () => {
    const errors = validate(s, { pack: { type: "integer", value: 0 }, colour: { type: "enum", value: "teal" } })
    expect(Object.keys(errors).sort()).toEqual(["brand", "colour", "pack"])
    expect(errors.brand).toEqual({ kind: "required" })
  })
  it("ignores values for codes the schema does not declare", () => {
    expect(validate(s, { brand: { type: "text", value: "Acme" }, pack: { type: "integer", value: 1 }, colour: { type: "enum", value: "red" }, leftover: { type: "text", value: "old" } })).toEqual({})
  })
})

describe("groupProgress", () => {
  const g = group([def({ code: "brand", data_type: "text", required: true }), def({ code: "model", data_type: "text", required: true }), def({ code: "notes", data_type: "long_text" })])
  it("counts only required attributes, and only valid answers", () => {
    expect(groupProgress(g, {})).toEqual({ filledRequired: 0, totalRequired: 2 })
    expect(groupProgress(g, { brand: { type: "text", value: "Acme" } })).toEqual({ filledRequired: 1, totalRequired: 2 })
    const strict = group([def({ code: "brand", data_type: "text", required: true, min_len: 4 })])
    expect(groupProgress(strict, { brand: { type: "text", value: "Ac" } })).toEqual({ filledRequired: 0, totalRequired: 1 })
  })
  it("reports 0 of 0 for a group with nothing required", () => {
    expect(groupProgress(group([def({ code: "notes", data_type: "long_text" })]), {})).toEqual({ filledRequired: 0, totalRequired: 0 })
  })
})

describe("values helpers", () => {
  it("knows what an empty value looks like for each type", () => {
    expect(isEmptyValue(null)).toBe(true)
    expect(isEmptyValue({ type: "text", value: "" })).toBe(true)
    expect(isEmptyValue({ type: "decimal", value: " " })).toBe(true)
    expect(isEmptyValue({ type: "measure", value: "", unit: "g" })).toBe(true)
    expect(isEmptyValue({ type: "integer", value: Number.NaN })).toBe(true)
    expect(isEmptyValue({ type: "money_minor", value: 0 })).toBe(false)
    expect(isEmptyValue({ type: "boolean", value: false })).toBe(false)
    expect(isEmptyValue({ type: "multi_enum", value: [] })).toBe(true)
    expect(isEmptyValue({ type: "media", value: ["a"] })).toBe(false)
    expect(isEmptyValue({ type: "unknown", data_type: "x", value: null })).toBe(true)
    expect(isEmptyValue({ type: "unknown", data_type: "x", value: [] })).toBe(true)
    expect(isEmptyValue({ type: "unknown", data_type: "x", value: 0 })).toBe(false)
  })
  it("builds a blank for every data type", () => {
    expect(emptyValueFor(def({ code: "a", data_type: "text" }))).toEqual({ type: "text", value: "" })
    expect(emptyValueFor(def({ code: "a", data_type: "integer" }))).toBeNull()
    expect(emptyValueFor(def({ code: "a", data_type: "money_minor" }))).toBeNull()
    expect(emptyValueFor(def({ code: "a", data_type: "boolean" }))).toEqual({ type: "boolean", value: false })
    expect(emptyValueFor(def({ code: "a", data_type: "multi_enum" }))).toEqual({ type: "multi_enum", value: [] })
    expect(emptyValueFor(def({ code: "a", data_type: "media" }))).toEqual({ type: "media", value: [] })
    expect(emptyValueFor(def({ code: "a", data_type: "measure", default_unit: "kg" }))).toEqual({ type: "measure", value: "", unit: "kg" })
    expect(emptyValueFor(def({ code: "a", data_type: "measure", units: [{ code: "g", label: "g" }] }))).toEqual({ type: "measure", value: "", unit: "g" })
    expect(emptyValueFor(def({ code: "a", data_type: "hologram" }))).toEqual({ type: "unknown", data_type: "hologram", value: null })
  })
})

describe("errors", () => {
  it("renders every kind", () => {
    expect(fieldErrorMessage({ kind: "required" }, "Brand")).toBe("Brand is required")
    expect(fieldErrorMessage({ kind: "too_short", min: 3, actual: 1 }, "Brand")).toContain("at least 3")
    expect(fieldErrorMessage({ kind: "too_long", max: 3, actual: 5 }, "Brand")).toContain("at most 3")
    expect(fieldErrorMessage({ kind: "out_of_range", min: 1, max: 9, actual: "0" }, "Pack")).toBe("Pack must be between 1 and 9")
    expect(fieldErrorMessage({ kind: "out_of_range", min: 1, max: null, actual: "0" }, "Pack")).toBe("Pack must be at least 1")
    expect(fieldErrorMessage({ kind: "out_of_range", min: null, max: 9, actual: "10" }, "Pack")).toBe("Pack must be at most 9")
    expect(fieldErrorMessage({ kind: "out_of_range", min: null, max: null, actual: "10" }, "Pack")).toBe("Pack is out of range")
    expect(fieldErrorMessage({ kind: "pattern", regex: null }, "GTIN")).toContain("format")
    expect(fieldErrorMessage({ kind: "not_in_enum", allowed: ["a"], received: ["b"] }, "Colour")).toContain("no longer offered")
    expect(fieldErrorMessage({ kind: "type_mismatch", expected: "date", received: "text" }, "Launched")).toContain("expected date")
    expect(fieldErrorMessage({ kind: "stale", expected_version: 7, actual_version: 8 })).toContain("changed")
    expect(fieldErrorMessage({ kind: "server", message: "Duplicate GTIN" })).toBe("Duplicate GTIN")
  })
  it("lets the server overwrite a local verdict", () => {
    const merged = mergeServerErrors({ gtin: { kind: "required" }, brand: { kind: "required" } }, { gtin: { message: "Already used", code: "duplicate_gtin" } })
    expect(merged.gtin).toEqual({ kind: "server", message: "Already used", code: "duplicate_gtin" })
    expect(merged.brand).toEqual({ kind: "required" })
  })
})
