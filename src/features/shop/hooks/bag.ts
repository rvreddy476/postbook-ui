"use client"

// The bag's queries. One key, ["shop", "bag"], read by the header badge,
// the product page and the bag screen alike; every write answers the whole
// cart, so the cache is set from the response.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { addToCart, fetchCart, removeCartItem, updateCartItem } from "../api/bag"
import { EMPTY_CART, type CartView } from "../model/bag"
import { isSignedOut, signInHref } from "../model/storefront"
import { useShopSession } from "./storefront"

export const BAG_KEY = ["shop", "bag"] as const

/** `GET /cart`. Never asked for a signed-out shopper; see useShopSession. */
export function useBag<T = CartView>(select?: (cart: CartView) => T) {
  const { signedIn, known } = useShopSession()
  return useQuery<CartView, unknown, T>({
    queryKey: BAG_KEY,
    queryFn: fetchCart,
    enabled: known && signedIn,
    staleTime: 15 * 1000,
    select,
  })
}

/** The header's count: `item_count` (units, not lines), 0 while unknown. */
export function useBagCount(): number {
  const { data } = useBag()
  return data?.item_count ?? EMPTY_CART.item_count
}

/** Sends a signed-out shopper to sign in, with a way back to where they were. */
function toSignInIfSignedOut(error: unknown) {
  if (typeof window === "undefined" || !isSignedOut(error)) return
  window.location.assign(signInHref(window.location.pathname + window.location.search))
}

/** `POST /cart/items {variant_id, quantity}`. The caller maps a failure with `addToBagFailure`. */
export function useAddToBag() {
  const qc = useQueryClient()
  return useMutation<CartView, unknown, { variant_id: string; quantity: number }>({
    mutationFn: addToCart,
    onSuccess: (cart) => qc.setQueryData(BAG_KEY, cart),
    onError: toSignInIfSignedOut,
  })
}

/** `PATCH /cart/items/by-variant/:variantId {quantity}`; 0 removes the line. */
export function useUpdateBagLine() {
  const qc = useQueryClient()
  return useMutation<CartView, unknown, { variant_id: string; quantity: number }>({
    mutationFn: ({ variant_id, quantity }) => updateCartItem(variant_id, quantity),
    onSuccess: (cart) => qc.setQueryData(BAG_KEY, cart),
    onError: (error) => {
      toSignInIfSignedOut(error)
      qc.invalidateQueries({ queryKey: BAG_KEY })
    },
  })
}

/** `DELETE /cart/items/:variantId`. */
export function useRemoveBagLine() {
  const qc = useQueryClient()
  return useMutation<CartView, unknown, string>({
    mutationFn: removeCartItem,
    onSuccess: (cart) => qc.setQueryData(BAG_KEY, cart),
    onError: (error) => {
      toSignInIfSignedOut(error)
      qc.invalidateQueries({ queryKey: BAG_KEY })
    },
  })
}
