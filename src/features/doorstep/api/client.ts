/*
  Doorstep customer calls — the shared axios client (`@/lib/api`), through
  the Next `/v1/*` proxy like Feast and the shop. Every response is
  `{data, meta}` and is decoded here (lenient); every refusal becomes a
  DoorstepApiError carrying the server's status, code, own words and details.

  Routes: contracts/doorstep/openapi.yaml (customer + catalogue). The gateway
  answers 404 for anyone outside the pilot allowlist.
*/

import { isAxiosError } from "axios"

import api from "@/lib/api"

import type { AddressBody } from "../model/address"
import { envelopeData, envelopeError, LENIENT, type Ctx, type Obj } from "../model/decode"
import type { QuoteBody } from "../model/selection"
import {
  decodeAddress,
  decodeAddressList,
  decodeBooking,
  decodeBookingCreated,
  decodeBookingPage,
  decodeBookingPayments,
  decodeCancelPreview,
  decodeCatalogue,
  decodeCategoryPage,
  decodeExtra,
  decodeExtraList,
  decodeExtrasBill,
  decodeIncident,
  decodeMessage,
  decodeMessagePage,
  decodeOutstanding,
  decodePaymentIntent,
  decodeQuote,
  decodeRating,
  decodeRealtimeToken,
  decodeReworkList,
  decodeReworkRequest,
  decodeServiceability,
  decodeServicePage,
  decodeShareToken,
  decodeSlotDays,
  decodeTrustedContact,
  type Address,
  type Booking,
  type BookingCreated,
  type BookingPage,
  type BookingPayments,
  type CancelPreview,
  type Catalogue,
  type CategoryPage,
  type Extra,
  type ExtrasBill,
  type Incident,
  type Message,
  type MessagePage,
  type Outstanding,
  type PaymentIntent,
  type Quote,
  type Rating,
  type RealtimeToken,
  type ReworkRequest,
  type Serviceability,
  type ServicePage,
  type ShareToken,
  type SlotDays,
  type TrustedContact,
} from "../model/wire"

const BASE = "/v1/doorstep"

/** The pilot city. Doorstep serves Hyderabad only at launch. */
export const PILOT_CITY = "HYD"

export class DoorstepApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    /** True when `message` is the server's own text. */
    public readonly fromServer: boolean,
    public readonly details: Obj | null = null,
  ) {
    super(message)
    this.name = "DoorstepApiError"
  }
}

/** Any thrown value as a DoorstepApiError; status 0 is "no answer" (network). */
export function toDoorstepError(error: unknown): DoorstepApiError {
  if (error instanceof DoorstepApiError) return error
  if (isAxiosError(error)) {
    const status = error.response?.status ?? 0
    const body = error.response?.data
    if (body && typeof body === "object") {
      try {
        const e = envelopeError(body, LENIENT)
        return new DoorstepApiError(status, e.code, e.message || "Something went wrong.", Boolean(e.message), e.details)
      } catch {
        /* not an envelope */
      }
    }
    return new DoorstepApiError(status, status ? `HTTP_${status}` : "NETWORK", status ? "Something went wrong." : "Check your connection and try again.", false)
  }
  return new DoorstepApiError(0, "UNKNOWN", "Something went wrong.", false)
}

async function call<T>(run: () => Promise<{ data: unknown }>, decode: (raw: unknown, ctx: Ctx) => T): Promise<T> {
  let raw: unknown
  try {
    raw = (await run()).data
  } catch (error) {
    throw toDoorstepError(error)
  }
  return decode(envelopeData(raw, LENIENT), LENIENT)
}

async function send(run: () => Promise<unknown>): Promise<void> {
  try {
    await run()
  } catch (error) {
    throw toDoorstepError(error)
  }
}

const id = (v: string) => encodeURIComponent(v)

/* catalogue */

export function getCatalogue(city = PILOT_CITY): Promise<Catalogue> {
  return call(() => api.get(`${BASE}/catalogue`, { params: { city } }), decodeCatalogue)
}

