"use client"

// FiGo admin reports — six tabs covering the D1 endpoints.
//
// Each tab is a thin shell over a TanStack hook: enter window, render
// table. CSV export is a one-liner per table because the data is
// already a flat array of typed rows.

import { useMemo, useState } from "react"
import { Loader2 } from "lucide-react"

import {
  useFoodCompliance,
  useFoodCouponAbuse,
  useFoodDeliverySLA,
  useFoodPaymentRecon,
  useFoodRefundsReport,
  useFoodRestaurantSLA,
} from "@/hooks/useFoodAdmin"
import type {
  ComplianceReportRow,
  CouponAbuseRow,
  DeliverySLAReport,
  PaymentReconRow,
  RefundCancelRow,
  RestaurantSLAReport,
} from "@/types/food"

import { errorMessage, EmptyState, PrimaryButton } from "../../mopedu/_shared"

type Tab =
  | "restaurant_sla"
  | "delivery_sla"
  | "payment_recon"
  | "refunds"
  | "coupon_abuse"
  | "compliance"

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "restaurant_sla", label: "Restaurant SLA" },
  { key: "delivery_sla", label: "Delivery SLA" },
  { key: "payment_recon", label: "Payment recon" },
  { key: "refunds", label: "Refunds & cancellations" },
  { key: "coupon_abuse", label: "Coupon abuse" },
  { key: "compliance", label: "Compliance" },
]

function isoDayStart(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
}

function defaultWindow(): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 7)
  return { from: isoDayStart(from), to: to.toISOString() }
}

