// FiGo admin API client.
//
// Wraps the shared `api` axios instance. The food-service admin
// middleware checks `X-Scopes: admin | superadmin` (not `X-Admin-Role`
// like rider-service) — see internal/http/handler.go:requireAdminScope.
// The shared client passes through whichever scopes the user already
// has; we attach `X-Scopes: admin` defensively so an authed admin can
// reach these endpoints from this UI without depending on whatever
// upstream gateway already populated.
//
// Backend envelope: { data, error, meta }. Methods unwrap to `data`.

import api from '@/lib/api'
import type {
  ComplianceReportRow,
  CouponAbuseRow,
  DeliverySLAReport,
  ItemReview,
  KitchenOrder,
  ModerationStatus,
  PaymentReconRow,
  PendingModerationItem,
  RefundCancelRow,
  RefundRequest,
  RestaurantSLAReport,
  SupportTicket,
  TicketMessage,
  TicketStatus,
  TopFraudUserRow,
} from '@/types/food'

const ADMIN_HEADERS = { 'X-Scopes': 'admin' } as const

interface ApiEnvelope<T> {
  data: T
  error?: { message?: string }
  meta?: Record<string, unknown>
}

function unwrap<T>(envelope: ApiEnvelope<T>): T {
  return envelope.data
}

export interface ReportWindowParams {
  /** ISO-8601 datetime. Optional — backend defaults to last 24h. */
  from?: string
  to?: string
}

function windowQuery(params: ReportWindowParams): Record<string, string> {
  const q: Record<string, string> = {}
  if (params.from) q.from = params.from
  if (params.to) q.to = params.to
  return q
}

// ── Reports (D1) ──────────────────────────────────────────────────────────

export async function getRestaurantSLA(
  params: ReportWindowParams = {},
): Promise<RestaurantSLAReport[]> {
  const { data } = await api.get<ApiEnvelope<{ rows: RestaurantSLAReport[] }>>(
    '/v1/food/admin/reports/restaurant-sla',
    { params: windowQuery(params), headers: ADMIN_HEADERS },
  )
  return unwrap(data).rows ?? []
}

export async function getDeliverySLA(
  params: ReportWindowParams = {},
): Promise<DeliverySLAReport[]> {
  const { data } = await api.get<ApiEnvelope<{ rows: DeliverySLAReport[] }>>(
    '/v1/food/admin/reports/delivery-sla',
    { params: windowQuery(params), headers: ADMIN_HEADERS },
  )
  return unwrap(data).rows ?? []
}

export async function getPaymentRecon(
  params: ReportWindowParams = {},
): Promise<PaymentReconRow[]> {
  const { data } = await api.get<ApiEnvelope<{ rows: PaymentReconRow[] }>>(
    '/v1/food/admin/reports/payment-recon',
    { params: windowQuery(params), headers: ADMIN_HEADERS },
  )
  return unwrap(data).rows ?? []
}

export async function getRefundsReport(
  params: ReportWindowParams = {},
): Promise<RefundCancelRow[]> {
  const { data } = await api.get<ApiEnvelope<{ rows: RefundCancelRow[] }>>(
    '/v1/food/admin/reports/refunds',
    { params: windowQuery(params), headers: ADMIN_HEADERS },
  )
  return unwrap(data).rows ?? []
}

export interface CouponAbuseParams extends ReportWindowParams {
  threshold?: number
}

export async function getCouponAbuse(
  params: CouponAbuseParams = {},
): Promise<CouponAbuseRow[]> {
  const q = windowQuery(params)
  if (params.threshold) q.threshold = String(params.threshold)
  const { data } = await api.get<ApiEnvelope<{ rows: CouponAbuseRow[] }>>(
    '/v1/food/admin/reports/coupon-abuse',
    { params: q, headers: ADMIN_HEADERS },
  )
  return unwrap(data).rows ?? []
}

