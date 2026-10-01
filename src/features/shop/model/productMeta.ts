// The product page's link preview: OpenGraph and the Twitter card, so a
// product shared on WhatsApp shows its picture, name and price
// (shop-engagement contract §4). Built from `GET /products/:id`, fetched on
// the server without the viewer's cookie: a product a buyer may not see
// answers 404 there and gets no preview at all.

import type { Metadata } from "next"
import { inrMinor } from "../money"
import { galleryImages, sellableVariants, type WireProductDetailBody } from "./catalogue"
import { productPath } from "./share"
import { readMinor, STORE_NAME } from "./storefront"

/** The public site. The canonical always names production, whichever host served the page. */
export const SHOP_PUBLIC_ORIGIN = "https://cleestudio.com"

/** The metadata for a page we have nothing to say about (unknown, hidden, or the API did not answer). */
export const PRODUCT_FALLBACK_METADATA: Metadata = { title: "Product" }

/** "₹289 · MStore", or just "MStore" when the product has no price. */
export function productMetaDescription(priceMinor: number | null): string {
  return priceMinor !== null ? `${inrMinor(priceMinor)} · ${STORE_NAME}` : STORE_NAME
}

/**
 * The "from" price of a product body: the summary's `min_price_minor` when
 * the server sent it, else the lowest price among the variants a buyer can
 * pick (the detail product carries no summary price today).
 */
export function lowestPriceMinor(body: WireProductDetailBody | null | undefined): number | null {
  const fromSummary = readMinor(body?.product?.min_price_minor)
  if (fromSummary !== null) return fromSummary
  let low: number | null = null
  for (const v of sellableVariants(body?.variants)) {
    if (v.priceMinor !== null && (low === null || v.priceMinor < low)) low = v.priceMinor
  }
  return low
}

/** An image URL made absolute against the public site; a protocol-relative or relative one included. */
export function absoluteUrl(url: string, origin: string = SHOP_PUBLIC_ORIGIN): string | null {
  if (!url) return null
  try {
    const out = new URL(url, origin)
    return out.protocol === "https:" || out.protocol === "http:" ? out.toString() : null
  } catch {
    return null
  }
}

/**
 * Metadata for a product body, or null when the body is not a product (the
 * page then keeps the fallback, with no preview).
 */
export function productMetadata(productId: string, body: WireProductDetailBody | null | undefined): Metadata | null {
  const product = body?.product
  if (!product || !product.id) return null
  const title = product.title || "Product"
  const description = productMetaDescription(lowestPriceMinor(body))
  const canonical = `${SHOP_PUBLIC_ORIGIN}${productPath(product.id || productId)}`
  const first = galleryImages(Array.isArray(body?.media) ? body.media : null, product)[0]
  const image = first ? absoluteUrl(first.src) : null
  const images = image ? [{ url: image, alt: title }] : undefined
  return {
    title: `${title} · ${STORE_NAME}`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: STORE_NAME,
      title,
      description,
      url: canonical,
      images,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  }
}
