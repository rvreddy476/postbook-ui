/*
  The Kitchen console's food-service client. Everything goes through the
  app's shared axios instance (`@/lib/api`: bearer token, X-User-Id, CSRF
  echo) to `/v1/food/*`, which Next rewrites to the `/api/proxy` hop and on
  to the gateway — the same path the shop uses.

  Every answer is decoded strictly (../model/wire.ts). Order transitions
  carry a caller-owned Idempotency-Key (the interceptor only fills one in
  when absent), so a retry of the same action reuses its key.
*/

import api from "@/lib/api"
import { uploadMedia } from "@/lib/mediaUpload"

import { envelopeData } from "../model/decode"
import { paiseToWireRupees, type Paise } from "../model/money"
import type { OrderAction } from "../model/orders"
import {
  decodeAccepting,
  decodeAddonGroup,
  decodeCompliance,
  decodeFssai,
  decodeKitchenQueue,
  decodeLocation,
  decodeMenuCategories,
  decodeMenuItem,
  decodeMenuItemDetail,
  decodeOperatingHours,
  decodePartnerOrder,
  decodePartnerOrders,
  decodePartnerRestaurant,
  decodePayoutAccount,
  decodePricedOption,
  decodeReadiness,
  decodeRealtimeToken,
  decodeSettlements,
  decodeSubmit,
  decodeSummary,
} from "../model/wire"
import type { ComplianceBody } from "../model/compliance"
import type { WindowBody } from "../model/hours"

const FOOD = "/v1/food"
const P = `${FOOD}/partner`

async function get(url: string): Promise<unknown> {
  const res = await api.get(url)
  return envelopeData(res.data)
}

// ── Gate ─────────────────────────────────────────────────────────────────

/** Raw bodies: the gate decodes them itself so it can fail closed on any shape. */
export async function fetchCapabilitiesRaw(): Promise<unknown> {
  return (await api.get(`${FOOD}/me/capabilities`)).data
}

export async function fetchRestaurantsRaw(): Promise<unknown> {
  return (await api.get(`${P}/restaurants`)).data
}

export interface NewRestaurant {
  name: string
  displayName: string
  legalName: string
  phone: string
  email: string
  addressLine1: string
  city: string
}

/** POST /partner/restaurants: name, address_line1 and city are required server-side (ops.go). */
export async function createRestaurant(r: NewRestaurant) {
  const res = await api.post(`${P}/restaurants`, {
    name: r.name.trim(),
    display_name: r.displayName.trim() || r.name.trim(),
    legal_name: r.legalName.trim(),
    phone: r.phone.trim(),
    email: r.email.trim(),
    address_line1: r.addressLine1.trim(),
    city: r.city.trim(),
  })
  return decodePartnerRestaurant(envelopeData(res.data))
}

// ── Restaurant + onboarding ──────────────────────────────────────────────

export const fetchRestaurant = async (id: string) => decodePartnerRestaurant(await get(`${P}/restaurants/${id}`))
export const fetchReadiness = async (id: string) => decodeReadiness(await get(`${P}/restaurants/${id}/readiness`))

export interface BasicsPatch {
  name: string
  displayName: string
  description: string
  phone: string
  email: string
  minOrderPaise: Paise
  packagingFeePaise: Paise
}

export async function patchBasics(id: string, b: BasicsPatch) {
  const res = await api.patch(`${P}/restaurants/${id}`, {
    name: b.name.trim(),
    display_name: b.displayName.trim(),
    description: b.description.trim(),
    phone: b.phone.trim(),
    email: b.email.trim(),
    // This route has no *_paise fields yet: float rupees computed from paise.
    min_order_amount: paiseToWireRupees(b.minOrderPaise),
    packaging_fee: paiseToWireRupees(b.packagingFeePaise),
  })
  return decodePartnerRestaurant(envelopeData(res.data))
}

export const fetchCompliance = async (id: string) => decodeCompliance(await get(`${P}/restaurants/${id}/compliance`))
export async function putCompliance(id: string, body: ComplianceBody) {
  return decodeCompliance(envelopeData((await api.put(`${P}/restaurants/${id}/compliance`, body)).data))
}

export interface LocationBody {
  latitude: number
  longitude: number
  address_line1: string
  address_line2: string
  city: string
  state: string
  postal_code: string
  delivery_radius_km: number
}

