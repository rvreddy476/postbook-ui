/*
  Doorstep customer wire: one decoder per schema in contracts/doorstep/openapi.yaml
  (components.schemas). Each decoder lists the schema's keys; strict mode
  (the contract tests) refuses an unknown or missing key and a fractional
  paise amount, lenient mode (production) only refuses what would break a
  screen.

  Golden fixtures exist for the catalogue, category, service, serviceability,
  quote, address, slot, booking, payment, cancel, reschedule and realtime
  routes (A1 + A3 + A4) and the B1 professional routes (the professionals
  lists, the change of professional). The visit, extras, rating, rework,
  safety and chat routes are decoded from the OpenAPI schema and listed as
  PENDING in __tests__/contracts.test.ts until doorstep-service lands their
  fixtures.

  A3 closed the old contract gaps: Booking.end_otp, Booking.photos,
  Booking.status_history and Extra.evidence_media_id are schema keys now,
  so strict mode requires them.

  B1 (4 Oct 2026): every bookable price is a professional's own. The
  catalogue carries only the city's SUGGESTED price (never charged) and the
  lowest approved professional price (`from_price_paise`, null while nobody
  prices it); an option has a unit (per_job / per_hour / per_month). The
  quote carries the picked professional (`pro_id`), a booking may be ASAP,
  and a booking whose professional is gone is `pro_unavailable` with a
  `choice_deadline`, an `unavailable_cause` and possibly a `pending_change`
  (a dearer professional waiting for the difference to be paid).
*/

import {
  arr,
  at,
  boolOr,
  intOr,
  obj,
  oneOf,
  optInt,
  optNum,
  optObj,
  optPaise,
  optStr,
  reqBool,
  reqNum,
  reqObj,
  reqPaise,
  reqStr,
  strArr,
  WireError,
  type Ctx,
} from "./decode"

/* ── enums ────────────────────────────────────────────────────────── */

export const FAMILIES = [
  "HOME_CLEANING",
  "PEST_CONTROL",
  "APPLIANCE_REPAIR",
  "INSTALLATION_REPAIR",
  "PAINTING",
  "BEAUTY_SALON",
  "CAR_CARE",
  "HOME_STAFFING",
  "RELOCATION",
  "PHOTOGRAPHY",
  "FITNESS_WELLNESS",
  "CONSTRUCTION",
] as const
export type Family = (typeof FAMILIES)[number]

export const GENDER_RULES = ["any", "female_pros_only", "male_pros_only"] as const
export type GenderRule = (typeof GENDER_RULES)[number]

export const EXTRAS_POLICIES = ["rate_card", "catalogue_addons_only"] as const
export type ExtrasPolicy = (typeof EXTRAS_POLICIES)[number]

export const BOOKING_STATUSES = [
  "pending_payment",
  "confirmed",
  "assigned",
  "en_route",
  "arrived",
  "in_progress",
  "awaiting_extras_payment",
  "completed",
  "cancelled",
  "expired",
  "customer_no_show",
  "pro_no_show",
  "pro_unavailable",
] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

/** B1: what one unit of an option is (quantity counts units: hours, months). */
export const UNITS = ["per_job", "per_hour", "per_month"] as const
export type Unit = (typeof UNITS)[number]

/** B1: why a booking's professional is gone (pro_unavailable only). */
export const UNAVAILABLE_CAUSES = ["declined", "offer_expired", "pro_cancel", "not_on_duty", "pro_no_show", "ops_redispatch", "no_professional"] as const
export type UnavailableCause = (typeof UNAVAILABLE_CAUSES)[number]

/** B1: a professional's distance from the address, as a band only (never an exact distance). */
export const DISTANCE_BANDS = ["under_2_km", "2_to_5_km", "5_to_10_km", "over_10_km"] as const
export type DistanceBand = (typeof DISTANCE_BANDS)[number]

/** A nullable enum: null, or one of `values` (strict refuses anything else). */
function optOneOf<T extends string>(o: Record<string, unknown>, key: string, ctx: Ctx, values: readonly T[]): T | null {
  const v = optStr(o, key, ctx)
  if (v !== null && ctx.strict && !(values as readonly string[]).includes(v)) throw new WireError(at(ctx, key).path, `unexpected value ${JSON.stringify(v)}`)
  return v as T | null
}

/* ── catalogue ────────────────────────────────────────────────────── */

export interface CityRef {
  code: string
  name: string
}

export function decodeCityRef(raw: unknown, ctx: Ctx): CityRef {
  const o = obj(raw, ctx, ["code", "name"])
  return { code: reqStr(o, "code", ctx), name: reqStr(o, "name", ctx) }
}

export interface CategorySummary {
  id: string
  slug: string
  name: string
  description: string
  family: Family
  genderRule: GenderRule
  imageUrl: string | null
  sortOrder: number
  serviceCount: number
  /** B1: the lowest bookable professional price in the category; null while nobody offers one. */
  startingPricePaise: number | null
}

export function decodeCategorySummary(raw: unknown, ctx: Ctx): CategorySummary {
  const o = obj(raw, ctx, ["id", "slug", "name", "description", "family", "gender_rule", "image_url", "sort_order", "service_count", "starting_price_paise"])
  return {
    id: reqStr(o, "id", ctx),
    slug: reqStr(o, "slug", ctx),
    name: reqStr(o, "name", ctx),
    description: reqStr(o, "description", ctx),
    family: oneOf(o, "family", ctx, FAMILIES),
    genderRule: oneOf(o, "gender_rule", ctx, GENDER_RULES),
    imageUrl: optStr(o, "image_url", ctx),
    sortOrder: intOr(o, "sort_order", ctx),
    serviceCount: intOr(o, "service_count", ctx),
    startingPricePaise: optPaise(o, "starting_price_paise", ctx),
  }
}

export interface Catalogue {
  city: CityRef
  categories: CategorySummary[]
}

export function decodeCatalogue(raw: unknown, ctx: Ctx): Catalogue {
  const o = obj(raw, ctx, ["city", "categories"])
  return { city: reqObj(o, "city", ctx, decodeCityRef), categories: arr(o, "categories", ctx, decodeCategorySummary) }
}

export interface ServiceSummary {
  id: string
  categoryId: string
  slug: string
  name: string
  description: string
  durationMinutes: number
  imageUrl: string | null
  /** B1: the lowest bookable professional price of its options; null while nobody prices it. */
  startingPricePaise: number | null
  /** B1: the city's suggested price (informational, never charged). */
  suggestedPricePaise: number | null
}