export async function getCompliance(): Promise<ComplianceReportRow[]> {
  const { data } = await api.get<ApiEnvelope<{ rows: ComplianceReportRow[] }>>(
    '/v1/food/admin/reports/compliance',
    { headers: ADMIN_HEADERS },
  )
  return unwrap(data).rows ?? []
}

// ── Moderation (B3) ───────────────────────────────────────────────────────

export async function getModerationQueue(
  limit = 50,
): Promise<PendingModerationItem[]> {
  const { data } = await api.get<
    ApiEnvelope<{ items: PendingModerationItem[] }>
  >('/v1/food/admin/moderation/queue', {
    params: { limit },
    headers: ADMIN_HEADERS,
  })
  return unwrap(data).items ?? []
}

export async function moderateMenuItem(
  itemId: string,
  status: ModerationStatus,
  reason?: string,
): Promise<void> {
  await api.post(
    `/v1/food/admin/moderation/menu-items/${itemId}`,
    { status, reason: reason ?? '' },
    { headers: ADMIN_HEADERS },
  )
}

// ── Fraud (E) ─────────────────────────────────────────────────────────────

export interface FraudTopParams {
  /** Window in hours; backend default 168 (7d). */
  window_hours?: number
  limit?: number
}

export async function getTopFraudUsers(
  params: FraudTopParams = {},
): Promise<TopFraudUserRow[]> {
  const q: Record<string, string> = {}
  if (params.window_hours) q.window_hours = String(params.window_hours)
  if (params.limit) q.limit = String(params.limit)
  const { data } = await api.get<ApiEnvelope<{ rows: TopFraudUserRow[] }>>(
    '/v1/food/admin/fraud/top',
    { params: q, headers: ADMIN_HEADERS },
  )
  return unwrap(data).rows ?? []
}

// ── Tickets + refunds (B6) ────────────────────────────────────────────────

export interface ListTicketsParams {
  status?: string
  limit?: number
}

export async function listAdminTickets(
  params: ListTicketsParams = {},
): Promise<SupportTicket[]> {
  const q: Record<string, string> = {}
  if (params.status) q.status = params.status
  if (params.limit) q.limit = String(params.limit)
  const { data } = await api.get<ApiEnvelope<{ tickets: SupportTicket[] }>>(
    '/v1/food/admin/support/tickets',
    { params: q, headers: ADMIN_HEADERS },
  )
  return unwrap(data).tickets ?? []
}

export async function listAdminRefunds(
  params: ListTicketsParams = {},
): Promise<RefundRequest[]> {
  const q: Record<string, string> = {}
  if (params.status) q.status = params.status
  if (params.limit) q.limit = String(params.limit)
  const { data } = await api.get<ApiEnvelope<{ refunds: RefundRequest[] }>>(
    '/v1/food/admin/refunds',
    { params: q, headers: ADMIN_HEADERS },
  )
  return unwrap(data).refunds ?? []
}

export async function setTicketStatus(
  ticketId: string,
  status: TicketStatus,
): Promise<void> {
  await api.post(
    `/v1/food/admin/support/tickets/${ticketId}/status`,
    { status },
    { headers: ADMIN_HEADERS },
  )
}

export async function decideRefund(
  refundId: string,
  status: 'approved' | 'rejected',
  reason?: string,
): Promise<void> {
  await api.post(
    `/v1/food/admin/refunds/${refundId}/decide`,
    { status, reason: reason ?? '' },
    { headers: ADMIN_HEADERS },
  )
}

// Admin ticket conversation — the `:ticketId/messages` endpoints are
// party-only at the food-service handler but admin scope counts as a
// party. Read view fetches the ticket + every message.
export async function getTicketWithMessages(ticketId: string): Promise<{
  ticket: SupportTicket
  messages: TicketMessage[]
}> {
  const { data } = await api.get<
    ApiEnvelope<{ ticket: SupportTicket; messages: TicketMessage[] }>
  >(`/v1/food/support/tickets/${ticketId}`, { headers: ADMIN_HEADERS })
  return unwrap(data)
}

