import { describe, expect, it } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { AddressForm } from "../components/addresses/AddressForm"
import { BagLine } from "../components/bag/BagLine"
import { VariantPicker } from "../components/catalogue/VariantPicker"
import { Specifications } from "../components/catalogue/Specifications"
import { sellableVariants, specGroups, variantAxes } from "../model/catalogue"
import type { CartViewLine } from "../model/bag"

/*
  The rules that live in markup: a bag line wears the badges the service's
  signals earn, a variant option that does not exist is disabled while a
  sold-out one is struck but pressable, the address form draws every
  required field, and the spec table keeps the server's grouping.
*/

const line = (over: Partial<CartViewLine> = {}): CartViewLine => ({
  variant_id: "v1",
  product_id: "p1",
  title: "Malgudi Days Annotated Edition",
  sku: "STEP15-121142",
  quantity: 2,
  unit_price_minor: 74900,
  line_total_minor: 149800,
  available_qty: 11,
  seller_id: "s1",
  seller_name: "E2E Merged Store",
  sellable: true,
  ...over,
})

describe("BagLine", () => {
  const noop = () => {}
  it("shows the old price and the Price changed badge only when price_was_minor is set", () => {
    const changed = renderToStaticMarkup(<BagLine line={line({ price_was_minor: 99900 })} onQuantity={noop} onRemove={noop} />)
    expect(changed).toContain("Price changed")
    expect(changed).toContain("was ₹999")
    const plain = renderToStaticMarkup(<BagLine line={line()} onQuantity={noop} onRemove={noop} />)
    expect(plain).not.toContain("Price changed")
    expect(plain).not.toContain("was ")
  })

  it("marks an unavailable line and disables its stepper", () => {
    const html = renderToStaticMarkup(<BagLine line={line({ sellable: false })} onQuantity={noop} onRemove={noop} />)
    expect(html).toContain("Unavailable")
    expect(html).toContain("shop-bag-line--unavailable")
    expect(html).toContain('aria-label="Increase quantity for Malgudi Days Annotated Edition" disabled=""')
  })

  it("names the SKU, the seller and the line total in paise-formatted rupees", () => {
    const html = renderToStaticMarkup(<BagLine line={line()} onQuantity={noop} onRemove={noop} />)
    expect(html).toContain("SKU STEP15-121142")
    expect(html).toContain("Sold by E2E Merged Store")
    expect(html).toContain("₹1,498")
    expect(html).toContain("₹749 each")
  })
})

describe("VariantPicker", () => {
  const variants = sellableVariants([
    { id: "a", option_1_name: "Colour", option_1_value: "Red", option_2_name: "Size", option_2_value: "S", available_qty: 3, selling_price_minor: 100 },
    { id: "b", option_1_name: "Colour", option_1_value: "Red", option_2_name: "Size", option_2_value: "M", selling_price_minor: 100 },
    { id: "c", option_1_name: "Colour", option_1_value: "Blue", option_2_name: "Size", option_2_value: "S", available_qty: 1, selling_price_minor: 100 },
  ])
  it("disables a missing combination and strikes a sold-out one", () => {
    const html = renderToStaticMarkup(
      <VariantPicker axes={variantAxes(variants)} variants={variants} selection={{ Colour: "Blue", Size: "S" }} onSelect={() => {}} />,
    )
    // Blue / M does not exist → disabled.
    expect(html).toMatch(/aria-label="M, not available with this combination"[^>]*disabled=""/)
    // Red / S exists with stock → plain and pressable.
    expect(html).toContain('aria-label="Red"')
    expect(html).toContain('aria-pressed="true"')
  })
  it("strikes but keeps pressable an option whose only variants have no stock", () => {
    const html = renderToStaticMarkup(
      <VariantPicker axes={variantAxes(variants)} variants={variants} selection={{ Colour: "Red", Size: "S" }} onSelect={() => {}} />,
    )
    expect(html).toContain('shop-variants__option--sold-out" aria-pressed="false" aria-label="M, sold out"')
    expect(html).not.toMatch(/aria-label="M, sold out"[^>]*disabled/)
  })
})

describe("AddressForm", () => {
  it("draws every required field, the two optional ones, the type and the default row", () => {
    const html = renderToStaticMarkup(<AddressForm onSubmit={() => {}} />)
    for (const label of ["Full name", "Mobile number", "House / flat, street", "Area, colony (optional)", "Landmark (optional)", "City", "State", "PIN code", "Address type", "Make this my default address"]) {
      expect(html, label).toContain(label)
    }
    expect(html).toContain("Save address")
    expect(html).not.toContain("Cancel")
  })
  it("pre-fills from `initial`, hides the default row on request and disables while busy", () => {
    const html = renderToStaticMarkup(<AddressForm initial={{ contactName: "Raghu V", pincode: "500001" }} onSubmit={() => {}} onCancel={() => {}} busy hideDefault submitLabel="Use this address" />)
    expect(html).toContain('value="Raghu V"')
    expect(html).toContain('value="500001"')
    expect(html).not.toContain("Make this my default address")
    expect(html).toContain("Saving…")
    expect(html).toContain("Cancel")
  })
})

describe("Specifications", () => {
  it("keeps the server's groups and hides the lone default heading", () => {
    const grouped = renderToStaticMarkup(<Specifications groups={specGroups([
      { code: "author", label: "Author", value: "R. K. Narayan", display_group: "Product Details" },
      { code: "weight", label: "Weight", value: 320, unit_code: "g", display_group: "" },
    ])} />)
    expect(grouped).toContain("Product Details")
    expect(grouped).toContain("<h3>Specifications</h3>")
    expect(grouped).toContain("320 g")
    const lone = renderToStaticMarkup(<Specifications groups={specGroups([{ code: "ram", label: "RAM", value: "8", unit_code: "GB", display_group: "" }])} />)
    expect(lone).not.toContain("<h3>")
    expect(renderToStaticMarkup(<Specifications groups={[]} />)).toBe("")
  })
})
