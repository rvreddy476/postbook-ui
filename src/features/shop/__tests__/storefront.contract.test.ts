import { describe, expect, it } from "bun:test"
import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { toAddresses } from "../model/addresses"
import { toCartView, type CartView } from "../model/bag"
import { galleryImages, sellableVariants, specGroups, type WireProductDetailBody } from "../model/catalogue"
import { toReviewsPage } from "../model/reviews"
import { orderCategories, toHomePage, toProductCards, toProductPage } from "../model/storefront"

/*
  Golden fixtures land in commerce-service at
  internal/http/testdata/contracts/<area>/<name>.json (lane C1) and are copied
  byte for byte to __tests__/contracts/<area>/. Nothing is invented here: for
  each area, every fixture that IS present is parsed through the mapper and
  the fields the UI depends on are asserted; a missing folder skips with the
  reason, and the byte-identical check runs only when the backend checkout
  is beside this one.

  Status at 30 Sep 2026: the backend folder does not exist yet, so every
  block below skips. Copy the fixtures and these light up.
*/

const HERE = resolve(import.meta.dir, "contracts")
const BACKEND = resolve(import.meta.dir, "../../../../../modernsmapp/Architecture/services/commerce-service/internal/http/testdata/contracts")

const fixtures = (area: string): Array<[string, unknown]> => {
  const dir = resolve(HERE, area)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => [name, JSON.parse(readFileSync(resolve(dir, name), "utf8")) as unknown])
}

const sha1 = (path: string) => createHash("sha1").update(readFileSync(path)).digest("hex")

const byteIdentical = (area: string) => {
  const backendDir = resolve(BACKEND, area)
  if (!existsSync(backendDir)) return
  for (const [name] of fixtures(area)) {
    const theirs = resolve(backendDir, name)
    if (!existsSync(theirs)) continue
    expect(sha1(resolve(HERE, area, name)), `${area}/${name} differs from the backend copy`).toBe(sha1(theirs))
  }
}

const isEnvelope = (raw: unknown): raw is { data: unknown } => !!raw && typeof raw === "object" && "data" in (raw as object)
const body = (raw: unknown): unknown => (isEnvelope(raw) ? raw.data : raw)

describe("storefront fixtures", () => {
  const files = fixtures("storefront")
  it.skipIf(files.length === 0)("every fixture maps and stays byte-identical to the backend copy", () => {
    byteIdentical("storefront")
    for (const [name, raw] of files) {
      const data = body(raw) as Record<string, unknown>
      if (name.startsWith("home")) {
        const page = toHomePage(data)
        for (const section of page.sections) expect(section.products.length, name).toBeGreaterThan(0)
        for (const banner of page.banners) expect(banner.image, name).not.toBe("")
      } else if (name.startsWith("categor")) {
        const cards = orderCategories(Array.isArray(data) ? data : (data.items as never))
        for (const card of cards) expect(card.id, name).not.toBe("")
      } else if (name.startsWith("product")) {
        const page = toProductPage(data as never)
        for (const card of page.items) {
          expect(card.id, name).not.toBe("")
          expect(card.price, name).not.toBe("")
        }
      } else {
        expect(toProductCards((data.items as never) ?? (Array.isArray(data) ? data : [])), name).toBeDefined()
      }
    }
  })
})

describe("catalogue fixtures", () => {
  const files = fixtures("catalogue")
  it.skipIf(files.length === 0)("a detail body yields variants, a gallery and specs", () => {
    byteIdentical("catalogue")
    for (const [name, raw] of files) {
      const detail = body(raw) as WireProductDetailBody
      if (!detail.product) continue
      expect(detail.product.id, name).toBeTruthy()
      expect(sellableVariants(detail.variants).length, name).toBeGreaterThan(0)
      expect(galleryImages(detail.media, detail.product), name).toBeDefined()
      expect(specGroups(detail.attributes), name).toBeDefined()
    }
  })
})

describe("bag fixtures", () => {
  const files = fixtures("bag")
  it.skipIf(files.length === 0)("every cart parses with an items array and paise totals", () => {
    byteIdentical("bag")
    for (const [name, raw] of files) {
      const cart = toCartView(body(raw) as Partial<CartView>)
      expect(Array.isArray(cart.items), name).toBe(true)
      expect(Number.isInteger(cart.subtotal_minor), name).toBe(true)
      for (const line of cart.items) {
        expect(typeof line.sellable, name).toBe("boolean")
        expect(Number.isInteger(line.unit_price_minor), name).toBe(true)
      }
    }
  })
})

describe("addresses fixtures", () => {
  const files = fixtures("addresses")
  it.skipIf(files.length === 0)("every address list parses with the default first", () => {
    byteIdentical("addresses")
    for (const [name, raw] of files) {
      const data = body(raw)
      const list = toAddresses(Array.isArray(data) ? data : [data as never])
      for (const address of list) {
        expect(address.id, name).toBeTruthy()
        expect(address.pincode, name).toMatch(/^\d{6}$/)
      }
      if (list.some((a) => a.isDefault)) expect(list[0].isDefault, name).toBe(true)
    }
  })
})

describe("reviews fixtures", () => {
  const files = fixtures("reviews")
  it.skipIf(files.length === 0)("every reviews page parses with ratings in 1..5", () => {
    byteIdentical("reviews")
    for (const [name, raw] of files) {
      const page = toReviewsPage(body(raw) as never)
      for (const review of page.reviews) {
        expect(review.rating, name).toBeGreaterThanOrEqual(1)
        expect(review.rating, name).toBeLessThanOrEqual(5)
      }
    }
  })
})
