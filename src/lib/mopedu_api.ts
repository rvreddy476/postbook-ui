// Mopedu admin API client.
//
// Wraps the shared `api` axios instance and forces the `X-Admin-Role: rider:admin`
// header on every call routed through this module. The shared client also
// auto-injects this header for any URL containing `/v1/rider/admin/`, so the
// extra `headers` spread here is belt-and-suspenders for callers passing
// custom configs.
//
// Backend envelope shape: `{ data, error, meta }` per spec §17. Methods here
// unwrap to `data` for ergonomics.

import api from '@/lib/api'
import type {
  AuditLog,
  City,
  CityFeatureFlags,
  Complaint,
  ComplaintStatus,
  CronRunRow,
  CustomerCohortBookingRate,
  FareRule,
  MopeduDashboardCounts,
  MopeduLiveRide,
  MopeduPaginated,
  MopeduRide,
  MopeduRideDetail,
  MatchingHealthRow,
  PartnerCohortRetention,
  PartnerComplianceRow,
  PartnerQualityRow,
  RevenueReport,
  RiderDocument,
  SafetyIncidentReportRow,
  SupplyDemandRow,
  RiderPartner,
  RiderVehicle,
  SafetyIncident,
  SafetyIncidentSeverity,
  SafetyIncidentStatus,
  SubscriptionPayment,
  VehicleType,
  Zone,
} from '@/types/mopedu'

const ADMIN_HEADERS = { 'X-Admin-Role': 'rider:admin' } as const

interface ApiEnvelope<T> {
  data: T
  error?: { message?: string }
  meta?: Record<string, unknown>
}

// ── Dashboard ─────────────────────────────────────────────────────────────

