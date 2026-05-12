// TanStack Query wrappers for the Mopedu admin API.
//
// Stable query keys are namespaced under `['mopedu', ...]` so the sibling
// agent's hooks (live rides, complaints, audit logs, etc.) can co-exist with
// these without colliding. Mutations invalidate the relevant lists + the
// dashboard counters.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query'

import mopeduAdminApi, {
  type CityCreateInput,
  type CityUpdateInput,
  type ComplaintRow,
  type DocumentQueueRow,
  type FareRuleCreateInput,
  type FareRuleUpdateInput,
  type ListAuditLogsParams,
  type ListComplaintsParams,
  type ListCronRunsParams,
  type ListDocumentsQueueParams,
  type ListPartnersParams,
  type ListPaymentsQueueParams,
  type ListRidesParams,
  type ListSafetyIncidentsParams,
  type ListVehiclesQueueParams,
  type PartnerDetailResponse,
  type PaymentQueueRow,
  type RevenueReportParams,
  type RideHistoryRow,
  type SafetyIncidentRow,
  type VehicleQueueRow,
  type ZoneCreateInput,
  type ZoneUpdateInput,
} from '@/lib/mopedu_api'
import type {
  AuditLog,
  City,
  ComplaintStatus,
  CronRunRow,
  CustomerCohortBookingRate,
  FareRule,
  MopeduDashboardCounts,
  MopeduLiveRide,
  MopeduPaginated,
  MopeduRideDetail,
  PartnerCohortRetention,
  RevenueReport,
  RiderPartner,
  Zone,
} from '@/types/mopedu'

const KEY_ROOT = 'mopedu' as const

const dashboardKey = () => [KEY_ROOT, 'dashboard'] as const
const partnersKey = (params: ListPartnersParams) =>
  [
    KEY_ROOT,
    'partners',
    params.status ?? 'all',
    params.q ?? '',
    params.limit ?? 50,
    params.offset ?? 0,
  ] as const
const partnerDetailKey = (id: string) =>
  [KEY_ROOT, 'partner', id] as const
const documentsQueueKey = (params: ListDocumentsQueueParams) =>
  [
    KEY_ROOT,
    'documents',
    params.status ?? 'pending',
    params.limit ?? 50,
    params.offset ?? 0,
  ] as const
const vehiclesQueueKey = (params: ListVehiclesQueueParams) =>
  [
    KEY_ROOT,
    'vehicles',
    params.status ?? 'pending',
    params.limit ?? 50,
    params.offset ?? 0,
  ] as const
const paymentsQueueKey = (params: ListPaymentsQueueParams) =>
  [
    KEY_ROOT,
    'payments',
    params.status ?? 'pending',
    params.limit ?? 50,
    params.offset ?? 0,
  ] as const

// ── Dashboard ─────────────────────────────────────────────────────────────

export function useMopeduDashboard(
  options?: Omit<
    UseQueryOptions<MopeduDashboardCounts>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery({
    queryKey: dashboardKey(),
    queryFn: () => mopeduAdminApi.getDashboard(),
    staleTime: 30_000,
    ...options,
  })
}

// ── Partners ──────────────────────────────────────────────────────────────

export function useMopeduPartners(params: ListPartnersParams = {}) {
  return useQuery<MopeduPaginated<RiderPartner>>({
    queryKey: partnersKey(params),
    queryFn: () => mopeduAdminApi.listPartners(params),
    staleTime: 15_000,
  })
}

export function useMopeduPartner(id: string | undefined) {
  return useQuery<PartnerDetailResponse>({
    queryKey: partnerDetailKey(id ?? ''),
    queryFn: () => mopeduAdminApi.getPartner(id as string),
    enabled: !!id,
    staleTime: 15_000,
  })
}

function invalidatePartnerScopes(
  qc: ReturnType<typeof useQueryClient>,
  id?: string,
) {
  void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'dashboard'] })
  void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'partners'] })
  if (id) {
    void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'partner', id] })
  }
}

