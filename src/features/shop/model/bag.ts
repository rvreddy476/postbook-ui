// The bag, as `GET /cart` sends it, and what it already knows about why
// checkout will refuse it.
//
// Mirrors commerce-service's `postgres.CartView` / `CartViewLine`
// (store/postgres/cartview.go). Optionality mirrors Go's `omitempty`: a
// field marked optional is ABSENT from the payload, never null.
//
// The three signals the service sends on every read, each a refusal the
// buyer otherwise meets for the first time at "Pay":
//
//   - `sellable: false`        → checkout answers PRODUCT_UNAVAILABLE
//   - a mixed-seller bag       → checkout answers MULTIPLE_SELLERS
//   - `quantity > available_qty` → checkout cannot reserve the stock
//
// `price_was_minor` is the fourth: set ONLY when the catalogue price moved
// since the line was added. Absent is the ordinary case; zero is a real
// former price, so the test is `!= null`, never falsiness.

import { inrMinor } from "../money"
import { MAX_QUANTITY } from "./catalogue"

/** One line of the bag. Flat — there is no nested product or variant. */
export interface CartViewLine {
  variant_id: string
  product_id: string
  title: string
  sku?: string
  image_media_id?: string
  /** Resolved server-side; absent when media-service could not answer. */
  image_url?: string
  thumbnail_url?: string
  quantity: number
  /** Integer paise. What the catalogue charges NOW. */
  unit_price_minor: number
  /** Integer paise: `unit_price_minor * quantity`, computed by the service. */
  line_total_minor: number
  /** Integer paise, present ONLY when the price moved since the line was added. */
  price_was_minor?: number
  /** Stock the buyer may still take, after reservations. */
  available_qty: number
  seller_id: string
  seller_name?: string
  /** False when the product or variant has left the catalogue. */
  sellable: boolean
}

export interface CartView {
  cart_id: string
  /** Always an array — the service sends `[]` for an empty bag, never null. */
  items: CartViewLine[]
  /** Integer paise: the sum of every `line_total_minor`. */
  subtotal_minor: number
  /** Total units across the lines, not the number of lines. */
  item_count: number
  /** Set ONLY when every line comes from one seller. */
  seller_id?: string
  seller_name?: string
}

/** An empty bag, for a signed-out or not-yet-loaded header. */
export const EMPTY_CART: CartView = { cart_id: "", items: [], subtotal_minor: 0, item_count: 0 }

/** Whatever the wire sent, as a CartView with `items` always an array. */
export function toCartView(raw: Partial<CartView> | null | undefined): CartView {
  if (!raw) return EMPTY_CART
  const items = Array.isArray(raw.items) ? raw.items : []
  return {
    cart_id: raw.cart_id || "",
    items,
    subtotal_minor: typeof raw.subtotal_minor === "number" ? raw.subtotal_minor : 0,
    item_count: typeof raw.item_count === "number" ? raw.item_count : items.reduce((n, l) => n + (l.quantity || 0), 0),
    ...(raw.seller_id ? { seller_id: raw.seller_id } : {}),
    ...(raw.seller_name ? { seller_name: raw.seller_name } : {}),
  }
}

/** Lines that have left the catalogue since they were added. */
export function unavailableLines(cart: CartView): CartViewLine[] {
  return cart.items.filter((line) => !line.sellable)
}

/** Lines asking for more units than the seller can still supply. */
export function overstockedLines(cart: CartView): CartViewLine[] {
  return cart.items.filter((line) => line.sellable && line.quantity > line.available_qty)
}

/**
 * True when the bag holds lines from more than one seller. Read off the
 * ABSENCE of `cart.seller_id`, which the service sets only when every line
 * agrees — never by picking the first line's seller.
 */
export function isMixedSellerCart(cart: CartView): boolean {
  return cart.items.length > 0 && !cart.seller_id
}

/** Lines whose catalogue price moved since they were added. */
export function repricedLines(cart: CartView): CartViewLine[] {
  return cart.items.filter((line) => line.price_was_minor != null)
}

/** Whether a line wears the "Price changed" badge, and the old price for it. */
export function priceChanged(line: CartViewLine): { was: string } | null {
  if (line.price_was_minor == null) return null
  return { was: inrMinor(line.price_was_minor) }
}

/** Whether a line wears the "Unavailable" badge. */
export function isUnavailable(line: CartViewLine): boolean {
  return !line.sellable
}

/**
 * The one sentence that says why this bag cannot be ordered, or null when
 * nothing about the bag itself is in the way. Address and delivery reasons
 * are checkout's job, not this one's.
 */
export function cartBlockReason(cart: CartView | null | undefined): string | null {
  if (!cart || cart.items.length === 0) return null

  const unavailable = unavailableLines(cart)
  if (unavailable.length > 0) {
    return unavailable.length === 1
      ? `${unavailable[0].title} is no longer available. Remove it to continue.`
      : `${unavailable.length} items are no longer available. Remove them to continue.`
  }

  if (isMixedSellerCart(cart)) {
    return "Your bag has items from more than one seller. An order can only be placed with one seller at a time."
  }

  const overstocked = overstockedLines(cart)
  if (overstocked.length > 0) {
    const line = overstocked[0]
    return line.available_qty === 0
      ? `${line.title} is out of stock. Remove it to continue.`
      : `Only ${line.available_qty} of ${line.title} ${line.available_qty === 1 ? "is" : "are"} left. Reduce the quantity to continue.`
  }

  return null
}

/** "Proceed to checkout" is enabled only when nothing blocks the bag. */
export function canCheckout(cart: CartView | null | undefined): boolean {
  return !!cart && cart.items.length > 0 && cartBlockReason(cart) === null
}

/** The image for a bag line: the resolved URL, the thumbnail, or null for the placeholder. */
export function lineImage(line: Pick<CartViewLine, "image_url" | "thumbnail_url">): string | null {
  return line.image_url || line.thumbnail_url || null
}

/** The stepper's ceiling on a bag line: the shop's cap, or what is left when that is smaller. */
export function lineMaxQuantity(line: Pick<CartViewLine, "available_qty" | "sellable">): number {
  if (!line.sellable) return 0
  return Math.max(0, Math.min(MAX_QUANTITY, line.available_qty))
}

/** "3 items" / "1 item". */
export function itemCountLabel(count: number): string {
  return `${count} ${count === 1 ? "item" : "items"}`
}