export function decodeServiceSummary(raw: unknown, ctx: Ctx): ServiceSummary {
  const o = obj(raw, ctx, ["id", "category_id", "slug", "name", "description", "duration_minutes", "image_url", "starting_price_paise", "suggested_price_paise"])
  return {
    id: reqStr(o, "id", ctx),
    categoryId: reqStr(o, "category_id", ctx),
    slug: reqStr(o, "slug", ctx),
    name: reqStr(o, "name", ctx),
    description: reqStr(o, "description", ctx),
    durationMinutes: intOr(o, "duration_minutes", ctx),
    imageUrl: optStr(o, "image_url", ctx),
    startingPricePaise: optPaise(o, "starting_price_paise", ctx),
    suggestedPricePaise: optPaise(o, "suggested_price_paise", ctx),
  }
}

export interface CategoryPage {
  city: CityRef
  category: CategorySummary
  services: ServiceSummary[]
}

export function decodeCategoryPage(raw: unknown, ctx: Ctx): CategoryPage {
  const o = obj(raw, ctx, ["city", "category", "services"])
  return {
    city: reqObj(o, "city", ctx, decodeCityRef),
    category: reqObj(o, "category", ctx, decodeCategorySummary),
    services: arr(o, "services", ctx, decodeServiceSummary),
  }
}

export interface ServiceOption {
  id: string
  name: string
  description: string
  durationMinutes: number
  maxQuantity: number
  unit: Unit
  isDefault: boolean
  /** The city's suggested price per unit: informational, never charged. */
  suggestedPricePaise: number | null
  mrpPaise: number | null
  /** The lowest bookable professional price per unit now; null while nobody prices it. */
  fromPricePaise: number | null
}

export function decodeServiceOption(raw: unknown, ctx: Ctx): ServiceOption {
  const o = obj(raw, ctx, ["id", "name", "description", "duration_minutes", "max_quantity", "unit", "is_default", "suggested_price_paise", "mrp_paise", "from_price_paise"])
  return {
    id: reqStr(o, "id", ctx),
    name: reqStr(o, "name", ctx),
    description: reqStr(o, "description", ctx),
    durationMinutes: intOr(o, "duration_minutes", ctx),
    maxQuantity: Math.max(1, intOr(o, "max_quantity", ctx, 1)),
    unit: oneOf(o, "unit", ctx, UNITS),
    isDefault: boolOr(o, "is_default", ctx),
    suggestedPricePaise: optPaise(o, "suggested_price_paise", ctx),
    mrpPaise: optPaise(o, "mrp_paise", ctx),
    fromPricePaise: optPaise(o, "from_price_paise", ctx),
  }
}

export interface Addon {
  id: string
  name: string
  description: string
  extraDurationMinutes: number
  suggestedPricePaise: number | null
  fromPricePaise: number | null
}

export function decodeAddon(raw: unknown, ctx: Ctx): Addon {
  const o = obj(raw, ctx, ["id", "name", "description", "extra_duration_minutes", "suggested_price_paise", "from_price_paise"])
  return {
    id: reqStr(o, "id", ctx),
    name: reqStr(o, "name", ctx),
    description: reqStr(o, "description", ctx),
    extraDurationMinutes: intOr(o, "extra_duration_minutes", ctx),
    suggestedPricePaise: optPaise(o, "suggested_price_paise", ctx),
    fromPricePaise: optPaise(o, "from_price_paise", ctx),
  }
}

export interface AddonGroup {
  id: string
  name: string
  minSelect: number
  maxSelect: number
  isRequired: boolean
  addons: Addon[]
}

export function decodeAddonGroup(raw: unknown, ctx: Ctx): AddonGroup {
  const o = obj(raw, ctx, ["id", "name", "min_select", "max_select", "is_required", "addons"])
  return {
    id: reqStr(o, "id", ctx),
    name: reqStr(o, "name", ctx),
    minSelect: intOr(o, "min_select", ctx),
    maxSelect: intOr(o, "max_select", ctx),
    isRequired: boolOr(o, "is_required", ctx),
    addons: arr(o, "addons", ctx, decodeAddon),
  }
}

export interface ServiceCategoryRef {
  id: string
  slug: string
  name: string
  family: Family
  genderRule: GenderRule
  extrasPolicy: ExtrasPolicy
}

function decodeServiceCategoryRef(raw: unknown, ctx: Ctx): ServiceCategoryRef {
  const o = obj(raw, ctx, ["id", "slug", "name", "family", "gender_rule", "extras_policy"])
  return {
    id: reqStr(o, "id", ctx),
    slug: reqStr(o, "slug", ctx),
    name: reqStr(o, "name", ctx),
    family: oneOf(o, "family", ctx, FAMILIES),
    genderRule: oneOf(o, "gender_rule", ctx, GENDER_RULES),
    extrasPolicy: oneOf(o, "extras_policy", ctx, EXTRAS_POLICIES),
  }
}

export interface ServiceDetail {
  id: string
  category: ServiceCategoryRef
  slug: string
  name: string
  description: string
  durationMinutes: number
  inclusions: string[]
  exclusions: string[]
  imageUrl: string | null
  crewSize: number
  reworkDays: number
  minBeforePhotos: number
  minAfterPhotos: number
  options: ServiceOption[]
  addonGroups: AddonGroup[]
}

function decodeServiceDetail(raw: unknown, ctx: Ctx): ServiceDetail {
  const o = obj(raw, ctx, [
    "id",
    "category",
    "slug",
    "name",
    "description",
    "duration_minutes",
    "inclusions",
    "exclusions",
    "image_url",
    "crew_size",
    "rework_days",
    "min_before_photos",
    "min_after_photos",
    "options",
    "addon_groups",
  ])
  return {
    id: reqStr(o, "id", ctx),
    category: reqObj(o, "category", ctx, decodeServiceCategoryRef),
    slug: reqStr(o, "slug", ctx),
    name: reqStr(o, "name", ctx),
    description: reqStr(o, "description", ctx),
    durationMinutes: intOr(o, "duration_minutes", ctx),
    inclusions: strArr(o, "inclusions", ctx),
    exclusions: strArr(o, "exclusions", ctx),
    imageUrl: optStr(o, "image_url", ctx),
    crewSize: intOr(o, "crew_size", ctx, 1),
    reworkDays: intOr(o, "rework_days", ctx),
    minBeforePhotos: intOr(o, "min_before_photos", ctx),
    minAfterPhotos: intOr(o, "min_after_photos", ctx),
    options: arr(o, "options", ctx, decodeServiceOption),
    addonGroups: arr(o, "addon_groups", ctx, decodeAddonGroup),
  }
}

