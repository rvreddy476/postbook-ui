/*
  The Kitchen console's wire shapes, decoded strictly from food-service's
  golden fixtures (Architecture/services/food-service/internal/http/testdata/
  contracts, copied byte-identical into ../__tests__/contracts).

  Money: only `*_paise` fields are decoded as money. Where a route has no
  paise sibling (restaurant min order / packaging fee) the float is decoded
  through wireRupeesToPaise and the gap is reported to the backend.
*/

import {
  bool,
  ContractError,
  int,
  num,
  obj,
  optArr,
  optNum,
  optPaise,
  optStr,
  paise,
  str,
  strArr,
  type Obj,
} from "./decode"
import { wireRupeesToPaise, type Paise } from "./money"

// ── Capabilities ─────────────────────────────────────────────────────────

export interface Capabilities {
  userId: string
  isRestaurantOwner: boolean
  isCustomer: boolean
  isDeliveryPartner: boolean
  isAdmin: boolean
  isModerator: boolean
}

export function decodeCapabilities(data: unknown): Capabilities {
  const o = obj(data, "capabilities")
  return {
    userId: str(o, "user_id", "capabilities"),
    isRestaurantOwner: bool(o, "is_restaurant_owner", "capabilities"),
    isCustomer: bool(o, "is_customer", "capabilities"),
    isDeliveryPartner: bool(o, "is_delivery_partner", "capabilities"),
    isAdmin: bool(o, "is_admin", "capabilities"),
    isModerator: bool(o, "is_moderator", "capabilities"),
  }
}

// ── Restaurants ──────────────────────────────────────────────────────────

export interface PartnerRestaurant {
  id: string
  name: string
  displayName: string | null
  legalName: string | null
  description: string | null
  status: string
  isOpen: boolean
  isAcceptingOrders: boolean
  city: string
  state: string | null
  phone: string | null
  email: string | null
  minOrderPaise: Paise
  packagingFeePaise: Paise
}

function moneyRupees(o: Obj, key: string, path: string): Paise {
  const p = wireRupeesToPaise(num(o, key, path))
  if (p === null) throw new ContractError(`${path}.${key}`, "a rupee amount with at most two decimals")
  return p
}

export function decodePartnerRestaurant(data: unknown, path = "restaurant"): PartnerRestaurant {
  const o = obj(data, path)
  return {
    id: str(o, "id", path),
    name: str(o, "name", path),
    displayName: optStr(o, "display_name", path),
    legalName: optStr(o, "legal_name", path),
    description: optStr(o, "description", path),
    status: str(o, "status", path),
    isOpen: bool(o, "is_open", path),
    isAcceptingOrders: bool(o, "is_accepting_orders", path),
    city: str(o, "city", path),
    state: optStr(o, "state", path),
    phone: optStr(o, "phone", path),
    email: optStr(o, "email", path),
    minOrderPaise: moneyRupees(o, "min_order_amount", path),
    packagingFeePaise: moneyRupees(o, "packaging_fee", path),
  }
}

export function decodeRestaurantList(data: unknown): PartnerRestaurant[] {
  const o = obj(data, "restaurants")
  return optArr(o, "items", "restaurants").map((r, i) => decodePartnerRestaurant(r, `restaurants.items[${i}]`))
}

// ── Readiness / submit ───────────────────────────────────────────────────

export interface Readiness {
  restaurantId: string
  ready: boolean
  missing: string[]
  status: string
  canSubmit: boolean
}

export function decodeReadiness(data: unknown): Readiness {
  const o = obj(data, "readiness")
  return {
    restaurantId: str(o, "restaurant_id", "readiness"),
    ready: bool(o, "ready", "readiness"),
    missing: strArr(o, "missing", "readiness"),
    status: str(o, "status", "readiness"),
    canSubmit: bool(o, "can_submit", "readiness"),
  }
}

export interface SubmitResult {
  restaurantId: string
  status: string
  missing: string[]
}

export function decodeSubmit(data: unknown): SubmitResult {
  const o = obj(data, "submit")
  return { restaurantId: str(o, "restaurant_id", "submit"), status: str(o, "status", "submit"), missing: strArr(o, "missing", "submit") }
}

export interface AcceptingResult {
  restaurantId: string
  status: string
  isAcceptingOrders: boolean
}

export function decodeAccepting(data: unknown): AcceptingResult {
  const o = obj(data, "accepting")
  return {
    restaurantId: str(o, "restaurant_id", "accepting"),
    status: str(o, "status", "accepting"),
    isAcceptingOrders: bool(o, "is_accepting_orders", "accepting"),
  }
}

// ── Onboarding steps ─────────────────────────────────────────────────────

