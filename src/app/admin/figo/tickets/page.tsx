"use client"

// FiGo admin tickets queue.
//
// Lists every support ticket filtered by status (open by default).
// Per row: inline status transition (in_progress / resolved / closed /
// cancelled) via the existing AdminSetTicketStatus endpoint.

import Link from "next/link"
import { useState } from "react"
import { Loader2 } from "lucide-react"

import {
  useFoodAdminTickets,
  useFoodSetTicketStatus,
} from "@/hooks/useFoodAdmin"
import type { TicketStatus } from "@/types/food"

import { EmptyState, errorMessage } from "../../mopedu/_shared"

const STATUSES: Array<{ key: string; label: string }> = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In progress" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
  { key: "", label: "All" },
]

const VERDICTS: Array<{ key: TicketStatus; label: string; tone: string }> = [
  { key: "in_progress", label: "Take", tone: "bg-blue-600 hover:bg-blue-700" },
  { key: "resolved", label: "Resolve", tone: "bg-emerald-600 hover:bg-emerald-700" },
  { key: "closed", label: "Close", tone: "bg-slate-600 hover:bg-slate-700" },
  { key: "cancelled", label: "Cancel", tone: "bg-rose-600 hover:bg-rose-700" },
]

export default function FoodTicketsPage() {
  const [status, setStatus] = useState<string>("open")
  const q = useFoodAdminTickets({ status: status || undefined, limit: 100 })
  const update = useFoodSetTicketStatus()

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
          <EmptyState title="No tickets" body="Nothing in this status." />
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Ticket</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(q.data ?? []).map((t) => (
                <tr key={t.id} className="align-top hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <Link
                      href={`/admin/figo/tickets/${t.id}`}
                      className="font-medium text-amber-700 hover:underline"
                    >
                      {t.subject}
                    </Link>
                    {t.order_id ? (
                      <div className="font-mono text-xs text-slate-500">
                        order {t.order_id.slice(0, 8)}…
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">
                    {t.customer_id.slice(0, 8)}…
                  </td>
                  <td className="px-3 py-3">{t.category}</td>
                  <td className="px-3 py-3">
                    <span
                      className={
                        t.status === "open"
                          ? "rounded bg-rose-100 px-2 py-0.5 text-xs text-rose-800"
                          : t.status === "in_progress"
                            ? "rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800"
                            : t.status === "resolved"
                              ? "rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800"
                              : "rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                      }
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500">
                    {new Date(t.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {VERDICTS.filter((v) => v.key !== t.status).map((v) => (
                        <button
                          key={v.key}
                          type="button"
                          onClick={() =>
                            update.mutate({ ticketId: t.id, status: v.key })
                          }
                          disabled={update.isPending}
                          className={[
                            "rounded px-2 py-1 text-xs font-medium text-white",
                            v.tone,
                            update.isPending ? "cursor-wait opacity-60" : "",
                          ].join(" ")}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {update.isError ? (
        <p className="text-sm text-rose-700">{errorMessage(update.error)}</p>
      ) : null}
    </div>
  )
}
