import { describe, expect, it } from "bun:test"
import {
  canCheckout,
  cartBlockReason,
  isMixedSellerCart,
  isUnavailable,
  itemCountLabel,
  lineImage,
  lineMaxQuantity,
  overstockedLines,
  priceChanged,
  repricedLines,
  toCartView,
  unavailableLines,
  type CartView,
  type CartViewLine,
} from "../model/bag"

// Ported from atpost-web-ui apps/commerce/src/lib/cart.test.ts, plus the
// bag rules the brief names (an unavailable line blocks checkout; a
// price_changed line shows the old price; the stepper's ceiling).

const SELLER_A = "11111111-1111-4111-8111-111111111111"
const SELLER_B = "22222222-2222-4222-8222-222222222222"

// Shaped on the real payload from GET /v1/commerce/cart, not on a guess:
//   {"cart_id":"4e81396f-…","items":[{"variant_id":"aa77ef7b-…",
//    "title":"Malgudi Days Annotated Edition","sku":"STEP15-121142",
//    "quantity":2,"unit_price_minor":74900,"line_total_minor":149800,
//    "available_qty":11,"seller_id":"bd7b7530-…","seller_name":"E2E Merged
//    Store","sellable":true}],"subtotal_minor":799700,"item_count":3,…}
function line(over: Partial<CartViewLine> = {}): CartViewLine {
  return {
    variant_id: "aa77ef7b-cbea-47da-bf5a-468ca6241a9d",
    product_id: "78923755-0fd2-4847-9c52-b28e7c02c916",
    title: "Malgudi Days Annotated Edition",
    sku: "STEP15-121142",
    quantity: 2,
    unit_price_minor: 74900,
    line_total_minor: 149800,
    available_qty: 11,
    seller_id: SELLER_A,
    seller_name: "E2E Merged Store",
    sellable: true,
    ...over,
  }
}

function cart(items: CartViewLine[], over: Partial<CartView> = {}): CartView {
  const sellers = new Set(items.map((l) => l.seller_id))
  return {
    cart_id: "4e81396f-c19e-4928-865a-db8377b70a17",
    items,
    subtotal_minor: items.reduce((total, l) => total + l.line_total_minor, 0),
    item_count: items.reduce((total, l) => total + l.quantity, 0),
    // The service sets these only for a single-seller cart; the fixture has to
    // behave the same way or the mixed-cart tests prove nothing.
    ...(sellers.size === 1 ? { seller_id: items[0].seller_id, seller_name: items[0].seller_name } : {}),
    ...over,
  }
}

describe("sellable", () => {
  it("finds the lines that have left the catalogue", () => {
    const c = cart([line(), line({ variant_id: "v2", sellable: false })])
    expect(unavailableLines(c).map((l) => l.variant_id)).toEqual(["v2"])
    expect(isUnavailable(c.items[1])).toBe(true)
    expect(isUnavailable(c.items[0])).toBe(false)
  })

  it("names the one item checkout would refuse with PRODUCT_UNAVAILABLE", () => {
    const c = cart([line({ title: "Aurora ANC Headphones", sellable: false })])
    expect(cartBlockReason(c)).toBe("Aurora ANC Headphones is no longer available. Remove it to continue.")
  })

  it("counts them when there is more than one", () => {
    const c = cart([line({ sellable: false }), line({ variant_id: "v2", sellable: false })])
    expect(cartBlockReason(c)).toBe("2 items are no longer available. Remove them to continue.")
  })

  it("an unavailable line blocks checkout; a clean bag does not", () => {
    expect(canCheckout(cart([line(), line({ variant_id: "v2", sellable: false })]))).toBe(false)
    expect(canCheckout(cart([line()]))).toBe(true)
    expect(canCheckout(cart([]))).toBe(false)
    expect(canCheckout(undefined)).toBe(false)
  })
})

describe("available_qty", () => {
  it("flags a line asking for more than the seller can supply", () => {
    const c = cart([line({ quantity: 4, available_qty: 2 })])
    expect(overstockedLines(c)).toHaveLength(1)
    expect(cartBlockReason(c)).toBe("Only 2 of Malgudi Days Annotated Edition are left. Reduce the quantity to continue.")
  })

  it('says out of stock rather than "only 0 left"', () => {
    const c = cart([line({ quantity: 1, available_qty: 0 })])
    expect(cartBlockReason(c)).toBe("Malgudi Days Annotated Edition is out of stock. Remove it to continue.")
  })

  it("reads the singular correctly", () => {
    const c = cart([line({ quantity: 2, available_qty: 1 })])
    expect(cartBlockReason(c)).toContain("Only 1 of Malgudi Days Annotated Edition is left")
  })

  it("is silent when the quantity fits", () => {
    expect(cartBlockReason(cart([line({ quantity: 11, available_qty: 11 })]))).toBeNull()
  })

  it("caps the stepper at ten, or at what is left, and at zero for an unavailable line", () => {
    expect(lineMaxQuantity(line({ available_qty: 40 }))).toBe(10)
    expect(lineMaxQuantity(line({ available_qty: 3 }))).toBe(3)
    expect(lineMaxQuantity(line({ available_qty: 0 }))).toBe(0)
    expect(lineMaxQuantity(line({ available_qty: 40, sellable: false }))).toBe(0)
  })
})

