"use client"

// MSeller coupons. Keys: ["shop", "sell", "coupons"], under the seller
// namespace so one invalidation of ["shop","sell"] reaches it too.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { createSellerCoupon, fetchSellerCoupons, patchSellerCoupon } from "../api/sellerCoupons"
import type { CouponCreateBody, CouponPatchBody, SellerCoupon } from "../model/sellerCoupons"

export const SELLER_COUPONS_KEY = ["shop", "sell", "coupons"] as const

export function useSellerCoupons(enabled = true) {
  return useQuery<SellerCoupon[]>({ queryKey: SELLER_COUPONS_KEY, queryFn: fetchSellerCoupons, enabled, retry: false })
}

export function useCreateSellerCoupon() {
  const qc = useQueryClient()
  return useMutation<SellerCoupon | null, unknown, CouponCreateBody>({
    mutationFn: createSellerCoupon,
    onSuccess: () => void qc.invalidateQueries({ queryKey: SELLER_COUPONS_KEY }),
  })
}

export function usePatchSellerCoupon() {
  const qc = useQueryClient()
  return useMutation<SellerCoupon | null, unknown, { id: string; body: CouponPatchBody }>({
    mutationFn: ({ id, body }) => patchSellerCoupon(id, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: SELLER_COUPONS_KEY }),
  })
}