export interface ServicePage {
  city: CityRef
  service: ServiceDetail
}

export function decodeServicePage(raw: unknown, ctx: Ctx): ServicePage {
  const o = obj(raw, ctx, ["city", "service"])
  return { city: reqObj(o, "city", ctx, decodeCityRef), service: reqObj(o, "service", ctx, decodeServiceDetail) }
}

/* ── serviceability ───────────────────────────────────────────────── */

export interface Serviceability {
  serviceable: boolean
  city: CityRef | null
  zone: { id: string; name: string } | null
  reason: string | null
}

export function decodeServiceability(raw: unknown, ctx: Ctx): Serviceability {
  const o = obj(raw, ctx, ["serviceable", "city", "zone", "reason"])
  return {
    serviceable: reqBool(o, "serviceable", ctx),
    city: optObj(o, "city", ctx, decodeCityRef),
    zone: optObj(o, "zone", ctx, (r, c) => {
      const z = obj(r, c, ["id", "name"])
      return { id: reqStr(z, "id", c), name: reqStr(z, "name", c) }
    }),
    reason: optStr(o, "reason", ctx),
  }
}

/* ── quotes ───────────────────────────────────────────────────────── */

export interface QuoteLine {
  kind: "option" | "addon"
  refId: string
  priceId: string
  name: string
  unit: Unit
  quantity: number
  unitPricePaise: number
  lineTotalPaise: number
  taxablePaise: number
  taxPaise: number
  taxRateBps: number
  gstCategory: string
  sac: string
}

export function decodeQuoteLine(raw: unknown, ctx: Ctx): QuoteLine {
  const o = obj(raw, ctx, ["kind", "ref_id", "price_id", "name", "unit", "quantity", "unit_price_paise", "line_total_paise", "taxable_paise", "tax_paise", "tax_rate_bps", "gst_category", "sac"])
  return {
    kind: oneOf(o, "kind", ctx, ["option", "addon"] as const),
    refId: reqStr(o, "ref_id", ctx),
    priceId: reqStr(o, "price_id", ctx),
    name: reqStr(o, "name", ctx),
    unit: oneOf(o, "unit", ctx, UNITS),
    quantity: intOr(o, "quantity", ctx, 1),
    unitPricePaise: reqPaise(o, "unit_price_paise", ctx),
    lineTotalPaise: reqPaise(o, "line_total_paise", ctx),
    taxablePaise: reqPaise(o, "taxable_paise", ctx),
    taxPaise: reqPaise(o, "tax_paise", ctx),
    taxRateBps: intOr(o, "tax_rate_bps", ctx),
    gstCategory: reqStr(o, "gst_category", ctx),
    sac: reqStr(o, "sac", ctx),
  }
}

export interface Quote {
  id: string
  status: "open" | "expired" | "consumed"
  serviceId: string
  optionId: string
  quantity: number
  /** B1: the professional the customer picked; the quote is priced with their approved prices. */
  proId: string
  cityCode: string
  zoneId: string
  lines: QuoteLine[]
  totalPaise: number
  taxablePaise: number
  taxPaise: number
  pricesIncludeTax: boolean
  taxProvisional: boolean
  taxNote: string
  durationMinutes: number
  expiresAt: string
  createdAt: string
}

export function decodeQuote(raw: unknown, ctx: Ctx): Quote {
  const o = obj(raw, ctx, [
    "id",
    "status",
    "service_id",
    "option_id",
    "quantity",
    "pro_id",
    "city_code",
    "zone_id",
    "lines",
    "total_paise",
    "taxable_paise",
    "tax_paise",
    "prices_include_tax",
    "tax_provisional",
    "tax_note",
    "duration_minutes",
    "expires_at",
    "created_at",
  ])
  return {
    id: reqStr(o, "id", ctx),
    status: oneOf(o, "status", ctx, ["open", "expired", "consumed"] as const),
    serviceId: reqStr(o, "service_id", ctx),
    optionId: reqStr(o, "option_id", ctx),
    quantity: intOr(o, "quantity", ctx, 1),
    proId: reqStr(o, "pro_id", ctx),
    cityCode: reqStr(o, "city_code", ctx),
    zoneId: reqStr(o, "zone_id", ctx),
    lines: arr(o, "lines", ctx, decodeQuoteLine),
    totalPaise: reqPaise(o, "total_paise", ctx),
    taxablePaise: reqPaise(o, "taxable_paise", ctx),
    taxPaise: reqPaise(o, "tax_paise", ctx),
    pricesIncludeTax: boolOr(o, "prices_include_tax", ctx, true),
    taxProvisional: boolOr(o, "tax_provisional", ctx),
    taxNote: optStr(o, "tax_note", ctx) ?? "",
    durationMinutes: intOr(o, "duration_minutes", ctx),
    expiresAt: reqStr(o, "expires_at", ctx),
    createdAt: reqStr(o, "created_at", ctx),
  }
}

/* ── addresses ────────────────────────────────────────────────────── */

export interface Address {
  id: string
  label: string
  line1: string
  line2: string | null
  landmark: string | null
  locality: string
  cityCode: string
  pincode: string
  lat: number
  lng: number
  zoneId: string
  isDefault: boolean
  createdAt: string
}

export function decodeAddress(raw: unknown, ctx: Ctx): Address {
  const o = obj(raw, ctx, ["id", "label", "line1", "line2", "landmark", "locality", "city_code", "pincode", "lat", "lng", "zone_id", "is_default", "created_at"])
  return {
    id: reqStr(o, "id", ctx),
    label: reqStr(o, "label", ctx),
    line1: reqStr(o, "line1", ctx),
    line2: optStr(o, "line2", ctx),
    landmark: optStr(o, "landmark", ctx),
    locality: reqStr(o, "locality", ctx),
    cityCode: reqStr(o, "city_code", ctx),
    pincode: reqStr(o, "pincode", ctx),
    lat: reqNum(o, "lat", ctx),
    lng: reqNum(o, "lng", ctx),
    zoneId: reqStr(o, "zone_id", ctx),
    isDefault: boolOr(o, "is_default", ctx),
    createdAt: reqStr(o, "created_at", ctx),
  }
}

export function decodeAddressList(raw: unknown, ctx: Ctx): Address[] {
  const o = obj(raw, ctx, ["items"])
  return arr(o, "items", ctx, decodeAddress)
}

