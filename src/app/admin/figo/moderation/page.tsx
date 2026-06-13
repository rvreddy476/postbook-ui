"use client"

// FiGo admin moderation queue.
//
// Menu items auto-flip to `flagged` once 3+ unresolved customer
// reports stack (see food.menu_item_reports auto-flag threshold).
// This page is the admin's triage view: render the queue, let the
// admin approve / reject / mark for re-review with an optional reason.

import { useState } from "react"
import { Loader2 } from "lucide-react"

import {
  useFoodModerateItem,
  useFoodModerationQueue,
} from "@/hooks/useFoodAdmin"
import type { ModerationStatus } from "@/types/food"

import {
  EmptyState,
  SecondaryButton,
  errorMessage,
} from "../../mopedu/_shared"

const VERDICTS: Array<{ key: ModerationStatus; label: string; tone: string }> =
  [
    {
      key: "approved",
      label: "Approve",
      tone: "bg-emerald-600 hover:bg-emerald-700",
    },
    {
      key: "rejected",
      label: "Reject (hide)",
      tone: "bg-rose-600 hover:bg-rose-700",
    },
    {
      key: "pending_review",
      label: "Send back",
      tone: "bg-amber-600 hover:bg-amber-700",
    },
  ]

export default function FoodModerationPage() {
  const q = useFoodModerationQueue()
  const moderate = useFoodModerateItem()
  const [reasons, setReasons] = useState<Record<string, string>>({})

  const setReason = (id: string, r: string) =>
    setReasons((prev) => ({ ...prev, [id]: r }))

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Menu items auto-flag at 3+ open customer reports. Approving an
        item resolves every open report against it; rejecting hides
        the item from customer listings.
      </p>

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        {q.isLoading ? (
          <div className="flex items-center justify-center p-6 text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading queue…
          </div>
        ) : q.error ? (
          <div className="p-4 text-sm text-rose-700">
            {errorMessage(q.error)}
          </div>
        ) : (q.data ?? []).length === 0 ? (
          <EmptyState
            title="Inbox clear"
            body="No items flagged or pending review right now."
          />
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Restaurant</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Reports</th>
                <th className="px-3 py-2">Latest</th>
                <th className="px-3 py-2">Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(q.data ?? []).map((row) => {
                const r = reasons[row.id] ?? ""
                return (
                  <tr key={row.id} className="align-top">
                    <td className="px-3 py-3">
                      <div className="font-medium">{row.name}</div>
                      {row.moderation_reason ? (
                        <div className="text-xs text-slate-500">
                          {row.moderation_reason}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">{row.restaurant_name}</td>
                    <td className="px-3 py-3">
                      <span
                        className={
                          row.moderation_status === "flagged"
                            ? "rounded bg-rose-100 px-2 py-0.5 text-xs text-rose-800"
                            : "rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800"
                        }
                      >
                        {row.moderation_status}
                      </span>
                    </td>
                    <td className="px-3 py-3">{row.open_reports}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {row.latest_report_at
                        ? new Date(row.latest_report_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          placeholder="Reason (optional)"
                          value={r}
                          onChange={(e) => setReason(row.id, e.target.value)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                        <div className="flex flex-wrap gap-1">
                          {VERDICTS.map((v) => (
                            <button
                              key={v.key}
                              type="button"
                              onClick={() =>
                                moderate.mutate({
                                  itemId: row.id,
                                  status: v.key,
                                  reason: r,
                                })
                              }
                              disabled={moderate.isPending}
                              className={[
                                "rounded px-2 py-1 text-xs font-medium text-white transition",
                                v.tone,
                                moderate.isPending
                                  ? "cursor-wait opacity-60"
                                  : "",
                              ].join(" ")}
                            >
                              {v.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {moderate.isError ? (
        <p className="text-sm text-rose-700">
          {errorMessage(moderate.error)}
        </p>
      ) : null}

      <div className="flex justify-end">
        <SecondaryButton onClick={() => q.refetch()}>Refresh</SecondaryButton>
      </div>
    </div>
  )
}
