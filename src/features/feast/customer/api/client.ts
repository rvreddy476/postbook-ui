/*
  Feast customer calls — the shared axios client (`@/lib/api`), which goes
  through the Next `/v1/*` proxy like the shop does. Every response is
  `{data, meta}` and is decoded here (lenient); every refusal becomes a
  FeastApiError carrying the server's status, code and own words.

  Routes: food-service handler.go (customer group) and handler_feast_customer.go.
*/

import { isAxiosError } from "axios"

import api from "@/lib/api"

import { envelopeData, envelopeError, LENIENT, type Ctx } from "../model/decode"
import {
  decodeAddress,
  decodeAddressList,
  decodeCart,
  decodeInvoice,
  decodeMenu,
  decodeOrder,
  decodeOrderList,
  decodeOrderPayment,
  decodePaymentIntent,
  decodeRealtimeToken,
  decodeRestaurant,
  decodeRestaurantList,
  decodeTracking,
  type Address,
  type Cart,
  type Invoice,
  type Menu,
  type Order,
  type OrderPayment,
  type PaymentIntent,
  type RealtimeToken,
  type Restaurant,
  type Tracking,
} from "../model/wire"

const BASE = "/v1/food"

export class FeastApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    /** True when `message` is the server's own text. */
    public readonly fromServer: boolean,
  ) {
    super(message)
    this.name = "FeastApiError"
  }
}

/** Any thrown value as a FeastApiError; status 0 is "no answer" (network). */
export function toFeastError(error: unknown): FeastApiError {
  if (error instanceof FeastApiError) return error
  if (isAxiosError(error)) {
    const status = error.response?.status ?? 0
    const body = error.response?.data
    if (body && typeof body === "object") {
      try {
        const e = envelopeError(body, LENIENT)
        return new FeastApiError(status, e.code, e.message || "Something went wrong.", Boolean(e.message))
      } catch {
        /* not an envelope */
      }
    }
    return new FeastApiError(status, status ? `HTTP_${status}` : "NETWORK", status ? "Something went wrong." : "Check your connection and try again.", false)
  }
  return new FeastApiError(0, "UNKNOWN", "Something went wrong.", false)
}

async function call<T>(run: () => Promise<{ data: unknown }>, decode: (raw: unknown, ctx: Ctx) => T): Promise<T> {
  let raw: unknown
  try {
    raw = (await run()).data
  } catch (error) {
    throw toFeastError(error)
  }
  return decode(envelopeData(raw, LENIENT), LENIENT)
}

export interface LatLng {
  lat: number
  lng: number
}

/* discovery */

export function listRestaurants(near: LatLng | null, q?: string): Promise<Restaurant[]> {
  const params: Record<string, string | number> = { limit: 50 }
  if (near) {
    params.lat = near.lat
    params.lng = near.lng
  }
  if (q && q.trim()) params.q = q.trim()
  return call(() => api.get(`${BASE}/restaurants`, { params }), decodeRestaurantList)
}

export function getRestaurant(id: string, near: LatLng | null): Promise<Restaurant> {
  const params = near ? { lat: near.lat, lng: near.lng } : undefined
  return call(() => api.get(`${BASE}/restaurants/${encodeURIComponent(id)}`, { params }), decodeRestaurant)
}

export function getMenu(id: string): Promise<Menu> {
  return call(() => api.get(`${BASE}/restaurants/${encodeURIComponent(id)}/menu`), decodeMenu)
}

/* cart */

export interface AddCartItemBody {
  menu_item_id: string
  quantity: number
  variant_id?: string
  addons: { addon_id: string; quantity: number }[]
  address_id?: string
  clear_existing?: boolean
  item_instruction?: string
}

export function getCart(): Promise<Cart> {
  return call(() => api.get(`${BASE}/cart`), decodeCart)
}

export function addCartItem(body: AddCartItemBody): Promise<Cart> {
  return call(() => api.post(`${BASE}/cart/items`, body), decodeCart)
}

export function updateCartItem(cartItemId: string, quantity: number): Promise<Cart> {
  return call(() => api.patch(`${BASE}/cart/items/${encodeURIComponent(cartItemId)}`, { quantity }), decodeCart)
}

