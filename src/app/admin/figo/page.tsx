"use client"

// FiGo admin overview — landing page.
//
// Cheap KPI strip lifted from the same endpoints the dedicated tabs
// use, then deep-links into each module. Compliance is the only
// always-fresh point-in-time view; the rest default to the last 24h
// so the overview matches "what's happening right now".

import Link from "next/link"
import { Loader2 } from "lucide-react"

import {
  useFoodCompliance,
  useFoodModerationQueue,
  useFoodRestaurantSLA,
  useFoodTopFraud,
} from "@/hooks/useFoodAdmin"

export default function FoodAdminOverviewPage() {
  const sla = useFoodRestaurantSLA()
  const mod = useFoodModerationQueue()
  const fraud = useFoodTopFraud({ window_hours: 168, limit: 5 })
  const compliance = useFoodCompliance()

  const breached = (sla.data ?? []).reduce(
    (acc, r) => acc + r.orders_breached,
    0,
  )
  const orders = (sla.data ?? []).reduce(
    (acc, r) => acc + r.orders_total,
    0,
  )
  const breachPct = orders === 0 ? 0 : (breached / orders) * 100

  const queueOpen = (mod.data ?? []).length
  const fraudHigh = (fraud.data ?? []).filter((r) => r.total_score >= 30).length
  const fssaiMissing = (compliance.data ?? []).filter(
    (r) => !r.has_approved_fssai,
  ).length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KPI
          title="Accept SLA (24h)"
          loading={sla.isLoading}
          primary={`${breachPct.toFixed(1)}%`}
          secondary={`${breached} of ${orders} orders breached`}
          href="/admin/figo/reports"
          tone={breachPct > 5 ? "warn" : "ok"}
        />
        <KPI
          title="Moderation queue"
          loading={mod.isLoading}
          primary={queueOpen.toString()}
          secondary="items flagged or pending review"
          href="/admin/figo/moderation"
          tone={queueOpen > 0 ? "warn" : "ok"}
        />
        <KPI
          title="High-risk users (7d)"
          loading={fraud.isLoading}
          primary={fraudHigh.toString()}
          secondary="score ≥ 30 across all signals"
          href="/admin/figo/fraud"
          tone={fraudHigh > 0 ? "alert" : "ok"}
        />
        <KPI
          title="Restaurants missing FSSAI"
          loading={compliance.isLoading}
          primary={fssaiMissing.toString()}
          secondary="active restaurants with no valid FSSAI doc"
          href="/admin/figo/reports"
          tone={fssaiMissing > 0 ? "alert" : "ok"}
        />
      </div>

      <p className="text-xs text-slate-500">
        Tip: the KPI cards above use the last 24h window for SLA and 7d
        for fraud. Open a tab for date-bounded views and CSV export.
      </p>
    </div>
  )
}

function KPI({
  title,
  primary,
  secondary,
  href,
  loading,
  tone,
}: {
  title: string
  primary: string
  secondary: string
  href: string
  loading: boolean
  tone: "ok" | "warn" | "alert"
}) {
  const toneRing =
    tone === "alert"
      ? "ring-rose-200"
      : tone === "warn"
        ? "ring-amber-200"
        : "ring-slate-200"
  return (
    <Link
      href={href}
      className={[
        "block rounded-md bg-white p-3 ring-1 transition hover:ring-amber-400",
        toneRing,
      ].join(" ")}
    >
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        ) : (
          <span className="text-2xl font-semibold text-slate-900">
            {primary}
          </span>
        )}
      </div>
      <div className="text-xs text-slate-500">{secondary}</div>
    </Link>
  )
}