export function useApprovePartner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => mopeduAdminApi.approvePartner(id),
    onSuccess: (_data, id) => invalidatePartnerScopes(qc, id),
  })
}

export function useRejectPartner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; reason: string }) =>
      mopeduAdminApi.rejectPartner(vars.id, vars.reason),
    onSuccess: (_data, vars) => invalidatePartnerScopes(qc, vars.id),
  })
}

export function useSuspendPartner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; reason: string }) =>
      mopeduAdminApi.suspendPartner(vars.id, vars.reason),
    onSuccess: (_data, vars) => invalidatePartnerScopes(qc, vars.id),
  })
}

export function useBlockPartner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; reason: string }) =>
      mopeduAdminApi.blockPartner(vars.id, vars.reason),
    onSuccess: (_data, vars) => invalidatePartnerScopes(qc, vars.id),
  })
}

// ── Documents ─────────────────────────────────────────────────────────────

export function useMopeduDocumentsQueue(
  params: ListDocumentsQueueParams = { status: 'pending' },
) {
  return useQuery<MopeduPaginated<DocumentQueueRow>>({
    queryKey: documentsQueueKey(params),
    queryFn: () => mopeduAdminApi.listDocumentsQueue(params),
    staleTime: 15_000,
  })
}

function invalidateDocumentScopes(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'dashboard'] })
  void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'documents'] })
  void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'partner'] })
  void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'partners'] })
}

export function useVerifyDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => mopeduAdminApi.verifyDocument(id),
    onSuccess: () => invalidateDocumentScopes(qc),
  })
}

export function useRejectDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; reason: string }) =>
      mopeduAdminApi.rejectDocument(vars.id, vars.reason),
    onSuccess: () => invalidateDocumentScopes(qc),
  })
}

// ── Vehicles ──────────────────────────────────────────────────────────────

export function useMopeduVehiclesQueue(
  params: ListVehiclesQueueParams = { status: 'pending' },
) {
  return useQuery<MopeduPaginated<VehicleQueueRow>>({
    queryKey: vehiclesQueueKey(params),
    queryFn: () => mopeduAdminApi.listVehiclesQueue(params),
    staleTime: 15_000,
  })
}

function invalidateVehicleScopes(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'dashboard'] })
  void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'vehicles'] })
  void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'partner'] })
}

export function useVerifyVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => mopeduAdminApi.verifyVehicle(id),
    onSuccess: () => invalidateVehicleScopes(qc),
  })
}

export function useRejectVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; reason: string }) =>
      mopeduAdminApi.rejectVehicle(vars.id, vars.reason),
    onSuccess: () => invalidateVehicleScopes(qc),
  })
}

// ── Payments ──────────────────────────────────────────────────────────────

export function useMopeduPaymentsQueue(
  params: ListPaymentsQueueParams = { status: 'pending' },
) {
  return useQuery<MopeduPaginated<PaymentQueueRow>>({
    queryKey: paymentsQueueKey(params),
    queryFn: () => mopeduAdminApi.listPaymentsQueue(params),
    staleTime: 15_000,
  })
}

function invalidatePaymentScopes(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'dashboard'] })
  void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'payments'] })
  void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'partner'] })
}

export function useVerifyPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => mopeduAdminApi.verifyPayment(id),
    onSuccess: () => invalidatePaymentScopes(qc),
  })
}

export function useRejectPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; reason: string }) =>
      mopeduAdminApi.rejectPayment(vars.id, vars.reason),
    onSuccess: () => invalidatePaymentScopes(qc),
  })
}

// ── Rides (history + live + detail + cancel) ──────────────────────────────

const ridesKey = (params: ListRidesParams) =>
  [
    KEY_ROOT,
    'rides',
    params.status ?? 'all',
    params.q ?? '',
    params.start ?? '',
    params.end ?? '',
    params.limit ?? 50,
    params.offset ?? 0,
  ] as const
const liveRidesKey = () => [KEY_ROOT, 'rides', 'live'] as const
const rideDetailKey = (id: string) => [KEY_ROOT, 'ride', id] as const

