import { describe, expect, it } from "bun:test"
import {
  MULTIPLE_SELLERS_MESSAGE,
  addToBagFailure,
  attributeText,
  findVariant,
  galleryImages,
  galleryStep,
  hasVariantPicker,
  initialSelection,
  isProductMissing,
  legacySpecGroups,
  maxQuantity,
  optionState,
  priceLine,
  selectOption,
  sellableVariants,
  specGroups,
  stepQuantity,
  stockLine,
  toVariant,
  variantAxes,
  type WireVariant,
} from "../model/catalogue"

// The variant-axis grouping (three axes, missing combinations, a
// single-variant product), the price and stock lines, the gallery's
// keyboard walk, the spec table and the MULTIPLE_SELLERS mapping.

// Shaped on a real variant from GET /v1/commerce/products/:id: the option
// pairs, the paise pair, available_qty (absent for 0 — omitempty).
const variant = (over: Partial<WireVariant> = {}): WireVariant => ({
  id: "v-red-s",
  product_id: "p1",
  sku: "TEE-RED-S",
  option_1_name: "Colour",
  option_1_value: "Red",
  option_2_name: "Size",
  option_2_value: "S",
  mrp_minor: 99900,
  selling_price_minor: 74900,
  currency_code: "INR",
  status: "active",
  available_qty: 4,
  ...over,
})

const THREE_AXES: WireVariant[] = [
  variant({ id: "red-s-cotton", option_3_name: "Fabric", option_3_value: "Cotton", available_qty: 4 }),
  variant({ id: "red-m-cotton", option_2_value: "M", option_3_name: "Fabric", option_3_value: "Cotton", available_qty: undefined }),
  variant({ id: "blue-s-cotton", option_1_value: "Blue", option_3_name: "Fabric", option_3_value: "Cotton", available_qty: 2 }),
  variant({ id: "blue-s-linen", option_1_value: "Blue", option_3_name: "Fabric", option_3_value: "Linen", available_qty: 1, selling_price_minor: 89900 }),
  // Blue / M does not exist on any fabric; Red / linen does not exist.
]

describe("toVariant", () => {
  it("reads the option pairs by axis name and drops a blank axis", () => {
    const v = toVariant(variant({ option_3_name: "", option_3_value: "ignored" }))!
    expect(v.options).toEqual({ Colour: "Red", Size: "S" })
    expect(v.sku).toBe("TEE-RED-S")
  })

  it("available_qty absent (Go's 0) is out of stock; price fields are paise", () => {
    expect(toVariant(variant({ available_qty: undefined }))!.availableQty).toBe(0)
    expect(toVariant(variant({ available_qty: 0 }))!.availableQty).toBe(0)
    expect(toVariant(variant())!.priceMinor).toBe(74900)
    expect(toVariant(variant({ selling_price_minor: undefined }))!.priceMinor).toBeNull()
  })

  it("keeps only active variants with an id", () => {
    expect(sellableVariants([variant(), variant({ id: "x", status: "archived" }), variant({ id: "" })]).map((v) => v.id)).toEqual(["v-red-s"])
    expect(sellableVariants(null)).toEqual([])
  })
})

