/*
  food-service's customer wire, decoded into the shapes the screens use.

  Pinned by the golden fixtures in __tests__/contracts (copied byte for byte
  from food-service/internal/http/testdata/contracts). Every amount here is
  integer paise: the `*_paise` field when the server sent one, otherwise the
  legacy rupee decimal converted through its string (money.ts).
*/

import {
  arr,
  at,
  boolOr,
  intOr,
  obj,
  optBool,
  optInt,
  optNum,
  optObj,
  optPaise,
  optStr,
  paiseOr,
  reqStr,
  strArr,
  strOr,
  type Ctx,
  type Obj,
  WireError,
} from "./decode"
import { rupeesToPaise } from "./money"

/** `*_paise` when present, else the rupee field through its decimal string, else null. */
function paiseOrRupees(o: Obj, paiseKey: string, rupeeKey: string, ctx: Ctx): number | null {
  const p = optPaise(o, paiseKey, ctx)
  if (p !== null) return p
  const r = o[rupeeKey]
  if (r === undefined || r === null) return null
  const converted = rupeesToPaise(r)
  if (converted === null) throw new WireError(at(ctx, rupeeKey).path, "not a rupee amount")
  return converted
}

function rupeesOnly(o: Obj, key: string, ctx: Ctx): number | null {
  const r = o[key]
  if (r === undefined || r === null) return null
  const converted = rupeesToPaise(r)
  if (converted === null) throw new WireError(at(ctx, key).path, "not a rupee amount")
  return converted
}

/* ── restaurants ──────────────────────────────────────────────────── */

export interface Restaurant {
  id: string
  name: string
  slug: string
  description: string | null
  city: string
  state: string | null
  status: string
  isOpen: boolean
  isAcceptingOrders: boolean
  avgRating: number | null
  ratingCount: number
  minOrderPaise: number | null
  packagingFeePaise: number | null
  avgPreparationMinutes: number
  heroImageUrl: string | null
  cuisines: string[]
  estimatedDelivery: string
  deliveryFeeEstimatePaise: number | null
  isOpenNow: boolean | null
  nextOpensAt: string | null
  distanceMeters: number | null
  serviceable: boolean | null
  unserviceableReasonCode: string | null
  unserviceableMessage: string | null
  phone: string | null
  addressLine: string | null
  postalCode: string | null
  latitude: number | null
  longitude: number | null
}

const RESTAURANT_KEYS = [
  "id", "name", "slug", "description", "city", "state", "status", "is_open", "is_accepting_orders", "avg_rating",
  "rating_count", "min_order_amount", "packaging_fee", "avg_preparation_minutes", "hero_image_url", "cuisines",
  "estimated_delivery", "delivery_fee_estimate", "is_open_now", "next_opens_at", "distance_meters", "serviceable",
  "unserviceable_reason_code", "unserviceable_message", "phone", "email", "address_line", "postal_code", "latitude",
  "longitude", "owner_user_id", "created_at", "updated_at",
] as const

export function decodeRestaurant(raw: unknown, ctx: Ctx): Restaurant {
  const o = obj(raw, ctx, RESTAURANT_KEYS)
  return {
    id: reqStr(o, "id", ctx),
    name: strOr(o, "name", ctx),
    slug: strOr(o, "slug", ctx),
    description: optStr(o, "description", ctx),
    city: strOr(o, "city", ctx),
    state: optStr(o, "state", ctx),
    status: strOr(o, "status", ctx),
    isOpen: boolOr(o, "is_open", ctx),
    isAcceptingOrders: boolOr(o, "is_accepting_orders", ctx),
    avgRating: optNum(o, "avg_rating", ctx),
    ratingCount: intOr(o, "rating_count", ctx),
    minOrderPaise: rupeesOnly(o, "min_order_amount", ctx),
    packagingFeePaise: rupeesOnly(o, "packaging_fee", ctx),
    avgPreparationMinutes: intOr(o, "avg_preparation_minutes", ctx),
    heroImageUrl: optStr(o, "hero_image_url", ctx),
    cuisines: strArr(o, "cuisines", ctx),
    estimatedDelivery: strOr(o, "estimated_delivery", ctx),
    deliveryFeeEstimatePaise: rupeesOnly(o, "delivery_fee_estimate", ctx),
    isOpenNow: optBool(o, "is_open_now", ctx),
    nextOpensAt: optStr(o, "next_opens_at", ctx),
    distanceMeters: optNum(o, "distance_meters", ctx),
    serviceable: optBool(o, "serviceable", ctx),
    unserviceableReasonCode: optStr(o, "unserviceable_reason_code", ctx),
    unserviceableMessage: optStr(o, "unserviceable_message", ctx),
    phone: optStr(o, "phone", ctx),
    addressLine: optStr(o, "address_line", ctx),
    postalCode: optStr(o, "postal_code", ctx),
    latitude: optNum(o, "latitude", ctx),
    longitude: optNum(o, "longitude", ctx),
  }
}

