"use client"

// FiGo admin refunds queue.
//
// Lists requested refunds (with status filter) and decides them inline.
// Approve/reject hits POST /v1/food/admin/refunds/:id/decide. The
// money-side processing happens out-of-band in payments-service.

import { useState } from "react"
import { Loader2 } from "lucide-react"

import {
  useFoodAdminRefunds,
  useFoodDecideRefund,
} from "@/hooks/useFoodAdmin"

import { EmptyState, errorMessage } from "../../mopedu/_shared"

const STATUSES: Array<{ key: string; label: string }> = [
  { key: "requested", label: "Requested" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "processed", label: "Processed" },
  { key: "", label: "All" },
]

export default function FoodRefundsPage() {
  const [status, setStatus] = useState<string>("requested")
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const q = useFoodAdminRefunds({ status: status || undefined, limit: 100 })
  const decide = useFoodDecideRefund()

  const setReason = (id: string, r: string) =>
    setReasons((prev) => ({ ...prev, [id]: r }))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600">Status:</span>
        {STATUSES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStatus(s.key)}
            className={[
              "rounded px-3 py-1 text-xs font-medium transition",
              status === s.key
                ? "bg-amber-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200",
            ].join(" ")}
          >
            {s.label}
          </button>
        ))}
      </div>

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
          <EmptyState title="Inbox clear" body="No refunds in this status." />
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Refund</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Customer / order</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(q.data ?? []).map((r) => {
                const reasonInput = reasons[r.id] ?? ""
                return (
                  <tr key={r.id} className="align-top hover:bg-slate-50">
                    <td className="px-3 py-3 font-mono text-xs">
                      {r.id.slice(0, 8)}…
                    </td>
                    <td className="px-3 py-3">
                      {r.amount.toLocaleString("en-IN", {
                        style: "currency",
                        currency: "INR",
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <div className="font-mono">
                        cust {r.customer_id.slice(0, 8)}…
                      </div>
                      <div className="font-mono text-slate-500">
                        order {r.order_id.slice(0, 8)}…
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs">{r.reason ?? "—"}</td>
                    <td className="px-3 py-3">
                      <span
                        className={
                          r.status === "requested"
                            ? "rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800"
                            : r.status === "approved"
                              ? "rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800"
                              : r.status === "rejected"
                                ? "rounded bg-rose-100 px-2 py-0.5 text-xs text-rose-800"
                                : "rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {r.status === "requested" ? (
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            value={reasonInput}
                            onChange={(e) => setReason(r.id, e.target.value)}
                            placeholder="Reason (optional)"
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          />
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                decide.mutate({
                                  refundId: r.id,
                                  status: "approved",
                                  reason: reasonInput,
                                })
                              }
                              disabled={decide.isPending}
                              className={[
                                "rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white",
                                decide.isPending
                                  ? "cursor-wait opacity-60"
                                  : "hover:bg-emerald-700",
                              ].join(" ")}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                decide.mutate({
                                  refundId: r.id,
                                  status: "rejected",
                                  reason: reasonInput,
                                })
                              }
                              disabled={decide.isPending}
                              className={[
                                "rounded bg-rose-600 px-2 py-1 text-xs font-medium text-white",
                                decide.isPending
                                  ? "cursor-wait opacity-60"
                                  : "hover:bg-rose-700",
                              ].join(" ")}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {decide.isError ? (
        <p className="text-sm text-rose-700">{errorMessage(decide.error)}</p>
      ) : null}
    </div>
  )
}
