// MSeller coupons. axios only; the shapes and rules are in ../model/sellerCoupons.
//
//   GET   /v1/commerce/seller/coupons
//   POST  /v1/commerce/seller/coupons        CouponCreateBody
//   PATCH /v1/commerce/seller/coupons/:id    CouponPatchBody (changed fields only; null clears)
//
// No delete: deactivate is PATCH {is_active:false}.

import api from "@/lib/api"

import { toSellerCoupon, toSellerCoupons, type CouponCreateBody, type CouponPatchBody, type SellerCoupon, type WireSellerCoupon } from "../model/sellerCoupons"

const BASE = "/v1/commerce/seller/coupons"

export async function fetchSellerCoupons(): Promise<SellerCoupon[]> {
  const res = await api.get<{ data: unknown }>(BASE)
  return toSellerCoupons(res.data?.data)
}

export async function createSellerCoupon(body: CouponCreateBody): Promise<SellerCoupon | null> {
  const res = await api.post<{ data: WireSellerCoupon }>(BASE, body)
  return res.data?.data ? toSellerCoupon(res.data.data) : null
}

export async function patchSellerCoupon(id: string, body: CouponPatchBody): Promise<SellerCoupon | null> {
  const res = await api.patch<{ data: WireSellerCoupon }>(`${BASE}/${encodeURIComponent(id)}`, body)
  return res.data?.data ? toSellerCoupon(res.data.data) : null
}