export interface Compliance {
  taxCategory: string
  legalName: string
  gstin: string | null
  gstinStateCode: string | null
  panMasked: string
  panHolderType: string
  specifiedPremisesDeclaredAt: string | null
  gstLiability: string
  gstinRequired: boolean
}

export function decodeCompliance(data: unknown): Compliance {
  const o = obj(data, "compliance")
  const p = "compliance"
  return {
    taxCategory: str(o, "tax_category", p),
    legalName: str(o, "legal_name", p),
    gstin: optStr(o, "gstin", p),
    gstinStateCode: optStr(o, "gstin_state_code", p),
    panMasked: str(o, "pan_masked", p),
    panHolderType: str(o, "pan_holder_type", p),
    specifiedPremisesDeclaredAt: optStr(o, "specified_premises_declared_at", p),
    gstLiability: str(o, "gst_liability", p),
    gstinRequired: bool(o, "gstin_required", p),
  }
}

export interface Location {
  latitude: number
  longitude: number
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  postalCode: string | null
  deliveryRadiusKm: number
  serviceAreaId: string | null
}

export function decodeLocation(data: unknown): Location {
  const o = obj(data, "location")
  const p = "location"
  return {
    latitude: num(o, "latitude", p),
    longitude: num(o, "longitude", p),
    addressLine1: str(o, "address_line1", p),
    addressLine2: optStr(o, "address_line2", p),
    city: str(o, "city", p),
    state: str(o, "state", p),
    postalCode: optStr(o, "postal_code", p),
    deliveryRadiusKm: num(o, "delivery_radius_km", p),
    serviceAreaId: optStr(o, "service_area_id", p),
  }
}

export interface HoursWindow {
  dayOfWeek: number
  opensAt: string
  closesAt: string
  isClosed: boolean
  overnight: boolean
}

export interface OperatingHours {
  timezone: string
  isOpenNow: boolean
  windows: HoursWindow[]
}

export function decodeOperatingHours(data: unknown): OperatingHours {
  const o = obj(data, "hours")
  return {
    timezone: str(o, "timezone", "hours"),
    isOpenNow: bool(o, "is_open_now", "hours"),
    windows: optArr(o, "windows", "hours").map((w, i) => {
      const p = `hours.windows[${i}]`
      const x = obj(w, p)
      const day = int(x, "day_of_week", p)
      if (day < 0 || day > 6) throw new ContractError(`${p}.day_of_week`, "0..6")
      return {
        dayOfWeek: day,
        opensAt: str(x, "opens_at", p),
        closesAt: str(x, "closes_at", p),
        isClosed: bool(x, "is_closed", p),
        overnight: bool(x, "overnight", p),
      }
    }),
  }
}

export interface FssaiDocument {
  id: string
  status: string
  rejectionReason: string | null
  expiresAt: string | null
}

export interface Fssai {
  licenceNumber: string | null
  expiresAt: string | null
  document: FssaiDocument | null
  documentStatus: string | null
  reviewReason: string | null
}

export function decodeFssai(data: unknown): Fssai {
  const o = obj(data, "fssai")
  const p = "fssai"
  let document: FssaiDocument | null = null
  if (o.document !== undefined && o.document !== null) {
    const d = obj(o.document, `${p}.document`)
    document = {
      id: str(d, "id", `${p}.document`),
      status: str(d, "status", `${p}.document`),
      rejectionReason: optStr(d, "rejection_reason", `${p}.document`),
      expiresAt: optStr(d, "expires_at", `${p}.document`),
    }
  }
  return {
    licenceNumber: optStr(o, "fssai_licence_number", p),
    expiresAt: optStr(o, "fssai_expires_at", p),
    document,
    // The PUT answer carries no document_status; the document's own status stands in.
    documentStatus: optStr(o, "document_status", p) ?? document?.status ?? null,
    reviewReason: optStr(o, "review_reason", p) ?? document?.rejectionReason ?? null,
  }
}

/** The bank account, MASKED. The full number is never part of any response. */
export interface PayoutAccount {
  holderName: string
  accountNumberMasked: string
  ifsc: string
  verificationStatus: string
  verificationReason: string | null
}

export function decodePayoutAccount(data: unknown): PayoutAccount {
  const o = obj(data, "payout")
  const p = "payout"
  const masked = str(o, "account_number_masked", p)
  // Fail closed if a response ever carried more than the last four digits.
  if (/\d{5,}/.test(masked)) throw new ContractError(`${p}.account_number_masked`, "masked")
  return {
    holderName: str(o, "holder_name", p),
    accountNumberMasked: masked,
    ifsc: str(o, "ifsc", p),
    verificationStatus: str(o, "verification_status", p),
    verificationReason: optStr(o, "verification_reason", p),
  }
}