// ── Item reviews (B7) ─────────────────────────────────────────────────────

export interface CreateItemReviewInput {
  orderId: string
  menuItemId: string
  rating: number
  review?: string
  photoUrls?: string[]
}

// Customer-facing review submit. The path takes the menu item id;
// menu_item_id in the body must match. Backend enforces:
//   - the order must be DELIVERED + owned by the caller,
//   - the item must be part of the order,
//   - UNIQUE (order, item, customer) — no duplicate reviews.
export async function createItemReview(
  in_: CreateItemReviewInput,
): Promise<ItemReview> {
  const { data } = await api.post<ApiEnvelope<ItemReview>>(
    `/v1/food/menu-items/${in_.menuItemId}/reviews`,
    {
      order_id: in_.orderId,
      menu_item_id: in_.menuItemId,
      rating: in_.rating,
      review: in_.review,
      photo_urls: in_.photoUrls ?? [],
    },
  )
  return unwrap(data)
}

// Public read — anyone can list reviews on a menu item (no headers).
export async function listItemReviews(
  menuItemId: string,
  limit = 50,
): Promise<ItemReview[]> {
  const { data } = await api.get<ApiEnvelope<{ reviews: ItemReview[] }>>(
    `/v1/food/menu-items/${menuItemId}/reviews`,
    { params: { limit } },
  )
  return unwrap(data).reviews ?? []
}

// Customer-side order read used by the review-submission flow to
// enumerate the order items the customer can rate.
export interface CustomerOrderItem {
  id: string
  menu_item_id?: string
  item_name_snapshot?: string
  name?: string
  quantity?: number
}

export interface CustomerOrder {
  id: string
  order_number?: string
  status: string
  items?: CustomerOrderItem[]
}

export async function getCustomerOrder(
  orderId: string,
): Promise<CustomerOrder> {
  const { data } = await api.get<ApiEnvelope<CustomerOrder>>(
    `/v1/food/orders/${orderId}`,
  )
  return unwrap(data)
}

export async function hideItemReview(reviewId: string): Promise<void> {
  await api.delete(`/v1/food/admin/item-reviews/${reviewId}`, {
    headers: ADMIN_HEADERS,
  })
}

// ── Kitchen queue (B1) — partner-side, not admin ──────────────────────────
//
// Partner-auth, not admin scope. Surfaced here for the partner ops
// screen even though the rest of this module is admin-only.

export interface PartnerRestaurant {
  id: string
  name: string
  slug?: string
  status?: string
  city?: string
  is_open?: boolean
  is_accepting_orders?: boolean
}

export async function listPartnerRestaurants(): Promise<PartnerRestaurant[]> {
  // No X-Scopes header — this is partner-auth (X-User-Id == owner_user_id).
  const { data } = await api.get<
    ApiEnvelope<{ items?: PartnerRestaurant[] } | PartnerRestaurant[]>
  >('/v1/food/partner/restaurants')
  const body = unwrap(data)
  if (Array.isArray(body)) return body
  return body.items ?? []
}

export async function getKitchenQueue(
  restaurantId: string,
): Promise<KitchenOrder[]> {
  const { data } = await api.get<ApiEnvelope<{ orders: KitchenOrder[] }>>(
    `/v1/food/partner/restaurants/${restaurantId}/kitchen-queue`,
  )
  return unwrap(data).orders ?? []
}

export async function partnerAcceptOrder(orderId: string): Promise<void> {
  await api.post(`/v1/food/partner/orders/${orderId}/accept`)
}

export async function partnerRejectOrder(
  orderId: string,
  reason?: string,
): Promise<void> {
  await api.post(`/v1/food/partner/orders/${orderId}/reject`, {
    reason: reason ?? '',
  })
}

// Re-export the item review type for the customer-facing pages.
export type { ItemReview }