export const fetchLocation = async (id: string) => decodeLocation(await get(`${P}/restaurants/${id}/location`))
export async function putLocation(id: string, body: LocationBody) {
  return decodeLocation(envelopeData((await api.put(`${P}/restaurants/${id}/location`, body)).data))
}

export const fetchHours = async (id: string) => decodeOperatingHours(await get(`${P}/restaurants/${id}/operating-hours`))
export async function putHours(id: string, windows: WindowBody[]) {
  return decodeOperatingHours(envelopeData((await api.put(`${P}/restaurants/${id}/operating-hours`, { windows })).data))
}

export const fetchFssai = async (id: string) => decodeFssai(await get(`${P}/restaurants/${id}/fssai`))
export async function putFssai(id: string, body: { licence_number: string; expires_at: string; media_id: string }) {
  return decodeFssai(envelopeData((await api.put(`${P}/restaurants/${id}/fssai`, body)).data))
}

export const fetchPayout = async (id: string) => decodePayoutAccount(await get(`${P}/restaurants/${id}/payout-account`))
export async function putPayout(id: string, body: { holder_name: string; account_number: string; ifsc: string }) {
  return decodePayoutAccount(envelopeData((await api.put(`${P}/restaurants/${id}/payout-account`, body)).data))
}

export async function submitForReview(id: string) {
  return decodeSubmit(envelopeData((await api.post(`${P}/restaurants/${id}/submit`, {})).data))
}

export async function setAccepting(id: string, accepting: boolean) {
  return decodeAccepting(envelopeData((await api.patch(`${P}/restaurants/${id}/accepting`, { is_accepting_orders: accepting })).data))
}

/**
 * An image through the web's one media flow (src/lib/mediaUpload.ts:
 * init → presigned PUT → confirm). No upload lease is requested: food-service
 * references the media id without telling media-service, so a leased upload
 * could be reclaimed while under review.
 */
export async function uploadImage(file: File): Promise<string> {
  return uploadMedia(file, "image", "general")
}

// ── Menu ─────────────────────────────────────────────────────────────────

export const fetchMenu = async (id: string) => decodeMenuCategories(await get(`${P}/restaurants/${id}/menu/categories`))

export async function createCategory(restaurantId: string, name: string, sortOrder: number) {
  return (await api.post(`${P}/restaurants/${restaurantId}/menu/categories`, { name: name.trim(), description: "", sort_order: sortOrder })).data
}
export async function updateCategory(categoryId: string, name: string, description: string, sortOrder: number) {
  return (await api.patch(`${P}/menu/categories/${categoryId}`, { name: name.trim(), description, sort_order: sortOrder })).data
}
export async function deleteCategory(categoryId: string) {
  await api.delete(`${P}/menu/categories/${categoryId}`)
}

export interface DishForm {
  categoryId: string
  name: string
  description: string
  foodType: "VEG" | "NON_VEG" | "EGG"
  basePricePaise: Paise
  discountPricePaise: Paise | null
  preparationMinutes: number
  isRecommended: boolean
  taxPercentage: number
  imageMediaId: string | null
  /** Kept on update: the route REPLACES every field. */
  imageUrl: string | null
}

/**
 * The dish body. The dish routes take float rupees only (no base_price_paise
 * on create/update yet), so the rupee number is derived from paise here and
 * nowhere else.
 */
export function dishBody(d: DishForm, includeCategory: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: d.name.trim(),
    description: d.description.trim(),
    food_type: d.foodType,
    base_price: paiseToWireRupees(d.basePricePaise),
    discount_price: d.discountPricePaise === null ? null : paiseToWireRupees(d.discountPricePaise),
    image_url: d.imageUrl ?? "",
    preparation_minutes: d.preparationMinutes,
    is_recommended: d.isRecommended,
    tax_percentage: d.taxPercentage,
    image_media_id: d.imageMediaId ?? "",
  }
  if (includeCategory) body.category_id = d.categoryId
  return body
}

export async function createDish(restaurantId: string, d: DishForm) {
  return decodeMenuItem(envelopeData((await api.post(`${P}/restaurants/${restaurantId}/menu/items`, dishBody(d, true))).data))
}
export async function updateDish(itemId: string, d: DishForm) {
  return decodeMenuItem(envelopeData((await api.patch(`${P}/menu/items/${itemId}`, dishBody(d, false))).data))
}
export async function deleteDish(itemId: string) {
  await api.delete(`${P}/menu/items/${itemId}`)
}
/** `false` must reach the wire: the body is always explicit. */
export async function setDishAvailable(itemId: string, isAvailable: boolean) {
  await api.patch(`${P}/menu/items/${itemId}/availability`, { is_available: isAvailable })
}
export const fetchDish = async (itemId: string) => decodeMenuItemDetail(await get(`${P}/menu/items/${itemId}`))