describe("variant axes", () => {
  it("groups three axes in first-seen order with first-seen values", () => {
    const axes = variantAxes(sellableVariants(THREE_AXES))
    expect(axes).toEqual([
      { name: "Colour", values: ["Red", "Blue"] },
      { name: "Size", values: ["S", "M"] },
      { name: "Fabric", values: ["Cotton", "Linen"] },
    ])
  })

  it("a single-variant product has no picker; so does one whose variants name no options", () => {
    expect(hasVariantPicker(sellableVariants([variant()]))).toBe(false)
    const plain = sellableVariants([
      variant({ id: "a", option_1_name: undefined, option_1_value: undefined, option_2_name: undefined, option_2_value: undefined }),
      variant({ id: "b", option_1_name: undefined, option_1_value: undefined, option_2_name: undefined, option_2_value: undefined }),
    ])
    expect(variantAxes(plain)).toEqual([])
    expect(hasVariantPicker(plain)).toBe(false)
    expect(findVariant(plain, {}, [])?.id).toBe("a")
    expect(hasVariantPicker(sellableVariants(THREE_AXES))).toBe(true)
  })

  it("finds the exact variant, or nothing while an axis is unchosen", () => {
    const variants = sellableVariants(THREE_AXES)
    const axes = variantAxes(variants)
    expect(findVariant(variants, { Colour: "Blue", Size: "S", Fabric: "Linen" }, axes)?.id).toBe("blue-s-linen")
    expect(findVariant(variants, { Colour: "Blue", Size: "S" }, axes)).toBeNull()
    expect(findVariant(variants, { Colour: "Blue", Size: "M", Fabric: "Cotton" }, axes)).toBeNull()
  })

  it("marks a combination that does not exist as missing and one with no stock as sold out", () => {
    const variants = sellableVariants(THREE_AXES)
    // Red / M / Cotton exists with no stock.
    expect(optionState(variants, { Colour: "Red", Fabric: "Cotton" }, "Size", "M")).toBe("sold_out")
    // Blue / M does not exist on any fabric.
    expect(optionState(variants, { Colour: "Blue" }, "Size", "M")).toBe("missing")
    // Red / Linen does not exist.
    expect(optionState(variants, { Colour: "Red", Size: "S" }, "Fabric", "Linen")).toBe("missing")
    expect(optionState(variants, { Colour: "Red", Size: "S" }, "Fabric", "Cotton")).toBe("available")
    // With nothing else chosen, an axis value is available when any variant with it has stock.
    expect(optionState(variants, {}, "Size", "M")).toBe("sold_out")
    expect(optionState(variants, {}, "Colour", "Blue")).toBe("available")
  })

  it("starts on the first variant with stock", () => {
    const variants = sellableVariants([variant({ id: "none", available_qty: undefined }), variant({ id: "some", option_1_value: "Green", available_qty: 3 })])
    expect(initialSelection(variants)).toEqual({ Colour: "Green", Size: "S" })
    expect(initialSelection([])).toEqual({})
    expect(initialSelection(sellableVariants([variant({ available_qty: undefined })]))).toEqual({ Colour: "Red", Size: "S" })
  })

  it("keeps the other axes when the combination exists and clears them when it does not", () => {
    const variants = sellableVariants(THREE_AXES)
    expect(selectOption(variants, { Colour: "Red", Size: "S", Fabric: "Cotton" }, "Colour", "Blue"))
      .toEqual({ Colour: "Blue", Size: "S", Fabric: "Cotton" })
    expect(selectOption(variants, { Colour: "Blue", Size: "S", Fabric: "Linen" }, "Colour", "Red"))
      .toEqual({ Colour: "Red" })
  })
})

describe("price and stock lines", () => {
  it("formats the selected variant's price with the struck MRP and money.ts's discount", () => {
    expect(priceLine(toVariant(variant()))).toEqual({ price: "₹749", was: "₹999", off: 25 })
    expect(priceLine(toVariant(variant({ mrp_minor: 74900 })))).toEqual({ price: "₹749", was: null, off: null })
    expect(priceLine(toVariant(variant({ selling_price_minor: undefined })))).toBeNull()
    expect(priceLine(null)).toBeNull()
  })

  it("says out of stock at 0, only-n-left at five or fewer, in stock above", () => {
    expect(stockLine(0)).toEqual({ text: "Out of stock", tone: "danger" })
    expect(stockLine(3)).toEqual({ text: "Only 3 left", tone: "warning" })
    expect(stockLine(6)).toEqual({ text: "In stock", tone: "success" })
  })

  it("caps the stepper at ten, or what is left, and steps within it", () => {
    expect(maxQuantity(40)).toBe(10)
    expect(maxQuantity(3)).toBe(3)
    expect(maxQuantity(0)).toBe(0)
    expect(stepQuantity(10, 1, 40)).toBe(10)
    expect(stepQuantity(1, -1, 40)).toBe(1)
    expect(stepQuantity(2, 1, 2)).toBe(2)
    expect(stepQuantity(1, 1, 0)).toBe(0)
  })
})

