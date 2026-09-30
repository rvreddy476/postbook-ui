import { describe, expect, it } from "bun:test"
import {
  ACCOUNT_MENU,
  activeFilterCount,
  apiErrorCode,
  avatarInitial,
  bagLabel,
  bannerHref,
  browseHref,
  categoryCountLabel,
  isAlphabetical,
  isSignedOut,
  liveBanners,
  nextSlide,
  orderCategories,
  orderHomeSections,
  parseBrowseFilters,
  priceRangeLabel,
  productImageUrl,
  productListParams,
  readDiscountPct,
  readInStock,
  shouldAutoplay,
  signInHref,
  toHomePage,
  toProductCard,
  toProductPage,
  type WireBanner,
  type WireHomeSection,
  type WireProductSummary,
} from "../model/storefront"

// The product-summary mapper against Go's zero values, the home rules ported
// from atpost-web-ui apps/commerce/src/lib/home.test.ts and product.test.ts,
// the browse filter round trip, and the header's menu order.

// Shaped on a real GET /v1/commerce/products row: the resolved image pair,
// the paise pair, the server's discount, the derived in_stock.
const summary = (over: Partial<WireProductSummary> = {}): WireProductSummary => ({
  id: "78923755-0fd2-4847-9c52-b28e7c02c916",
  seller_id: "bd7b7530-1111-4111-8111-111111111111",
  title: "Malgudi Days Annotated Edition",
  slug: "malgudi-days-annotated-edition",
  image_url: "https://media/full.jpg",
  thumbnail_url: "https://media/thumb.jpg",
  seller_name: "E2E Merged Store",
  retailer_name: "E2E Merged Store",
  category_name: "Books",
  min_price_minor: 74900,
  mrp_minor: 99900,
  discount_pct: 25,
  in_stock: true,
  total_stock: 11,
  avg_rating: 4.5,
  review_count: 3,
  default_variant_id: "aa77ef7b-cbea-47da-bf5a-468ca6241a9d",
  ...over,
})

describe("toProductCard — Go zero values", () => {
  it("reads a full row", () => {
    const card = toProductCard(summary())!
    expect(card.image).toBe("https://media/full.jpg")
    expect(card.price).toBe("₹749")
    expect(card.was).toBe("₹999")
    expect(card.discountPct).toBe(25)
    expect(card.inStock).toBe(true)
    expect(card.stock).toBe(11)
    expect(card.rating).toBe(4.5)
    expect(card.reviewCount).toBe(3)
    expect(card.seller).toBe("E2E Merged Store")
    expect(card.isFavourite).toBe(false)
  })

  it("an empty image_url falls through to thumbnail_url, then to null for the placeholder", () => {
    expect(productImageUrl({ image_url: "", thumbnail_url: "https://media/thumb.jpg" })).toBe("https://media/thumb.jpg")
    expect(toProductCard(summary({ image_url: "", thumbnail_url: "https://media/thumb.jpg" }))!.image).toBe("https://media/thumb.jpg")
    expect(toProductCard(summary({ image_url: undefined, thumbnail_url: undefined }))!.image).toBeNull()
    expect(toProductCard(summary({ image_url: "", thumbnail_url: "", source_image_url: "https://src/x.jpg" }))!.image).toBe("https://src/x.jpg")
  })

  it("available_qty / total_stock 0 (absent on the wire) is out of stock; in_stock false wins", () => {
    expect(readInStock({ total_stock: 0 })).toBe(false)
    expect(readInStock({ in_stock: false, total_stock: 5 })).toBe(false)
    expect(readInStock({ in_stock: true, total_stock: 0 })).toBe(true)
    expect(readInStock({})).toBe(true)
    expect(toProductCard(summary({ in_stock: undefined, total_stock: 0 }))!.inStock).toBe(false)
  })

  it("price fields are paise, never floats: a summary without the _minor pair has no price", () => {
    const card = toProductCard(summary({ min_price_minor: undefined, mrp_minor: undefined }))!
    expect(card.priceMinor).toBeNull()
    expect(card.price).toBe("—")
    expect(card.was).toBeNull()
    // A float in the paise field is refused rather than rounded.
    expect(toProductCard(summary({ min_price_minor: 749.5 }))!.priceMinor).toBeNull()
  })

  it("strikes the MRP only when it is above the price", () => {
    expect(toProductCard(summary({ min_price_minor: 99900, mrp_minor: 99900, discount_pct: undefined }))!.was).toBeNull()
    expect(toProductCard(summary({ min_price_minor: 99900, mrp_minor: undefined, discount_pct: undefined }))!.was).toBeNull()
  })

  it("takes the server's discount_pct first and money.ts's sum only when it is absent", () => {
    expect(readDiscountPct({ discount_pct: 25, min_price_minor: 1, mrp_minor: 1000 })).toBe(25)
    expect(readDiscountPct({ min_price_minor: 74900, mrp_minor: 100000 })).toBe(25)
    expect(readDiscountPct({ discount_pct: 0, min_price_minor: 99900, mrp_minor: 99900 })).toBeNull()
    expect(readDiscountPct({ discount_pct: -5 })).toBeNull()
    expect(readDiscountPct(undefined)).toBeNull()
  })

  it("reads the tri-state heart honestly and the seller under either wire name", () => {
    expect(toProductCard(summary({ is_favourite: true }))!.isFavourite).toBe(true)
    expect(toProductCard(summary({ is_favourite: undefined }))!.isFavourite).toBe(false)
    expect(toProductCard(summary({ seller_name: "", retailer_name: "Alias Shop" }))!.seller).toBe("Alias Shop")
    expect(toProductCard(summary({ seller_name: undefined, retailer_name: undefined }))!.seller).toBeNull()
  })

  it("drops a row with no id and an absent rating", () => {
    expect(toProductCard({ title: "ghost" })).toBeNull()
    expect(toProductCard(summary({ avg_rating: undefined, review_count: undefined }))!.rating).toBeNull()
    expect(toProductCard(summary({ avg_rating: 0 }))!.rating).toBeNull()
  })
})

