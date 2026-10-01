// Sharing a product: what is shared, where, and in what order the fallback
// menu lists the places. shop-engagement contract §4.
//
//   POST /products/:id/share {channel:"native"|"whatsapp"|"copy_link"|"other"} → 204
//
// The system share sheet is used when the browser has one; otherwise a small
// menu (ascending alphabetical, the founder's rule): Copy link, WhatsApp.

import { inrMinor } from "../money"
import { SHOP_BASE, STORE_NAME } from "./storefront"

export type ShareChannel = "native" | "whatsapp" | "copy_link" | "other"

/** The product page's path. One function, so the link and the canonical agree. */
export function productPath(productId: string): string {
  return `${SHOP_BASE}/products/${encodeURIComponent(productId)}`
}

/** The absolute link that is shared. Never the current URL: no query, no hash, no tracking. */
export function productShareUrl(origin: string, productId: string): string {
  return `${origin.replace(/\/+$/, "")}${productPath(productId)}`
}

/** "Momentum Wireless Earbuds · ₹289 on MStore", or without the price when there is none. */
export function shareText(title: string, priceMinor: number | null | undefined): string {
  const name = title.trim() || "This product"
  const price = typeof priceMinor === "number" && priceMinor > 0 ? inrMinor(priceMinor) : ""
  return price ? `${name} · ${price} on ${STORE_NAME}` : `${name} on ${STORE_NAME}`
}

export interface SharePayload {
  title: string
  text: string
  url: string
}

export function sharePayload(input: { origin: string; productId: string; title: string; priceMinor: number | null | undefined }): SharePayload {
  return {
    title: input.title.trim() || STORE_NAME,
    text: shareText(input.title, input.priceMinor),
    url: productShareUrl(input.origin, input.productId),
  }
}

/** `https://wa.me/?text=` with the text and the link, encoded once. */
export function whatsappHref(payload: Pick<SharePayload, "text" | "url">): string {
  return `https://wa.me/?text=${encodeURIComponent(`${payload.text} ${payload.url}`)}`
}

export interface ShareTarget {
  channel: Exclude<ShareChannel, "native" | "other">
  label: string
}

/** The fallback menu, in ascending alphabetical order by label. */
export const SHARE_TARGETS: readonly ShareTarget[] = [
  { channel: "copy_link", label: "Copy link" },
  { channel: "whatsapp", label: "WhatsApp" },
]

/** The minimal slice of `navigator` that sharing needs, so a test can hand one in. */
export interface ShareNavigator {
  share?: (data: SharePayload) => Promise<void>
}

/** Whether the system share sheet is there to use. */
export function canShareNatively(nav: ShareNavigator | null | undefined): boolean {
  return !!nav && typeof nav.share === "function"
}

/**
 * Whether a rejected `navigator.share` was the person closing the sheet (an
 * AbortError), which is not a failure and is not recorded as a share.
 */
export function isShareCancelled(error: unknown): boolean {
  return (error as { name?: unknown } | null)?.name === "AbortError"
}
