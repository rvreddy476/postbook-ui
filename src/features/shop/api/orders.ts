/*
  Orders, axios only (commerce-contract.md §5). Reviews live here too: the
  only review a buyer writes is of an order item, and its inputs come off
  the order.
*/

import api from "@/lib/api"

import type { ReviewBody, WireInvoiceResponse, WireOrderDetail, WireOrdersPage, WireShipmentsResponse } from "../model/orders"

const BASE = "/v1/commerce"

export const ORDERS_PAGE_SIZE = 20

/** GET /orders?limit=&cursor= → `{ data: {items, next_cursor}, meta: {next_cursor} }`. */
export async function fetchOrdersPage(cursor: string): Promise<{ data: WireOrdersPage; meta: { next_cursor?: string } | null }> {
  const params: Record<string, string | number> = { limit: ORDERS_PAGE_SIZE }
  if (cursor) params.cursor = cursor
  const res = await api.get(`${BASE}/orders`, { params })
  return { data: res.data.data as WireOrdersPage, meta: (res.data.meta as { next_cursor?: string } | null) || null }
}

/** GET /orders/:id — the assembled OrderDetail. */
export async function fetchOrder(orderId: string): Promise<WireOrderDetail> {
  const res = await api.get(`${BASE}/orders/${orderId}`)
  return res.data.data as WireOrderDetail
}

/** GET /orders/:id/shipments → `{ shipments: [{shipment, events}] }`. */
export async function fetchShipments(orderId: string): Promise<WireShipmentsResponse> {
  const res = await api.get(`${BASE}/orders/${orderId}/shipments`)
  return res.data.data as WireShipmentsResponse
}

/** GET /orders/:id/invoice → `{ invoice, download_url }`; 404 until the order is paid and invoiced. */
export async function fetchInvoice(orderId: string): Promise<WireInvoiceResponse> {
  const res = await api.get(`${BASE}/orders/${orderId}/invoice`)
  return res.data.data as WireInvoiceResponse
}

/** POST /orders/:id/cancel {reason} → 204. */
export async function cancelOrder(orderId: string, reason: string): Promise<void> {
  await api.post(`${BASE}/orders/${orderId}/cancel`, { reason })
}

/** POST /products/:productId/reviews → 201. */
export async function createReview(productId: string, body: ReviewBody): Promise<void> {
  await api.post(`${BASE}/products/${productId}/reviews`, body)
}
