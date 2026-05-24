"use client"

// Mopedu admin reports — original three (Sprint 4) + five D2 tabs:
//   • Revenue, Partner retention, Customer cohort.
//   • D2: Matching health, Partner quality, Supply/demand, Safety,
//     Partner compliance.

import { useMemo, useState } from "react"
import { Loader2 } from "lucide-react"

import {
  useMopeduCustomerCohortBookingRate,
  useMopeduMatchingHealth,
  useMopeduPartnerCohortRetention,
  useMopeduPartnerCompliance,
  useMopeduPartnerQuality,
  useMopeduRevenueReport,
  useMopeduSafetyReport,
  useMopeduSupplyDemand,
} from "@/hooks/useMopeduAdmin"
import type {
  CustomerCohortBookingRate,
  MatchingHealthRow,
  PartnerCohortRetention,
  PartnerComplianceRow,
  PartnerQualityRow,
  RevenueReport,
  RevenueReportRow,
  SafetyIncidentReportRow,
  SupplyDemandRow,
} from "@/types/mopedu"

import {
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  classNames,
  errorMessage,
  paiseToRupees,
} from "../_shared"

type ReportsTab =
  | "revenue"
  | "partner_retention"
  | "customer_cohort"
  | "matching_health"
  | "partner_quality"
  | "supply_demand"
  | "safety"
  | "partner_compliance"

const TABS: Array<{ key: ReportsTab; label: string }> = [
  { key: "revenue", label: "Revenue" },
  { key: "partner_retention", label: "Partner retention" },
  { key: "customer_cohort", label: "Customer cohort" },
  { key: "matching_health", label: "Matching health" },
  { key: "partner_quality", label: "Partner quality" },
  { key: "supply_demand", label: "Supply / demand" },
  { key: "safety", label: "Safety" },
  { key: "partner_compliance", label: "Compliance" },
]

// ── Date helpers ──────────────────────────────────────────────────────────

function todayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

function monthsAgoIso(months: number): string {
  // Returns "YYYY-MM" relative to today.
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - months)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

// ── Page shell ────────────────────────────────────────────────────────────

export default function MopeduReportsPage() {
  const [tab, setTab] = useState<ReportsTab>("revenue")
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-brand-divider bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((t) => {
            const active = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={classNames(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "border-brand-text bg-brand-text text-white"
                    : "border-gray-300 bg-white text-brand-text/70 hover:bg-gray-50",
                )}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {tab === "revenue" ? <RevenueTab /> : null}
      {tab === "partner_retention" ? <PartnerRetentionTab /> : null}
      {tab === "customer_cohort" ? <CustomerCohortTab /> : null}
      {tab === "matching_health" ? <MatchingHealthTab /> : null}
      {tab === "partner_quality" ? <PartnerQualityTab /> : null}
      {tab === "supply_demand" ? <SupplyDemandTab /> : null}
      {tab === "safety" ? <SafetyTab /> : null}
      {tab === "partner_compliance" ? <PartnerComplianceTab /> : null}
    </div>
  )
}

// ── Revenue tab ───────────────────────────────────────────────────────────

type SortKey =
  | "group_name"
  | "subscriptions_count"
  | "subscriptions_revenue_paise"
  | "rides_count"
  | "rides_completed"
  | "rides_cancelled"
  | "fare_total_paise"
  | "cancellation_fees_paise"

type SortDir = "asc" | "desc"

function RevenueTab() {
  const [by, setBy] = useState<"plan" | "city">("plan")
  const [since, setSince] = useState<string>(daysAgoIso(30))
  const [until, setUntil] = useState<string>(todayIso())
  const [sortKey, setSortKey] = useState<SortKey>("fare_total_paise")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const params = useMemo(
    () => ({ by, since, until }),
    [by, since, until],
  )
  const report = useMopeduRevenueReport(params)
  const data = report.data

  const sortedRows = useMemo(() => {
    const rows = data?.rows ?? []
    const out = [...rows]
    out.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av
      }
      const as = String(av ?? "")
      const bs = String(bv ?? "")
      return sortDir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as)
    })
    return out
  }, [data, sortKey, sortDir])

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(k)
      setSortDir("desc")
    }
  }

  function handleExportCsv() {
    if (!data) return
    downloadRevenueCsv(data)
  }

  return (
    <div className="space-y-4">
      <RevenueFilters
        by={by}
        setBy={setBy}
        since={since}
        setSince={setSince}
        until={until}
        setUntil={setUntil}
        onExportCsv={handleExportCsv}
        canExport={!!data && (data.rows?.length ?? 0) > 0}
      />

      {report.isLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-brand-divider bg-white py-12 text-sm text-brand-text/60 shadow-sm">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : report.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
          {errorMessage(report.error)}
        </div>
      ) : !data || (data.rows?.length ?? 0) === 0 ? (
        <EmptyState
          title="No revenue in the selected window"
          body="Adjust the date range or grouping to surface results."
        />
      ) : (
        <>
          <RevenueKpis report={data} />
          <RevenueBarChart rows={sortedRows} />
          <RevenueTable
            rows={sortedRows}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={toggleSort}
          />
        </>
      )}
    </div>
  )
}