export function decodeRestaurantList(raw: unknown, ctx: Ctx): Restaurant[] {
  const o = obj(raw, ctx, ["items", "next_cursor", "total"])
  return arr(o, "items", ctx, decodeRestaurant)
}

/* ── menu ─────────────────────────────────────────────────────────── */

export interface Variant {
  id: string
  name: string
  pricePaise: number
  isAvailable: boolean
  sortOrder: number
}

export interface Addon {
  id: string
  name: string
  pricePaise: number
  isAvailable: boolean
  sortOrder: number
}

export interface AddonGroup {
  id: string
  name: string
  minSelect: number
  maxSelect: number
  isRequired: boolean
  sortOrder: number
  addons: Addon[]
}

export interface MenuItem {
  id: string
  restaurantId: string
  categoryId: string | null
  name: string
  description: string | null
  foodType: string
  basePricePaise: number
  discountPricePaise: number | null
  imageUrl: string | null
  preparationMinutes: number
  isAvailable: boolean
  isRecommended: boolean
  variants: Variant[]
  addonGroups: AddonGroup[]
}

export interface MenuCategory {
  id: string
  name: string
  description: string | null
  sortOrder: number
  items: MenuItem[]
}

export interface Menu {
  categories: MenuCategory[]
}

function decodeVariant(raw: unknown, ctx: Ctx): Variant {
  const o = obj(raw, ctx, ["id", "menu_item_id", "name", "price", "price_paise", "is_available", "sort_order"])
  return {
    id: reqStr(o, "id", ctx),
    name: strOr(o, "name", ctx),
    pricePaise: paiseOrRupees(o, "price_paise", "price", ctx) ?? 0,
    isAvailable: boolOr(o, "is_available", ctx, true),
    sortOrder: intOr(o, "sort_order", ctx),
  }
}

function decodeAddon(raw: unknown, ctx: Ctx): Addon {
  const o = obj(raw, ctx, ["id", "addon_group_id", "name", "price", "price_paise", "is_available", "sort_order"])
  return {
    id: reqStr(o, "id", ctx),
    name: strOr(o, "name", ctx),
    pricePaise: paiseOrRupees(o, "price_paise", "price", ctx) ?? 0,
    isAvailable: boolOr(o, "is_available", ctx, true),
    sortOrder: intOr(o, "sort_order", ctx),
  }
}

function decodeAddonGroup(raw: unknown, ctx: Ctx): AddonGroup {
  const o = obj(raw, ctx, ["id", "menu_item_id", "name", "min_select", "max_select", "is_required", "sort_order", "addons"])
  return {
    id: reqStr(o, "id", ctx),
    name: strOr(o, "name", ctx),
    minSelect: intOr(o, "min_select", ctx),
    maxSelect: intOr(o, "max_select", ctx),
    isRequired: boolOr(o, "is_required", ctx),
    sortOrder: intOr(o, "sort_order", ctx),
    addons: arr(o, "addons", ctx, decodeAddon),
  }
}

const MENU_ITEM_KEYS = [
  "id", "restaurant_id", "category_id", "name", "description", "food_type", "base_price", "discount_price",
  "image_url", "preparation_minutes", "is_available", "is_recommended", "tax_percentage", "base_price_paise",
  "discount_price_paise", "variants", "addon_groups", "stock_quantity", "moderation_status", "sort_order",
] as const

export function decodeMenuItem(raw: unknown, ctx: Ctx): MenuItem {
  const o = obj(raw, ctx, MENU_ITEM_KEYS)
  return {
    id: reqStr(o, "id", ctx),
    restaurantId: strOr(o, "restaurant_id", ctx),
    categoryId: optStr(o, "category_id", ctx),
    name: strOr(o, "name", ctx),
    description: optStr(o, "description", ctx),
    foodType: strOr(o, "food_type", ctx),
    basePricePaise: paiseOrRupees(o, "base_price_paise", "base_price", ctx) ?? 0,
    discountPricePaise: paiseOrRupees(o, "discount_price_paise", "discount_price", ctx),
    imageUrl: optStr(o, "image_url", ctx),
    preparationMinutes: intOr(o, "preparation_minutes", ctx),
    isAvailable: boolOr(o, "is_available", ctx),
    isRecommended: boolOr(o, "is_recommended", ctx),
    variants: arr(o, "variants", ctx, decodeVariant),
    addonGroups: arr(o, "addon_groups", ctx, decodeAddonGroup),
  }
}