/* ── slots ────────────────────────────────────────────────────────── */

export interface Slot {
  start: string
  end: string
  available: boolean
}

export interface SlotDay {
  date: string
  slots: Slot[]
}

export interface SlotDays {
  timezone: string
  days: SlotDay[]
}

export function decodeSlotDays(raw: unknown, ctx: Ctx): SlotDays {
  const o = obj(raw, ctx, ["timezone", "days"])
  return {
    timezone: optStr(o, "timezone", ctx) || "Asia/Kolkata",
    days: arr(o, "days", ctx, (r, c) => {
      const d = obj(r, c, ["date", "slots"])
      return {
        date: reqStr(d, "date", c),
        slots: arr(d, "slots", c, (rs, cs) => {
          const s = obj(rs, cs, ["start", "end", "available"])
          return { start: reqStr(s, "start", cs), end: reqStr(s, "end", cs), available: reqBool(s, "available", cs) }
        }),
      }
    }),
  }
}

/* ── payments ─────────────────────────────────────────────────────── */

export const PAYMENT_STATUSES = ["created", "pending", "succeeded", "failed", "refunded", "partially_refunded"] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

/**
  payments-service's client session (paymentsclient.ClientSession), relayed
  unchanged as `checkout`: provider ("razorpay", or "stub" on a dev stack),
  order_id, key_id (publishable) and, when payments has one,
  merchant_display_name. Never a secret.
*/
export interface CheckoutSession {
  provider: string
  orderId: string
  keyId: string
  /** "" when payments attached none. */
  merchantDisplayName: string
}

const CHECKOUT_REQUIRED = ["provider", "order_id", "key_id"] as const

/**
  `checkout` is `additionalProperties: {type: string}` and `{}` when payments
  attached no session (→ null). Strict refuses a non-string value and a
  non-empty session missing provider, order_id or key_id; a key it does not
  read is tolerated (payments may add one).
*/
function decodeCheckout(raw: unknown, ctx: Ctx): CheckoutSession | null {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== "object" || Array.isArray(raw)) {
    if (ctx.strict) throw new WireError(ctx.path, "expected an object")
    return null
  }
  const o = raw as Record<string, unknown>
  if (!Object.keys(o).length) return null
  if (ctx.strict) {
    for (const [k, v] of Object.entries(o)) if (typeof v !== "string") throw new WireError(at(ctx, k).path, "expected a string")
    for (const k of CHECKOUT_REQUIRED) {
      // Only the development stub has no publishable provider key.
      if (k === "key_id" && o.provider === "stub") continue
      if (!(k in o)) throw new WireError(at(ctx, k).path, "missing field")
    }
  }
  const s = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "")
  return { provider: s("provider"), orderId: s("order_id"), keyId: s("key_id"), merchantDisplayName: s("merchant_display_name") }
}

export interface PaymentIntent {
  paymentId: string
  referenceType: "doorstep_booking" | "doorstep_extras"
  referenceId: string
  amountPaise: number
  status: PaymentStatus
  checkout: CheckoutSession | null
}

export function decodePaymentIntent(raw: unknown, ctx: Ctx): PaymentIntent {
  const o = obj(raw, ctx, ["payment_id", "reference_type", "reference_id", "amount_paise", "status", "checkout"])
  return {
    paymentId: reqStr(o, "payment_id", ctx),
    referenceType: oneOf(o, "reference_type", ctx, ["doorstep_booking", "doorstep_extras"] as const),
    referenceId: reqStr(o, "reference_id", ctx),
    amountPaise: reqPaise(o, "amount_paise", ctx),
    status: oneOf(o, "status", ctx, PAYMENT_STATUSES),
    checkout: decodeCheckout(o.checkout, at(ctx, "checkout")),
  }
}

export interface Refund {
  id: string
  paymentId: string
  cause: string
  amountPaise: number
  status: "requested" | "pending" | "succeeded" | "failed"
  createdAt: string
}

export function decodeRefund(raw: unknown, ctx: Ctx): Refund {
  const o = obj(raw, ctx, ["id", "payment_id", "cause", "amount_paise", "status", "created_at"])
  return {
    id: reqStr(o, "id", ctx),
    paymentId: reqStr(o, "payment_id", ctx),
    cause: reqStr(o, "cause", ctx),
    amountPaise: reqPaise(o, "amount_paise", ctx),
    status: oneOf(o, "status", ctx, ["requested", "pending", "succeeded", "failed"] as const),
    createdAt: reqStr(o, "created_at", ctx),
  }
}

export interface BookingPayments {
  payments: PaymentIntent[]
  refunds: Refund[]
}

export function decodeBookingPayments(raw: unknown, ctx: Ctx): BookingPayments {
  const o = obj(raw, ctx, ["payments", "refunds"])
  return { payments: arr(o, "payments", ctx, decodePaymentIntent), refunds: arr(o, "refunds", ctx, decodeRefund) }
}

/* ── bookings ─────────────────────────────────────────────────────── */

export interface BookingProfessional {
  firstName: string
  photoMediaId: string | null
  ratingAvg: number | null
  jobsCompleted: number
}

export interface Photo {
  id: string
  bookingId: string
  phase: "before" | "after" | "kit_seal" | "extra_evidence"
  mediaId: string
  createdAt: string
}

export function decodePhoto(raw: unknown, ctx: Ctx): Photo {
  const o = obj(raw, ctx, ["id", "booking_id", "phase", "media_id", "created_at"])
  return {
    id: reqStr(o, "id", ctx),
    bookingId: reqStr(o, "booking_id", ctx),
    phase: oneOf(o, "phase", ctx, ["before", "after", "kit_seal", "extra_evidence"] as const),
    mediaId: reqStr(o, "media_id", ctx),
    createdAt: reqStr(o, "created_at", ctx),
  }
}

/** One step of the customer's timeline (StatusStep); actor and reason are admin-only. */
export interface StatusStep {
  fromStatus: BookingStatus | null
  toStatus: BookingStatus
  createdAt: string
}

export function decodeStatusStep(raw: unknown, ctx: Ctx): StatusStep {
  const o = obj(raw, ctx, ["from_status", "to_status", "created_at"])
  const from = optStr(o, "from_status", ctx)
  if (from !== null && ctx.strict && !(BOOKING_STATUSES as readonly string[]).includes(from)) {
    throw new WireError(at(ctx, "from_status").path, `unexpected value ${JSON.stringify(from)}`)
  }
  return {
    fromStatus: from as BookingStatus | null,
    toStatus: oneOf(o, "to_status", ctx, BOOKING_STATUSES),
    createdAt: reqStr(o, "created_at", ctx),
  }
}

