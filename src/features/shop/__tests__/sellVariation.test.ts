import { describe, expect, it } from "bun:test"
import type { AttributeSchema } from "../model/attributes"
import {
  MAX_COMBINATIONS,
  applyToAll,
  axesPayload,
  axisCandidates,
  combinationKey,
  combinationsFor,
  countIfAdded,
  createVariantsPayload,
  localProblems,
  matrixFromVariants,
  matrixRows,
  minorToRupees,
  patchVariantsPayload,
  problemsOntoRows,
  suggestSku,
  type MatrixRow,
  type MatrixState,
} from "../model/sellListing"

// Ported from atpost-web-ui lib/variation.test.ts. Options carry `code` (the
// schema route's spelling); money goes through parseMinor.

const SCHEMA = {
  category_id: "cat-tees",
  category_path: ["Fashion", "T-shirts"],
  schema_version: 2,
  variation_axes: ["size", "colour"],
  groups: [
    {
      name: "Fabric and fit",
      sort_order: 0,
      attributes: [
        { code: "size", label: "Size", data_type: "enum", required: true, scope: "item", is_variant_axis: true, lookup_endpoint: null, values: [{ code: "s", label: "Small", sort_order: 0 }, { code: "m", label: "Medium", sort_order: 1 }, { code: "l", label: "Large", sort_order: 2 }] },
        { code: "colour", label: "Colour", data_type: "enum", required: true, scope: "item", is_variant_axis: true, lookup_endpoint: null, values: [{ code: "blue", label: "Blue", swatch_hex: "#2244aa", sort_order: 0 }, { code: "red", label: "Red", swatch_hex: "#cc2222", sort_order: 1 }] },
        { code: "fabric", label: "Fabric", data_type: "text", required: false, scope: "item", is_variant_axis: false, lookup_endpoint: null },
        { code: "finish", label: "Finish", data_type: "enum", required: false, scope: "item", is_variant_axis: true, lookup_endpoint: null, values: [] },
      ],
    },
  ],
} as unknown as AttributeSchema

const CANDIDATES = axisCandidates(SCHEMA)
const state = (axes: string[], values: Record<string, string[]>): MatrixState => ({ axes, values, rows: {} })

describe("axisCandidates", () => {
  it("offers only what the category says may be an axis", () => {
    expect(CANDIDATES.map((c) => c.code)).toEqual(["size", "colour", "finish"])
    expect(CANDIDATES.find((c) => c.code === "fabric")).toBeUndefined()
  })
  it("reads an option identity from `code`", () => {
    const colour = CANDIDATES.find((c) => c.code === "colour")
    expect(colour?.options.map((o) => o.code)).toEqual(["blue", "red"])
    expect(colour?.options[0].swatchHex).toBe("#2244aa")
  })
  it("marks an axis with no published options unavailable rather than hiding it", () => {
    const finish = CANDIDATES.find((c) => c.code === "finish")
    expect(finish?.options).toEqual([])
    expect(finish?.unavailable).toContain("no published options")
  })
})

describe("the cross product", () => {
  it("is one row per combination, last axis varying fastest", () => {
    expect(combinationsFor(["size", "colour"], { size: ["s", "m"], colour: ["blue", "red"] })).toEqual([
      { size: "s", colour: "blue" },
      { size: "s", colour: "red" },
      { size: "m", colour: "blue" },
      { size: "m", colour: "red" },
    ])
  })
  it("is empty until every axis has a value", () => {
    expect(combinationsFor(["size", "colour"], { size: ["s"], colour: [] })).toEqual([])
  })
  it("keys a row the way the database does", () => {
    expect(combinationKey(["size", "colour"], { size: "m", colour: "blue" })).toBe("size=m|colour=blue")
  })
})

describe("the cap", () => {
  it("says what one more value would cost, before it is picked", () => {
    const at20 = state(["size", "colour"], { size: ["s", "m", "l", "xl", "xxl"], colour: ["blue", "red", "green", "black"] })
    expect(countIfAdded(at20, "colour", "white")).toBe(25)
    expect(countIfAdded(at20, "colour", "white")).toBeGreaterThan(MAX_COMBINATIONS)
    expect(countIfAdded(at20, "colour", "red")).toBe(20)
  })
})

describe("SKU help and local problems", () => {
  it("suggests a stem plus the option codes, upper-cased", () => {
    expect(suggestSku("tee", ["size", "colour"], { size: "m", colour: "blue" })).toBe("TEE-M-BLUE")
  })
  it("flags two rows that claim one SKU", () => {
    const rows = matrixRows(state(["size"], { size: ["s", "m"] }), "tee").map((row) => ({ ...row, sku: "TEE", mrp: "999", price: "749" }))
    const problems = localProblems(rows)
    expect(Object.keys(problems)).toHaveLength(2)
    expect(problems["size=s"][0]).toContain("Two rows use the SKU TEE")
  })
  it("asks for the money each row is missing", () => {
    const rows = matrixRows(state(["size"], { size: ["s"] }), "tee")
    expect(localProblems(rows)["size=s"]).toEqual(["Needs an MRP.", "Needs a selling price."])
  })
  it("refuses a third decimal, a zero price and an MRP below the price", () => {
    const base = matrixRows(state(["size"], { size: ["s"] }), "tee")[0]
    expect(localProblems([{ ...base, mrp: "12.345", price: "10" }])["size=s"]).toEqual(["Needs an MRP."])
    expect(localProblems([{ ...base, mrp: "10", price: "0" }])["size=s"]).toEqual(["The selling price must be more than zero."])
    expect(localProblems([{ ...base, mrp: "5", price: "10" }])["size=s"]).toEqual(["MRP cannot be below the selling price."])
    expect(localProblems([{ ...base, mrp: "10", price: "9.99" }])).toEqual({})
  })
})

