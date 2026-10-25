import { describe, expect, it } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { VariationMatrix } from "../components/sell/VariationMatrix"
import { SKU_LOCKED_HELP, type AxisCandidate, type MatrixState } from "../model/sellListing"

/*
  Once a listing is approved the server answers a SKU change with 409
  SKU_LOCKED. The grid shows an EXISTING variant's SKU read-only there, says
  why, and leaves a row that has no variant yet (its SKU is new) editable.
*/

const candidates: AxisCandidate[] = [
  { code: "size", label: "Size", unavailable: null, options: [{ code: "m", label: "M", swatchHex: null }, { code: "l", label: "L", swatchHex: null }] },
]

const state: MatrixState = {
  axes: ["size"],
  values: { size: ["m", "l"] },
  rows: {
    "size=m": { key: "size=m", combo: { size: "m" }, sku: "TEE-M", mrp: "999", price: "899", stock: "", included: true, variantId: "v-m" },
  },
}

function skuInput(html: string, combo: string): string {
  const m = new RegExp(`<input[^>]*aria-label="SKU for ${combo}"[^>]*>`).exec(html)
  if (!m) throw new Error(`no SKU input for ${combo}`)
  return m[0]
}

const titleText = SKU_LOCKED_HELP.replace(/\./g, "\\.")

describe("VariationMatrix SKU lock", () => {
  it("an existing variant's SKU is read-only and explained when locked", () => {
    const html = renderToStaticMarkup(<VariationMatrix candidates={candidates} value={state} onChange={() => {}} stem="TEE" problems={{}} editing skuLocked />)
    const existing = skuInput(html, "M")
    expect(existing).toContain("readOnly")
    expect(existing).toMatch(new RegExp(`title="${titleText}"`))
    // The new row (L) has no variant yet: its SKU is still the seller's to choose.
    expect(skuInput(html, "L")).not.toContain("readOnly")
  })

  it("nothing is read-only on a draft", () => {
    const html = renderToStaticMarkup(<VariationMatrix candidates={candidates} value={state} onChange={() => {}} stem="TEE" problems={{}} editing />)
    expect(skuInput(html, "M")).not.toContain("readOnly")
    expect(skuInput(html, "M")).not.toContain("title=")
  })
})