export function getCategory(slug: string, city = PILOT_CITY): Promise<CategoryPage> {
  return call(() => api.get(`${BASE}/categories/${id(slug)}`, { params: { city } }), decodeCategoryPage)
}

export function getService(serviceId: string, city = PILOT_CITY): Promise<ServicePage> {
  return call(() => api.get(`${BASE}/services/${id(serviceId)}`, { params: { city } }), decodeServicePage)
}

export function checkServiceability(lat: number, lng: number): Promise<Serviceability> {
  return call(() => api.post(`${BASE}/serviceability`, { lat, lng }), decodeServiceability)
}

/* quotes */

export function createQuote(body: QuoteBody): Promise<Quote> {
  return call(() => api.post(`${BASE}/quotes`, body), decodeQuote)
}

export function getQuote(quoteId: string): Promise<Quote> {
  return call(() => api.get(`${BASE}/quotes/${id(quoteId)}`), decodeQuote)
}

/* addresses */

export function listAddresses(): Promise<Address[]> {
  return call(() => api.get(`${BASE}/addresses`), decodeAddressList)
}

export function createAddress(body: AddressBody): Promise<Address> {
  return call(() => api.post(`${BASE}/addresses`, body), decodeAddress)
}

export function updateAddress(addressId: string, body: AddressBody): Promise<Address> {
  return call(() => api.patch(`${BASE}/addresses/${id(addressId)}`, body), decodeAddress)
}

export function deleteAddress(addressId: string): Promise<void> {
  return send(() => api.delete(`${BASE}/addresses/${id(addressId)}`))
}

/* slots */

export interface SlotQuery {
  quoteId?: string
  bookingId?: string
  addressId?: string
  requireFemalePro?: boolean
}

export function listSlots(q: SlotQuery): Promise<SlotDays> {
  const params: Record<string, string> = {}
  if (q.quoteId) params.quote_id = q.quoteId
  if (q.bookingId) params.booking_id = q.bookingId
  if (q.addressId) params.address_id = q.addressId
  if (q.requireFemalePro) params.require_female_pro = "true"
  return call(() => api.get(`${BASE}/slots`, { params }), decodeSlotDays)
}

/* bookings */

export interface BookingBody {
  quote_id: string
  address_id: string
  slot_start: string
  require_female_pro: boolean
  notes?: string
}

/** POST /bookings. The key is the caller's, saved BEFORE this call (bookingAttempt.ts). */
export function createBooking(body: BookingBody, idempotencyKey: string): Promise<BookingCreated> {
  return call(() => api.post(`${BASE}/bookings`, body, { headers: { "Idempotency-Key": idempotencyKey } }), decodeBookingCreated)
}

export function listBookings(status: "upcoming" | "past" | "all" = "all", cursor?: string): Promise<BookingPage> {
  const params: Record<string, string | number> = { status, limit: 50 }
  if (cursor) params.cursor = cursor
  return call(() => api.get(`${BASE}/bookings`, { params }), decodeBookingPage)
}

export function getBooking(bookingId: string): Promise<Booking> {
  return call(() => api.get(`${BASE}/bookings/${id(bookingId)}`), decodeBooking)
}

export function previewCancel(bookingId: string): Promise<CancelPreview> {
  return call(() => api.get(`${BASE}/bookings/${id(bookingId)}/cancel-preview`), decodeCancelPreview)
}

export function cancelBooking(bookingId: string, reason: string): Promise<Booking> {
  return call(() => api.post(`${BASE}/bookings/${id(bookingId)}/cancel`, { reason }), decodeBooking)
}

export function rescheduleBooking(bookingId: string, slotStart: string): Promise<Booking> {
  return call(() => api.post(`${BASE}/bookings/${id(bookingId)}/reschedule`, { slot_start: slotStart }), decodeBooking)
}

/* payment — "paid" is only ever GET /bookings/:id/payment */

export function openBookingPaymentIntent(bookingId: string): Promise<PaymentIntent> {
  return call(() => api.post(`${BASE}/bookings/${id(bookingId)}/payment/intent`), decodePaymentIntent)
}

