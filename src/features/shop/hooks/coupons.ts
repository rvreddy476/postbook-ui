"use client"

// Buyer coupons. Keys: ["shop", "coupons", …].

import { useQuery } from "@tanstack/react-query"

import { fetchCartCoupons } from "../api/coupons"
import type { CartCoupon } from "../model/coupons"
import { useShopSession } from "./storefront"

/**
  `GET /cart/coupons`. Keyed by the bag's subtotal and item count so a
  change to the bag asks again (the applicable set and each discount
  depend on it). Signed-in only, like the bag.
*/
export function useCartCoupons(bagSignature: string, enabled = true) {
  const { signedIn, known } = useShopSession()
  return useQuery<CartCoupon[]>({
    queryKey: ["shop", "coupons", "cart", bagSignature],
    queryFn: fetchCartCoupons,
    enabled: enabled && known && signedIn && !!bagSignature,
    staleTime: 30 * 1000,
    retry: false,
  })
}