export function useMopeduRides(params: ListRidesParams = {}) {
  return useQuery<MopeduPaginated<RideHistoryRow>>({
    queryKey: ridesKey(params),
    queryFn: () => mopeduAdminApi.listRides(params),
    staleTime: 15_000,
  })
}

export function useMopeduLiveRides() {
  return useQuery<MopeduLiveRide[]>({
    queryKey: liveRidesKey(),
    queryFn: () => mopeduAdminApi.listLiveRides(),
    refetchInterval: 10_000,
    staleTime: 0,
  })
}

export function useMopeduRideDetail(id: string | undefined) {
  return useQuery<MopeduRideDetail>({
    queryKey: rideDetailKey(id ?? ''),
    queryFn: () => mopeduAdminApi.getRide(id as string),
    enabled: !!id,
    staleTime: 5_000,
  })
}

export function useCancelMopeduRide() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; reason: string }) =>
      mopeduAdminApi.cancelRide(vars.id, vars.reason),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'dashboard'] })
      void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'rides'] })
      void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'ride', vars.id] })
    },
  })
}

// ── Complaints ────────────────────────────────────────────────────────────

const complaintsKey = (params: ListComplaintsParams) =>
  [
    KEY_ROOT,
    'complaints',
    params.status ?? 'open',
    params.limit ?? 50,
    params.offset ?? 0,
  ] as const

export function useMopeduComplaints(
  params: ListComplaintsParams = { status: 'open' },
) {
  return useQuery<MopeduPaginated<ComplaintRow>>({
    queryKey: complaintsKey(params),
    queryFn: () => mopeduAdminApi.listComplaints(params),
    staleTime: 15_000,
  })
}

export function useUpdateMopeduComplaint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      id: string
      status: ComplaintStatus
      note?: string
    }) =>
      mopeduAdminApi.updateComplaintStatus(vars.id, vars.status, vars.note),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'dashboard'] })
      void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'complaints'] })
    },
  })
}

// ── Safety incidents ──────────────────────────────────────────────────────

const safetyIncidentsKey = (params: ListSafetyIncidentsParams) =>
  [
    KEY_ROOT,
    'safety-incidents',
    params.status ?? 'open',
    params.severity ?? 'all',
    params.limit ?? 50,
    params.offset ?? 0,
  ] as const

export function useMopeduSafetyIncidents(
  params: ListSafetyIncidentsParams = { status: 'open' },
) {
  return useQuery<MopeduPaginated<SafetyIncidentRow>>({
    queryKey: safetyIncidentsKey(params),
    queryFn: () => mopeduAdminApi.listSafetyIncidents(params),
    staleTime: 10_000,
  })
}

function invalidateSafetyScopes(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'dashboard'] })
  void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'safety-incidents'] })
}

export function useAcknowledgeSafetyIncident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      mopeduAdminApi.acknowledgeSafetyIncident(id),
    onSuccess: () => invalidateSafetyScopes(qc),
  })
}

export function useResolveSafetyIncident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; note: string }) =>
      mopeduAdminApi.resolveSafetyIncident(vars.id, vars.note),
    onSuccess: () => invalidateSafetyScopes(qc),
  })
}

// ── Cities / Zones / Fare rules ───────────────────────────────────────────

const citiesKey = () => [KEY_ROOT, 'cities'] as const
const zonesKey = (cityId?: string) =>
  [KEY_ROOT, 'zones', cityId ?? 'all'] as const
const fareRulesKey = (cityId?: string) =>
  [KEY_ROOT, 'fare-rules', cityId ?? 'all'] as const

export function useMopeduCities() {
  return useQuery<City[]>({
    queryKey: citiesKey(),
    queryFn: () => mopeduAdminApi.listCities(),
    staleTime: 60_000,
  })
}

export function useCreateMopeduCity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CityCreateInput) => mopeduAdminApi.createCity(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'cities'] })
      void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'dashboard'] })
    },
  })
}

export function useUpdateMopeduCity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; body: CityUpdateInput }) =>
      mopeduAdminApi.updateCity(vars.id, vars.body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'cities'] })
      void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'dashboard'] })
    },
  })
}