export function decodeMenu(raw: unknown, ctx: Ctx): Menu {
  const o = obj(raw, ctx, ["categories"])
  return {
    categories: arr(o, "categories", ctx, (r, c) => {
      const cat = obj(r, c, ["id", "name", "description", "sort_order", "items"])
      return {
        id: reqStr(cat, "id", c),
        name: strOr(cat, "name", c),
        description: optStr(cat, "description", c),
        sortOrder: intOr(cat, "sort_order", c),
        items: arr(cat, "items", c, decodeMenuItem),
      }
    }),
  }
}

/* ── money blocks ─────────────────────────────────────────────────── */

export interface TotalsPaise {
  itemSubtotal: number
  addonTotal: number
  packagingFee: number
  deliveryFee: number
  platformFee: number
  taxTotal: number
  discountTotal: number
  finalAmount: number
}

export function decodeTotalsPaise(raw: unknown, ctx: Ctx): TotalsPaise {
  const o = obj(raw, ctx, [
    "item_subtotal_paise", "addon_total_paise", "packaging_fee_paise", "delivery_fee_paise", "platform_fee_paise",
    "tax_total_paise", "discount_total_paise", "final_amount_paise",
  ])
  const final = optPaise(o, "final_amount_paise", ctx)
  if (final === null) throw new WireError(at(ctx, "final_amount_paise").path, "missing")
  return {
    itemSubtotal: paiseOr(o, "item_subtotal_paise", ctx),
    addonTotal: paiseOr(o, "addon_total_paise", ctx),
    packagingFee: paiseOr(o, "packaging_fee_paise", ctx),
    deliveryFee: paiseOr(o, "delivery_fee_paise", ctx),
    platformFee: paiseOr(o, "platform_fee_paise", ctx),
    taxTotal: paiseOr(o, "tax_total_paise", ctx),
    discountTotal: paiseOr(o, "discount_total_paise", ctx),
    finalAmount: final,
  }
}

/** The legacy rupee `totals` block: only its final amount is ever used, and only when no paise block exists. */
function legacyFinalPaise(raw: unknown, ctx: Ctx): number | null {
  const o = obj(raw, ctx, [
    "item_subtotal", "addon_total", "packaging_fee", "tax_total", "delivery_fee", "platform_fee",
    "restaurant_discount", "coupon_discount", "final_amount",
  ])
  return rupeesOnly(o, "final_amount", ctx)
}

export interface TaxRate {
  rateBp: number
  ratePercent: string
  taxablePaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  taxPaise: number
}

export interface TaxGroup {
  liableParty: string
  liability: string
  label: string
  taxablePaise: number
  taxPaise: number
  rates: TaxRate[]
}

export interface Charge {
  kind: string
  label: string
  amountPaise: number
}

export interface TaxesAndCharges {
  charges: Charge[]
  taxes: TaxGroup[]
  totalChargesPaise: number
  totalTaxPaise: number
  totalTaxesAndChargesPaise: number
  menuPricesTreatedAsExclusive: boolean
  needsAdviserConfirmation: boolean
  adviserNotice: string | null
}

