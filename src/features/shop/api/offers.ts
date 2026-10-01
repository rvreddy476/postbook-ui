// Bank offers (Razorpay Offers). axios only; the shapes are in ../model/offers.
//
//   GET /v1/commerce/payment-offers?amount_minor=<paise>   PUBLIC
//
// The product page asks with the product's price, checkout with the
// quote's total. The answer lists; it never changes a total.

import api from "@/lib/api"

import { toPaymentOffers, type PaymentOffer } from "../model/offers"

const BASE = "/v1/commerce"

export async function fetchPaymentOffers(amountMinor: number): Promise<PaymentOffer[]> {
  const res = await api.get<{ data: unknown }>(`${BASE}/payment-offers`, { params: { amount_minor: amountMinor } })
  return toPaymentOffers(res.data?.data)
}