function RevenueFilters({
  by,
  setBy,
  since,
  setSince,
  until,
  setUntil,
  onExportCsv,
  canExport,
}: {
  by: "plan" | "city"
  setBy: (v: "plan" | "city") => void
  since: string
  setSince: (v: string) => void
  until: string
  setUntil: (v: string) => void
  onExportCsv: () => void
  canExport: boolean
}) {
  return (
    <div className="rounded-2xl border border-brand-divider bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <FilterField label="Group by">
          <select
            value={by}
            onChange={(e) => setBy(e.target.value as "plan" | "city")}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-text"
          >
            <option value="plan">Plan</option>
            <option value="city">City</option>
          </select>
        </FilterField>
        <FilterField label="Since">
          <input
            type="date"
            value={since}
            max={until}
            onChange={(e) => setSince(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-text"
          />
        </FilterField>
        <FilterField label="Until">
          <input
            type="date"
            value={until}
            min={since}
            onChange={(e) => setUntil(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-text"
          />
        </FilterField>
        <div className="ml-auto">
          <SecondaryButton onClick={onExportCsv} disabled={!canExport}>
            Export CSV
          </SecondaryButton>
        </div>
      </div>
    </div>
  )
}

function RevenueKpis({ report }: { report: RevenueReport }) {
  const subs = report.total_subscriptions_revenue_paise
  const fare = report.total_fare_paise
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <KpiCard
        label="Total subscriptions revenue"
        value={paiseToRupees(subs)}
        hint={`${report.since} → ${report.until}`}
      />
      <KpiCard
        label="Total fare collected"
        value={paiseToRupees(fare)}
        hint={`Grouped by ${report.by}`}
      />
    </div>
  )
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-2xl border border-brand-divider bg-white px-5 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-text/55">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-brand-text">{value}</p>
      {hint ? (
        <p className="mt-1 text-[11px] text-brand-text/55">{hint}</p>
      ) : null}
    </div>
  )
}

function RevenueBarChart({ rows }: { rows: RevenueReportRow[] }) {
  // Top 5 by fare_total_paise — already sorted; we still pick top 5 here in case
  // user picked a different sort column.
  const top = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => b.fare_total_paise - a.fare_total_paise)
    return copy.slice(0, 5)
  }, [rows])
  const max = top[0]?.fare_total_paise ?? 0
  if (top.length === 0) return null
  return (
    <div className="rounded-2xl border border-brand-divider bg-white px-5 py-4 shadow-sm">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-brand-text/55">
        Top 5 by fare total
      </p>
      <ul className="space-y-2">
        {top.map((r) => {
          const pct = max > 0 ? (r.fare_total_paise / max) * 100 : 0
          return (
            <li key={r.group_key}>
              <div className="flex items-center justify-between text-xs text-brand-text/70">
                <span className="truncate font-medium text-brand-text">
                  {r.group_name || r.group_key}
                </span>
                <span className="font-mono">
                  {paiseToRupees(r.fare_total_paise)}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-brand-text/70"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function RevenueTable({
  rows,
  sortKey,
  sortDir,
  onSort,
}: {
  rows: RevenueReportRow[]
  sortKey: SortKey
  sortDir: SortDir
  onSort: (k: SortKey) => void
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-brand-divider bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">
            <tr>
              <SortHeader
                label="Group"
                k="group_name"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortHeader
                label="Subs #"
                k="subscriptions_count"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortHeader
                label="Subs revenue"
                k="subscriptions_revenue_paise"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortHeader
                label="Rides #"
                k="rides_count"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortHeader
                label="Completed"
                k="rides_completed"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortHeader
                label="Cancelled"
                k="rides_cancelled"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortHeader
                label="Fare total"
                k="fare_total_paise"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortHeader
                label="Cancel fees"
                k="cancellation_fees_paise"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.group_key} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-brand-text">
                  {r.group_name || r.group_key}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {r.subscriptions_count.toLocaleString()}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {paiseToRupees(r.subscriptions_revenue_paise)}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {r.rides_count.toLocaleString()}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-emerald-700">
                  {r.rides_completed.toLocaleString()}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-rose-700">
                  {r.rides_cancelled.toLocaleString()}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {paiseToRupees(r.fare_total_paise)}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {paiseToRupees(r.cancellation_fees_paise)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SortHeader({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string
  k: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onSort: (k: SortKey) => void
}) {
  const active = sortKey === k
  const arrow = active ? (sortDir === "asc" ? " ↑" : " ↓") : ""
  return (
    <th className="px-4 py-3">
      <button
        type="button"
        onClick={() => onSort(k)}
        className={classNames(
          "inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider",
          active ? "text-brand-text" : "text-gray-500 hover:text-brand-text",
        )}
      >
        {label}
        <span className="font-mono">{arrow}</span>
      </button>
    </th>
  )
}

function downloadRevenueCsv(report: RevenueReport) {
  const headers = [
    "group_key",
    "group_name",
    "subscriptions_count",
    "subscriptions_revenue_paise",
    "rides_count",
    "rides_completed",
    "rides_cancelled",
    "fare_total_paise",
    "cancellation_fees_paise",
  ]
  const escape = (v: unknown) => {
    const s = String(v ?? "")
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines: string[] = []
  lines.push(headers.join(","))
  for (const r of report.rows) {
    lines.push(
      [
        r.group_key,
        r.group_name,
        r.subscriptions_count,
        r.subscriptions_revenue_paise,
        r.rides_count,
        r.rides_completed,
        r.rides_cancelled,
        r.fare_total_paise,
        r.cancellation_fees_paise,
      ]
        .map(escape)
        .join(","),
    )
  }
  const csv = lines.join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `mopedu-revenue-${report.by}-${report.since}-${report.until}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ── Partner retention tab ─────────────────────────────────────────────────

const COHORT_CHIPS: Array<{ months: number; label: string }> = [
  { months: 1, label: "1 month ago" },
  { months: 2, label: "2 months ago" },
  { months: 3, label: "3 months ago" },
  { months: 6, label: "6 months ago" },
]

function PartnerRetentionTab() {
  const defaultMonth = monthsAgoIso(3)
  const [cohortMonth, setCohortMonth] = useState<string>(defaultMonth)
  const q = useMopeduPartnerCohortRetention(cohortMonth)

  return (
    <div className="space-y-4">
      <CohortFilter
        cohortMonth={cohortMonth}
        setCohortMonth={setCohortMonth}
        helperText="Partner sign-up cohort. M1/M2/M3 are months 1/2/3 since onboarding."
      />

      {q.isLoading ? (
        <LoadingCard />
      ) : q.isError ? (
        <ErrorCard message={errorMessage(q.error)} />
      ) : !q.data ? (
        <EmptyState title="No data for cohort" />
      ) : (
        <PartnerRetentionDisplay data={q.data} />
      )}
    </div>
  )
}

function PartnerRetentionDisplay({ data }: { data: PartnerCohortRetention }) {
  return (
    <div className="space-y-3">
      <KpiCard
        label="Cohort size"
        value={data.cohort_size.toLocaleString()}
        hint={`Cohort month: ${data.cohort_month}`}
      />
      <div className="rounded-2xl border border-brand-divider bg-white px-5 py-4 shadow-sm">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-brand-text/55">
          Active partners — retention
        </p>
        <div className="space-y-3">
          <RetentionBar
            label="Month 1"
            count={data.m1_active}
            total={data.cohort_size}
            pct={data.m1_pct}
          />
          <RetentionBar
            label="Month 2"
            count={data.m2_active}
            total={data.cohort_size}
            pct={data.m2_pct}
          />
          <RetentionBar
            label="Month 3"
            count={data.m3_active}
            total={data.cohort_size}
            pct={data.m3_pct}
          />
        </div>
      </div>
    </div>
  )
}

function RetentionBar({
  label,
  count,
  total,
  pct,
}: {
  label: string
  count: number
  total: number
  pct: number
}) {
  // Clamp pct to [0,100] for display safety; backend may return 0–1 or 0–100,
  // so we accept either by normalising values that look fractional.
  const display = pct > 0 && pct <= 1 ? pct * 100 : pct
  const clamped = Math.max(0, Math.min(100, display))
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-brand-text">{label}</span>
        <span className="font-mono text-brand-text/70">
          {count.toLocaleString()} / {total.toLocaleString()} ·{" "}
          {clamped.toFixed(1)}%
        </span>
      </div>
      <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-3 rounded-full bg-emerald-500"
          style={{ width: `${Math.max(clamped, 1)}%` }}
        />
      </div>
    </div>
  )
}

// ── Customer cohort tab ───────────────────────────────────────────────────

function CustomerCohortTab() {
  const defaultMonth = monthsAgoIso(3)
  const [cohortMonth, setCohortMonth] = useState<string>(defaultMonth)
  const q = useMopeduCustomerCohortBookingRate(cohortMonth)

  return (
    <div className="space-y-4">
      <CohortFilter
        cohortMonth={cohortMonth}
        setCohortMonth={setCohortMonth}
        helperText="Customer sign-up cohort. M1/M2/M3 are average rides per customer in months 1/2/3."
      />

      {q.isLoading ? (
        <LoadingCard />
      ) : q.isError ? (
        <ErrorCard message={errorMessage(q.error)} />
      ) : !q.data ? (
        <EmptyState title="No data for cohort" />
      ) : (
        <CustomerCohortDisplay data={q.data} />
      )}
    </div>
  )
}

function CustomerCohortDisplay({
  data,
}: {
  data: CustomerCohortBookingRate
}) {
  const max = Math.max(data.m1_avg_rides, data.m2_avg_rides, data.m3_avg_rides, 0.0001)
  return (
    <div className="space-y-3">
      <KpiCard
        label="Cohort size"
        value={data.cohort_size.toLocaleString()}
        hint={`Cohort month: ${data.cohort_month}`}
      />
      <div className="rounded-2xl border border-brand-divider bg-white px-5 py-4 shadow-sm">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-brand-text/55">
          Average rides per customer
        </p>
        <div className="space-y-3">
          <AvgRidesBar label="Month 1" value={data.m1_avg_rides} max={max} />
          <AvgRidesBar label="Month 2" value={data.m2_avg_rides} max={max} />
          <AvgRidesBar label="Month 3" value={data.m3_avg_rides} max={max} />
        </div>
      </div>
    </div>
  )
}

function AvgRidesBar({
  label,
  value,
  max,
}: {
  label: string
  value: number
  max: number
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-brand-text">{label}</span>
        <span className="font-mono text-brand-text/70">
          {value.toFixed(2)} avg
        </span>
      </div>
      <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-3 rounded-full bg-blue-500"
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </div>
    </div>
  )
}

// ── Cohort filter (shared between partner + customer tabs) ────────────────

function CohortFilter({
  cohortMonth,
  setCohortMonth,
  helperText,
}: {
  cohortMonth: string
  setCohortMonth: (v: string) => void
  helperText?: string
}) {
  return (
    <div className="rounded-2xl border border-brand-divider bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <FilterField label="Cohort month">
          <input
            type="month"
            value={cohortMonth}
            onChange={(e) => setCohortMonth(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-text"
          />
        </FilterField>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-text/55">
            Quick chips
          </span>
          {COHORT_CHIPS.map((c) => {
            const target = monthsAgoIso(c.months)
            const active = cohortMonth === target
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => setCohortMonth(target)}
                className={classNames(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  active
                    ? "border-brand-text bg-brand-text text-white"
                    : "border-gray-300 bg-white text-brand-text/70 hover:bg-gray-50",
                )}
              >
                {c.label}
              </button>
            )
          })}
        </div>
        <div className="ml-auto">
          <PrimaryButton
            tone="slate"
            onClick={() => setCohortMonth(monthsAgoIso(3))}
          >
            Reset to 3 months ago
          </PrimaryButton>
        </div>
      </div>
      {helperText ? (
        <p className="mt-2 text-[11px] text-brand-text/55">{helperText}</p>
      ) : null}
    </div>
  )
}

// ── Misc shared bits ──────────────────────────────────────────────────────

function FilterField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-text/55">
        {label}
      </span>
      {children}
    </label>
  )
}

function LoadingCard() {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-brand-divider bg-white py-12 text-sm text-brand-text/60 shadow-sm">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Loading…
    </div>
  )
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
      {message}
    </div>
  )
}

// ── D2 helpers ────────────────────────────────────────────────────────────

function defaultD2Window(): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  from.setHours(from.getHours() - 24)
  return { from: from.toISOString(), to: to.toISOString() }
}

function D2WindowPicker({
  value,
  onChange,
}: {
  value: { from: string; to: string }
  onChange: (next: { from: string; to: string }) => void
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-brand-divider bg-white p-3 text-sm">
      <label className="flex flex-col">
        <span className="text-xs text-gray-500">From</span>
        <input
          type="datetime-local"
          value={value.from.slice(0, 16)}
          onChange={(e) =>
            onChange({ ...value, from: new Date(e.target.value).toISOString() })
          }
          className="rounded border border-gray-300 px-2 py-1"
        />
      </label>
      <label className="flex flex-col">
        <span className="text-xs text-gray-500">To</span>
        <input
          type="datetime-local"
          value={value.to.slice(0, 16)}
          onChange={(e) =>
            onChange({ ...value, to: new Date(e.target.value).toISOString() })
          }
          className="rounded border border-gray-300 px-2 py-1"
        />
      </label>
      <SecondaryButton onClick={() => onChange(defaultD2Window())}>
        Last 24h
      </SecondaryButton>
    </div>
  )
}

function downloadD2CSV(filename: string, rows: object[]) {
  if (rows.length === 0) return
  const keys = Object.keys(rows[0])
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return ""
    const s = String(v)
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = keys.join(",")
  const body = rows
    .map((r) => keys.map((k) => escape((r as Record<string, unknown>)[k])).join(","))
    .join("\n")
  const blob = new Blob([header + "\n" + body], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

interface D2QueryShape<T> {
  data?: T[]
  isLoading: boolean
  error: unknown
}

function D2Shell<T extends object>({
  query,
  exportName,
  emptyMessage,
  children,
}: {
  query: D2QueryShape<T>
  exportName: string
  emptyMessage: string
  children: React.ReactNode
}) {
  const rowCount = query.data?.length ?? 0
  return (
    <section className="space-y-3">
      <div className="flex justify-end">
        <PrimaryButton
          onClick={() => downloadD2CSV(exportName, query.data ?? [])}
          disabled={rowCount === 0}
        >
          Export CSV
        </PrimaryButton>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-brand-divider bg-white shadow-sm">
        {query.isLoading ? (
          <LoadingCard />
        ) : query.error ? (
          <ErrorCard message={errorMessage(query.error)} />
        ) : rowCount === 0 ? (
          <EmptyState title="No data" body={emptyMessage} />
        ) : (
          children
        )}
      </div>
    </section>
  )
}

// ── Tab: matching health ──────────────────────────────────────────────────

function MatchingHealthTab() {
  const [win, setWin] = useState(defaultD2Window())
  const q = useMopeduMatchingHealth(win)
  return (
    <div className="space-y-3">
      <D2WindowPicker value={win} onChange={setWin} />
      <D2Shell
        query={q}
        exportName="matching-health.csv"
        emptyMessage="No rides requested in this window."
      >
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2">Vehicle</th>
              <th className="px-3 py-2">Rides</th>
              <th className="px-3 py-2">No-candidate</th>
              <th className="px-3 py-2">Avg time-to-first-offer (s)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(q.data ?? []).map((r: MatchingHealthRow, i: number) => (
              <tr key={`${r.city_id}-${r.vehicle_type}-${i}`} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">
                  {r.city_id || "—"}
                </td>
                <td className="px-3 py-2">{r.vehicle_type}</td>
                <td className="px-3 py-2">{r.rides_total}</td>
                <td className="px-3 py-2">{r.no_candidate_count}</td>
                <td className="px-3 py-2">
                  {r.avg_time_to_first_offer_seconds == null
                    ? "—"
                    : r.avg_time_to_first_offer_seconds.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </D2Shell>
    </div>
  )
}

// ── Tab: partner quality ──────────────────────────────────────────────────

function PartnerQualityTab() {
  const [win, setWin] = useState(defaultD2Window())
  const q = useMopeduPartnerQuality(win)
  return (
    <div className="space-y-3">
      <D2WindowPicker value={win} onChange={setWin} />
      <D2Shell
        query={q}
        exportName="partner-quality.csv"
        emptyMessage="No partners received an offer in this window."
      >
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2">Partner</th>
              <th className="px-3 py-2">Received</th>
              <th className="px-3 py-2">Accepted</th>
              <th className="px-3 py-2">Rejected</th>
              <th className="px-3 py-2">Expired</th>
              <th className="px-3 py-2">Accept %</th>
              <th className="px-3 py-2">No-show (30d)</th>
              <th className="px-3 py-2">Rating (30d)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(q.data ?? []).map((r: PartnerQualityRow) => (
              <tr key={r.partner_id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{r.full_name || r.partner_id}</td>
                <td className="px-3 py-2">{r.offers_received}</td>
                <td className="px-3 py-2">{r.offers_accepted}</td>
                <td className="px-3 py-2">{r.offers_rejected}</td>
                <td className="px-3 py-2">{r.offers_expired}</td>
                <td className="px-3 py-2">
                  {r.acceptance_pct == null ? "—" : `${r.acceptance_pct.toFixed(1)}%`}
                </td>
                <td className="px-3 py-2">{r.no_show_count_30d}</td>
                <td className="px-3 py-2">
                  {r.avg_rating_30d ? r.avg_rating_30d.toFixed(2) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </D2Shell>
    </div>
  )
}

// ── Tab: supply / demand ──────────────────────────────────────────────────

function SupplyDemandTab() {
  const [win, setWin] = useState(defaultD2Window())
  const q = useMopeduSupplyDemand(win)
  return (
    <div className="space-y-3">
      <D2WindowPicker value={win} onChange={setWin} />
      <D2Shell
        query={q}
        exportName="supply-demand.csv"
        emptyMessage="No ride requests in this window."
      >
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2">Hour</th>
              <th className="px-3 py-2">Ride requests</th>
              <th className="px-3 py-2">Online partners (avg)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(q.data ?? []).map((r: SupplyDemandRow, i: number) => (
              <tr key={`${r.city_id}-${r.hour_bucket}-${i}`} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">{r.city_id || "—"}</td>
                <td className="px-3 py-2 text-xs">
                  {new Date(r.hour_bucket).toLocaleString()}
                </td>
                <td className="px-3 py-2">{r.ride_requests}</td>
                <td className="px-3 py-2">{r.online_partners_avg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </D2Shell>
    </div>
  )
}

// ── Tab: safety incidents ─────────────────────────────────────────────────

function SafetyTab() {
  const [win, setWin] = useState(defaultD2Window())
  const q = useMopeduSafetyReport(win)
  return (
    <div className="space-y-3">
      <D2WindowPicker value={win} onChange={setWin} />
      <D2Shell
        query={q}
        exportName="safety.csv"
        emptyMessage="No safety incidents in this window."
      >
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2">Kind</th>
              <th className="px-3 py-2">Severity</th>
              <th className="px-3 py-2">Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(q.data ?? []).map((r: SafetyIncidentReportRow, i: number) => (
              <tr key={`${r.kind}-${r.severity}-${i}`} className="hover:bg-gray-50">
                <td className="px-3 py-2">{r.kind}</td>
                <td className="px-3 py-2">
                  <span
                    className={classNames(
                      "rounded px-2 py-0.5 text-xs font-semibold",
                      r.severity === "critical"
                        ? "bg-rose-100 text-rose-800"
                        : r.severity === "high"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-gray-100 text-gray-700",
                    )}
                  >
                    {r.severity}
                  </span>
                </td>
                <td className="px-3 py-2">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </D2Shell>
    </div>
  )
}

// ── Tab: partner compliance (point-in-time + optional city) ───────────────

function PartnerComplianceTab() {
  const [city, setCity] = useState("")
  const q = useMopeduPartnerCompliance(city || undefined)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-md border border-brand-divider bg-white p-3 text-sm">
        <label className="flex flex-col">
          <span className="text-xs text-gray-500">City filter</span>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Bengaluru"
            className="rounded border border-gray-300 px-2 py-1"
          />
        </label>
      </div>
      <D2Shell
        query={q}
        exportName="partner-compliance.csv"
        emptyMessage="No approved partners found."
      >
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2">Partner</th>
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2">Expired KYC docs</th>
              <th className="px-3 py-2">Expired vehicle docs</th>
              <th className="px-3 py-2">Oldest expiry</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(q.data ?? []).map((r: PartnerComplianceRow) => {
              const totalExpired = r.expired_docs + r.expired_vehicle_docs
              return (
                <tr key={r.partner_id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">
                    {r.full_name || r.partner_id}
                  </td>
                  <td className="px-3 py-2">{r.city || "—"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        r.expired_docs > 0
                          ? "rounded bg-rose-100 px-2 py-0.5 text-xs text-rose-800"
                          : ""
                      }
                    >
                      {r.expired_docs}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        r.expired_vehicle_docs > 0
                          ? "rounded bg-rose-100 px-2 py-0.5 text-xs text-rose-800"
                          : ""
                      }
                    >
                      {r.expired_vehicle_docs}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {r.oldest_expiry
                      ? new Date(r.oldest_expiry).toLocaleDateString()
                      : totalExpired === 0
                        ? "—"
                        : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </D2Shell>
    </div>
  )
}