export function decodeTaxesAndCharges(raw: unknown, ctx: Ctx): TaxesAndCharges {
  const o = obj(raw, ctx, [
    "charges", "taxes", "total_charges_paise", "total_tax_paise", "total_taxes_and_charges_paise",
    "menu_prices_treated_as_exclusive", "needs_adviser_confirmation", "adviser_notice",
  ])
  return {
    charges: arr(o, "charges", ctx, (r, c) => {
      const ch = obj(r, c, ["kind", "label", "amount_paise"])
      return { kind: strOr(ch, "kind", c), label: strOr(ch, "label", c), amountPaise: paiseOr(ch, "amount_paise", c) }
    }),
    taxes: arr(o, "taxes", ctx, (r, c) => {
      const t = obj(r, c, ["liable_party", "liability", "label", "taxable_paise", "tax_paise", "rates"])
      return {
        liableParty: strOr(t, "liable_party", c),
        liability: strOr(t, "liability", c),
        label: strOr(t, "label", c),
        taxablePaise: paiseOr(t, "taxable_paise", c),
        taxPaise: paiseOr(t, "tax_paise", c),
        rates: arr(t, "rates", c, (rr, rc) => {
          const rate = obj(rr, rc, [
            "rate_bp", "rate_percent", "taxable_paise", "cgst_paise", "sgst_paise", "igst_paise", "tax_paise",
            "needs_adviser_confirmation",
          ])
          return {
            rateBp: intOr(rate, "rate_bp", rc),
            ratePercent: strOr(rate, "rate_percent", rc),
            taxablePaise: paiseOr(rate, "taxable_paise", rc),
            cgstPaise: paiseOr(rate, "cgst_paise", rc),
            sgstPaise: paiseOr(rate, "sgst_paise", rc),
            igstPaise: paiseOr(rate, "igst_paise", rc),
            taxPaise: paiseOr(rate, "tax_paise", rc),
          }
        }),
      }
    }),
    totalChargesPaise: paiseOr(o, "total_charges_paise", ctx),
    totalTaxPaise: paiseOr(o, "total_tax_paise", ctx),
    totalTaxesAndChargesPaise: paiseOr(o, "total_taxes_and_charges_paise", ctx),
    menuPricesTreatedAsExclusive: boolOr(o, "menu_prices_treated_as_exclusive", ctx),
    needsAdviserConfirmation: boolOr(o, "needs_adviser_confirmation", ctx),
    adviserNotice: optStr(o, "adviser_notice", ctx),
  }
}

/* ── cart ─────────────────────────────────────────────────────────── */

export interface CartAddon {
  addonId: string
  name: string
  quantity: number
  unitPricePaise: number
  lineTotalPaise: number
}

export interface CartItem {
  id: string
  menuItemId: string
  variantId: string | null
  name: string
  foodType: string
  quantity: number
  unitPricePaise: number
  lineTotalPaise: number
  addonTotalPaise: number
  itemInstruction: string | null
  addons: CartAddon[]
}

export interface PricingError {
  code: string
  message: string
}

export interface Cart {
  id: string
  restaurantId: string | null
  restaurantName: string | null
  couponCode: string | null
  items: CartItem[]
  totalsPaise: TotalsPaise | null
  taxesAndCharges: TaxesAndCharges | null
  pricingError: PricingError | null
}

const CART_ITEM_KEYS = [
  "id", "restaurant_id", "menu_item_id", "variant_id", "name", "image_url", "food_type", "quantity", "unit_price",
  "tax_percentage", "tax_amount", "line_total", "item_instruction", "addons", "addon_total", "unit_price_paise",
  "line_total_paise", "addon_total_paise", "tax_amount_paise",
] as const

function decodeCartItem(raw: unknown, ctx: Ctx): CartItem {
  const o = obj(raw, ctx, CART_ITEM_KEYS)
  return {
    id: reqStr(o, "id", ctx),
    menuItemId: strOr(o, "menu_item_id", ctx),
    variantId: optStr(o, "variant_id", ctx),
    name: strOr(o, "name", ctx),
    foodType: strOr(o, "food_type", ctx),
    quantity: intOr(o, "quantity", ctx),
    unitPricePaise: paiseOrRupees(o, "unit_price_paise", "unit_price", ctx) ?? 0,
    lineTotalPaise: paiseOrRupees(o, "line_total_paise", "line_total", ctx) ?? 0,
    addonTotalPaise: paiseOrRupees(o, "addon_total_paise", "addon_total", ctx) ?? 0,
    itemInstruction: optStr(o, "item_instruction", ctx),
    addons: arr(o, "addons", ctx, (r, c) => {
      const a = obj(r, c, ["addon_id", "name", "unit_price", "quantity", "line_total", "unit_price_paise", "line_total_paise"])
      return {
        addonId: reqStr(a, "addon_id", c),
        name: strOr(a, "name", c),
        quantity: intOr(a, "quantity", c),
        unitPricePaise: paiseOrRupees(a, "unit_price_paise", "unit_price", c) ?? 0,
        lineTotalPaise: paiseOrRupees(a, "line_total_paise", "line_total", c) ?? 0,
      }
    }),
  }
}