export function useMopeduZones(cityId?: string) {
  return useQuery<Zone[]>({
    queryKey: zonesKey(cityId),
    queryFn: () => mopeduAdminApi.listZones(cityId),
    staleTime: 30_000,
  })
}

export function useCreateMopeduZone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ZoneCreateInput) => mopeduAdminApi.createZone(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'zones'] })
    },
  })
}

export function useUpdateMopeduZone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; body: ZoneUpdateInput }) =>
      mopeduAdminApi.updateZone(vars.id, vars.body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'zones'] })
    },
  })
}

export function useMopeduFareRules(cityId?: string) {
  return useQuery<FareRule[]>({
    queryKey: fareRulesKey(cityId),
    queryFn: () => mopeduAdminApi.listFareRules(cityId),
    staleTime: 30_000,
  })
}

export function useCreateMopeduFareRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: FareRuleCreateInput) =>
      mopeduAdminApi.createFareRule(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'fare-rules'] })
    },
  })
}

export function useUpdateMopeduFareRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; body: FareRuleUpdateInput }) =>
      mopeduAdminApi.updateFareRule(vars.id, vars.body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY_ROOT, 'fare-rules'] })
    },
  })
}

// ── Audit logs ────────────────────────────────────────────────────────────

const auditLogsKey = (params: ListAuditLogsParams) =>
  [
    KEY_ROOT,
    'audit-logs',
    params.actor ?? '',
    params.action ?? '',
    params.target_kind ?? '',
    params.since ?? '',
    params.limit ?? 50,
    params.offset ?? 0,
  ] as const

export function useMopeduAuditLogs(params: ListAuditLogsParams = {}) {
  return useQuery<MopeduPaginated<AuditLog>>({
    queryKey: auditLogsKey(params),
    queryFn: () => mopeduAdminApi.listAuditLogs(params),
    staleTime: 15_000,
  })
}

// ── Reports (Sprint 4) ────────────────────────────────────────────────────

const revenueReportKey = (params: RevenueReportParams) =>
  [
    KEY_ROOT,
    'reports',
    'revenue',
    params.by,
    params.since,
    params.until,
  ] as const

const partnerCohortKey = (cohort_month: string) =>
  [KEY_ROOT, 'reports', 'partner-cohort', cohort_month] as const

const customerCohortKey = (cohort_month: string) =>
  [KEY_ROOT, 'reports', 'customer-cohort', cohort_month] as const

export function useMopeduRevenueReport(params: RevenueReportParams) {
  return useQuery<RevenueReport>({
    queryKey: revenueReportKey(params),
    queryFn: () => mopeduAdminApi.getRevenueReport(params),
    enabled: !!params.since && !!params.until,
    staleTime: 60_000,
  })
}

export function useMopeduPartnerCohortRetention(cohort_month: string) {
  return useQuery<PartnerCohortRetention>({
    queryKey: partnerCohortKey(cohort_month),
    queryFn: () => mopeduAdminApi.getPartnerCohortRetention(cohort_month),
    enabled: !!cohort_month,
    staleTime: 60_000,
  })
}

export function useMopeduCustomerCohortBookingRate(cohort_month: string) {
  return useQuery<CustomerCohortBookingRate>({
    queryKey: customerCohortKey(cohort_month),
    queryFn: () =>
      mopeduAdminApi.getCustomerCohortBookingRate(cohort_month),
    enabled: !!cohort_month,
    staleTime: 60_000,
  })
}

// ── Cron runs (Sprint 4) ──────────────────────────────────────────────────

const cronRunsKey = (params: ListCronRunsParams) =>
  [
    KEY_ROOT,
    'cron-runs',
    params.job ?? '',
    params.since ?? '',
    params.limit ?? 50,
    params.offset ?? 0,
  ] as const

export function useMopeduCronRuns(params: ListCronRunsParams = {}) {
  return useQuery<MopeduPaginated<CronRunRow>>({
    queryKey: cronRunsKey(params),
    queryFn: () => mopeduAdminApi.getCronRuns(params),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}
