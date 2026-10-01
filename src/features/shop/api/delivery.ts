// The delivery estimate (shop-engagement contract §1). PUBLIC.
//   GET /products/:id/delivery-estimate?pincode=NNNNNN
// With no pincode the server uses a signed-in buyer's default address, and
// answers 400 PINCODE_REQUIRED to a signed-out one (the hook never asks then).

import api from "@/lib/api"
import { toDeliveryEstimate, type DeliveryEstimate, type WireDeliveryEstimate } from "../model/delivery"

const BASE = "/v1/commerce"

export async function fetchDeliveryEstimate(productId: string, pincode: string | null): Promise<DeliveryEstimate> {
  const res = await api.get<{ data: WireDeliveryEstimate }>(`${BASE}/products/${encodeURIComponent(productId)}/delivery-estimate`, {
    params: pincode ? { pincode } : undefined,
  })
  return toDeliveryEstimate(res.data?.data)
}
