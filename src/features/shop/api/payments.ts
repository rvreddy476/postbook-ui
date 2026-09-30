/*
  The payment leg, axios only. The three-state read tries C1's route first
  and falls back to the legacy `/payment/status` while the new one is not
  deployed; `readPayment` hides that from the poll.
*/

import api from "@/lib/api"

import { errorCode, errorStatus } from "../model/checkout"
import {
  readingFromLegacyStatus,
  readingFromPayment,
  type PaymentReading,
  type StubConfirmBody,
  type WireOrderPayment,
  type WirePaymentIntent,
  type WirePaymentStatus,
} from "../model/payments"

const BASE = "/v1/commerce"

/** POST /orders/:id/payment/intent — no body; commerce authors the amount from the order. */
export async function openPaymentIntent(orderId: string): Promise<WirePaymentIntent> {
  const res = await api.post(`${BASE}/orders/${orderId}/payment/intent`)
  return res.data.data as WirePaymentIntent
}

/** GET /orders/:id/payment (C1). */
export async function fetchOrderPayment(orderId: string): Promise<WireOrderPayment> {
  const res = await api.get(`${BASE}/orders/${orderId}/payment`)
  return res.data.data as WireOrderPayment
}

/** GET /orders/:id/payment/status — the legacy shape. */
export async function fetchPaymentStatus(orderId: string): Promise<WirePaymentStatus> {
  const res = await api.get(`${BASE}/orders/${orderId}/payment/status`)
  return res.data.data as WirePaymentStatus
}

/** The route is not deployed: a 404 that is not the order's own "not found". */
export function isRouteMissing(error: unknown): boolean {
  return errorStatus(error) === 404 && errorCode(error) !== "ORDER_NOT_FOUND"
}

/**
  One read for the poll. `/payment` first; when that route itself is
  missing (404 without ORDER_NOT_FOUND) the legacy route answers and its
  verdict is derived. Any other error propagates with its status so the
  poll can tell a permanent 4xx from an outage.
*/
export async function readPayment(orderId: string): Promise<PaymentReading> {
  try {
    return readingFromPayment(await fetchOrderPayment(orderId))
  } catch (error) {
    if (!isRouteMissing(error)) throw error
    return readingFromLegacyStatus(await fetchPaymentStatus(orderId))
  }
}

/** POST /orders/:id/payment/confirm {gateway: "stub"} — dev only; registered only with PAYMENTS_ALLOW_STUB. */
export async function confirmStubPayment(orderId: string, body: StubConfirmBody): Promise<void> {
  await api.post(`${BASE}/orders/${orderId}/payment/confirm`, body)
}
