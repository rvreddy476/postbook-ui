import type { Metadata } from "next"

import { PRODUCT_FALLBACK_METADATA, productMetadata } from "@/features/shop/model/productMeta"
import type { WireProductDetailBody } from "@/features/shop/model/catalogue"
import { ProductScreen } from "@/features/shop/storefront/ProductScreen"

type Props = { params: Promise<{ id: string }> }

const API_GATEWAY_URL = process.env.API_GATEWAY_URL || "http://localhost:8080"

/*
  The link preview (OpenGraph + Twitter card) a WhatsApp or X share shows:
  title, "₹289 · MStore", the first image as an absolute URL, and the
  canonical https://cleestudio.com/shop/products/:id.

  Fetched here, on the server, from the gateway WITHOUT the viewer's cookie:
  the preview is what a stranger opening the link may see, so a product a
  buyer may not see (404 PRODUCT_NOT_FOUND) gets no preview, and a slow or
  failing API costs the page its preview, never its render.
*/
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  if (!id || id.length > 128) return PRODUCT_FALLBACK_METADATA
  try {
    const res = await fetch(`${API_GATEWAY_URL}/v1/commerce/products/${encodeURIComponent(id)}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return PRODUCT_FALLBACK_METADATA
    const json = (await res.json()) as { data?: WireProductDetailBody | null } | null
    return productMetadata(id, json?.data) ?? PRODUCT_FALLBACK_METADATA
  } catch {
    return PRODUCT_FALLBACK_METADATA
  }
}

export default async function ShopProductPage({ params }: Props) {
  const { id } = await params
  return <ProductScreen productId={id} />
}
