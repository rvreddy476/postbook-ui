// Favourites (AUTH). `GET /favourites?limit=100` is keyset-paged; the heart
// is `POST /favourites {product_id}` / `DELETE /favourites/:productId`, both
// idempotent on the server.

import api from "@/lib/api"
import type { FavouritesPage } from "../model/favourites"
import { toProductCards, type WireProductSummary } from "../model/storefront"

const BASE = "/v1/commerce"

export const FAVOURITES_LIMIT = 100

export async function fetchFavourites(): Promise<FavouritesPage> {
  const res = await api.get<{ data: { items?: WireProductSummary[] | null; next_cursor?: string } }>(`${BASE}/favourites`, {
    params: { limit: FAVOURITES_LIMIT },
  })
  return { items: toProductCards(res.data?.data?.items), nextCursor: res.data?.data?.next_cursor || null }
}

export async function addFavourite(productId: string): Promise<void> {
  await api.post(`${BASE}/favourites`, { product_id: productId })
}

export async function removeFavourite(productId: string): Promise<void> {
  await api.delete(`${BASE}/favourites/${encodeURIComponent(productId)}`)
}