export interface Booking {
  id: string
  status: BookingStatus
  serviceId: string
  serviceName: string
  categorySlug: string
  cityCode: string
  zoneId: string
  slotStart: string
  slotEnd: string
  durationMinutes: number
  requireFemalePro: boolean
  items: QuoteLine[]
  totalPaise: number
  taxablePaise: number
  taxPaise: number
  paidPaise: number
  refundedPaise: number
  cancellationFeePaise: number
  extrasTotalPaise: number
  outstandingPaise: number
  holdExpiresAt: string | null
  address: Address
  professional: BookingProfessional | null
  parentBookingId: string | null
  startOtp: string | null
  /** Null until the visit lane sets it; shown only while in_progress (model/booking.ts otpToShow). */
  endOtp: string | null
  /** Before/after visit photos; [] until the visit lane uploads them. */
  photos: Photo[]
  /** The timeline, oldest first. */
  statusHistory: StatusStep[]
  canCancel: boolean
  canReschedule: boolean
  /** B1: a same-day, as-soon-as-possible booking. */
  asap: boolean
  /** B1: while pro_unavailable, pick another professional (or cancel) by then, else a full refund. */
  choiceDeadline: string | null
  /** B1: why the professional is gone (pro_unavailable only). */
  unavailableCause: UnavailableCause | null
  /** B1: a change of professional waiting for its difference to be paid, else null. */
  pendingChange: ProChange | null
  createdAt: string
  updatedAt: string
}

const BOOKING_KEYS = [
  "id",
  "status",
  "service_id",
  "service_name",
  "category_slug",
  "city_code",
  "zone_id",
  "slot_start",
  "slot_end",
  "duration_minutes",
  "require_female_pro",
  "items",
  "total_paise",
  "taxable_paise",
  "tax_paise",
  "paid_paise",
  "refunded_paise",
  "cancellation_fee_paise",
  "extras_total_paise",
  "outstanding_paise",
  "hold_expires_at",
  "address",
  "professional",
  "parent_booking_id",
  "start_otp",
  "end_otp",
  "photos",
  "status_history",
  "can_cancel",
  "can_reschedule",
  "asap",
  "choice_deadline",
  "unavailable_cause",
  "pending_change",
  "created_at",
  "updated_at",
] as const

export function decodeBooking(raw: unknown, ctx: Ctx): Booking {
  const o = obj(raw, ctx, BOOKING_KEYS)
  return {
    id: reqStr(o, "id", ctx),
    status: oneOf(o, "status", ctx, BOOKING_STATUSES),
    serviceId: reqStr(o, "service_id", ctx),
    serviceName: reqStr(o, "service_name", ctx),
    categorySlug: reqStr(o, "category_slug", ctx),
    cityCode: reqStr(o, "city_code", ctx),
    zoneId: reqStr(o, "zone_id", ctx),
    slotStart: reqStr(o, "slot_start", ctx),
    slotEnd: reqStr(o, "slot_end", ctx),
    durationMinutes: intOr(o, "duration_minutes", ctx),
    requireFemalePro: boolOr(o, "require_female_pro", ctx),
    items: arr(o, "items", ctx, decodeQuoteLine),
    totalPaise: reqPaise(o, "total_paise", ctx),
    taxablePaise: reqPaise(o, "taxable_paise", ctx),
    taxPaise: reqPaise(o, "tax_paise", ctx),
    paidPaise: reqPaise(o, "paid_paise", ctx),
    refundedPaise: reqPaise(o, "refunded_paise", ctx),
    cancellationFeePaise: reqPaise(o, "cancellation_fee_paise", ctx),
    extrasTotalPaise: reqPaise(o, "extras_total_paise", ctx),
    outstandingPaise: reqPaise(o, "outstanding_paise", ctx),
    holdExpiresAt: optStr(o, "hold_expires_at", ctx),
    address: reqObj(o, "address", ctx, decodeAddress),
    professional: optObj(o, "professional", ctx, (r, c) => {
      const p = obj(r, c, ["first_name", "photo_media_id", "rating_avg", "jobs_completed"])
      return {
        firstName: reqStr(p, "first_name", c),
        photoMediaId: optStr(p, "photo_media_id", c),
        ratingAvg: optNum(p, "rating_avg", c),
        jobsCompleted: intOr(p, "jobs_completed", c),
      }
    }),
    parentBookingId: optStr(o, "parent_booking_id", ctx),
    startOtp: optStr(o, "start_otp", ctx),
    endOtp: optStr(o, "end_otp", ctx),
    photos: arr(o, "photos", ctx, decodePhoto),
    statusHistory: arr(o, "status_history", ctx, decodeStatusStep),
    canCancel: boolOr(o, "can_cancel", ctx),
    canReschedule: boolOr(o, "can_reschedule", ctx),
    asap: reqBool(o, "asap", ctx),
    choiceDeadline: optStr(o, "choice_deadline", ctx),
    unavailableCause: optOneOf(o, "unavailable_cause", ctx, UNAVAILABLE_CAUSES),
    pendingChange: optObj(o, "pending_change", ctx, decodeProChange),
    createdAt: reqStr(o, "created_at", ctx),
    updatedAt: reqStr(o, "updated_at", ctx),
  }
}

export interface BookingCreated {
  booking: Booking
  paymentIntent: PaymentIntent
}

export function decodeBookingCreated(raw: unknown, ctx: Ctx): BookingCreated {
  const o = obj(raw, ctx, ["booking", "payment_intent"])
  return { booking: reqObj(o, "booking", ctx, decodeBooking), paymentIntent: reqObj(o, "payment_intent", ctx, decodePaymentIntent) }
}

export interface BookingSummary {
  id: string
  status: BookingStatus
  serviceName: string
  categorySlug: string
  slotStart: string
  slotEnd: string
  totalPaise: number
  createdAt: string
}

export function decodeBookingSummary(raw: unknown, ctx: Ctx): BookingSummary {
  const o = obj(raw, ctx, ["id", "status", "service_name", "category_slug", "slot_start", "slot_end", "total_paise", "created_at"])
  return {
    id: reqStr(o, "id", ctx),
    status: oneOf(o, "status", ctx, BOOKING_STATUSES),
    serviceName: reqStr(o, "service_name", ctx),
    categorySlug: reqStr(o, "category_slug", ctx),
    slotStart: reqStr(o, "slot_start", ctx),
    slotEnd: reqStr(o, "slot_end", ctx),
    totalPaise: reqPaise(o, "total_paise", ctx),
    createdAt: reqStr(o, "created_at", ctx),
  }
}

