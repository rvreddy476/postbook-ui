// One product's reads: the detail body, the gallery, the legacy spec rows.
// axios only; the mappers live in model/catalogue.ts.

import api from "@/lib/api"
import type { WireLegacyAttribute, WireMediaItem, WireProductDetailBody } from "../model/catalogue"

const BASE = "/v1/commerce"

/** `GET /products/:id` → `{product, variants, media, attributes}`; 404 PRODUCT_NOT_FOUND for unknown ids and others' drafts. */
export async function fetchProductDetail(productId: string): Promise<WireProductDetailBody> {
  const res = await api.get<{ data: WireProductDetailBody }>(`${BASE}/products/${encodeURIComponent(productId)}`)
  return res.data?.data ?? {}
}

/** `GET /products/:id/media` → `{items}`; the same rows the detail body carries under `media`. */
export async function fetchProductMedia(productId: string): Promise<WireMediaItem[]> {
  const res = await api.get<{ data: { items?: WireMediaItem[] | null } }>(`${BASE}/products/${encodeURIComponent(productId)}/media`)
  const items = res.data?.data?.items
  return Array.isArray(items) ? items : []
}

/** `GET /products/:id/attributes` → `{attributes}`: the legacy free-form name/value/unit rows. */
export async function fetchProductAttributes(productId: string): Promise<WireLegacyAttribute[]> {
  const res = await api.get<{ data: { attributes?: WireLegacyAttribute[] | null } }>(`${BASE}/products/${encodeURIComponent(productId)}/attributes`)
  const rows = res.data?.data?.attributes
  return Array.isArray(rows) ? rows : []
}