export async function getDashboard(): Promise<MopeduDashboardCounts> {
  const res = await api.get<ApiEnvelope<MopeduDashboardCounts>>(
    '/v1/rider/admin/dashboard',
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

// ── Partners ──────────────────────────────────────────────────────────────

export interface ListPartnersParams {
  status?: string
  q?: string
  limit?: number
  offset?: number
}

export interface PartnerDetailResponse {
  partner: RiderPartner
  documents: RiderDocument[]
  vehicles: RiderVehicle[]
  vehicle_documents: RiderDocument[]
  subscription_payments: SubscriptionPayment[]
  recent_rides: MopeduRide[]
}

export async function listPartners(
  params: ListPartnersParams = {},
): Promise<MopeduPaginated<RiderPartner>> {
  const res = await api.get<ApiEnvelope<MopeduPaginated<RiderPartner>>>(
    '/v1/rider/admin/partners',
    { headers: ADMIN_HEADERS, params },
  )
  return res.data.data
}

export async function getPartner(id: string): Promise<PartnerDetailResponse> {
  const res = await api.get<ApiEnvelope<PartnerDetailResponse>>(
    `/v1/rider/admin/partners/${id}`,
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

export async function approvePartner(id: string): Promise<RiderPartner> {
  const res = await api.post<ApiEnvelope<RiderPartner>>(
    `/v1/rider/admin/partners/${id}/approve`,
    {},
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

export async function rejectPartner(
  id: string,
  reason: string,
): Promise<RiderPartner> {
  const res = await api.post<ApiEnvelope<RiderPartner>>(
    `/v1/rider/admin/partners/${id}/reject`,
    { reason },
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

export async function suspendPartner(
  id: string,
  reason: string,
): Promise<RiderPartner> {
  const res = await api.post<ApiEnvelope<RiderPartner>>(
    `/v1/rider/admin/partners/${id}/suspend`,
    { reason },
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

export async function blockPartner(
  id: string,
  reason: string,
): Promise<RiderPartner> {
  const res = await api.post<ApiEnvelope<RiderPartner>>(
    `/v1/rider/admin/partners/${id}/block`,
    { reason },
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

// ── Documents queue ───────────────────────────────────────────────────────

export interface ListDocumentsQueueParams {
  status?: string
  limit?: number
  offset?: number
}

export interface DocumentQueueRow extends RiderDocument {
  partner_id?: string
  partner_name?: string
}

export async function listDocumentsQueue(
  params: ListDocumentsQueueParams,
): Promise<MopeduPaginated<DocumentQueueRow>> {
  const res = await api.get<ApiEnvelope<MopeduPaginated<DocumentQueueRow>>>(
    '/v1/rider/admin/documents',
    { headers: ADMIN_HEADERS, params },
  )
  return res.data.data
}

export async function verifyDocument(id: string): Promise<RiderDocument> {
  const res = await api.post<ApiEnvelope<RiderDocument>>(
    `/v1/rider/admin/documents/${id}/verify`,
    {},
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

export async function rejectDocument(
  id: string,
  reason: string,
): Promise<RiderDocument> {
  const res = await api.post<ApiEnvelope<RiderDocument>>(
    `/v1/rider/admin/documents/${id}/reject`,
    { reason },
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

// ── Vehicles queue ────────────────────────────────────────────────────────

export interface ListVehiclesQueueParams {
  status?: string
  limit?: number
  offset?: number
}

export interface VehicleQueueRow extends RiderVehicle {
  partner_name?: string
  thumbnail_url?: string
}

export async function listVehiclesQueue(
  params: ListVehiclesQueueParams,
): Promise<MopeduPaginated<VehicleQueueRow>> {
  const res = await api.get<ApiEnvelope<MopeduPaginated<VehicleQueueRow>>>(
    '/v1/rider/admin/vehicles',
    { headers: ADMIN_HEADERS, params },
  )
  return res.data.data
}

export async function verifyVehicle(id: string): Promise<RiderVehicle> {
  const res = await api.post<ApiEnvelope<RiderVehicle>>(
    `/v1/rider/admin/vehicles/${id}/verify`,
    {},
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

export async function rejectVehicle(
  id: string,
  reason: string,
): Promise<RiderVehicle> {
  const res = await api.post<ApiEnvelope<RiderVehicle>>(
    `/v1/rider/admin/vehicles/${id}/reject`,
    { reason },
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

// ── Payments queue ────────────────────────────────────────────────────────

export interface ListPaymentsQueueParams {
  status?: string
  limit?: number
  offset?: number
}

export interface PaymentQueueRow extends SubscriptionPayment {
  partner_name?: string
  plan_name?: string
}

export async function listPaymentsQueue(
  params: ListPaymentsQueueParams,
): Promise<MopeduPaginated<PaymentQueueRow>> {
  const res = await api.get<ApiEnvelope<MopeduPaginated<PaymentQueueRow>>>(
    '/v1/rider/admin/payments',
    { headers: ADMIN_HEADERS, params },
  )
  return res.data.data
}

export async function verifyPayment(id: string): Promise<SubscriptionPayment> {
  const res = await api.post<ApiEnvelope<SubscriptionPayment>>(
    `/v1/rider/admin/payments/${id}/verify`,
    {},
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

export async function rejectPayment(
  id: string,
  reason: string,
): Promise<SubscriptionPayment> {
  const res = await api.post<ApiEnvelope<SubscriptionPayment>>(
    `/v1/rider/admin/payments/${id}/reject`,
    { reason },
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

// ── Rides (history + live + detail + cancel) ──────────────────────────────

export interface ListRidesParams {
  status?: string
  q?: string
  start?: string
  end?: string
  limit?: number
  offset?: number
}

export interface RideHistoryRow extends MopeduRide {
  customer_name?: string
  partner_name?: string
  partner_phone?: string
  vehicle_number?: string
}

export async function listRides(
  params: ListRidesParams = {},
): Promise<MopeduPaginated<RideHistoryRow>> {
  const res = await api.get<ApiEnvelope<MopeduPaginated<RideHistoryRow>>>(
    '/v1/rider/admin/rides',
    { headers: ADMIN_HEADERS, params },
  )
  return res.data.data
}

export async function listLiveRides(): Promise<MopeduLiveRide[]> {
  const res = await api.get<ApiEnvelope<MopeduLiveRide[]>>(
    '/v1/rider/admin/rides/live',
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

export async function getRide(id: string): Promise<MopeduRideDetail> {
  const res = await api.get<ApiEnvelope<MopeduRideDetail>>(
    `/v1/rider/admin/rides/${id}`,
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

export async function cancelRide(
  id: string,
  reason: string,
): Promise<MopeduRide> {
  const res = await api.post<ApiEnvelope<MopeduRide>>(
    `/v1/rider/admin/rides/${id}/cancel`,
    { reason },
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

// ── Complaints ────────────────────────────────────────────────────────────

export interface ListComplaintsParams {
  status?: ComplaintStatus | 'all'
  limit?: number
  offset?: number
}

export interface ComplaintRow extends Complaint {
  customer_name?: string
  partner_name?: string
}

export async function listComplaints(
  params: ListComplaintsParams = {},
): Promise<MopeduPaginated<ComplaintRow>> {
  const res = await api.get<ApiEnvelope<MopeduPaginated<ComplaintRow>>>(
    '/v1/rider/admin/complaints',
    { headers: ADMIN_HEADERS, params },
  )
  return res.data.data
}

export async function updateComplaintStatus(
  id: string,
  status: ComplaintStatus,
  note?: string,
): Promise<Complaint> {
  const res = await api.post<ApiEnvelope<Complaint>>(
    `/v1/rider/admin/complaints/${id}/update-status`,
    { status, note },
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

// ── Safety incidents ──────────────────────────────────────────────────────

export interface ListSafetyIncidentsParams {
  status?: SafetyIncidentStatus | 'all'
  severity?: SafetyIncidentSeverity
  limit?: number
  offset?: number
}

export interface SafetyIncidentRow extends SafetyIncident {
  customer_name?: string
  partner_name?: string
}

export async function listSafetyIncidents(
  params: ListSafetyIncidentsParams = {},
): Promise<MopeduPaginated<SafetyIncidentRow>> {
  const res = await api.get<ApiEnvelope<MopeduPaginated<SafetyIncidentRow>>>(
    '/v1/rider/admin/safety-incidents',
    { headers: ADMIN_HEADERS, params },
  )
  return res.data.data
}

export async function acknowledgeSafetyIncident(
  id: string,
): Promise<SafetyIncident> {
  const res = await api.post<ApiEnvelope<SafetyIncident>>(
    `/v1/rider/admin/safety-incidents/${id}/acknowledge`,
    {},
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

export async function resolveSafetyIncident(
  id: string,
  note: string,
): Promise<SafetyIncident> {
  const res = await api.post<ApiEnvelope<SafetyIncident>>(
    `/v1/rider/admin/safety-incidents/${id}/resolve`,
    { note },
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

// ── Cities ────────────────────────────────────────────────────────────────

export interface CityCreateInput {
  name: string
  state?: string
  country: string
  currency_code: string
  is_active?: boolean
  feature_flags?: CityFeatureFlags
}

export type CityUpdateInput = Partial<CityCreateInput>

export async function listCities(): Promise<City[]> {
  const res = await api.get<ApiEnvelope<City[]>>(
    '/v1/rider/admin/cities',
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

export async function createCity(body: CityCreateInput): Promise<City> {
  const res = await api.post<ApiEnvelope<City>>(
    '/v1/rider/admin/cities',
    body,
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

export async function updateCity(
  id: string,
  body: CityUpdateInput,
): Promise<City> {
  const res = await api.patch<ApiEnvelope<City>>(
    `/v1/rider/admin/cities/${id}`,
    body,
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

// ── Zones ─────────────────────────────────────────────────────────────────

export interface ZoneCreateInput {
  city_id: string
  name: string
  boundary?: string
  is_active?: boolean
}

export type ZoneUpdateInput = Partial<ZoneCreateInput>

export async function listZones(cityId?: string): Promise<Zone[]> {
  const res = await api.get<ApiEnvelope<Zone[]>>(
    '/v1/rider/admin/zones',
    {
      headers: ADMIN_HEADERS,
      params: cityId ? { city_id: cityId } : undefined,
    },
  )
  return res.data.data
}

export async function createZone(body: ZoneCreateInput): Promise<Zone> {
  const res = await api.post<ApiEnvelope<Zone>>(
    '/v1/rider/admin/zones',
    body,
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

export async function updateZone(
  id: string,
  body: ZoneUpdateInput,
): Promise<Zone> {
  const res = await api.patch<ApiEnvelope<Zone>>(
    `/v1/rider/admin/zones/${id}`,
    body,
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

// ── Fare rules ────────────────────────────────────────────────────────────

export interface FareRuleCreateInput {
  city_id: string
  vehicle_type: VehicleType
  base_fare_paise: number
  per_km_paise: number
  per_minute_paise: number
  minimum_fare_paise: number
  surge_multiplier: number
  cancellation_fee_paise: number
  tax_rate_pct: number
  is_active?: boolean
}

export type FareRuleUpdateInput = Partial<FareRuleCreateInput>

export async function listFareRules(cityId?: string): Promise<FareRule[]> {
  const res = await api.get<ApiEnvelope<FareRule[]>>(
    '/v1/rider/admin/fare-rules',
    {
      headers: ADMIN_HEADERS,
      params: cityId ? { city_id: cityId } : undefined,
    },
  )
  return res.data.data
}

export async function createFareRule(
  body: FareRuleCreateInput,
): Promise<FareRule> {
  const res = await api.post<ApiEnvelope<FareRule>>(
    '/v1/rider/admin/fare-rules',
    body,
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

export async function updateFareRule(
  id: string,
  body: FareRuleUpdateInput,
): Promise<FareRule> {
  const res = await api.patch<ApiEnvelope<FareRule>>(
    `/v1/rider/admin/fare-rules/${id}`,
    body,
    { headers: ADMIN_HEADERS },
  )
  return res.data.data
}

// ── Audit logs ────────────────────────────────────────────────────────────

export interface ListAuditLogsParams {
  actor?: string
  action?: string
  target_kind?: string
  since?: string
  limit?: number
  offset?: number
}

export async function listAuditLogs(
  params: ListAuditLogsParams = {},
): Promise<MopeduPaginated<AuditLog>> {
  const res = await api.get<ApiEnvelope<MopeduPaginated<AuditLog>>>(
    '/v1/rider/admin/audit-logs',
    { headers: ADMIN_HEADERS, params },
  )
  return res.data.data
}

// ── Reports (Sprint 4) ────────────────────────────────────────────────────

export interface RevenueReportParams {
  by: 'plan' | 'city'
  since: string
  until: string
}

export async function getRevenueReport(
  params: RevenueReportParams,
): Promise<RevenueReport> {
  const res = await api.get<ApiEnvelope<RevenueReport>>(
    '/v1/rider/admin/reports/revenue',
    { headers: ADMIN_HEADERS, params },
  )
  return res.data.data
}

export async function getPartnerCohortRetention(
  cohort_month: string,
): Promise<PartnerCohortRetention> {
  const res = await api.get<ApiEnvelope<PartnerCohortRetention>>(
    '/v1/rider/admin/reports/cohort-retention',
    { headers: ADMIN_HEADERS, params: { cohort_month } },
  )
  return res.data.data
}

export async function getCustomerCohortBookingRate(
  cohort_month: string,
): Promise<CustomerCohortBookingRate> {
  const res = await api.get<ApiEnvelope<CustomerCohortBookingRate>>(
    '/v1/rider/admin/reports/customer-cohort',
    { headers: ADMIN_HEADERS, params: { cohort_month } },
  )
  return res.data.data
}

// ── Cron runs (Sprint 4) ──────────────────────────────────────────────────

export interface ListCronRunsParams {
  job?: string
  since?: string
  limit?: number
  offset?: number
}

export async function getCronRuns(
  params: ListCronRunsParams = {},
): Promise<MopeduPaginated<CronRunRow>> {
  const res = await api.get<ApiEnvelope<MopeduPaginated<CronRunRow>>>(
    '/v1/rider/admin/reports/cron-runs',
    { headers: ADMIN_HEADERS, params },
  )
  return res.data.data
}

// Default export bundle for ergonomic access.
const mopeduAdminApi = {
  getDashboard,
  listPartners,
  getPartner,
  approvePartner,
  rejectPartner,
  suspendPartner,
  blockPartner,
  listDocumentsQueue,
  verifyDocument,
  rejectDocument,
  listVehiclesQueue,
  verifyVehicle,
  rejectVehicle,
  listPaymentsQueue,
  verifyPayment,
  rejectPayment,
  // Rides
  listRides,
  listLiveRides,
  getRide,
  cancelRide,
  // Complaints
  listComplaints,
  updateComplaintStatus,
  // Safety
  listSafetyIncidents,
  acknowledgeSafetyIncident,
  resolveSafetyIncident,
  // Geo
  listCities,
  createCity,
  updateCity,
  listZones,
  createZone,
  updateZone,
  listFareRules,
  createFareRule,
  updateFareRule,
  // Audit
  listAuditLogs,
  // Reports + cron (Sprint 4)
  getRevenueReport,
  getPartnerCohortRetention,
  getCustomerCohortBookingRate,
  getCronRuns,
  // D2 reports (Wave D2)
  getMatchingHealth,
  getPartnerQuality,
  getSupplyDemand,
  getSafetyIncidentsReport,
  getPartnerComplianceReport,
}

export default mopeduAdminApi

// ── D2 reports (Wave D2) ──────────────────────────────────────────────────

export interface D2WindowParams {
  from?: string
  to?: string
}

function windowQuery(params: D2WindowParams): Record<string, string> {
  const q: Record<string, string> = {}
  if (params.from) q.from = params.from
  if (params.to) q.to = params.to
  return q
}

export async function getMatchingHealth(
  params: D2WindowParams = {},
): Promise<MatchingHealthRow[]> {
  const { data } = await api.get<{ data: { rows: MatchingHealthRow[] } }>(
    '/v1/rider/admin/reports/matching-health',
    { headers: ADMIN_HEADERS, params: windowQuery(params) },
  )
  return data.data.rows ?? []
}

export async function getPartnerQuality(
  params: D2WindowParams = {},
): Promise<PartnerQualityRow[]> {
  const { data } = await api.get<{ data: { rows: PartnerQualityRow[] } }>(
    '/v1/rider/admin/reports/partner-quality',
    { headers: ADMIN_HEADERS, params: windowQuery(params) },
  )
  return data.data.rows ?? []
}

export async function getSupplyDemand(
  params: D2WindowParams = {},
): Promise<SupplyDemandRow[]> {
  const { data } = await api.get<{ data: { rows: SupplyDemandRow[] } }>(
    '/v1/rider/admin/reports/supply-demand',
    { headers: ADMIN_HEADERS, params: windowQuery(params) },
  )
  return data.data.rows ?? []
}

export async function getSafetyIncidentsReport(
  params: D2WindowParams = {},
): Promise<SafetyIncidentReportRow[]> {
  const { data } = await api.get<{
    data: { rows: SafetyIncidentReportRow[] }
  }>('/v1/rider/admin/reports/safety', {
    headers: ADMIN_HEADERS,
    params: windowQuery(params),
  })
  return data.data.rows ?? []
}

export async function getPartnerComplianceReport(
  city?: string,
): Promise<PartnerComplianceRow[]> {
  const q: Record<string, string> = {}
  if (city) q.city = city
  const { data } = await api.get<{ data: { rows: PartnerComplianceRow[] } }>(
    '/v1/rider/admin/reports/compliance',
    { headers: ADMIN_HEADERS, params: q },
  )
  return data.data.rows ?? []
}