describe("gallery", () => {
  it("orders the cover first, then by sort_order, skipping entries with no picture", () => {
    const images = galleryImages([
      { media_id: "m2", media_type: "image", sort_order: 1, image_url: "https://m/2.jpg", thumbnail_url: "https://m/2t.jpg", is_cover: false },
      { media_id: "m3", media_type: "image", sort_order: 2, image_url: "", is_cover: false },
      { media_id: "m1", media_type: "image", sort_order: 0, image_url: "https://m/1.jpg", is_cover: true },
    ])
    expect(images.map((g) => g.id)).toEqual(["m1", "m2"])
    expect(images[0].thumb).toBe("https://m/1.jpg")
    expect(images[1].thumb).toBe("https://m/2t.jpg")
  })

  it("falls back to the product's own image when the gallery is empty", () => {
    expect(galleryImages([], { image_url: "", thumbnail_url: "https://p/t.jpg" })).toEqual([{ id: "product", src: "https://p/t.jpg", thumb: "https://p/t.jpg" }])
    expect(galleryImages(undefined, { image_url: "" })).toEqual([])
  })

  it("walks with the arrow keys and wraps", () => {
    expect(galleryStep(0, 3, "ArrowRight")).toBe(1)
    expect(galleryStep(2, 3, "ArrowRight")).toBe(0)
    expect(galleryStep(0, 3, "ArrowLeft")).toBe(2)
    expect(galleryStep(1, 3, "Home")).toBe(0)
    expect(galleryStep(1, 3, "End")).toBe(2)
    expect(galleryStep(1, 3, "Enter")).toBe(1)
    expect(galleryStep(0, 0, "ArrowRight")).toBe(0)
  })
})

describe("specifications", () => {
  it("groups by the server's display_group and words each value", () => {
    const groups = specGroups([
      { code: "author", label: "Author", data_type: "text", value: "R. K. Narayan", display_group: "Product Details" },
      { code: "pages", label: "Pages", data_type: "integer", value: 256, display_group: "Product Details" },
      { code: "weight", label: "Weight", data_type: "measure", value: 320, unit_code: "g", display_group: "" },
      { code: "genres", label: "Genres", data_type: "multi_enum", value: ["fiction", "short_stories"], display_group: "Content" },
      { code: "hardback", label: "Hardback", data_type: "boolean", value: false, display_group: "Content" },
      { code: "", label: "", value: "dropped" },
    ])
    expect(groups.map((g) => [g.name, g.rows.map((r) => `${r.label}=${r.value}`)])).toEqual([
      ["Product Details", ["Author=R. K. Narayan", "Pages=256"]],
      ["Specifications", ["Weight=320 g"]],
      ["Content", ["Genres=fiction, short_stories", "Hardback=No"]],
    ])
    expect(attributeText(null)).toBe("—")
    expect(attributeText(true)).toBe("Yes")
  })

  it("reads the legacy free-form rows as one group", () => {
    expect(legacySpecGroups([{ name: "RAM", value: "8", unit: "GB" }, { name: "", value: "x" }])).toEqual([
      { name: "Specifications", rows: [{ code: "RAM", label: "RAM", value: "8 GB" }] },
    ])
    expect(legacySpecGroups([])).toEqual([])
  })
})

describe("add to bag", () => {
  const failure = (code: string, message = "") => ({ response: { status: 409, data: { error: { code, message } } } })

  it("maps 409 MULTIPLE_SELLERS to the one line", () => {
    expect(addToBagFailure(failure("MULTIPLE_SELLERS"))).toBe(MULTIPLE_SELLERS_MESSAGE)
    expect(MULTIPLE_SELLERS_MESSAGE).toBe("Your bag has items from another seller. Empty it to add this.")
  })

  it("reads today's ADD_TO_CART_FAILED spelling of the same refusal, and nothing else from a message", () => {
    expect(addToBagFailure(failure("ADD_TO_CART_FAILED", "cart contains items from more than one seller"))).toBe(MULTIPLE_SELLERS_MESSAGE)
    expect(addToBagFailure(failure("ADD_TO_CART_FAILED", "insufficient stock"))).toBe("Could not add this to your bag. Please try again.")
    expect(addToBagFailure(failure("SOMETHING_ELSE", "more than one seller"))).toBe("Could not add this to your bag. Please try again.")
    expect(addToBagFailure(new Error("network"))).toBe("Could not add this to your bag. Please try again.")
  })

  it("names the other codes checkout can answer", () => {
    expect(addToBagFailure(failure("PRODUCT_UNAVAILABLE"))).toBe("This product is no longer available.")
    expect(addToBagFailure(failure("OUT_OF_STOCK"))).toBe("Not enough stock for that quantity.")
  })

  it("an unknown id is a 404 state", () => {
    expect(isProductMissing({ response: { status: 404, data: { error: { code: "PRODUCT_NOT_FOUND" } } } })).toBe(true)
    expect(isProductMissing({ response: { status: 400, data: { error: { code: "INVALID_PARAM" } } } })).toBe(true)
    expect(isProductMissing({ response: { status: 500 } })).toBe(false)
  })
})
