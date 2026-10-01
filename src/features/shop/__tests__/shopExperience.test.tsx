import { describe, expect, it } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { CategoryStrip } from "../components/storefront/CategoryStrip"
import { ProductPhoto } from "../components/storefront/ProductPhoto"
import { shelfColumns } from "../components/storefront/shelfLayout"

describe("responsive commerce shelves", () => {
  it("keeps two readable cards on phones, adds columns at desktop widths, and caps wide monitors", () => {
    expect(shelfColumns(328)).toBe(2)
    expect(shelfColumns(680)).toBe(3)
    expect(shelfColumns(1000)).toBe(4)
    expect(shelfColumns(1200)).toBe(5)
    expect(shelfColumns(1500)).toBe(6)
    expect(shelfColumns(3840)).toBe(6)
  })
  it("has a safe hydration fallback for an unmeasured container", () => {
    for (const width of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(shelfColumns(width)).toBe(2)
  })
})

describe("product photography", () => {
  it("preserves the product and its accessible name, lazily loading catalogue images", () => {
    const html = renderToStaticMarkup(<ProductPhoto src="/product.jpg" alt="Wireless headphones" contain />)
    expect(html).toContain("shop-photo--contain")
    expect(html).toContain('alt="Wireless headphones"')
    expect(html).toContain('loading="lazy"')
  })
  it("gives missing artwork a named fallback without inventing a product photo", () => {
    const html = renderToStaticMarkup(<ProductPhoto src={null} alt="Wireless headphones" />)
    expect(html).toContain('aria-label="Wireless headphones: image unavailable"')
    expect(html).toContain("Image unavailable")
    expect(html).not.toContain("<img")
  })
})

describe("category navigation", () => {
  it("keeps empty categories navigable and names their availability honestly", () => {
    const html = renderToStaticMarkup(<CategoryStrip categories={[{ id: "electronics", name: "Electronics", count: 4, image: null, description: null, displayOrder: 0 }, { id: "toys", name: "Toys & Baby", count: 0, image: null, description: null, displayOrder: 1 }]} active="electronics" />)
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('aria-label="Electronics, 4 products"')
    expect(html).toContain('aria-label="Toys &amp; Baby, coming soon"')
    expect(html).toContain("/shop/browse?category=toys")
  })
})