// ── Menu ─────────────────────────────────────────────────────────────────

export interface MenuItem {
  id: string
  categoryId: string | null
  name: string
  description: string | null
  foodType: string
  basePricePaise: Paise
  discountPricePaise: Paise | null
  imageUrl: string | null
  imageMediaId: string | null
  preparationMinutes: number
  isAvailable: boolean
  isRecommended: boolean
  taxPercentage: number
}

export function decodeMenuItem(data: unknown, path = "item"): MenuItem {
  const o = obj(data, path)
  return {
    id: str(o, "id", path),
    categoryId: optStr(o, "category_id", path),
    name: str(o, "name", path),
    description: optStr(o, "description", path),
    foodType: str(o, "food_type", path),
    basePricePaise: paise(o, "base_price_paise", path),
    discountPricePaise: optPaise(o, "discount_price_paise", path),
    imageUrl: optStr(o, "image_url", path),
    imageMediaId: optStr(o, "image_media_id", path),
    preparationMinutes: int(o, "preparation_minutes", path),
    isAvailable: bool(o, "is_available", path),
    isRecommended: bool(o, "is_recommended", path),
    taxPercentage: num(o, "tax_percentage", path),
  }
}

export interface MenuCategory {
  id: string
  name: string
  description: string | null
  sortOrder: number
  items: MenuItem[]
}

export function decodeMenuCategories(data: unknown): MenuCategory[] {
  const o = obj(data, "menu")
  return optArr(o, "items", "menu").map((c, i) => {
    const p = `menu.items[${i}]`
    const x = obj(c, p)
    return {
      id: str(x, "id", p),
      name: str(x, "name", p),
      description: optStr(x, "description", p),
      sortOrder: int(x, "sort_order", p),
      items: optArr(x, "items", p).map((it, j) => decodeMenuItem(it, `${p}.items[${j}]`)),
    }
  })
}

/** A variant or an add-on: both are a name, a paise price, availability and an order. */
export interface PricedOption {
  id: string
  name: string
  pricePaise: Paise
  isAvailable: boolean
  sortOrder: number
}

export function decodePricedOption(data: unknown, path: string): PricedOption {
  const o = obj(data, path)
  return {
    id: str(o, "id", path),
    name: str(o, "name", path),
    pricePaise: paise(o, "price_paise", path),
    isAvailable: bool(o, "is_available", path),
    sortOrder: int(o, "sort_order", path),
  }
}

export interface AddonGroup {
  id: string
  name: string
  minSelect: number
  maxSelect: number
  isRequired: boolean
  sortOrder: number
  addons: PricedOption[]
}

export function decodeAddonGroup(data: unknown, path = "group"): AddonGroup {
  const o = obj(data, path)
  return {
    id: str(o, "id", path),
    name: str(o, "name", path),
    minSelect: int(o, "min_select", path),
    maxSelect: int(o, "max_select", path),
    isRequired: bool(o, "is_required", path),
    sortOrder: int(o, "sort_order", path),
    addons: optArr(o, "addons", path).map((a, i) => decodePricedOption(a, `${path}.addons[${i}]`)),
  }
}

export interface MenuItemDetail extends MenuItem {
  variants: PricedOption[]
  addonGroups: AddonGroup[]
}

export function decodeMenuItemDetail(data: unknown): MenuItemDetail {
  const base = decodeMenuItem(data, "item")
  const o = obj(data, "item")
  return {
    ...base,
    variants: optArr(o, "variants", "item").map((v, i) => decodePricedOption(v, `item.variants[${i}]`)),
    addonGroups: optArr(o, "addon_groups", "item").map((g, i) => decodeAddonGroup(g, `item.addon_groups[${i}]`)),
  }
}

// ── Orders ───────────────────────────────────────────────────────────────

/** A CONFIRMED order awaiting accept (kitchen-queue). */
export interface QueueOrder {
  id: string
  orderNumber: string
  status: string
  finalAmountPaise: Paise
  itemCount: number
  customerInstruction: string | null
  placedAt: string | null
  /** Seconds left to accept, as the server computed it at response time. */
  secondsToBreach: number | null
  acceptDeadlineAt: string | null
}

export function decodeKitchenQueue(data: unknown): QueueOrder[] {
  const o = obj(data, "queue")
  return optArr(o, "orders", "queue").map((r, i) => {
    const p = `queue.orders[${i}]`
    const x = obj(r, p)
    const seconds = optNum(x, "seconds_to_breach", p)
    return {
      id: str(x, "id", p),
      orderNumber: str(x, "order_number", p),
      status: str(x, "status", p),
      finalAmountPaise: paise(x, "final_amount_paise", p),
      itemCount: int(x, "item_count", p),
      customerInstruction: optStr(x, "customer_instruction", p),
      placedAt: optStr(x, "placed_at", p),
      secondsToBreach: seconds,
      acceptDeadlineAt: optStr(x, "accept_deadline_at_rfc3339", p) ?? optStr(x, "accept_deadline_at", p),
    }
  })
}

