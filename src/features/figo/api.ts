import api from "@/lib/api"

function idempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`
}

export interface FigoCuisine {
  id: string
  name: string
  slug: string
  image_url?: string
}

export interface FigoRestaurant {
  id: string
  name: string
  slug: string
  description?: string
  city: string
  state?: string
  is_open: boolean
  is_accepting_orders: boolean
  avg_rating: number
  rating_count: number
  min_order_amount: number
  packaging_fee: number
  avg_preparation_minutes: number
  hero_image_url?: string
  cuisines: string[]
  estimated_delivery: string
  delivery_fee_estimate: number
}

export interface FigoMenuItem {
  id: string
  restaurant_id: string
  category_id: string
  name: string
  description?: string
  food_type: string
  base_price: number
  discount_price?: number
  image_url?: string
  preparation_minutes: number
  is_available: boolean
  is_recommended: boolean
  tax_percentage: number
}

export interface FigoMenuCategory {
  id: string
  name: string
  description?: string
  sort_order: number
  items: FigoMenuItem[]
}

export interface FigoCart {
  id: string
  restaurant_id?: string
  restaurant?: string
  coupon_code?: string
  items: Array<{
    id: string
    menu_item_id: string
    name: string
    image_url?: string
    food_type: string
    quantity: number
    unit_price: number
    tax_amount: number
    line_total: number
  }>
  totals: FigoTotals
}

export interface FigoTotals {
  item_subtotal: number
  addon_total: number
  packaging_fee: number
  tax_total: number
  delivery_fee: number
  platform_fee: number
  restaurant_discount: number
  coupon_discount: number
  final_amount: number
}

export interface FigoAddress {
  id: string
  label?: string
  receiver_name?: string
  phone?: string
  address_line1: string
  address_line2?: string
  landmark?: string
  city: string
  state?: string
  country: string
  postal_code?: string
  latitude?: number
  longitude?: number
  is_default: boolean
}

export interface FigoOrder {
  id: string
  order_number: string
  restaurant_name: string
  status: string
  payment_status: string
  payment_method: string
  totals: FigoTotals
  placed_at: string
  items?: Array<{
    id: string
    name: string
    quantity: number
    unit_price: number
    line_total: number
  }>
  history?: Array<{
    from_status?: string
    to_status: string
    reason?: string
    created_at: string
  }>
}

export interface FigoLocationPoint {
  latitude: number
  longitude: number
  address_line1?: string
  city?: string
  state?: string
  recorded_at?: string
}

export interface FigoTrackingEvent {
  from_status?: string
  to_status?: string
  status?: string
  label: string
  reason?: string
  completed?: boolean
  created_at: string
  latitude?: number
  longitude?: number
}

export interface FigoOrderTracking {
  order_id: string
  order_number: string
  status: string
  timeline: FigoTrackingEvent[]
  assignment?: Record<string, unknown>
  restaurant_location?: FigoLocationPoint
  delivery_location?: FigoLocationPoint
  customer_location?: FigoLocationPoint
  estimated_delivery_minutes?: number
}

export interface FigoPaymentIntent {
  id: string
  order_id: string
  method: "COD" | "ONLINE" | "WALLET"
  status: string
  provider?: string
  provider_order_id?: string
  provider_payment_id?: string
  amount: number
  currency: string
  payment_intent?: Record<string, unknown>
}

export interface FigoSettlementGenerateResult {
  period_start: string
  period_end: string
  restaurant_settlements: FigoSettlement[]
  delivery_settlements: FigoSettlement[]
}

export interface FigoPartnerRestaurant {
  id: string
  partner_id: string
  owner_user_id: string
  name: string
  slug: string
  description?: string
  status: string
  is_open: boolean
  is_accepting_orders: boolean
  city: string
  state?: string
  min_order_amount: number
  packaging_fee: number
  created_at: string
}

export interface FigoDeliveryPartner {
  id: string
  user_id: string
  full_name: string
  phone: string
  email?: string
  status: string
  vehicle_type?: string
  vehicle_number?: string
  city?: string
  is_online: boolean
  created_at: string
}

export interface FigoDeliveryAssignment {
  id: string
  order_id: string
  order_number: string
  restaurant_name: string
  restaurant_id: string
  delivery_partner_id?: string
  status: string
  order_status: string
  delivery_fee: number
  delivery_partner_payout: number
  created_at: string
}

export interface FigoAdminDashboard {
  total_orders_today: number
  gmv_today: number
  cancelled_orders_today: number
  active_restaurants: number
  pending_restaurants: number
  pending_delivery_partners: number
  online_delivery_partners: number
}

export interface FigoDeliveryEarnings {
  deliveries_today: number
  earnings_today: number
  total_deliveries: number
  total_earnings: number
}

export interface FigoServiceArea {
  id: string
  name: string
  city: string
  state?: string
  country: string
  postal_code?: string
  center_latitude?: number
  center_longitude?: number
  radius_km: number
  is_active: boolean
}

export interface FigoRevenueReport {
  orders: number
  gmv: number
  commission: number
  refunds: number
  net_revenue: number
}

export interface FigoSettlement {
  id: string
  restaurant_id?: string
  delivery_partner_id?: string
  restaurant_name?: string
  delivery_partner_name?: string
  period_start: string
  period_end: string
  gross_amount?: number
  gross_order_amount?: number
  commission?: number
  commission_amount?: number
  refund_adjustment?: number
  payout_amount: number
  status: string
  paid_reference?: string
}

export interface FigoAuditLog {
  id: string
  actor_user_id: string
  action: string
  entity_type: string
  entity_id?: string
  new_value?: Record<string, unknown>
  created_at: string
}

// FigoWallet is retained as a type alias so any external import keeps
// compiling while the food UI removes the consumer-balance display
// (Phase 2 §D4). The food app must not display this as a consumer
// wallet — the consumer wallet is being built in wallet-service.
//
// The shape mirrors the new /v1/monetization/creator-ledger response
// for the few internal callers that still read it (e.g. analytics).
export interface FigoCreatorLedger {
  user_id?: string
  balance_paise?: number
  lifetime_earnings_paise?: number
  pending_payout_paise?: number
  currency?: string
  is_frozen?: boolean
}

/** @deprecated Use FigoCreatorLedger. Kept for back-compat through 2026-10-30. */
export type FigoWallet = FigoCreatorLedger

export interface FigoCoupon {
  id: string
  code: string
  title: string
  coupon_type: string
  discount_value: number
  max_discount_amount: number
  min_order_amount: number
  is_active: boolean
  starts_at: string
  ends_at: string
  used_count: number
}

export interface FigoOffer {
  code: string
  title: string
  description: string
}

export interface FigoHome {
  cuisines: FigoCuisine[]
  nearby_restaurants: FigoRestaurant[]
  top_rated: FigoRestaurant[]
  fast_delivery: FigoRestaurant[]
  offers: FigoOffer[]
}

export async function fetchFigoHome(city?: string): Promise<FigoHome> {
  const res = await api.get("/v1/food/home", {
    params: city ? { city } : undefined,
  })
  return res.data?.data
}

export async function fetchFigoMenu(restaurantId: string): Promise<FigoMenuCategory[]> {
  const res = await api.get(`/v1/food/restaurants/${restaurantId}/menu`)
  return res.data?.data?.categories ?? []
}

export async function fetchFigoCart(): Promise<FigoCart> {
  const res = await api.get("/v1/food/cart")
  return res.data?.data
}

export async function addFigoCartItem(menuItemId: string, clearExisting = false): Promise<FigoCart> {
  const res = await api.post("/v1/food/cart/items", {
    menu_item_id: menuItemId,
    quantity: 1,
    clear_existing: clearExisting,
  })
  return res.data?.data
}

export async function applyFigoCoupon(code: string): Promise<FigoCart> {
  const res = await api.post("/v1/food/coupons/validate", { code })
  return res.data?.data
}

export async function fetchFigoAddresses(): Promise<FigoAddress[]> {
  const res = await api.get("/v1/food/addresses")
  return res.data?.data?.items ?? []
}

export async function createFigoAddress(input: Partial<FigoAddress>): Promise<FigoAddress> {
  const res = await api.post("/v1/food/addresses", input)
  return res.data?.data
}

export async function placeFigoOrder(input: {
  address_id: string
  payment_method: "COD" | "ONLINE" | "WALLET"
  customer_instruction?: string
}): Promise<FigoOrder> {
  const res = await api.post("/v1/food/orders", input, {
    headers: { "Idempotency-Key": idempotencyKey() },
  })
  return res.data?.data
}

export async function createFigoPaymentIntent(
  orderId: string,
  method: "COD" | "ONLINE" | "WALLET",
): Promise<FigoPaymentIntent> {
  const res = await api.post(
    `/v1/food/orders/${orderId}/payments/intents`,
    { method },
    { headers: { "Idempotency-Key": idempotencyKey() } },
  )
  return res.data?.data
}

// P0.1 — the FiGo confirm-payment body MUST carry the Razorpay
// signature triple for ONLINE orders. Backend now refuses to mark an
// order paid without it (no more direct status PATCH from the
// customer-facing path). Wallet/COD confirms keep working without
// signature fields.
export type ConfirmFigoPaymentInput = {
  provider_payment_id?: string
  provider_reference?: string
  // Razorpay signature triple — required for ONLINE.
  razorpay_order_id?: string
  razorpay_payment_id?: string
  razorpay_signature?: string
  amount_minor?: number
}

export async function confirmFigoPayment(
  orderId: string,
  input: ConfirmFigoPaymentInput = {},
): Promise<FigoOrder> {
  const res = await api.post(`/v1/food/orders/${orderId}/payments/confirm`, input, {
    // Idempotency key dedupes the confirm if Razorpay's callback +
    // our explicit confirm fire concurrently (common race on
    // production checkouts).
    headers: { "Idempotency-Key": idempotencyKey() },
  })
  return res.data?.data
}

export async function fetchFigoOrders(): Promise<FigoOrder[]> {
  const res = await api.get("/v1/food/orders")
  return res.data?.data?.items ?? []
}

export async function fetchFigoOrderTracking(orderId: string): Promise<FigoOrderTracking> {
  const res = await api.get(`/v1/food/orders/${orderId}/tracking`)
  return res.data?.data
}

export async function rateFigoRestaurant(orderId: string, rating: number, review = "") {
  const res = await api.post(`/v1/food/orders/${orderId}/ratings/restaurant`, { rating, review })
  return res.data?.data
}

export async function rateFigoDelivery(orderId: string, rating: number, review = "") {
  const res = await api.post(`/v1/food/orders/${orderId}/ratings/delivery`, { rating, review })
  return res.data?.data
}

/** @deprecated Phase 2 §D4: the food UI no longer displays a wallet
 * balance. The consumer wallet is being built in wallet-service and
 * lives at /v1/wallet/balance. This helper now hits the renamed
 * creator-earnings endpoint and is kept only for any non-UI caller
 * (e.g. analytics scripts) that still needs it. */
export async function fetchFigoCreatorLedger(): Promise<FigoCreatorLedger> {
  const res = await api.get("/v1/monetization/creator-ledger")
  return res.data?.data
}

/** @deprecated Use fetchFigoCreatorLedger. Kept for back-compat through 2026-10-30. */
export const fetchFigoWallet = fetchFigoCreatorLedger

export async function fetchFigoPartnerRestaurants(): Promise<FigoPartnerRestaurant[]> {
  const res = await api.get("/v1/food/partner/restaurants")
  return res.data?.data?.items ?? []
}

export async function createFigoPartnerRestaurant(
  input: Partial<FigoPartnerRestaurant> & {
    address_line1: string
    phone?: string
    email?: string
  },
): Promise<FigoPartnerRestaurant> {
  const res = await api.post("/v1/food/partner/restaurants", input)
  return res.data?.data
}

export async function createFigoMenuCategory(
  restaurantId: string,
  input: { name: string; description?: string; sort_order?: number },
): Promise<FigoMenuCategory> {
  const res = await api.post(`/v1/food/partner/restaurants/${restaurantId}/menu/categories`, input)
  return res.data?.data
}

export async function createFigoMenuItem(
  restaurantId: string,
  input: {
    category_id: string
    name: string
    description?: string
    food_type?: string
    base_price: number
    discount_price?: number
    preparation_minutes?: number
    is_recommended?: boolean
    tax_percentage?: number
  },
): Promise<FigoMenuItem> {
  const res = await api.post(`/v1/food/partner/restaurants/${restaurantId}/menu/items`, input)
  return res.data?.data
}

export async function fetchFigoPartnerOrders(restaurantId: string): Promise<FigoOrder[]> {
  const res = await api.get(`/v1/food/partner/restaurants/${restaurantId}/orders`)
  return res.data?.data?.items ?? []
}

export async function fetchFigoPartnerSettlements(restaurantId: string): Promise<FigoSettlement[]> {
  const res = await api.get(`/v1/food/partner/restaurants/${restaurantId}/settlements`)
  return res.data?.data?.items ?? []
}

export async function fetchFigoPartnerSummary(restaurantId: string): Promise<Record<string, number | string>> {
  const res = await api.get(`/v1/food/partner/restaurants/${restaurantId}/reports/summary`)
  return res.data?.data
}

export async function updateFigoPartnerOrder(orderId: string, action: "accept" | "reject" | "mark-preparing" | "mark-ready"): Promise<FigoOrder> {
  const res = await api.post(`/v1/food/partner/orders/${orderId}/${action}`, {}, {
    headers: { "Idempotency-Key": idempotencyKey() },
  })
  return res.data?.data
}

export async function upsertFigoDeliveryPartner(input: {
  full_name: string
  phone: string
  email?: string
  vehicle_type?: string
  vehicle_number?: string
  city?: string
}): Promise<FigoDeliveryPartner> {
  const res = await api.post("/v1/food/delivery/profile", input)
  return res.data?.data
}

export async function fetchFigoDeliveryPartner(): Promise<FigoDeliveryPartner> {
  const res = await api.get("/v1/food/delivery/profile")
  return res.data?.data
}

export async function setFigoDeliveryAvailability(isOnline: boolean): Promise<FigoDeliveryPartner> {
  const res = await api.post("/v1/food/delivery/availability", { is_online: isOnline })
  return res.data?.data
}

export async function fetchFigoDeliveryAssignments(): Promise<FigoDeliveryAssignment[]> {
  const res = await api.get("/v1/food/delivery/assignments")
  return res.data?.data?.items ?? []
}

export async function fetchFigoCurrentDeliveryAssignment(): Promise<FigoDeliveryAssignment | null> {
  try {
    const res = await api.get("/v1/food/delivery/assignments/current")
    return res.data?.data
  } catch {
    return null
  }
}

export async function updateFigoDeliveryAssignment(
  assignmentId: string,
  action: "accept" | "reject" | "arrived-restaurant" | "picked-up" | "arrived-customer" | "delivered",
): Promise<FigoDeliveryAssignment> {
  const res = await api.post(`/v1/food/delivery/assignments/${assignmentId}/${action}`, {}, {
    headers: { "Idempotency-Key": idempotencyKey() },
  })
  return res.data?.data
}

export async function updateFigoDeliveryLocation(input: {
  latitude: number
  longitude: number
  accuracy_meters?: number
}): Promise<Record<string, unknown>> {
  const res = await api.post("/v1/food/delivery/location", input)
  return res.data?.data
}

export async function fetchFigoAssignmentTracking(assignmentId: string): Promise<{
  assignment: FigoDeliveryAssignment
  events: FigoTrackingEvent[]
  delivery_location?: FigoLocationPoint
}> {
  const res = await api.get(`/v1/food/delivery/assignments/${assignmentId}/tracking`)
  return res.data?.data
}

export async function fetchFigoDeliveryEarnings(): Promise<FigoDeliveryEarnings> {
  const res = await api.get("/v1/food/delivery/earnings")
  return res.data?.data
}

// ─── P2 delivery batching ───────────────────────────────────────────
//
// The batch-aware offer flow surfaces pending offers to a partner with
// a `batch` block when 2-3 same-restaurant orders are bundled into one
// pickup. Accepting the offer claims the whole batch atomically.

export interface FigoBatchMember {
  order_id: string
  sequence: number
}

export interface FigoDeliveryBatch {
  id: string
  restaurant_id: string
  status: "pending" | "assigned" | "cancelled" | "completed"
  members: FigoBatchMember[]
  created_at?: string
  assigned_at?: string
  completed_at?: string
}

export interface FigoDeliveryOfferEntry {
  id: string
  order_id: string
  delivery_partner_id: string
  status: string
  distance_km?: number
  expires_at: string
  created_at: string
  // When the offer covers a batch, the dispatch worker emits this
  // alongside the offer so the rider UI can render the bundle without
  // a second round-trip.
  batch?: FigoDeliveryBatch
  is_batch?: boolean
}

export async function fetchFigoMyDeliveryOffers(): Promise<FigoDeliveryOfferEntry[]> {
  const res = await api.get("/v1/food/delivery/offers/me")
  return res.data?.data?.offers ?? []
}

export async function acceptFigoDeliveryOffer(offerId: string): Promise<{ offer_id: string; status: string }> {
  const res = await api.post(`/v1/food/delivery/offers/${offerId}/accept`, {})
  return res.data?.data
}

export async function rejectFigoDeliveryOffer(offerId: string, reason = ""): Promise<{ offer_id: string; status: string }> {
  const res = await api.post(`/v1/food/delivery/offers/${offerId}/reject`, { reason })
  return res.data?.data
}

// fetchFigoBatchForOrder returns the batch payload (members + sequence)
// for an order that's part of a multi-pickup batch, or null when the
// order is dispatched solo. 404 → null so callers can render the
// alongside-banner conditionally.
export async function fetchFigoBatchForOrder(orderId: string): Promise<FigoDeliveryBatch | null> {
  try {
    const res = await api.get(`/v1/food/delivery/orders/${orderId}/batch`)
    return res.data?.data ?? null
  } catch {
    return null
  }
}

export async function fetchFigoDeliveryHistory(): Promise<FigoDeliveryAssignment[]> {
  const res = await api.get("/v1/food/delivery/history")
  return res.data?.data?.items ?? []
}

export async function fetchFigoAdminDashboard(): Promise<FigoAdminDashboard> {
  const res = await api.get("/v1/food/admin/dashboard")
  return res.data?.data
}

export async function fetchFigoAdminPendingRestaurants(): Promise<FigoPartnerRestaurant[]> {
  const res = await api.get("/v1/food/admin/restaurants/pending")
  return res.data?.data?.items ?? []
}

export async function reviewFigoAdminRestaurant(restaurantId: string, approve: boolean): Promise<void> {
  await api.post(`/v1/food/admin/restaurants/${restaurantId}/${approve ? "approve" : "reject"}`, {})
}

export async function fetchFigoAdminPendingDeliveryPartners(): Promise<FigoDeliveryPartner[]> {
  const res = await api.get("/v1/food/admin/delivery-partners/pending")
  return res.data?.data?.items ?? []
}

export async function reviewFigoAdminDeliveryPartner(partnerId: string, approve: boolean): Promise<void> {
  await api.post(`/v1/food/admin/delivery-partners/${partnerId}/${approve ? "approve" : "reject"}`, {})
}

export async function fetchFigoAdminOrders(): Promise<FigoOrder[]> {
  const res = await api.get("/v1/food/admin/orders")
  return res.data?.data?.items ?? []
}

export async function cancelFigoAdminOrder(orderId: string, reason: string): Promise<FigoOrder> {
  const res = await api.post(`/v1/food/admin/orders/${orderId}/cancel`, { reason })
  return res.data?.data
}

export async function refundFigoAdminOrder(orderId: string, reason: string, amount?: number) {
  const res = await api.post(`/v1/food/admin/orders/${orderId}/refund`, { reason, amount }, {
    headers: { "Idempotency-Key": idempotencyKey() },
  })
  return res.data?.data
}

export async function fetchFigoAdminCoupons(): Promise<FigoCoupon[]> {
  const res = await api.get("/v1/food/admin/coupons")
  return res.data?.data?.items ?? []
}

export async function createFigoAdminCoupon(input: {
  code: string
  title: string
  coupon_type: "FLAT" | "PERCENTAGE"
  discount_value: number
  max_discount_amount: number
  min_order_amount: number
}): Promise<{ id: string; code: string; title: string }> {
  const res = await api.post("/v1/food/admin/coupons", input)
  return res.data?.data
}

export async function fetchFigoServiceAreas(): Promise<FigoServiceArea[]> {
  const res = await api.get("/v1/food/admin/service-areas")
  return res.data?.data?.items ?? []
}

export async function createFigoServiceArea(input: {
  name: string
  city: string
  state?: string
  postal_code?: string
  radius_km?: number
}): Promise<FigoServiceArea> {
  const res = await api.post("/v1/food/admin/service-areas", {
    country: "India",
    is_active: true,
    ...input,
  })
  return res.data?.data
}

export async function fetchFigoRevenueReport(): Promise<FigoRevenueReport> {
  const res = await api.get("/v1/food/admin/reports/revenue")
  return res.data?.data
}

export async function fetchFigoAdminDeliverySettlements(): Promise<FigoSettlement[]> {
  const res = await api.get("/v1/food/admin/settlements/delivery-partners")
  return res.data?.data?.items ?? []
}

export async function fetchFigoAdminRestaurantSettlements(): Promise<FigoSettlement[]> {
  const res = await api.get("/v1/food/admin/settlements/restaurants")
  return res.data?.data?.items ?? []
}

export async function generateFigoAdminSettlements(input: {
  period_start: string
  period_end: string
  restaurant_id?: string
  delivery_partner_id?: string
}): Promise<FigoSettlementGenerateResult> {
  const res = await api.post("/v1/food/admin/settlements/generate", input, {
    headers: { "Idempotency-Key": idempotencyKey() },
  })
  return res.data?.data
}

export async function markFigoAdminDeliverySettlementPaid(settlementId: string, reference: string): Promise<FigoSettlement> {
  const res = await api.post(`/v1/food/admin/settlements/delivery-partners/${settlementId}/mark-paid`, { reference })
  return res.data?.data
}

export async function markFigoAdminRestaurantSettlementPaid(settlementId: string, reference: string): Promise<FigoSettlement> {
  const res = await api.post(`/v1/food/admin/settlements/restaurants/${settlementId}/mark-paid`, { reference })
  return res.data?.data
}

export async function fetchFigoAdminAuditLogs(): Promise<FigoAuditLog[]> {
  const res = await api.get("/v1/food/admin/audit-logs")
  return res.data?.data?.items ?? []
}