export interface BookingPage {
  items: BookingSummary[]
  nextCursor: string | null
}

export function decodeBookingPage(raw: unknown, ctx: Ctx): BookingPage {
  const o = obj(raw, ctx, ["items", "next_cursor"])
  return { items: arr(o, "items", ctx, decodeBookingSummary), nextCursor: optStr(o, "next_cursor", ctx) }
}

export interface CancelPreview {
  allowed: boolean
  feePaise: number
  refundPaise: number
  rule: string
}

export function decodeCancelPreview(raw: unknown, ctx: Ctx): CancelPreview {
  const o = obj(raw, ctx, ["allowed", "fee_paise", "refund_paise", "rule"])
  return { allowed: reqBool(o, "allowed", ctx), feePaise: reqPaise(o, "fee_paise", ctx), refundPaise: reqPaise(o, "refund_paise", ctx), rule: reqStr(o, "rule", ctx) }
}

/* ── the visit: extras, bills, outstanding ────────────────────────── */

export const EXTRA_STATUSES = ["proposed", "approved", "declined", "withdrawn", "billed"] as const
export type ExtraStatus = (typeof EXTRA_STATUSES)[number]

export interface Extra {
  id: string
  bookingId: string
  kind: "rate_card" | "addon"
  rateCardId: string | null
  addonId: string | null
  name: string
  quantity: number
  unitPricePaise: number
  totalPaise: number
  status: ExtraStatus
  createdAt: string
  /** The photo the professional attached to the extra, or null. */
  evidenceMediaId: string | null
}

export function decodeExtra(raw: unknown, ctx: Ctx): Extra {
  const o = obj(raw, ctx, ["id", "booking_id", "kind", "rate_card_id", "addon_id", "name", "quantity", "unit_price_paise", "total_paise", "status", "evidence_media_id", "created_at"])
  return {
    id: reqStr(o, "id", ctx),
    bookingId: reqStr(o, "booking_id", ctx),
    kind: oneOf(o, "kind", ctx, ["rate_card", "addon"] as const),
    rateCardId: optStr(o, "rate_card_id", ctx),
    addonId: optStr(o, "addon_id", ctx),
    name: reqStr(o, "name", ctx),
    quantity: intOr(o, "quantity", ctx, 1),
    unitPricePaise: reqPaise(o, "unit_price_paise", ctx),
    totalPaise: reqPaise(o, "total_paise", ctx),
    status: oneOf(o, "status", ctx, EXTRA_STATUSES),
    createdAt: reqStr(o, "created_at", ctx),
    evidenceMediaId: optStr(o, "evidence_media_id", ctx),
  }
}

export function decodeExtraList(raw: unknown, ctx: Ctx): Extra[] {
  const o = obj(raw, ctx, ["items"])
  return arr(o, "items", ctx, decodeExtra)
}

export const BILL_STATUSES = ["open", "payment_pending", "paid", "outstanding", "waived", "refunded"] as const
export type BillStatus = (typeof BILL_STATUSES)[number]

export interface ExtrasBill {
  id: string
  bookingId: string
  amountPaise: number
  taxablePaise: number
  taxPaise: number
  status: BillStatus
  dueAt: string | null
  paidAt: string | null
}

export function decodeExtrasBill(raw: unknown, ctx: Ctx): ExtrasBill {
  const o = obj(raw, ctx, ["id", "booking_id", "amount_paise", "taxable_paise", "tax_paise", "status", "due_at", "paid_at"])
  return {
    id: reqStr(o, "id", ctx),
    bookingId: reqStr(o, "booking_id", ctx),
    amountPaise: reqPaise(o, "amount_paise", ctx),
    taxablePaise: reqPaise(o, "taxable_paise", ctx),
    taxPaise: reqPaise(o, "tax_paise", ctx),
    status: oneOf(o, "status", ctx, BILL_STATUSES),
    dueAt: optStr(o, "due_at", ctx),
    paidAt: optStr(o, "paid_at", ctx),
  }
}

export interface Outstanding {
  totalPaise: number
  bills: ExtrasBill[]
}

export function decodeOutstanding(raw: unknown, ctx: Ctx): Outstanding {
  const o = obj(raw, ctx, ["total_paise", "bills"])
  return { totalPaise: reqPaise(o, "total_paise", ctx), bills: arr(o, "bills", ctx, decodeExtrasBill) }
}

/* ── after the visit: rating, rework ──────────────────────────────── */

export interface Rating {
  id: string
  bookingId: string
  raterKind: "customer" | "pro"
  stars: number
  tags: string[]
  comment: string | null
  hidden: boolean
  createdAt: string
}

export function decodeRating(raw: unknown, ctx: Ctx): Rating {
  const o = obj(raw, ctx, ["id", "booking_id", "rater_kind", "stars", "tags", "comment", "hidden", "created_at"])
  return {
    id: reqStr(o, "id", ctx),
    bookingId: reqStr(o, "booking_id", ctx),
    raterKind: oneOf(o, "rater_kind", ctx, ["customer", "pro"] as const),
    stars: intOr(o, "stars", ctx),
    tags: strArr(o, "tags", ctx),
    comment: optStr(o, "comment", ctx),
    hidden: boolOr(o, "hidden", ctx),
    createdAt: reqStr(o, "created_at", ctx),
  }
}

export interface ReworkRequest {
  id: string
  bookingId: string
  childBookingId: string | null
  status: "requested" | "approved" | "rejected" | "scheduled" | "completed"
  reason: string
  createdAt: string
}

export function decodeReworkRequest(raw: unknown, ctx: Ctx): ReworkRequest {
  const o = obj(raw, ctx, ["id", "booking_id", "child_booking_id", "status", "reason", "created_at"])
  return {
    id: reqStr(o, "id", ctx),
    bookingId: reqStr(o, "booking_id", ctx),
    childBookingId: optStr(o, "child_booking_id", ctx),
    status: oneOf(o, "status", ctx, ["requested", "approved", "rejected", "scheduled", "completed"] as const),
    reason: reqStr(o, "reason", ctx),
    createdAt: reqStr(o, "created_at", ctx),
  }
}