function downloadCSV(filename: string, rows: object[]) {
  if (rows.length === 0) return
  const keys = Object.keys(rows[0])
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return ""
    const s = String(v)
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = keys.join(",")
  const body = rows
    .map((r) =>
      keys.map((k) => escape((r as Record<string, unknown>)[k])).join(","),
    )
    .join("\n")
  const blob = new Blob([header + "\n" + body], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function FoodAdminReportsPage() {
  const [tab, setTab] = useState<Tab>("restaurant_sla")
  const [win, setWin] = useState(defaultWindow())

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={[
              "px-3 py-2 text-sm font-medium transition",
              tab === t.key
                ? "border-b-2 border-amber-600 text-amber-900"
                : "text-slate-500 hover:text-slate-800",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab !== "compliance" ? (
        <WindowPicker value={win} onChange={setWin} />
      ) : null}

      {tab === "restaurant_sla" ? <RestaurantSLATab win={win} /> : null}
      {tab === "delivery_sla" ? <DeliverySLATab win={win} /> : null}
      {tab === "payment_recon" ? <PaymentReconTab win={win} /> : null}
      {tab === "refunds" ? <RefundsTab win={win} /> : null}
      {tab === "coupon_abuse" ? <CouponAbuseTab win={win} /> : null}
      {tab === "compliance" ? <ComplianceTab /> : null}
    </div>
  )
}

function WindowPicker({
  value,
  onChange,
}: {
  value: { from: string; to: string }
  onChange: (next: { from: string; to: string }) => void
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-slate-200 bg-white p-3 text-sm">
      <label className="flex flex-col">
        <span className="text-xs text-slate-500">From</span>
        <input
          type="datetime-local"
          value={value.from.slice(0, 16)}
          onChange={(e) =>
            onChange({ ...value, from: new Date(e.target.value).toISOString() })
          }
          className="rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <label className="flex flex-col">
        <span className="text-xs text-slate-500">To</span>
        <input
          type="datetime-local"
          value={value.to.slice(0, 16)}
          onChange={(e) =>
            onChange({ ...value, to: new Date(e.target.value).toISOString() })
          }
          className="rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <PrimaryButton onClick={() => onChange(defaultWindow())}>
        Last 7 days
      </PrimaryButton>
    </div>
  )
}

// ── Tab: restaurant SLA ───────────────────────────────────────────────────

function RestaurantSLATab({ win }: { win: { from: string; to: string } }) {
  const q = useFoodRestaurantSLA(win)
  const headline = useMemo(() => {
    if (!q.data) return null
    const total = q.data.reduce((acc, r) => acc + r.orders_total, 0)
    const breached = q.data.reduce((acc, r) => acc + r.orders_breached, 0)
    const pct = total === 0 ? 0 : (breached / total) * 100
    return { total, breached, pct }
  }, [q.data])

  return (
    <ReportShell
      title="Restaurant accept SLA"
      query={q}
      onExport={() =>
        downloadCSV("restaurant-sla.csv", q.data ?? [])
      }
      kpi={
        headline ? (
          <KPIs>
            <KPI label="Orders" value={headline.total.toLocaleString()} />
            <KPI label="Breached" value={headline.breached.toLocaleString()} />
            <KPI label="Breach %" value={`${headline.pct.toFixed(1)}%`} />
          </KPIs>
        ) : null
      }
      empty="No restaurants placed an order in this window."
    >
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">Restaurant</th>
            <th className="px-3 py-2">Orders</th>
            <th className="px-3 py-2">Breached</th>
            <th className="px-3 py-2">Breach %</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(q.data ?? []).map((row: RestaurantSLAReport) => (
            <tr key={row.restaurant_id} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-medium">{row.restaurant_name}</td>
              <td className="px-3 py-2">{row.orders_total}</td>
              <td className="px-3 py-2">{row.orders_breached}</td>
              <td className="px-3 py-2">
                {row.breached_pct == null
                  ? "—"
                  : `${row.breached_pct.toFixed(1)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ReportShell>
  )
}

// ── Tab: delivery SLA ─────────────────────────────────────────────────────

function DeliverySLATab({ win }: { win: { from: string; to: string } }) {
  const q = useFoodDeliverySLA(win)
  return (
    <ReportShell
      title="Delivery SLA"
      query={q}
      onExport={() => downloadCSV("delivery-sla.csv", q.data ?? [])}
      empty="No deliveries completed in this window."
    >
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">Partner</th>
            <th className="px-3 py-2">Deliveries</th>
            <th className="px-3 py-2">Late</th>
            <th className="px-3 py-2">Late %</th>
            <th className="px-3 py-2">Avg min</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(q.data ?? []).map((row: DeliverySLAReport) => (
            <tr key={row.partner_id} className="hover:bg-slate-50">
              <td className="px-3 py-2">{row.partner_name || row.partner_id}</td>
              <td className="px-3 py-2">{row.deliveries_total}</td>
              <td className="px-3 py-2">{row.late_count}</td>
              <td className="px-3 py-2">
                {row.late_pct == null ? "—" : `${row.late_pct.toFixed(1)}%`}
              </td>
              <td className="px-3 py-2">
                {row.avg_delivery_minutes == null
                  ? "—"
                  : row.avg_delivery_minutes.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ReportShell>
  )
}

// ── Tab: payment reconciliation ───────────────────────────────────────────

function PaymentReconTab({ win }: { win: { from: string; to: string } }) {
  const q = useFoodPaymentRecon(win)
  return (
    <ReportShell
      title="Payment reconciliation"
      query={q}
      onExport={() => downloadCSV("payment-recon.csv", q.data ?? [])}
      empty="No orders placed in this window."
    >
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">Method</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Count</th>
            <th className="px-3 py-2">Gross ₹</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(q.data ?? []).map((row: PaymentReconRow, i: number) => (
            <tr
              key={`${row.payment_method}-${row.payment_status}-${i}`}
              className="hover:bg-slate-50"
            >
              <td className="px-3 py-2">{row.payment_method}</td>
              <td className="px-3 py-2">{row.payment_status}</td>
              <td className="px-3 py-2">{row.count}</td>
              <td className="px-3 py-2">
                {row.gross_amount.toLocaleString("en-IN", {
                  style: "currency",
                  currency: "INR",
                  maximumFractionDigits: 2,
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ReportShell>
  )
}

// ── Tab: refunds & cancellations ──────────────────────────────────────────

function RefundsTab({ win }: { win: { from: string; to: string } }) {
  const q = useFoodRefundsReport(win)
  return (
    <ReportShell
      title="Refunds & cancellations"
      query={q}
      onExport={() => downloadCSV("refunds.csv", q.data ?? [])}
      empty="No refunds or cancellations in this window."
    >
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Count</th>
            <th className="px-3 py-2">Amount ₹</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(q.data ?? []).map((row: RefundCancelRow, i: number) => (
            <tr key={`${row.category}-${i}`} className="hover:bg-slate-50">
              <td className="px-3 py-2">{row.category}</td>
              <td className="px-3 py-2">{row.count}</td>
              <td className="px-3 py-2">
                {row.amount.toLocaleString("en-IN", {
                  style: "currency",
                  currency: "INR",
                  maximumFractionDigits: 2,
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ReportShell>
  )
}

// ── Tab: coupon abuse ─────────────────────────────────────────────────────

function CouponAbuseTab({ win }: { win: { from: string; to: string } }) {
  const [threshold, setThreshold] = useState(5)
  const q = useFoodCouponAbuse({ ...win, threshold })
  return (
    <ReportShell
      title="Coupon abuse (per customer)"
      query={q}
      onExport={() => downloadCSV("coupon-abuse.csv", q.data ?? [])}
      empty="No customer crossed the threshold in this window."
      extra={
        <label className="flex items-center gap-2 text-xs text-slate-600">
          Min uses
          <input
            type="number"
            value={threshold}
            min={1}
            max={100}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-16 rounded border border-slate-300 px-2 py-1"
          />
        </label>
      }
    >
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2">Coupon</th>
            <th className="px-3 py-2">Uses</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(q.data ?? []).map((row: CouponAbuseRow, i: number) => (
            <tr
              key={`${row.customer_id}-${row.coupon_code}-${i}`}
              className="hover:bg-slate-50"
            >
              <td className="px-3 py-2 font-mono text-xs">{row.customer_id}</td>
              <td className="px-3 py-2 font-medium">{row.coupon_code}</td>
              <td className="px-3 py-2">{row.use_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ReportShell>
  )
}

// ── Tab: compliance (point-in-time, no window) ────────────────────────────

function ComplianceTab() {
  const q = useFoodCompliance()
  return (
    <ReportShell
      title="Compliance — FSSAI status"
      query={q}
      onExport={() => downloadCSV("compliance.csv", q.data ?? [])}
      empty="No active restaurants found."
    >
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">Restaurant</th>
            <th className="px-3 py-2">FSSAI ok</th>
            <th className="px-3 py-2">Expired docs</th>
            <th className="px-3 py-2">Oldest expiry</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(q.data ?? []).map((row: ComplianceReportRow) => (
            <tr key={row.restaurant_id} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-medium">{row.restaurant_name}</td>
              <td className="px-3 py-2">
                <span
                  className={
                    row.has_approved_fssai
                      ? "rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800"
                      : "rounded bg-rose-100 px-2 py-0.5 text-xs text-rose-800"
                  }
                >
                  {row.has_approved_fssai ? "OK" : "MISSING"}
                </span>
              </td>
              <td className="px-3 py-2">{row.expired_docs}</td>
              <td className="px-3 py-2">
                {row.oldest_doc_expiry
                  ? new Date(row.oldest_doc_expiry).toLocaleDateString()
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ReportShell>
  )
}

// ── Shared shells ─────────────────────────────────────────────────────────

interface ReportQueryShape<T> {
  data?: T[]
  isLoading: boolean
  error: unknown
}

function ReportShell<T>({
  title,
  query,
  onExport,
  kpi,
  extra,
  empty,
  children,
}: {
  title: string
  query: ReportQueryShape<T>
  onExport: () => void
  kpi?: React.ReactNode
  extra?: React.ReactNode
  empty: string
  children: React.ReactNode
}) {
  const rowCount = query.data?.length ?? 0
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <div className="flex items-center gap-2">
          {extra}
          <PrimaryButton onClick={onExport} disabled={rowCount === 0}>
            Export CSV
          </PrimaryButton>
        </div>
      </div>
      {kpi}
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        {query.isLoading ? (
          <div className="flex items-center justify-center p-6 text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : query.error ? (
          <div className="p-4 text-sm text-rose-700">
            {errorMessage(query.error)}
          </div>
        ) : rowCount === 0 ? (
          <EmptyState title="No data" body={empty} />
        ) : (
          children
        )}
      </div>
    </section>
  )
}

function KPIs({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{children}</div>
  )
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="text-lg font-semibold text-slate-900">{value}</div>
    </div>
  )
}
