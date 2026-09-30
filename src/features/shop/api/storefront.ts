// The storefront's reads: home, categories, the product list. axios only;
// the mappers live in model/storefront.ts. Every route is under
// /v1/commerce and public (the gateway adds X-User-Id when there is one).

import api from "@/lib/api"
import {
  productListParams,
  toHomePage,
  toProductPage,
  type BrowseFilters,
  type HomePage,
  type ProductPage,
  type WireCategoryCard,
  type WireHomePage,
  type WireProductPage,
} from "../model/storefront"

const BASE = "/v1/commerce"

/** `GET /home` → banners + sections. A 404 (nothing merchandised) is an empty page, not an error. */
export async function fetchHome(): Promise<HomePage> {
  try {
    const res = await api.get<{ data: WireHomePage }>(`${BASE}/home`)
    return toHomePage(res.data?.data)
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) return toHomePage(undefined)
    throw error
  }
}

/** `GET /categories` → the browsable roots with live counts. */
export async function fetchCategories(): Promise<WireCategoryCard[]> {
  const res = await api.get<{ data: WireCategoryCard[] | null }>(`${BASE}/categories`)
  return Array.isArray(res.data?.data) ? res.data.data : []
}

/**
 * `GET /products?q&category&in_stock&min_price&max_price&min_rating&cursor&limit`
 * in cursor mode. The handler reads `cursor` (handler.go ListProducts), so
 * the offset path is never needed; a first page sends no cursor.
 */
export async function fetchProducts(filters: Partial<BrowseFilters>, page: { cursor?: string | null; limit: number }): Promise<ProductPage> {
  const res = await api.get<{ data: WireProductPage }>(`${BASE}/products`, { params: productListParams(filters, page) })
  return toProductPage(res.data?.data)
}
