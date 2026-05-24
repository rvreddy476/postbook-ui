// TanStack Query wrappers for the FiGo admin API.
//
// Query keys are namespaced under `['food', ...]`. Mutations invalidate
// the matching list keys + the moderation queue + the fraud top-N as
// appropriate.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query'

import * as foodApi from '@/lib/food_api'
import type {
  ComplianceReportRow,
  CouponAbuseRow,
  DeliverySLAReport,
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

const KEY = 'food' as const

// ── Reports (D1) ──────────────────────────────────────────────────────────

const reportKey = (
  kind: string,
  params: foodApi.ReportWindowParams & { threshold?: number },
) =>
  [
    KEY,
    'report',
    kind,
    params.from ?? '',
    params.to ?? '',
    params.threshold ?? '',
  ] as const

export function useFoodRestaurantSLA(
  params: foodApi.ReportWindowParams = {},
  options?: Omit<
    UseQueryOptions<RestaurantSLAReport[]>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<RestaurantSLAReport[]>({
    queryKey: reportKey('restaurant-sla', params),
    queryFn: () => foodApi.getRestaurantSLA(params),
    ...options,
  })
}

export function useFoodDeliverySLA(
  params: foodApi.ReportWindowParams = {},
  options?: Omit<UseQueryOptions<DeliverySLAReport[]>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<DeliverySLAReport[]>({
    queryKey: reportKey('delivery-sla', params),
    queryFn: () => foodApi.getDeliverySLA(params),
    ...options,
  })
}

export function useFoodPaymentRecon(
  params: foodApi.ReportWindowParams = {},
  options?: Omit<UseQueryOptions<PaymentReconRow[]>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<PaymentReconRow[]>({
    queryKey: reportKey('payment-recon', params),
    queryFn: () => foodApi.getPaymentRecon(params),
    ...options,
  })
}

export function useFoodRefundsReport(
  params: foodApi.ReportWindowParams = {},
  options?: Omit<UseQueryOptions<RefundCancelRow[]>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<RefundCancelRow[]>({
    queryKey: reportKey('refunds', params),
    queryFn: () => foodApi.getRefundsReport(params),
    ...options,
  })
}

export function useFoodCouponAbuse(
  params: foodApi.CouponAbuseParams = {},
  options?: Omit<UseQueryOptions<CouponAbuseRow[]>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<CouponAbuseRow[]>({
    queryKey: reportKey('coupon-abuse', params),
    queryFn: () => foodApi.getCouponAbuse(params),
    ...options,
  })
}

export function useFoodCompliance(
  options?: Omit<
    UseQueryOptions<ComplianceReportRow[]>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<ComplianceReportRow[]>({
    queryKey: [KEY, 'report', 'compliance'] as const,
    queryFn: () => foodApi.getCompliance(),
    ...options,
  })
}

// ── Moderation (B3) ───────────────────────────────────────────────────────

export function useFoodModerationQueue(limit = 50) {
  return useQuery<PendingModerationItem[]>({
    queryKey: [KEY, 'moderation', 'queue', limit] as const,
    queryFn: () => foodApi.getModerationQueue(limit),
  })
}

export function useFoodModerateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      itemId: string
      status: ModerationStatus
      reason?: string
    }) =>
      foodApi.moderateMenuItem(input.itemId, input.status, input.reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, 'moderation'] as const })
    },
  })
}

// ── Fraud (E) ─────────────────────────────────────────────────────────────

export function useFoodTopFraud(params: foodApi.FraudTopParams = {}) {
  return useQuery<TopFraudUserRow[]>({
    queryKey: [
      KEY,
      'fraud',
      'top',
      params.window_hours ?? '',
      params.limit ?? '',
    ] as const,
    queryFn: () => foodApi.getTopFraudUsers(params),
  })
}

// ── Tickets + refunds (B6) ────────────────────────────────────────────────

export function useFoodAdminTickets(params: foodApi.ListTicketsParams = {}) {
  return useQuery<SupportTicket[]>({
    queryKey: [
      KEY,
      'tickets',
      'admin',
      params.status ?? '',
      params.limit ?? '',
    ] as const,
    queryFn: () => foodApi.listAdminTickets(params),
  })
}

export function useFoodAdminRefunds(params: foodApi.ListTicketsParams = {}) {
  return useQuery<RefundRequest[]>({
    queryKey: [
      KEY,
      'refunds',
      'admin',
      params.status ?? '',
      params.limit ?? '',
    ] as const,
    queryFn: () => foodApi.listAdminRefunds(params),
  })
}

export function useFoodTicket(ticketId: string | undefined) {
  return useQuery<{ ticket: SupportTicket; messages: TicketMessage[] }>({
    queryKey: [KEY, 'ticket', ticketId ?? ''] as const,
    queryFn: () => foodApi.getTicketWithMessages(ticketId!),
    enabled: Boolean(ticketId),
  })
}

export function useFoodSetTicketStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { ticketId: string; status: TicketStatus }) =>
      foodApi.setTicketStatus(input.ticketId, input.status),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [KEY, 'ticket', vars.ticketId] as const })
    },
  })
}

export function useFoodDecideRefund() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      refundId: string
      status: 'approved' | 'rejected'
      reason?: string
    }) => foodApi.decideRefund(input.refundId, input.status, input.reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, 'refunds'] as const })
    },
  })
}

// ── Item reviews (B7) ─────────────────────────────────────────────────────

export function useFoodHideItemReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (reviewId: string) => foodApi.hideItemReview(reviewId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, 'item-reviews'] as const })
    },
  })
}

// ── Kitchen queue (B1) ────────────────────────────────────────────────────

export function useFoodPartnerRestaurants() {
  return useQuery({
    queryKey: [KEY, 'partner', 'restaurants'] as const,
    queryFn: () => foodApi.listPartnerRestaurants(),
  })
}

export function useFoodKitchenQueue(restaurantId: string | undefined) {
  return useQuery<KitchenOrder[]>({
    queryKey: [KEY, 'kitchen', restaurantId ?? ''] as const,
    queryFn: () => foodApi.getKitchenQueue(restaurantId!),
    enabled: Boolean(restaurantId),
    refetchInterval: 5000,
  })
}

export function usePartnerAcceptOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderId: string) => foodApi.partnerAcceptOrder(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, 'kitchen'] as const })
    },
  })
}

export function usePartnerRejectOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { orderId: string; reason?: string }) =>
      foodApi.partnerRejectOrder(input.orderId, input.reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, 'kitchen'] as const })
    },
  })
}