export function decodeCart(raw: unknown, ctx: Ctx): Cart {
  const o = obj(raw, ctx, [
    "id", "user_id", "restaurant_id", "restaurant", "coupon_code", "items", "totals", "totals_paise",
    "taxes_and_charges", "pricing_error",
  ])
  if (o.totals !== undefined && o.totals !== null) legacyFinalPaise(o.totals, at(ctx, "totals"))
  return {
    id: reqStr(o, "id", ctx),
    restaurantId: optStr(o, "restaurant_id", ctx),
    restaurantName: optStr(o, "restaurant", ctx),
    couponCode: optStr(o, "coupon_code", ctx),
    items: arr(o, "items", ctx, decodeCartItem),
    totalsPaise: optObj(o, "totals_paise", ctx, decodeTotalsPaise),
    taxesAndCharges: optObj(o, "taxes_and_charges", ctx, decodeTaxesAndCharges),
    pricingError: optObj(o, "pricing_error", ctx, (r, c) => {
      const e = obj(r, c, ["code", "message"])
      return { code: strOr(e, "code", c), message: strOr(e, "message", c) }
    }),
  }
}

/* ── addresses ────────────────────────────────────────────────────── */

export interface Address {
  id: string
  label: string | null
  receiverName: string | null
  phone: string | null
  addressLine1: string
  addressLine2: string | null
  landmark: string | null
  city: string
  state: string | null
  country: string | null
  postalCode: string | null
  latitude: number | null
  longitude: number | null
  isDefault: boolean
}

export function decodeAddress(raw: unknown, ctx: Ctx): Address {
  const o = obj(raw, ctx, [
    "id", "user_id", "label", "receiver_name", "phone", "address_line1", "address_line2", "landmark", "city",
    "state", "country", "postal_code", "latitude", "longitude", "is_default", "created_at", "updated_at",
  ])
  return {
    id: reqStr(o, "id", ctx),
    label: optStr(o, "label", ctx),
    receiverName: optStr(o, "receiver_name", ctx),
    phone: optStr(o, "phone", ctx),
    addressLine1: strOr(o, "address_line1", ctx),
    addressLine2: optStr(o, "address_line2", ctx),
    landmark: optStr(o, "landmark", ctx),
    city: strOr(o, "city", ctx),
    state: optStr(o, "state", ctx),
    country: optStr(o, "country", ctx),
    postalCode: optStr(o, "postal_code", ctx),
    latitude: optNum(o, "latitude", ctx),
    longitude: optNum(o, "longitude", ctx),
    isDefault: boolOr(o, "is_default", ctx),
  }
}

export function decodeAddressList(raw: unknown, ctx: Ctx): Address[] {
  const o = obj(raw, ctx, ["items"])
  return arr(o, "items", ctx, decodeAddress)
}

/* ── orders ───────────────────────────────────────────────────────── */

export interface OrderItem {
  id: string
  name: string
  foodType: string
  quantity: number
  unitPricePaise: number
  lineTotalPaise: number
  instruction: string | null
}

export interface OrderHistory {
  fromStatus: string | null
  toStatus: string
  reason: string | null
  createdAt: string | null
}

export interface Order {
  id: string
  orderNumber: string
  restaurantId: string
  restaurantName: string
  status: string
  paymentStatus: string
  paymentMethod: string
  /** money.totals_paise.final_amount_paise, else the legacy rupee total through its string. */
  finalAmountPaise: number | null
  totalsPaise: TotalsPaise | null
  taxesAndCharges: TaxesAndCharges | null
  estimatedPreparationMinutes: number
  estimatedDeliveryMinutes: number
  placedAt: string | null
  deliveredAt: string | null
  items: OrderItem[]
  history: OrderHistory[]
  deliveryCode: string | null
  etaAt: string | null
}