export interface OrderLine {
  id: string
  name: string
  foodType: string
  quantity: number
  unitPricePaise: Paise
  lineTotalPaise: Paise
  instruction: string | null
}

export interface PartnerOrder {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  paymentMethod: string
  estimatedPreparationMinutes: number | null
  placedAt: string | null
  items: OrderLine[]
  finalAmountPaise: Paise
}

export function decodePartnerOrder(data: unknown, path = "order"): PartnerOrder {
  const o = obj(data, path)
  const totals = obj(o.totals, `${path}.totals`)
  return {
    id: str(o, "id", path),
    orderNumber: str(o, "order_number", path),
    status: str(o, "status", path),
    paymentStatus: str(o, "payment_status", path),
    paymentMethod: str(o, "payment_method", path),
    estimatedPreparationMinutes: optNum(o, "estimated_preparation_minutes", path),
    placedAt: optStr(o, "placed_at", path),
    items: optArr(o, "items", path).map((it, i) => {
      const p = `${path}.items[${i}]`
      const x = obj(it, p)
      return {
        id: str(x, "id", p),
        name: str(x, "name", p),
        foodType: str(x, "food_type", p),
        quantity: int(x, "quantity", p),
        unitPricePaise: paise(x, "unit_price_paise", p),
        lineTotalPaise: paise(x, "line_total_paise", p),
        instruction: optStr(x, "instruction", p),
      }
    }),
    finalAmountPaise: paise(totals, "final_amount_paise", `${path}.totals`),
  }
}

export function decodePartnerOrders(data: unknown): PartnerOrder[] {
  const o = obj(data, "orders")
  return optArr(o, "items", "orders").map((r, i) => decodePartnerOrder(r, `orders.items[${i}]`))
}

// ── Realtime ─────────────────────────────────────────────────────────────

export interface RealtimeToken {
  token: string
  scope: string
  topics: string[]
  ttlSeconds: number
}

export function decodeRealtimeToken(data: unknown): RealtimeToken {
  const o = obj(data, "realtime")
  const token = str(o, "token", "realtime")
  if (!token) throw new ContractError("realtime.token", "non-empty")
  return { token, scope: str(o, "scope", "realtime"), topics: strArr(o, "topics", "realtime"), ttlSeconds: int(o, "ttl_seconds", "realtime") }
}

// ── Earnings ─────────────────────────────────────────────────────────────

export interface EarningsSummary {
  orders: number
  delivered: number
  refunded: number
  grossPaise: Paise
  commissionPaise: Paise
  refundsPaise: Paise
  payoutPaise: Paise
}

export function decodeSummary(data: unknown): EarningsSummary {
  const o = obj(data, "summary")
  const p = "summary"
  return {
    orders: int(o, "orders", p),
    delivered: int(o, "delivered", p),
    refunded: int(o, "refunded", p),
    grossPaise: paise(o, "gross_amount_paise", p),
    commissionPaise: paise(o, "commission_paise", p),
    refundsPaise: paise(o, "refunds_paise", p),
    payoutPaise: paise(o, "payout_amount_paise", p),
  }
}

export interface Settlement {
  id: string
  periodStart: string
  periodEnd: string
  grossPaise: Paise
  commissionPaise: Paise
  refundAdjustmentPaise: Paise
  penaltyPaise: Paise
  payoutPaise: Paise
  status: string
  paidReference: string | null
  paidAt: string | null
}

export function decodeSettlements(data: unknown): Settlement[] {
  const o = obj(data, "settlements")
  if (!("items" in o)) throw new ContractError("settlements.items", "present")
  return optArr(o, "items", "settlements").map((s, i) => {
    const p = `settlements.items[${i}]`
    const x = obj(s, p)
    return {
      id: str(x, "id", p),
      periodStart: str(x, "period_start", p),
      periodEnd: str(x, "period_end", p),
      grossPaise: paise(x, "gross_amount_paise", p),
      commissionPaise: paise(x, "commission_paise", p),
      refundAdjustmentPaise: paise(x, "refund_adjustment_paise", p),
      penaltyPaise: paise(x, "penalty_amount_paise", p),
      payoutPaise: paise(x, "payout_amount_paise", p),
      status: str(x, "status", p),
      // Go writes "" for an unpaid settlement; read empty as absent.
      paidReference: optStr(x, "paid_reference", p) || null,
      paidAt: optStr(x, "paid_at", p) || null,
    }
  })
}
