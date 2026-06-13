"use client"

// FiGo admin fraud queue.
//
// Reads from food.fraud_scores via /v1/food/admin/fraud/top. The
// worker writes refund_abuse + coupon_burn + cancellation_pattern
// signals; this page surfaces top-N aggregate by recent window.

import { useState } from "react"
import { Loader2 } from "lucide-react"

import { useFoodTopFraud } from "@/hooks/useFoodAdmin"

import { EmptyState, PrimaryButton, errorMessage } from "../../mopedu/_shared"

const WINDOWS: Array<{ label: string; hours: number }> = [
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
  { label: "30d", hours: 720 },
]

export default function FoodFraudPage() {
  const [windowHours, setWindowHours] = useState(168)
  const [limit] = useState(50)
  const q = useFoodTopFraud({ window_hours: windowHours, limit })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600">Window:</span>
        {WINDOWS.map((w) => (
          <button
            key={w.hours}
            type="button"
            onClick={() => setWindowHours(w.hours)}
            className={[
              "rounded px-3 py-1 text-xs font-medium transition",
              windowHours === w.hours
                ? "bg-amber-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200",
            ].join(" ")}
          >
            {w.label}
          </button>
        ))}
        <PrimaryButton onClick={() => q.refetch()}>Refresh</PrimaryButton>
      </div>

      <p className="text-xs text-slate-500">
        Aggregate score across refund_abuse, coupon_burn, and
        cancellation_pattern signals from the fraud worker. Higher
        score = stronger pattern.
      </p>

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        {q.isLoading ? (
          <div className="flex items-center justify-center p-6 text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : q.error ? (
          <div className="p-4 text-sm text-rose-700">
            {errorMessage(q.error)}
          </div>
        ) : (q.data ?? []).length === 0 ? (
          <EmptyState
            title="No fraud signals"
            body="The worker hasn't written any scoring rows in this window."
          />
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Signals</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(q.data ?? []).map((row) => (
                <tr key={row.user_id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">
                    {row.user_id}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        row.total_score >= 30
                          ? "rounded bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800"
                          : row.total_score >= 10
                            ? "rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"
                            : "rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700"
                      }
                    >
                      {row.total_score.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-3 py-2">{row.signals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