export function decodeOrder(raw: unknown, ctx: Ctx): Order {
  const o = obj(raw, ctx, [
    "id", "order_number", "user_id", "restaurant_id", "restaurant_name", "status", "payment_status",
    "payment_method", "totals", "estimated_preparation_minutes", "estimated_delivery_minutes", "placed_at",
    "delivered_at", "items", "history", "money", "delivery_code", "eta_at", "eta_source", "customer_instruction",
    "address_id", "coupon_code",
  ])
  const money = optObj(o, "money", ctx, (r, c) => {
    const m = obj(r, c, ["totals_paise", "taxes_and_charges", "needs_adviser_confirmation"])
    return {
      totalsPaise: optObj(m, "totals_paise", c, decodeTotalsPaise),
      taxesAndCharges: optObj(m, "taxes_and_charges", c, decodeTaxesAndCharges),
    }
  })
  const legacyFinal = o.totals !== undefined && o.totals !== null ? legacyFinalPaise(o.totals, at(ctx, "totals")) : null
  return {
    id: reqStr(o, "id", ctx),
    orderNumber: strOr(o, "order_number", ctx),
    restaurantId: strOr(o, "restaurant_id", ctx),
    restaurantName: strOr(o, "restaurant_name", ctx),
    status: strOr(o, "status", ctx),
    paymentStatus: strOr(o, "payment_status", ctx),
    paymentMethod: strOr(o, "payment_method", ctx),
    finalAmountPaise: money?.totalsPaise?.finalAmount ?? legacyFinal,
    totalsPaise: money?.totalsPaise ?? null,
    taxesAndCharges: money?.taxesAndCharges ?? null,
    estimatedPreparationMinutes: intOr(o, "estimated_preparation_minutes", ctx),
    estimatedDeliveryMinutes: intOr(o, "estimated_delivery_minutes", ctx),
    placedAt: optStr(o, "placed_at", ctx),
    deliveredAt: optStr(o, "delivered_at", ctx),
    items: arr(o, "items", ctx, (r, c) => {
      const it = obj(r, c, [
        "id", "name", "food_type", "unit_price", "quantity", "tax_amount", "line_total", "instruction",
        "unit_price_paise", "tax_amount_paise", "line_total_paise",
      ])
      return {
        id: strOr(it, "id", c),
        name: strOr(it, "name", c),
        foodType: strOr(it, "food_type", c),
        quantity: intOr(it, "quantity", c),
        unitPricePaise: paiseOrRupees(it, "unit_price_paise", "unit_price", c) ?? 0,
        lineTotalPaise: paiseOrRupees(it, "line_total_paise", "line_total", c) ?? 0,
        instruction: optStr(it, "instruction", c),
      }
    }),
    history: arr(o, "history", ctx, (r, c) => {
      const h = obj(r, c, ["from_status", "to_status", "reason", "created_at"])
      return {
        fromStatus: optStr(h, "from_status", c),
        toStatus: strOr(h, "to_status", c),
        reason: optStr(h, "reason", c),
        createdAt: optStr(h, "created_at", c),
      }
    }),
    deliveryCode: optStr(o, "delivery_code", ctx),
    etaAt: optStr(o, "eta_at", ctx),
  }
}

export function decodeOrderList(raw: unknown, ctx: Ctx): Order[] {
  const o = obj(raw, ctx, ["items", "next_cursor"])
  return arr(o, "items", ctx, decodeOrder)
}

/* ── tracking ─────────────────────────────────────────────────────── */

export interface Point {
  latitude: number | null
  longitude: number | null
  recordedAt: string | null
  addressLine1: string | null
  city: string | null
}

export interface TimelineStep {
  fromStatus: string | null
  toStatus: string
  label: string
  reason: string | null
  completed: boolean
  createdAt: string | null
}

export interface Tracking {
  orderId: string
  orderNumber: string
  status: string
  estimatedDeliveryMinutes: number
  etaAt: string | null
  deliveryLocation: Point | null
  customerLocation: Point | null
  restaurantLocation: Point | null
  assignmentStatus: string | null
  timeline: TimelineStep[]
}

function decodePoint(raw: unknown, ctx: Ctx): Point {
  const o = obj(raw, ctx, [
    "latitude", "longitude", "recorded_at", "delivery_partner_id", "address_line1", "city", "state", "heading",
    "speed",
  ])
  return {
    latitude: optNum(o, "latitude", ctx),
    longitude: optNum(o, "longitude", ctx),
    recordedAt: optStr(o, "recorded_at", ctx),
    addressLine1: optStr(o, "address_line1", ctx),
    city: optStr(o, "city", ctx),
  }
}