export interface OptionBody {
  name?: string
  price_paise?: Paise
  is_available?: boolean
  sort_order?: number
}

export async function createVariant(itemId: string, b: OptionBody) {
  return decodePricedOption(envelopeData((await api.post(`${P}/menu/items/${itemId}/variants`, b)).data), "variant")
}
export async function updateVariant(itemId: string, variantId: string, b: OptionBody) {
  return decodePricedOption(envelopeData((await api.patch(`${P}/menu/items/${itemId}/variants/${variantId}`, b)).data), "variant")
}
export async function deleteVariant(itemId: string, variantId: string) {
  await api.delete(`${P}/menu/items/${itemId}/variants/${variantId}`)
}

export interface GroupBody {
  name?: string
  min_select?: number
  max_select?: number
  is_required?: boolean
  sort_order?: number
}

export async function createAddonGroup(itemId: string, b: GroupBody) {
  return decodeAddonGroup(envelopeData((await api.post(`${P}/menu/items/${itemId}/addon-groups`, b)).data))
}
export async function updateAddonGroup(itemId: string, groupId: string, b: GroupBody) {
  return decodeAddonGroup(envelopeData((await api.patch(`${P}/menu/items/${itemId}/addon-groups/${groupId}`, b)).data))
}
export async function deleteAddonGroup(itemId: string, groupId: string) {
  await api.delete(`${P}/menu/items/${itemId}/addon-groups/${groupId}`)
}
export async function createAddon(itemId: string, groupId: string, b: OptionBody) {
  return decodePricedOption(envelopeData((await api.post(`${P}/menu/items/${itemId}/addon-groups/${groupId}/addons`, b)).data), "addon")
}
export async function updateAddon(itemId: string, groupId: string, addonId: string, b: OptionBody) {
  return decodePricedOption(envelopeData((await api.patch(`${P}/menu/items/${itemId}/addon-groups/${groupId}/addons/${addonId}`, b)).data), "addon")
}
export async function deleteAddon(itemId: string, groupId: string, addonId: string) {
  await api.delete(`${P}/menu/items/${itemId}/addon-groups/${groupId}/addons/${addonId}`)
}

// ── Orders ───────────────────────────────────────────────────────────────

export const fetchQueue = async (restaurantId: string) => decodeKitchenQueue(await get(`${P}/restaurants/${restaurantId}/kitchen-queue`))
export const fetchOrders = async (restaurantId: string) => decodePartnerOrders(await get(`${P}/restaurants/${restaurantId}/orders`))
export const fetchOrder = async (orderId: string) => decodePartnerOrder(await get(`${P}/orders/${orderId}`))

export async function transitionOrder(orderId: string, action: OrderAction, idempotencyKey: string, reason?: string) {
  const res = await api.post(`${P}/orders/${orderId}/${action}`, reason ? { reason } : {}, {
    headers: { "Idempotency-Key": idempotencyKey },
  })
  return decodePartnerOrder(envelopeData(res.data))
}

export async function verifyPickup(orderId: string, code: string): Promise<void> {
  await api.post(`${P}/orders/${orderId}/verify-pickup`, { code })
}

// ── Realtime ─────────────────────────────────────────────────────────────

export async function issueRestaurantToken(restaurantId: string) {
  return decodeRealtimeToken(envelopeData((await api.post(`${FOOD}/realtime/token`, { scope: "restaurant", id: restaurantId })).data))
}

/** notification-service's SSE route, through the same /v1 hop. Token and topics ride the query: EventSource sets no headers. */
export function sseUrl(token: string, topics: readonly string[]): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  return `${base}/v1/realtime/sse?topics=${encodeURIComponent(topics.join(","))}&token=${encodeURIComponent(token)}`
}

// ── Earnings ─────────────────────────────────────────────────────────────

export const fetchSummary = async (restaurantId: string) => decodeSummary(await get(`${P}/restaurants/${restaurantId}/reports/summary`))
export const fetchSettlements = async (restaurantId: string) => decodeSettlements(await get(`${P}/restaurants/${restaurantId}/settlements`))
