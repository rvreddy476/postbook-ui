"use client"

import Link from "next/link"
import {
  AlertTriangle,
  CalendarClock,
  CarFront,
  CircleCheck,
  CircleSlash,
  Coins,
  FileBadge2,
  LifeBuoy,
  Loader2,
  Siren,
  Users,
  UsersRound,
  Wallet2,
  Wifi,
} from "lucide-react"

import { useMopeduDashboard } from "@/hooks/useMopeduAdmin"

import {
  classNames,
  EmptyState,
  errorMessage,
  paiseToRupees,
} from "./_shared"

interface KpiCardProps {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  tone?: "neutral" | "amber" | "green" | "red" | "blue"
  loading?: boolean
}

const TONE_CLASSES: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  neutral: "bg-gray-50 text-gray-700",
  amber: "bg-amber-50 text-amber-700",
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-rose-50 text-rose-700",
  blue: "bg-blue-50 text-blue-700",
}

function KpiCard({ label, value, icon: Icon, tone = "neutral", loading }: KpiCardProps) {
  return (
    <div className="rounded-2xl border border-brand-divider bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-text/45">
          {label}
        </p>
        <div
          className={classNames(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            TONE_CLASSES[tone],
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-brand-text">
        {loading ? <span className="text-brand-text/30">…</span> : value}
      </p>
    </div>
  )
}

export default function MopeduOverviewPage() {
  const dashboard = useMopeduDashboard()
  const counts = dashboard.data
  const loading = dashboard.isLoading

  const fmt = (n?: number) => (typeof n === "number" ? n.toLocaleString("en-IN") : "—")

  return (
    <div className="space-y-8">
      {dashboard.isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage(dashboard.error) || "Could not load dashboard."}
        </div>
      ) : null}

      {/* KPI grid — 12 cards. */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-brand-text/70">
          Key metrics
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <KpiCard
            label="Total customers"
            value={fmt(counts?.total_customers)}
            icon={UsersRound}
            tone="blue"
            loading={loading}
          />
          <KpiCard
            label="Total partners"
            value={fmt(counts?.total_partners)}
            icon={Users}
            tone="blue"
            loading={loading}
          />
          <KpiCard
            label="Active partners"
            value={fmt(counts?.active_partners)}
            icon={Wifi}
            tone="green"
            loading={loading}
          />
          <KpiCard
            label="Pending KYC"
            value={fmt(counts?.pending_kyc)}
            icon={FileBadge2}
            tone="amber"
            loading={loading}
          />
          <KpiCard
            label="Pending vehicle"
            value={fmt(counts?.pending_vehicle)}
            icon={CarFront}
            tone="amber"
            loading={loading}
          />
          <KpiCard
            label="Pending payment"
            value={fmt(counts?.pending_payment)}
            icon={Coins}
            tone="amber"
            loading={loading}
          />
          <KpiCard
            label="Rides today"
            value={fmt(counts?.rides_today)}
            icon={Siren}
            tone="blue"
            loading={loading}
          />
          <KpiCard
            label="Completed today"
            value={fmt(counts?.completed_today)}
            icon={CircleCheck}
            tone="green"
            loading={loading}
          />
          <KpiCard
            label="Cancelled today"
            value={fmt(counts?.cancelled_today)}
            icon={CircleSlash}
            tone="red"
            loading={loading}
          />
          <KpiCard
            label="Subscription revenue today"
            value={paiseToRupees(counts?.partner_subscription_revenue_today_paise)}
            icon={Wallet2}
            tone="green"
            loading={loading}
          />
          <KpiCard
            label="Subs expiring (7d)"
            value={fmt(counts?.expiring_subscriptions_7d)}
            icon={CalendarClock}
            tone="amber"
            loading={loading}
          />
          <KpiCard
            label="Suspended partners"
            value={fmt(counts?.suspended_partners)}
            icon={CircleSlash}
            tone="red"
            loading={loading}
          />
          <KpiCard
            label="Open complaints"
            value={fmt(counts?.open_complaints)}
            icon={LifeBuoy}
            tone="amber"
            loading={loading}
          />
          <KpiCard
            label="SOS open"
            value={fmt(counts?.sos_incidents_open)}
            icon={AlertTriangle}
            tone="red"
            loading={loading}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-brand-divider bg-white px-5 py-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-brand-text">
            Quick actions
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/admin/mopedu/partners?status=pending"
              className="rounded-xl border border-gray-200 bg-gray-50 p-4 transition-colors hover:border-brand-text/30 hover:bg-white"
            >
              <p className="text-sm font-semibold text-brand-text">
                Partner queue
              </p>
              <p className="mt-1 text-xs text-brand-text/60">
                Review pending onboardings.
              </p>
            </Link>
            <Link
              href="/admin/mopedu/live-rides"
              className="rounded-xl border border-gray-200 bg-gray-50 p-4 transition-colors hover:border-brand-text/30 hover:bg-white"
            >
              <p className="text-sm font-semibold text-brand-text">
                Live rides
              </p>
              <p className="mt-1 text-xs text-brand-text/60">
                Watch in-flight rides + SOS triggers.
              </p>
            </Link>
            <Link
              href="/admin/mopedu/payments"
              className="rounded-xl border border-gray-200 bg-gray-50 p-4 transition-colors hover:border-brand-text/30 hover:bg-white"
            >
              <p className="text-sm font-semibold text-brand-text">
                Payment proofs
              </p>
              <p className="mt-1 text-xs text-brand-text/60">
                Verify subscription UPI payments.
              </p>
            </Link>
            <Link
              href="/admin/mopedu/complaints"
              className="rounded-xl border border-gray-200 bg-gray-50 p-4 transition-colors hover:border-brand-text/30 hover:bg-white"
            >
              <p className="text-sm font-semibold text-brand-text">
                Complaints
              </p>
              <p className="mt-1 text-xs text-brand-text/60">
                Triage open customer complaints.
              </p>
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-brand-divider bg-white px-5 py-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-brand-text">
            Pending verifications
          </h2>
          {loading ? (
            <div className="flex items-center justify-center py-6 text-sm text-brand-text/60">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : counts ? (
            <ul className="divide-y divide-gray-100">
              <li className="flex items-center justify-between py-3">
                <Link
                  href="/admin/mopedu/documents?status=pending"
                  className="flex items-center gap-2 text-sm font-medium text-brand-text hover:underline"
                >
                  <FileBadge2 className="h-4 w-4 text-amber-600" />
                  KYC documents
                </Link>
                <span className="text-sm font-semibold text-brand-text">
                  {fmt(counts.pending_kyc)}
                </span>
              </li>
              <li className="flex items-center justify-between py-3">
                <Link
                  href="/admin/mopedu/vehicles?status=pending"
                  className="flex items-center gap-2 text-sm font-medium text-brand-text hover:underline"
                >
                  <CarFront className="h-4 w-4 text-amber-600" />
                  Vehicle verifications
                </Link>
                <span className="text-sm font-semibold text-brand-text">
                  {fmt(counts.pending_vehicle)}
                </span>
              </li>
              <li className="flex items-center justify-between py-3">
                <Link
                  href="/admin/mopedu/payments?status=pending"
                  className="flex items-center gap-2 text-sm font-medium text-brand-text hover:underline"
                >
                  <Coins className="h-4 w-4 text-amber-600" />
                  Subscription payments
                </Link>
                <span className="text-sm font-semibold text-brand-text">
                  {fmt(counts.pending_payment)}
                </span>
              </li>
              <li className="flex items-center justify-between py-3">
                <Link
                  href="/admin/mopedu/partners?status=pending"
                  className="flex items-center gap-2 text-sm font-medium text-brand-text hover:underline"
                >
                  <Users className="h-4 w-4 text-amber-600" />
                  Partner approvals
                </Link>
                <span className="text-sm font-semibold text-brand-text">
                  {/* No dedicated count; surface a hint instead. */}
                  Open queue
                </span>
              </li>
            </ul>
          ) : (
            <EmptyState title="No data yet" body="Dashboard hasn't loaded." />
          )}
        </div>
      </section>
    </div>
  )
}