export function decodeTracking(raw: unknown, ctx: Ctx): Tracking {
  const o = obj(raw, ctx, [
    "order_id", "order_number", "status", "estimated_delivery_minutes", "eta_at", "eta_source",
    "delivery_location", "customer_location", "restaurant_location", "assignment", "timeline",
  ])
  const assignment = optObj(o, "assignment", ctx, (r, c) => {
    const a = obj(r, c, ["id", "delivery_partner_id", "status", "created_at"])
    return strOr(a, "status", c)
  })
  return {
    orderId: strOr(o, "order_id", ctx),
    orderNumber: strOr(o, "order_number", ctx),
    status: strOr(o, "status", ctx),
    estimatedDeliveryMinutes: intOr(o, "estimated_delivery_minutes", ctx),
    etaAt: optStr(o, "eta_at", ctx),
    deliveryLocation: optObj(o, "delivery_location", ctx, decodePoint),
    customerLocation: optObj(o, "customer_location", ctx, decodePoint),
    restaurantLocation: optObj(o, "restaurant_location", ctx, decodePoint),
    assignmentStatus: assignment,
    timeline: arr(o, "timeline", ctx, (r, c) => {
      const t = obj(r, c, ["from_status", "to_status", "label", "reason", "completed", "created_at"])
      return {
        fromStatus: optStr(t, "from_status", c),
        toStatus: strOr(t, "to_status", c),
        label: strOr(t, "label", c),
        reason: optStr(t, "reason", c),
        completed: boolOr(t, "completed", c),
        createdAt: optStr(t, "created_at", c),
      }
    }),
  }
}

/* ── payment ──────────────────────────────────────────────────────── */

export interface OrderPayment {
  orderId: string
  status: string
  amountMinor: number
  currency: string
  refundStatus: string | null
  updatedAt: string | null
}

export function decodeOrderPayment(raw: unknown, ctx: Ctx): OrderPayment {
  const o = obj(raw, ctx, ["order_id", "status", "amount_minor", "currency", "refund_status", "updated_at"])
  return {
    orderId: reqStr(o, "order_id", ctx),
    status: strOr(o, "status", ctx),
    amountMinor: intOr(o, "amount_minor", ctx),
    currency: strOr(o, "currency", ctx, "INR"),
    refundStatus: optStr(o, "refund_status", ctx),
    updatedAt: optStr(o, "updated_at", ctx),
  }
}

export interface ClientSession {
  provider: string
  orderId: string
  keyId: string
  merchantDisplayName: string | null
}

export interface PaymentIntent {
  id: string
  orderId: string
  status: string
  /** The intent's own amount (payment_intent.amount_minor), relayed, never computed. */
  amountPaise: number
  currency: string
  providerOrderId: string
  clientSession: ClientSession | null
}

export function decodePaymentIntent(raw: unknown, ctx: Ctx): PaymentIntent {
  const o = obj(raw, ctx, [
    "amount", "client_session", "currency", "id", "method", "order_id", "payment_intent", "provider",
    "provider_order_id", "provider_payment_id", "status",
  ])
  const inner = optObj(o, "payment_intent", ctx, (r, c) => {
    const p = obj(r, c, ["amount_minor", "currency", "id", "method", "provider_ref", "reference_id", "reference_type", "status"])
    return { amountMinor: optInt(p, "amount_minor", c), currency: optStr(p, "currency", c), providerRef: optStr(p, "provider_ref", c) }
  })
  const session = optObj(o, "client_session", ctx, (r, c) => {
    const s = obj(r, c, ["provider", "order_id", "key_id", "merchant_display_name"])
    return {
      provider: strOr(s, "provider", c),
      orderId: strOr(s, "order_id", c),
      keyId: strOr(s, "key_id", c),
      merchantDisplayName: optStr(s, "merchant_display_name", c),
    }
  })
  return {
    id: strOr(o, "id", ctx),
    orderId: strOr(o, "order_id", ctx),
    status: strOr(o, "status", ctx),
    amountPaise: inner?.amountMinor ?? rupeesOnly(o, "amount", ctx) ?? 0,
    currency: inner?.currency || strOr(o, "currency", ctx, "INR"),
    providerOrderId: optStr(o, "provider_order_id", ctx) || inner?.providerRef || "",
    clientSession: session,
  }
}

/* ── realtime ─────────────────────────────────────────────────────── */

export interface RealtimeToken {
  token: string
  topics: string[]
  ttlSeconds: number
}

export function decodeRealtimeToken(raw: unknown, ctx: Ctx): RealtimeToken {
  const o = obj(raw, ctx, ["token", "scope", "topics", "expires_at", "ttl_seconds"])
  return { token: reqStr(o, "token", ctx), topics: strArr(o, "topics", ctx), ttlSeconds: intOr(o, "ttl_seconds", ctx) }
}

/* ── invoice ──────────────────────────────────────────────────────── */

export interface InvoiceLine {
  ref: string | null
  kind: string
  description: string
  sac: string | null
  quantity: number
  unitPricePaise: number
  ratePercent: string
  discountPaise: number
  taxablePaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  taxPaise: number
  totalPaise: number
}