describe("toProductPage", () => {
  it("reads the cursor page and turns Go's empty next_cursor into null", () => {
    const page = toProductPage({ items: [summary(), { title: "no id" }], next_cursor: "", limit: 24 })
    expect(page.items).toHaveLength(1)
    expect(page.nextCursor).toBeNull()
    expect(toProductPage({ items: [summary()], next_cursor: "abc" }).nextCursor).toBe("abc")
  })

  it("tolerates a bare array and nothing at all", () => {
    expect(toProductPage([summary()]).items).toHaveLength(1)
    expect(toProductPage(null)).toEqual({ items: [], nextCursor: null })
  })
})

describe("browse filters", () => {
  it("round-trips through the URL and only writes what is set", () => {
    const filters = parseBrowseFilters(new URLSearchParams("q=red%20shoes&category=c1&in_stock=true&min_price=500&max_price=2000&min_rating=4"))
    expect(filters).toEqual({ q: "red shoes", category: "c1", inStock: true, minPrice: 500, maxPrice: 2000, minRating: 4 })
    expect(browseHref(filters)).toBe("/shop/browse?q=red+shoes&category=c1&in_stock=true&min_price=500&max_price=2000&min_rating=4")
    expect(browseHref({})).toBe("/shop/browse")
    expect(parseBrowseFilters(null)).toEqual({ q: "", category: "", inStock: false, minPrice: null, maxPrice: null, minRating: null })
  })

  it("refuses nonsense numbers and a rating above five", () => {
    const filters = parseBrowseFilters(new URLSearchParams("min_price=abc&max_price=-4&min_rating=9&in_stock=yes"))
    expect(filters.minPrice).toBeNull()
    expect(filters.maxPrice).toBeNull()
    expect(filters.minRating).toBeNull()
    expect(filters.inStock).toBe(false)
  })

  it("sends exactly the handler's query names, with the cursor only after the first page", () => {
    expect(productListParams({ q: "x", category: "c", inStock: true, minPrice: 5, maxPrice: 50, minRating: 4 }, { limit: 24 }))
      .toEqual({ limit: 24, q: "x", category: "c", in_stock: "true", min_price: 5, max_price: 50, min_rating: 4 })
    expect(productListParams({}, { limit: 24, cursor: "k2" })).toEqual({ limit: 24, cursor: "k2" })
    // No sort exists on the server, so none is ever sent.
    expect("sort" in productListParams({}, { limit: 24 })).toBe(false)
  })

  it("counts the set filters and labels the price range in rupees", () => {
    expect(activeFilterCount({ q: "x", category: "", inStock: false, minPrice: null, maxPrice: null, minRating: null })).toBe(0)
    expect(activeFilterCount({ q: "", category: "c", inStock: true, minPrice: 1, maxPrice: null, minRating: 4 })).toBe(4)
    expect(priceRangeLabel(500, 2000)).toBe("₹500 – ₹2,000")
    expect(priceRangeLabel(null, 2000)).toBe("Under ₹2,000")
    expect(priceRangeLabel(500, null)).toBe("Over ₹500")
    expect(priceRangeLabel(null, null)).toBeNull()
  })
})