export function getBookingPayments(bookingId: string): Promise<BookingPayments> {
  return call(() => api.get(`${BASE}/bookings/${id(bookingId)}/payment`), decodeBookingPayments)
}

export function openExtrasPaymentIntent(billId: string): Promise<PaymentIntent> {
  return call(() => api.post(`${BASE}/extras-bills/${id(billId)}/payment/intent`), decodePaymentIntent)
}

/* the visit */

export function listExtras(bookingId: string): Promise<Extra[]> {
  return call(() => api.get(`${BASE}/bookings/${id(bookingId)}/extras`), decodeExtraList)
}

export function approveExtra(bookingId: string, extraId: string): Promise<Extra> {
  return call(() => api.post(`${BASE}/bookings/${id(bookingId)}/extras/${id(extraId)}/approve`), decodeExtra)
}

export function declineExtra(bookingId: string, extraId: string): Promise<Extra> {
  return call(() => api.post(`${BASE}/bookings/${id(bookingId)}/extras/${id(extraId)}/decline`), decodeExtra)
}

export function getExtrasBill(bookingId: string): Promise<ExtrasBill> {
  return call(() => api.get(`${BASE}/bookings/${id(bookingId)}/extras-bill`), decodeExtrasBill)
}

export function getOutstanding(): Promise<Outstanding> {
  return call(() => api.get(`${BASE}/me/outstanding`), decodeOutstanding)
}

/* after the visit */

export interface RatingBody {
  stars: number
  tags?: string[]
  comment?: string
}

export function rateBooking(bookingId: string, body: RatingBody): Promise<Rating> {
  return call(() => api.post(`${BASE}/bookings/${id(bookingId)}/rating`, body), decodeRating)
}

export interface ReworkBody {
  reason: string
  slot_start?: string
}

export function requestRework(bookingId: string, body: ReworkBody): Promise<ReworkRequest> {
  return call(() => api.post(`${BASE}/bookings/${id(bookingId)}/rework`, body), decodeReworkRequest)
}

export function listRework(bookingId: string): Promise<ReworkRequest[]> {
  return call(() => api.get(`${BASE}/bookings/${id(bookingId)}/rework`), decodeReworkList)
}

/* safety */

export function raiseSOS(bookingId: string, body: { lat?: number; lng?: number; note?: string }): Promise<Incident> {
  return call(() => api.post(`${BASE}/bookings/${id(bookingId)}/sos`, body), decodeIncident)
}

export function createShare(bookingId: string): Promise<ShareToken> {
  return call(() => api.post(`${BASE}/bookings/${id(bookingId)}/share`), decodeShareToken)
}

export function revokeShare(bookingId: string): Promise<void> {
  return send(() => api.delete(`${BASE}/bookings/${id(bookingId)}/share`))
}

export function getTrustedContact(): Promise<TrustedContact | null> {
  return call(() => api.get(`${BASE}/trusted-contact`), decodeTrustedContact)
}

export function putTrustedContact(body: { name: string; phone: string }): Promise<TrustedContact | null> {
  return call(() => api.put(`${BASE}/trusted-contact`, body), decodeTrustedContact)
}

/* chat */

export function listMessages(bookingId: string): Promise<MessagePage> {
  return call(() => api.get(`${BASE}/bookings/${id(bookingId)}/messages`), decodeMessagePage)
}

export function sendMessage(bookingId: string, body: string): Promise<Message> {
  return call(() => api.post(`${BASE}/bookings/${id(bookingId)}/messages`, { body }), decodeMessage)
}

export function markMessageRead(bookingId: string, messageId: string): Promise<void> {
  return send(() => api.post(`${BASE}/bookings/${id(bookingId)}/messages/${id(messageId)}/read`))
}

/* realtime */

export function issueBookingRealtimeToken(bookingId: string): Promise<RealtimeToken> {
  return call(() => api.post(`${BASE}/realtime/token`, { booking_id: bookingId }), decodeRealtimeToken)
}