describe("apply to all", () => {
  it("fills one column in one action", () => {
    const filled = applyToAll(state(["size"], { size: ["s", "m", "l"] }), "tee", "price", "749")
    const rows = matrixRows(filled, "tee")
    expect(rows.map((r) => r.price)).toEqual(["749", "749", "749"])
    expect(rows.map((r) => r.sku)).toEqual(["TEE-S", "TEE-M", "TEE-L"])
  })
})

describe("the request", () => {
  const rows: MatrixRow[] = matrixRows(state(["size", "colour"], { size: ["s", "m"], colour: ["blue"] }), "tee").map((row) => ({ ...row, mrp: "999", price: "749.90", stock: "12" }))

  it("sends array order only, never a position", () => {
    expect(axesPayload(["size", "colour"])).toEqual([{ code: "size" }, { code: "colour" }])
    expect(JSON.stringify(axesPayload(["size"]))).not.toContain("position")
  })
  it("sends paise through parseMinor, and an option value that is the enum code", () => {
    expect(createVariantsPayload(["size", "colour"], rows)).toEqual([
      { sku: "TEE-S-BLUE", mrp_minor: 99900, selling_price_minor: 74990, stock_qty: 12, options: [{ code: "size", value: "s" }, { code: "colour", value: "blue" }] },
      { sku: "TEE-M-BLUE", mrp_minor: 99900, selling_price_minor: 74990, stock_qty: 12, options: [{ code: "size", value: "m" }, { code: "colour", value: "blue" }] },
    ])
  })
  it("leaves an excluded combination out of the create", () => {
    const excluded = rows.map((row, i) => (i === 0 ? { ...row, included: false } : row))
    expect(createVariantsPayload(["size", "colour"], excluded).map((v) => v.sku)).toEqual(["TEE-M-BLUE"])
  })
  it("names every existing variant on a patch, by id", () => {
    const withIds = rows.map((row, i) => ({ ...row, variantId: `var-${i}` }))
    expect(patchVariantsPayload(["size", "colour"], withIds)).toEqual([
      { variant_id: "var-0", options: [{ code: "size", value: "s" }, { code: "colour", value: "blue" }] },
      { variant_id: "var-1", options: [{ code: "size", value: "m" }, { code: "colour", value: "blue" }] },
    ])
  })
})

describe("the 422", () => {
  const rows = matrixRows(state(["size"], { size: ["s", "m"] }), "tee")
  it("puts a problem on the row the server named by SKU", () => {
    const { rows: onRows, unattached } = problemsOntoRows([{ variant: "TEE-M", code: "size", reason: "is not one of the option codes" }], rows)
    expect(onRows["size=m"]).toEqual(["size: is not one of the option codes"])
    expect(unattached).toEqual([])
  })
  it("puts a problem on the row the server named by position", () => {
    expect(problemsOntoRows([{ variant: "variant 1", reason: "needs a SKU" }], rows).rows["size=s"]).toEqual(["needs a SKU"])
  })
  it("keeps a problem that belongs to no row", () => {
    const { rows: onRows, unattached } = problemsOntoRows([{ reason: "25 variants were sent; a product is capped at 20 combinations" }], rows)
    expect(onRows).toEqual({})
    expect(unattached[0]).toContain("capped at 20")
  })
})

describe("reading a product back into the grid", () => {
  it("reconstructs the axes and options from the legacy label columns", () => {
    const loaded = matrixFromVariants(CANDIDATES, [{ id: "var-1", sku: "TEE-M-BLUE", option_1_name: "Size", option_1_value: "Medium", option_2_name: "Colour", option_2_value: "Blue", mrp_minor: 99900, selling_price_minor: 74990, available_qty: 4 }])
    expect(loaded?.axes).toEqual(["size", "colour"])
    expect(loaded?.values).toEqual({ size: ["m"], colour: ["blue"] })
    const row = loaded?.rows["size=m|colour=blue"]
    expect(row?.variantId).toBe("var-1")
    expect(row?.mrp).toBe("999")
    expect(row?.price).toBe("749.90")
    expect(row?.stock).toBe("4")
  })
  it("keeps a variant whose value no longer resolves, stranded", () => {
    const loaded = matrixFromVariants(CANDIDATES, [{ id: "var-9", sku: "TEE-M-TEAL", option_1_name: "Size", option_1_value: "Medium", option_2_name: "Colour", option_2_value: "Teal" }])
    const row = loaded?.rows["unresolved:var-9"]
    expect(row?.stranded).toBe(true)
    expect(localProblems([row as MatrixRow])["unresolved:var-9"][0]).toContain("no longer in the grid")
  })
  it("says a product does not vary when no variant carries options", () => {
    expect(matrixFromVariants(CANDIDATES, [{ id: "v", sku: "TEE" }])).toBeNull()
  })
  it("renders paise as the rupee text a field holds", () => {
    expect(minorToRupees(99900)).toBe("999")
    expect(minorToRupees(74990)).toBe("749.90")
    expect(minorToRupees(5)).toBe("0.05")
  })
})