export interface InvoiceSection {
  issuer: string
  title: string
  invoiceNumber: string
  issuerName: string
  issuerGstin: string | null
  lines: InvoiceLine[]
  taxablePaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  taxPaise: number
  totalPaise: number
  notes: string[]
}

export interface Invoice {
  orderNumber: string
  invoiceDate: string
  placeOfSupplyState: string | null
  buyerName: string
  buyerAddress: string | null
  sections: InvoiceSection[]
  grandTotalPaise: number
  currency: string
  adviserMarker: string | null
  needsAdviserConfirmation: boolean
  legacy: boolean
  notes: string[]
}

export function decodeInvoice(raw: unknown, ctx: Ctx): Invoice {
  const o = obj(raw, ctx, [
    "order_id", "order_number", "invoice_date", "place_of_supply_state", "buyer", "sections", "grand_total_paise",
    "currency", "menu_prices_treated_as_exclusive", "needs_adviser_confirmation", "adviser_marker", "legacy", "notes",
  ])
  const buyer = optObj(o, "buyer", ctx, (r, c) => {
    const b = obj(r, c, ["name", "legal_name", "gstin", "address_line", "city", "state"])
    const parts = [optStr(b, "address_line", c), optStr(b, "city", c), optStr(b, "state", c)].filter(Boolean)
    return { name: strOr(b, "name", c), address: parts.length ? parts.join(", ") : null }
  })
  return {
    orderNumber: strOr(o, "order_number", ctx),
    invoiceDate: strOr(o, "invoice_date", ctx),
    placeOfSupplyState: optStr(o, "place_of_supply_state", ctx),
    buyerName: buyer?.name ?? "",
    buyerAddress: buyer?.address ?? null,
    sections: arr(o, "sections", ctx, (r, c) => {
      const s = obj(r, c, [
        "issuer", "title", "invoice_number", "issuer_name", "issuer_gstin", "lines", "taxable_paise", "cgst_paise",
        "sgst_paise", "igst_paise", "tax_paise", "total_paise", "notes",
      ])
      return {
        issuer: strOr(s, "issuer", c),
        title: strOr(s, "title", c),
        invoiceNumber: strOr(s, "invoice_number", c),
        issuerName: strOr(s, "issuer_name", c),
        issuerGstin: optStr(s, "issuer_gstin", c),
        lines: arr(s, "lines", c, (lr, lc) => {
          const l = obj(lr, lc, [
            "ref", "kind", "description", "sac", "quantity", "unit_price_paise", "supplied_by", "liability", "rate_bp",
            "rate_percent", "discount_paise", "taxable_paise", "cgst_paise", "sgst_paise", "igst_paise", "tax_paise",
            "total_paise",
          ])
          return {
            ref: optStr(l, "ref", lc),
            kind: strOr(l, "kind", lc),
            description: strOr(l, "description", lc),
            sac: optStr(l, "sac", lc),
            quantity: intOr(l, "quantity", lc),
            unitPricePaise: paiseOr(l, "unit_price_paise", lc),
            ratePercent: strOr(l, "rate_percent", lc),
            discountPaise: paiseOr(l, "discount_paise", lc),
            taxablePaise: paiseOr(l, "taxable_paise", lc),
            cgstPaise: paiseOr(l, "cgst_paise", lc),
            sgstPaise: paiseOr(l, "sgst_paise", lc),
            igstPaise: paiseOr(l, "igst_paise", lc),
            taxPaise: paiseOr(l, "tax_paise", lc),
            totalPaise: paiseOr(l, "total_paise", lc),
          }
        }),
        taxablePaise: paiseOr(s, "taxable_paise", c),
        cgstPaise: paiseOr(s, "cgst_paise", c),
        sgstPaise: paiseOr(s, "sgst_paise", c),
        igstPaise: paiseOr(s, "igst_paise", c),
        taxPaise: paiseOr(s, "tax_paise", c),
        totalPaise: paiseOr(s, "total_paise", c),
        notes: strArr(s, "notes", c),
      }
    }),
    grandTotalPaise: paiseOr(o, "grand_total_paise", ctx),
    currency: strOr(o, "currency", ctx, "INR"),
    adviserMarker: optStr(o, "adviser_marker", ctx),
    needsAdviserConfirmation: boolOr(o, "needs_adviser_confirmation", ctx),
    legacy: boolOr(o, "legacy", ctx),
    notes: strArr(o, "notes", ctx),
  }
}