export function decodeReworkList(raw: unknown, ctx: Ctx): ReworkRequest[] {
  const o = obj(raw, ctx, ["items"])
  return arr(o, "items", ctx, decodeReworkRequest)
}

/* ── safety ───────────────────────────────────────────────────────── */

export interface Incident {
  id: string
  bookingId: string | null
  raisedByKind: string
  kind: string
  severity: string
  status: "open" | "acknowledged" | "resolved"
  description: string | null
  proAutoSuspended: boolean
  createdAt: string
}

export function decodeIncident(raw: unknown, ctx: Ctx): Incident {
  const o = obj(raw, ctx, ["id", "booking_id", "raised_by_kind", "kind", "severity", "status", "description", "pro_auto_suspended", "created_at"])
  return {
    id: reqStr(o, "id", ctx),
    bookingId: optStr(o, "booking_id", ctx),
    raisedByKind: oneOf(o, "raised_by_kind", ctx, ["customer", "pro", "system", "admin"] as const),
    kind: oneOf(o, "kind", ctx, ["sos", "safety", "damage", "harassment", "theft", "unsafe_exit", "other"] as const),
    severity: oneOf(o, "severity", ctx, ["low", "medium", "high", "critical"] as const),
    status: oneOf(o, "status", ctx, ["open", "acknowledged", "resolved"] as const),
    description: optStr(o, "description", ctx),
    proAutoSuspended: boolOr(o, "pro_auto_suspended", ctx),
    createdAt: reqStr(o, "created_at", ctx),
  }
}

export interface ShareToken {
  token: string
  url: string
  expiresAt: string
}

export function decodeShareToken(raw: unknown, ctx: Ctx): ShareToken {
  const o = obj(raw, ctx, ["token", "url", "expires_at"])
  return { token: reqStr(o, "token", ctx), url: reqStr(o, "url", ctx), expiresAt: reqStr(o, "expires_at", ctx) }
}

export interface TrustedContact {
  name: string
  phoneMasked: string
  updatedAt: string
}

/** The schema is nullable: `data: null` means none saved. */
export function decodeTrustedContact(raw: unknown, ctx: Ctx): TrustedContact | null {
  if (raw === null) return null
  const o = obj(raw, ctx, ["name", "phone_masked", "updated_at"])
  return { name: reqStr(o, "name", ctx), phoneMasked: reqStr(o, "phone_masked", ctx), updatedAt: reqStr(o, "updated_at", ctx) }
}

/* ── chat ─────────────────────────────────────────────────────────── */

export interface Message {
  id: string
  bookingId: string
  senderKind: "customer" | "pro" | "system"
  body: string
  createdAt: string
  readAt: string | null
}

export function decodeMessage(raw: unknown, ctx: Ctx): Message {
  const o = obj(raw, ctx, ["id", "booking_id", "sender_kind", "body", "created_at", "read_at"])
  return {
    id: reqStr(o, "id", ctx),
    bookingId: reqStr(o, "booking_id", ctx),
    senderKind: oneOf(o, "sender_kind", ctx, ["customer", "pro", "system"] as const),
    body: reqStr(o, "body", ctx),
    createdAt: reqStr(o, "created_at", ctx),
    readAt: optStr(o, "read_at", ctx),
  }
}

export interface MessagePage {
  items: Message[]
  nextCursor: string | null
  open: boolean
}

export interface Ticket {
  id: string; bookingId: string | null; category: string; subject: string; body: string; status: string; createdAt: string; updatedAt: string
}
export function decodeTicket(raw: unknown, ctx: Ctx): Ticket {
  const o = obj(raw, ctx, ["id", "booking_id", "category", "subject", "body", "status", "created_at", "updated_at"])
  return { id: reqStr(o,"id",ctx), bookingId: optStr(o,"booking_id",ctx), category: reqStr(o,"category",ctx), subject: reqStr(o,"subject",ctx), body: reqStr(o,"body",ctx), status: reqStr(o,"status",ctx), createdAt: reqStr(o,"created_at",ctx), updatedAt: reqStr(o,"updated_at",ctx) }
}
export function decodeTicketList(raw: unknown, ctx: Ctx): Ticket[] {
  const o = obj(raw,ctx,["items"]); return arr(o,"items",ctx,decodeTicket)
}

export function decodeMessagePage(raw: unknown, ctx: Ctx): MessagePage {
  const o = obj(raw, ctx, ["items", "next_cursor", "open"])
  return { items: arr(o, "items", ctx, decodeMessage), nextCursor: optStr(o, "next_cursor", ctx), open: reqBool(o, "open", ctx) }
}

/* ── realtime ─────────────────────────────────────────────────────── */

export interface RealtimeToken {
  token: string
  topics: string[]
  expiresAt: string
}

export function decodeRealtimeToken(raw: unknown, ctx: Ctx): RealtimeToken {
  const o = obj(raw, ctx, ["token", "topics", "expires_at"])
  return { token: reqStr(o, "token", ctx), topics: strArr(o, "topics", ctx), expiresAt: reqStr(o, "expires_at", ctx) }
}

/* ── B1: the professionals a customer may pick ────────────────────── */

/** One priced line of a professional's card (the tax split is on the card's total). */
export interface PriceLine {
  kind: "option" | "addon"
  refId: string
  name: string
  unit: Unit
  quantity: number
  unitPricePaise: number
  lineTotalPaise: number
}

export function decodePriceLine(raw: unknown, ctx: Ctx): PriceLine {
  const o = obj(raw, ctx, ["kind", "ref_id", "name", "unit", "quantity", "unit_price_paise", "line_total_paise"])
  return {
    kind: oneOf(o, "kind", ctx, ["option", "addon"] as const),
    refId: reqStr(o, "ref_id", ctx),
    name: reqStr(o, "name", ctx),
    unit: oneOf(o, "unit", ctx, UNITS),
    quantity: intOr(o, "quantity", ctx, 1),
    unitPricePaise: reqPaise(o, "unit_price_paise", ctx),
    lineTotalPaise: reqPaise(o, "line_total_paise", ctx),
  }
}

export interface CardPrice {
  /** GST-inclusive: what the customer pays this professional for the selection. */
  totalPaise: number
  taxablePaise: number
  taxPaise: number
  lines: PriceLine[]
}

export interface NextSlot {
  start: string
  end: string
}

