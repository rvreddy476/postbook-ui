import { describe, expect, it } from "bun:test"
import {
  favouriteCount,
  favouritesAfterToggle,
  favouritesLabel,
  isFavourited,
  markFavouriteIn,
  withFavourite,
  type FavouritesPage,
} from "../model/favourites"
import { toProductCard, type ProductCard } from "../model/storefront"

// Ported from atpost-web-ui apps/commerce/src/lib/favourites.test.ts.

const product = (id: string, isFavourite?: boolean): ProductCard => {
  const card = toProductCard({ id, title: id, min_price_minor: 100 }) as ProductCard
  return isFavourite === undefined ? { ...card, isFavourite: undefined as unknown as boolean } : { ...card, isFavourite }
}

describe("withFavourite", () => {
  it("returns the same object when nothing changes, so caches stay clean", () => {
    const p = product("a", true)
    expect(withFavourite(p, true)).toBe(p)
    const q = product("b")
    expect(withFavourite(q, false)).toBe(q)
  })

  it("returns a new object with the heart flipped otherwise", () => {
    const p = product("a")
    const out = withFavourite(p, true)
    expect(out).not.toBe(p)
    expect(out.isFavourite).toBe(true)
    expect(p.isFavourite).toBeUndefined()
  })
})

describe("markFavouriteIn", () => {
  it("flips every copy of the product in a list and leaves the rest alone", () => {
    const list = [product("a"), product("b"), product("a")]
    const out = markFavouriteIn(list, "a", true)
    expect(out.map((p) => p.isFavourite)).toEqual([true, undefined, true])
    expect(out[1]).toBe(list[1])
  })

  it("answers an empty list for nothing", () => {
    expect(markFavouriteIn(undefined, "a", true)).toEqual([])
  })
})

describe("favouritesAfterToggle", () => {
  const page: FavouritesPage = { items: [product("b", true), product("c", true)], nextCursor: "k" }

  it("puts a newly hearted product at the front and marks it hearted", () => {
    const out = favouritesAfterToggle(page, product("a"), true)
    expect(out.items.map((p) => p.id)).toEqual(["a", "b", "c"])
    expect(out.items[0].isFavourite).toBe(true)
    expect(out.nextCursor).toBe("k")
  })

  it("does not duplicate a product hearted twice", () => {
    const out = favouritesAfterToggle(page, product("b"), true)
    expect(out.items.map((p) => p.id)).toEqual(["b", "c"])
  })

  it("drops every copy of an un-hearted product", () => {
    const out = favouritesAfterToggle(
      { items: [product("a", true), product("b", true), product("a", true)], nextCursor: null },
      product("a"),
      false,
    )
    expect(out.items.map((p) => p.id)).toEqual(["b"])
  })

  it("un-hearting something not on the list is a no-op rather than an error", () => {
    const out = favouritesAfterToggle(page, product("zz"), false)
    expect(out.items.map((p) => p.id)).toEqual(["b", "c"])
  })

  it("starts from nothing when there is no cached page yet", () => {
    const out = favouritesAfterToggle(undefined, product("a"), true)
    expect(out.items.map((p) => p.id)).toEqual(["a"])
    expect(out.nextCursor).toBeNull()
  })

  // The optimistic round trip: apply, then put the snapshot back on failure.
  // The reducer never mutates its input, so the snapshot IS the rollback.
  it("leaves the snapshot untouched so a failed request can restore it", () => {
    const before = JSON.stringify(page)
    favouritesAfterToggle(page, product("a"), true)
    favouritesAfterToggle(page, product("b"), false)
    expect(JSON.stringify(page)).toBe(before)
  })
})

describe("favouriteCount and isFavourited", () => {
  it("counts the loaded items and nothing more", () => {
    expect(favouriteCount({ items: [product("a"), product("b")], nextCursor: "more" })).toBe(2)
    expect(favouriteCount(undefined)).toBe(0)
  })

  it("reads an absent heart as not hearted, not as unknown", () => {
    expect(isFavourited(product("a"))).toBe(false)
    expect(isFavourited(product("a", false))).toBe(false)
    expect(isFavourited(product("a", true))).toBe(true)
    expect(isFavourited(null)).toBe(false)
  })

  it("labels the header icon", () => {
    expect(favouritesLabel(0)).toBe("Favourites")
    expect(favouritesLabel(4)).toBe("Favourites, 4 saved")
  })
})
