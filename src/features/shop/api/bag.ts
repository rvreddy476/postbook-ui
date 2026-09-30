// The bag's routes (AUTH). Every write answers the whole cart, so the cache
// is set from the response rather than refetched.
//
//   GET    /cart
//   POST   /cart/items {variant_id, quantity}
//   PATCH  /cart/items/by-variant/:variantId {quantity}   (0 deletes)
//   DELETE /cart/items/:variantId

import api from "@/lib/api"
import { toCartView, type CartView } from "../model/bag"

const BASE = "/v1/commerce"

export async function fetchCart(): Promise<CartView> {
  const res = await api.get<{ data: Partial<CartView> }>(`${BASE}/cart`)
  return toCartView(res.data?.data)
}

export async function addToCart(input: { variant_id: string; quantity: number }): Promise<CartView> {
  const res = await api.post<{ data: Partial<CartView> }>(`${BASE}/cart/items`, input)
  return toCartView(res.data?.data)
}

export async function updateCartItem(variantId: string, quantity: number): Promise<CartView> {
  const res = await api.patch<{ data: Partial<CartView> }>(`${BASE}/cart/items/by-variant/${encodeURIComponent(variantId)}`, { quantity })
  return toCartView(res.data?.data)
}

export async function removeCartItem(variantId: string): Promise<CartView> {
  const res = await api.delete<{ data: Partial<CartView> }>(`${BASE}/cart/items/${encodeURIComponent(variantId)}`)
  return toCartView(res.data?.data)
}