/**
  A professional the customer may pick (ProfessionalCard). Never an exact
  distance, location or phone: this type has no field for one, and strict
  mode refuses any key the contract does not list.
*/
export interface ProfessionalCard {
  proId: string
  firstName: string
  photoMediaId: string | null
  ratingAvg: number | null
  ratingCount: number
  jobsCompleted: number
  distanceBand: DistanceBand
  price: CardPrice
  /** scheduled: free starts (up to 3, or 6 on a chosen date); [] for asap. */
  nextSlots: NextSlot[]
  /** asap only. */
  etaMinutes: number | null
  sameDay: boolean
  /** GET /bookings/{id}/professionals only: price minus the booking's total (negative: refunded; positive: charged). */
  differencePaise: number | null
}

export function decodeProfessionalCard(raw: unknown, ctx: Ctx): ProfessionalCard {
  const o = obj(raw, ctx, ["pro_id", "first_name", "photo_media_id", "rating_avg", "rating_count", "jobs_completed", "distance_band", "price", "next_slots", "eta_minutes", "same_day", "difference_paise"])
  return {
    proId: reqStr(o, "pro_id", ctx),
    firstName: reqStr(o, "first_name", ctx),
    photoMediaId: optStr(o, "photo_media_id", ctx),
    ratingAvg: optNum(o, "rating_avg", ctx),
    ratingCount: intOr(o, "rating_count", ctx),
    jobsCompleted: intOr(o, "jobs_completed", ctx),
    distanceBand: oneOf(o, "distance_band", ctx, DISTANCE_BANDS),
    price: reqObj(o, "price", ctx, (r, c) => {
      const p = obj(r, c, ["total_paise", "taxable_paise", "tax_paise", "lines"])
      return {
        totalPaise: reqPaise(p, "total_paise", c),
        taxablePaise: reqPaise(p, "taxable_paise", c),
        taxPaise: reqPaise(p, "tax_paise", c),
        lines: arr(p, "lines", c, decodePriceLine),
      }
    }),
    nextSlots: arr(o, "next_slots", ctx, (r, c) => {
      const n = obj(r, c, ["start", "end"])
      return { start: reqStr(n, "start", c), end: reqStr(n, "end", c) }
    }),
    etaMinutes: optInt(o, "eta_minutes", ctx),
    sameDay: reqBool(o, "same_day", ctx),
    differencePaise: optPaise(o, "difference_paise", ctx),
  }
}

export type ListMode = "scheduled" | "asap"
export const PRO_SORTS = ["price", "rating", "soonest"] as const
export type ProSort = (typeof PRO_SORTS)[number]

export interface ProfessionalList {
  serviceId: string
  optionId: string
  quantity: number
  addonIds: string[]
  bookingId: string | null
  mode: ListMode
  date: string | null
  sort: ProSort
  timezone: string
  items: ProfessionalCard[]
  noProfessional: boolean
  noProfessionalReason: "none_available_now" | null
  /** asap with nobody: the next free starts for the same selection and address. */
  scheduledAlternatives: ProfessionalCard[]
}

export function decodeProfessionalList(raw: unknown, ctx: Ctx): ProfessionalList {
  const o = obj(raw, ctx, ["service_id", "option_id", "quantity", "addon_ids", "booking_id", "mode", "date", "sort", "timezone", "items", "no_professional", "no_professional_reason", "scheduled_alternatives"])
  return {
    serviceId: reqStr(o, "service_id", ctx),
    optionId: reqStr(o, "option_id", ctx),
    quantity: intOr(o, "quantity", ctx, 1),
    addonIds: strArr(o, "addon_ids", ctx),
    bookingId: optStr(o, "booking_id", ctx),
    mode: oneOf(o, "mode", ctx, ["scheduled", "asap"] as const),
    date: optStr(o, "date", ctx),
    sort: oneOf(o, "sort", ctx, PRO_SORTS),
    timezone: optStr(o, "timezone", ctx) || "Asia/Kolkata",
    items: arr(o, "items", ctx, decodeProfessionalCard),
    noProfessional: reqBool(o, "no_professional", ctx),
    noProfessionalReason: optOneOf(o, "no_professional_reason", ctx, ["none_available_now"] as const),
    scheduledAlternatives: arr(o, "scheduled_alternatives", ctx, decodeProfessionalCard),
  }
}

/* ── B1: a change of professional ─────────────────────────────────── */

export const CHANGE_STATUSES = ["pending_payment", "applied", "abandoned"] as const
export type ChangeStatus = (typeof CHANGE_STATUSES)[number]

export interface ProChange {
  id: string
  status: ChangeStatus
  proId: string
  proFirstName: string
  asap: boolean
  slotStart: string
  slotEnd: string
  previousTotalPaise: number
  newTotalPaise: number
  /** new − previous. */
  differencePaise: number
  /** Refunded at once when the new professional is cheaper. */
  refundPaise: number
  /** pending_payment only. */
  holdExpiresAt: string | null
  /** pending_payment only: reference doorstep_extras (the pro_change bill), paid only by the signed event. */
  paymentIntent: PaymentIntent | null
  createdAt: string
}

export function decodeProChange(raw: unknown, ctx: Ctx): ProChange {
  const o = obj(raw, ctx, ["id", "status", "pro_id", "pro_first_name", "asap", "slot_start", "slot_end", "previous_total_paise", "new_total_paise", "difference_paise", "refund_paise", "hold_expires_at", "payment_intent", "created_at"])
  return {
    id: reqStr(o, "id", ctx),
    status: oneOf(o, "status", ctx, CHANGE_STATUSES),
    proId: reqStr(o, "pro_id", ctx),
    proFirstName: reqStr(o, "pro_first_name", ctx),
    asap: reqBool(o, "asap", ctx),
    slotStart: reqStr(o, "slot_start", ctx),
    slotEnd: reqStr(o, "slot_end", ctx),
    previousTotalPaise: reqPaise(o, "previous_total_paise", ctx),
    newTotalPaise: reqPaise(o, "new_total_paise", ctx),
    differencePaise: reqPaise(o, "difference_paise", ctx),
    refundPaise: reqPaise(o, "refund_paise", ctx),
    holdExpiresAt: optStr(o, "hold_expires_at", ctx),
    paymentIntent: optObj(o, "payment_intent", ctx, decodePaymentIntent),
    createdAt: reqStr(o, "created_at", ctx),
  }
}

export interface ProChangeResult {
  booking: Booking
  change: ProChange
}

export function decodeProChangeResult(raw: unknown, ctx: Ctx): ProChangeResult {
  const o = obj(raw, ctx, ["booking", "change"])
  return { booking: reqObj(o, "booking", ctx, decodeBooking), change: reqObj(o, "change", ctx, decodeProChange) }
}