describe("categories", () => {
  it("puts stocked categories first and keeps the empties, dimmed rather than dropped", () => {
    const out = orderCategories([
      { id: "a", name: "Empty", product_count: 0, display_order: 1 },
      { id: "b", name: "Books", product_count: 3, display_order: 2 },
      { id: "c", name: "Cameras", product_count: 9, display_order: 3 },
      { id: "", name: "ghost", product_count: 9 },
    ])
    expect(out.map((c) => c.id)).toEqual(["c", "b", "a"])
    expect(out[2].count).toBe(0)
    expect(categoryCountLabel(0)).toBe("Coming soon")
    expect(categoryCountLabel(1)).toBe("1 product")
    expect(categoryCountLabel(3)).toBe("3 products")
  })

  it("draws the thumbnail before the full image and nothing for neither", () => {
    expect(orderCategories([{ id: "a", name: "A", product_count: 1, image_url: "f", thumbnail_url: "t" }])[0].image).toBe("t")
    expect(orderCategories([{ id: "a", name: "A", product_count: 1, image_url: "", thumbnail_url: "" }])[0].image).toBeNull()
  })
})

const section = (key: string, count: number, title = key): WireHomeSection => ({
  key,
  title,
  products: Array.from({ length: count }, (_, i) => summary({ id: `${key}-${i}`, title: `${key}-${i}` })),
})

describe("orderHomeSections", () => {
  it("puts the rails in the decided order whatever order they arrive in", () => {
    const out = orderHomeSections([section("new_arrivals", 2), section("deals", 2), section("best_sellers", 2)])
    expect(out.map((s) => s.key)).toEqual(["deals", "best_sellers", "new_arrivals"])
  })

  it("drops a rail with nothing in it", () => {
    const out = orderHomeSections([section("deals", 0), section("best_sellers", 3), section("new_arrivals", 0)])
    expect(out.map((s) => s.key)).toEqual(["best_sellers"])
  })

  it("appends a rail it does not know, after the known ones, in arrival order", () => {
    const out = orderHomeSections([section("trending", 1), section("new_arrivals", 1), section("staff_picks", 1), section("deals", 1)])
    expect(out.map((s) => s.key)).toEqual(["deals", "new_arrivals", "trending", "staff_picks"])
  })

  it("answers an empty list for nothing at all", () => {
    expect(orderHomeSections(undefined)).toEqual([])
    expect(orderHomeSections(null)).toEqual([])
    expect(orderHomeSections([])).toEqual([])
  })

  it("tolerates a section whose products field is missing, and fills a missing title", () => {
    const broken = { key: "deals", title: "Deals" } as unknown as WireHomeSection
    expect(orderHomeSections([broken, section("best_sellers", 1, "")]).map((s) => [s.key, s.title])).toEqual([["best_sellers", "Best sellers"]])
  })

  it("a 404 (no /home) or an empty page is a page with nothing on it, so the grid stands alone", () => {
    expect(toHomePage(undefined)).toEqual({ banners: [], sections: [] })
    expect(toHomePage({ banners: [], sections: [] })).toEqual({ banners: [], sections: [] })
  })
})

