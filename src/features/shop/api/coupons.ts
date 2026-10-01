// Buyer coupons. axios only; the shapes and rules are in ../model/coupons.
//
//   GET /v1/commerce/cart/coupons   (AUTH) the codes that apply to the bag,
//                                   each with the discount it would give.
//
// The code itself travels in the quote and checkout bodies (api/checkout.ts,
// `coupon_code`). The legacy float `GET /cart/coupon-preview` is not called
// from the web.

import api from "@/lib/api"

import { toCartCoupons, type CartCoupon } from "../model/coupons"

const BASE = "/v1/commerce"

export async function fetchCartCoupons(): Promise<CartCoupon[]> {
  const res = await api.get<{ data: unknown }>(`${BASE}/cart/coupons`)
  return toCartCoupons(res.data?.data)
}