describe("mixed-seller cart", () => {
  it("is read off the absence of cart.seller_id, not off the lines", () => {
    const mixed = cart([line(), line({ variant_id: "v2", seller_id: SELLER_B, seller_name: "Another Shop" })])
    expect(mixed.seller_id).toBeUndefined()
    expect(isMixedSellerCart(mixed)).toBe(true)
  })

  it("refuses to name either shop", () => {
    const mixed = cart([line(), line({ variant_id: "v2", seller_id: SELLER_B, seller_name: "Another Shop" })])
    const reason = cartBlockReason(mixed)
    expect(reason).toBe("Your bag has items from more than one seller. An order can only be placed with one seller at a time.")
    expect(reason).not.toContain("E2E Merged Store")
    expect(reason).not.toContain("Another Shop")
  })

  it("leaves a single-seller cart alone", () => {
    const single = cart([line(), line({ variant_id: "v2" })])
    expect(isMixedSellerCart(single)).toBe(false)
    expect(cartBlockReason(single)).toBeNull()
  })

  it("does not call an empty cart mixed", () => {
    expect(isMixedSellerCart(cart([]))).toBe(false)
    expect(cartBlockReason(cart([]))).toBeNull()
  })
})

describe("price_was_minor", () => {
  it("is absent in the ordinary case", () => {
    expect(repricedLines(cart([line()]))).toHaveLength(0)
    expect(priceChanged(line())).toBeNull()
  })

  it("treats zero as a real price, not as absent", () => {
    // Nil means "nothing to warn about". Zero means the item used to be free,
    // and `was ₹0` is a thing the bag must be able to say — so the test is
    // on `!= null`, never on falsiness.
    const c = cart([line({ price_was_minor: 0 })])
    expect(repricedLines(c)).toHaveLength(1)
    expect(priceChanged(c.items[0])).toEqual({ was: "₹0" })
  })

  it("shows the old price on the badge", () => {
    const c = cart([line({ unit_price_minor: 74900, price_was_minor: 99900 })])
    expect(repricedLines(c)[0].price_was_minor).toBe(99900)
    expect(priceChanged(c.items[0])).toEqual({ was: "₹999" })
  })

  it("is not on its own a reason checkout is blocked", () => {
    expect(cartBlockReason(cart([line({ price_was_minor: 99900 })]))).toBeNull()
    expect(canCheckout(cart([line({ price_was_minor: 99900 })]))).toBe(true)
  })
})

describe("image_url", () => {
  it("passes a resolved URL through", () => {
    expect(lineImage(line({ image_url: "https://media/x.jpg" }))).toBe("https://media/x.jpg")
  })

  it("turns an absent or empty URL into null, so the placeholder renders", () => {
    expect(lineImage(line())).toBeNull()
    expect(lineImage(line({ image_url: "" }))).toBeNull()
  })

  it("falls through to the thumbnail before the placeholder", () => {
    expect(lineImage(line({ image_url: "", thumbnail_url: "https://media/t.jpg" }))).toBe("https://media/t.jpg")
  })
})

describe("order of precedence", () => {
  it("reports the unavailable item before the mixed bag", () => {
    const c = cart([line({ sellable: false }), line({ variant_id: "v2", seller_id: SELLER_B, seller_name: "Another Shop" })])
    expect(cartBlockReason(c)).toContain("no longer available")
  })

  it("has nothing to say about a cart that is fine", () => {
    expect(cartBlockReason(cart([line()]))).toBeNull()
    expect(cartBlockReason(null)).toBeNull()
    expect(cartBlockReason(undefined)).toBeNull()
  })
})

describe("toCartView", () => {
  it("answers an empty bag for nothing, and never a null items list", () => {
    expect(toCartView(undefined).items).toEqual([])
    expect(toCartView({ cart_id: "c", items: null as unknown as CartViewLine[], subtotal_minor: 0, item_count: 0 }).items).toEqual([])
  })

  it("keeps seller_id only when the wire set it", () => {
    expect("seller_id" in toCartView({ cart_id: "c", items: [], subtotal_minor: 0, item_count: 0 })).toBe(false)
    expect(toCartView({ cart_id: "c", items: [line()], subtotal_minor: 1, item_count: 1, seller_id: SELLER_A }).seller_id).toBe(SELLER_A)
  })

  it("labels the count", () => {
    expect(itemCountLabel(1)).toBe("1 item")
    expect(itemCountLabel(3)).toBe("3 items")
  })
})