const banner = (over: Partial<WireBanner>): WireBanner => ({
  id: "b",
  title: "Sale",
  target_type: "search",
  target_id: "sale",
  position: 0,
  active: true,
  image_url: "https://cdn/x.jpg",
  ...over,
})

describe("liveBanners", () => {
  it("keeps only active banners that have a picture, in position order", () => {
    const out = liveBanners([
      banner({ id: "late", position: 5 }),
      banner({ id: "blank", image_url: "" }),
      banner({ id: "off", active: false }),
      banner({ id: "first", position: 1 }),
    ])
    expect(out.map((b) => b.id)).toEqual(["first", "late"])
  })

  it("is empty for no banners", () => {
    expect(liveBanners(undefined)).toEqual([])
  })
})

describe("bannerHref", () => {
  it("routes each target type inside the zone", () => {
    expect(bannerHref({ target_type: "product", target_id: "p1" })).toEqual({ href: "/shop/products/p1", external: false })
    expect(bannerHref({ target_type: "category", target_id: "c1" })).toEqual({ href: "/shop/browse?category=c1", external: false })
    expect(bannerHref({ target_type: "search", target_id: "red shoes" })).toEqual({ href: "/shop/browse?q=red+shoes", external: false })
    expect(bannerHref({ target_type: "url", target_id: "https://x.y/z" })).toEqual({ href: "https://x.y/z", external: true })
    expect(bannerHref({ target_type: "mystery", target_id: "q" })).toEqual({ href: "/shop", external: false })
  })
})

describe("the carousel", () => {
  it("never autoplays under reduced motion, with one slide, or while engaged", () => {
    expect(shouldAutoplay({ reducedMotion: false, count: 3, engaged: false })).toBe(true)
    expect(shouldAutoplay({ reducedMotion: true, count: 3, engaged: false })).toBe(false)
    expect(shouldAutoplay({ reducedMotion: false, count: 1, engaged: false })).toBe(false)
    expect(shouldAutoplay({ reducedMotion: false, count: 3, engaged: true })).toBe(false)
  })

  it("wraps in both directions", () => {
    expect(nextSlide(2, 3)).toBe(0)
    expect(nextSlide(0, 3, -1)).toBe(2)
    expect(nextSlide(0, 0)).toBe(0)
  })
})

describe("the header", () => {
  it("lists the account menu in ascending alphabetical order", () => {
    expect(ACCOUNT_MENU.map((m) => m.label)).toEqual(["Addresses", "Favourites", "Orders", "Payments", "Sell on MStore"])
    expect(isAlphabetical(ACCOUNT_MENU)).toBe(true)
    expect(isAlphabetical([{ label: "Orders" }, { label: "Addresses" }])).toBe(false)
    expect(ACCOUNT_MENU.find((m) => m.label === "Sell on MStore")?.href).toBe("/shop/sell")
  })

  it("sends a signed-out shopper to sign in with a way back", () => {
    expect(signInHref("/shop/bag")).toBe("/login?next=%2Fshop%2Fbag&redirect=%2Fshop%2Fbag")
    expect(signInHref("https://evil")).toBe("/login?next=%2Fshop&redirect=%2Fshop")
  })

  it("labels the bag and finds an initial", () => {
    expect(bagLabel(0)).toBe("Bag")
    expect(bagLabel(1)).toBe("Bag, 1 item")
    expect(bagLabel(3)).toBe("Bag, 3 items")
    expect(avatarInitial({ name: "raghu" })).toBe("R")
    expect(avatarInitial({ name: "", username: "rv" })).toBe("R")
    expect(avatarInitial(null)).toBe("")
  })
})

describe("errors", () => {
  it("branches on the code, and reads a 401 as signed out", () => {
    expect(apiErrorCode({ response: { data: { error: { code: "MULTIPLE_SELLERS", message: "x" } } } })).toBe("MULTIPLE_SELLERS")
    expect(apiErrorCode(new Error("boom"))).toBeNull()
    expect(isSignedOut({ response: { status: 401 } })).toBe(true)
    expect(isSignedOut({ response: { status: 500 } })).toBe(false)
  })
})