/** The route answers `{status}`; the fresh cart is read back. */
export async function removeCartItem(cartItemId: string): Promise<Cart> {
  try {
    await api.delete(`${BASE}/cart/items/${encodeURIComponent(cartItemId)}`)
  } catch (error) {
    throw toFeastError(error)
  }
  return getCart()
}

export async function clearCart(): Promise<void> {
  try {
    await api.delete(`${BASE}/cart`)
  } catch (error) {
    throw toFeastError(error)
  }
}

/* addresses */

export interface AddressBody {
  label: string
  address_line1: string
  city: string
  country: string
  receiver_name?: string
  phone?: string
  address_line2?: string
  landmark?: string
  state?: string
  postal_code?: string
  latitude?: number
  longitude?: number
  is_default: boolean
}

export function listAddresses(): Promise<Address[]> {
  return call(() => api.get(`${BASE}/addresses`), decodeAddressList)
}

export function createAddress(body: AddressBody): Promise<Address> {
  return call(() => api.post(`${BASE}/addresses`, body), decodeAddress)
}

export function updateAddress(id: string, body: Partial<AddressBody>): Promise<Address> {
  return call(() => api.patch(`${BASE}/addresses/${encodeURIComponent(id)}`, body), decodeAddress)
}

export async function deleteAddress(id: string): Promise<void> {
  try {
    await api.delete(`${BASE}/addresses/${encodeURIComponent(id)}`)
  } catch (error) {
    throw toFeastError(error)
  }
}

/* orders */

export interface PlaceOrderBody {
  address_id: string
  payment_method: "upi" | "card"
  customer_instruction?: string
}

/** POST /orders. The key is the caller's, saved BEFORE this call (checkoutAttempt.ts). */
export function placeOrder(body: PlaceOrderBody, idempotencyKey: string): Promise<Order> {
  return call(() => api.post(`${BASE}/orders`, body, { headers: { "Idempotency-Key": idempotencyKey } }), decodeOrder)
}

export function listOrders(): Promise<Order[]> {
  return call(() => api.get(`${BASE}/orders`), decodeOrderList)
}

export function getOrder(id: string): Promise<Order> {
  return call(() => api.get(`${BASE}/orders/${encodeURIComponent(id)}`), decodeOrder)
}

export function getTracking(id: string): Promise<Tracking> {
  return call(() => api.get(`${BASE}/orders/${encodeURIComponent(id)}/tracking`), decodeTracking)
}

export function cancelOrder(id: string, reason: string): Promise<Order> {
  return call(() => api.post(`${BASE}/orders/${encodeURIComponent(id)}/cancel`, { reason }), decodeOrder)
}

export function getInvoice(id: string): Promise<Invoice> {
  return call(() => api.get(`${BASE}/orders/${encodeURIComponent(id)}/invoice`), decodeInvoice)
}

/* payment */

/** GET /orders/:id/payment — the ONLY source of "paid". */
export function getOrderPayment(id: string): Promise<OrderPayment> {
  return call(() => api.get(`${BASE}/orders/${encodeURIComponent(id)}/payment`), decodeOrderPayment)
}

/** One key per payment attempt; the client names an order and an instrument, never an amount. */
export function createPaymentIntent(orderId: string, method: "upi" | "card", idempotencyKey: string): Promise<PaymentIntent> {
  return call(
    () => api.post(`${BASE}/orders/${encodeURIComponent(orderId)}/payments/intents`, { method }, { headers: { "Idempotency-Key": idempotencyKey } }),
    decodePaymentIntent,
  )
}

export interface StubConfirmBody {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
  amount_minor: number
}

/** Dev only: settles a stub-gateway intent. The server still decides; the page keeps polling. */
export async function confirmStubPayment(orderId: string, body: StubConfirmBody, idempotencyKey: string): Promise<void> {
  try {
    await api.post(`${BASE}/orders/${encodeURIComponent(orderId)}/payments/confirm`, body, { headers: { "Idempotency-Key": idempotencyKey } })
  } catch (error) {
    throw toFeastError(error)
  }
}

/* realtime */

export function issueOrderRealtimeToken(orderId: string): Promise<RealtimeToken> {
  return call(() => api.post(`${BASE}/realtime/token`, { scope: "order", id: orderId }), decodeRealtimeToken)
}
