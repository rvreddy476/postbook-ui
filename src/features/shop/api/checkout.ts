/*
  Checkout calls, axios only. Every response is `{ data, meta }` and is
  unwrapped here; every path is under the gateway's /v1/commerce.
*/

import api from "@/lib/api"

import type { CheckoutBody, PaymentMethod, WireCart, WireCheckoutResult, WireQuote } from "../model/checkout"

const BASE = "/v1/commerce"

// TODO(lead): merge with W1's api/bag.ts — checkout reads the bag once.
// TODO(lead): merge with W1's api/addresses.ts.
// TODO(lead): merge with W1's api/addresses.ts.
export interface QuoteRequest {
  address_id: string
  payment_method: PaymentMethod
  coupon_code?: string
}

/** POST /checkout/quote. 422 NOT_SERVICEABLE and the 409s reject; the caller branches on the code. */
export async function requestQuote(body: QuoteRequest): Promise<WireQuote> {
  const res = await api.post(`${BASE}/checkout/quote`, body)
  return res.data.data as WireQuote
}

/**
  POST /v2/orders/checkout with the attempt's Idempotency-Key. The axios
  client stamps a fresh key on any write that has none; this one is passed
  explicitly so a retry of the same attempt carries the same key.
*/
export async function placeOrder(body: CheckoutBody, idempotencyKey: string): Promise<WireCheckoutResult> {
  const res = await api.post(`${BASE}/v2/orders/checkout`, body, {
    headers: { "Idempotency-Key": idempotencyKey },
  })
  return res.data.data as WireCheckoutResult
}
