"use client"

// Complaints queue. Tabs by status, side panel with full description and
// status update form (radio: under_review / resolved / dismissed + note).

import Link from "next/link"
import { useMemo, useState } from "react"
import { Loader2, X } from "lucide-react"

import {
  useMopeduComplaints,
  useUpdateMopeduComplaint,
} from "@/hooks/useMopeduAdmin"
import type { ComplaintRow } from "@/lib/mopedu_api"
import type { ComplaintStatus } from "@/types/mopedu"

import {
  EmptyState,
  PrimaryButton,
  StatusPill,
  classNames,
  errorMessage,
  formatDate,
  maskFirstName,
  relativeTime,
  shortId,
  toneForStatus,
} from "../_shared"

const TABS: Array<{ key: ComplaintStatus; label: string }> = [
  { key: "open", label: "Open" },
  { key: "under_review", label: "Under review" },
  { key: "resolved", label: "Resolved" },
  { key: "dismissed", label: "Dismissed" },
]

const UPDATE_OPTIONS: Array<{ value: ComplaintStatus; label: string }> = [
  { value: "under_review", label: "Under review" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
]

export default function MopeduComplaintsPage() {
  const [tab, setTab] = useState<ComplaintStatus>("open")
  const [selected, setSelected] = useState<ComplaintRow | null>(null)
  const [nextStatus, setNextStatus] = useState<ComplaintStatus>("under_review")
  const [note, setNote] = useState<string>("")

  const params = useMemo(
    () => ({ status: tab, limit: 50, offset: 0 }),
    [tab],
  )

  const list = useMopeduComplaints(params)
  const updateM = useUpdateMopeduComplaint()
  const items = list.data?.items ?? []

  function pickRow(c: ComplaintRow) {
    setSelected(c)
    setNextStatus(
      c.status === "open"
        ? "under_review"
        : c.status === "under_review"
          ? "resolved"
          : "resolved",
    )
    setNote("")
  }

  function closePanel() {
    setSelected(null)
    setNote("")
  }

  async function handleUpdate() {
    if (!selected) return
    await updateM.mutateAsync({
      id: selected.id,
      status: nextStatus,
      note: note.trim() || undefined,
    })
    closePanel()
  }

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
                onClick={() => {
                  setTab(t.key)
                  closePanel()
                }}
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

      <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
        <div className="overflow-hidden rounded-2xl border border-brand-divider bg-white shadow-sm">
          {list.isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-brand-text/60">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : list.isError ? (
            <div className="px-4 py-6 text-sm text-rose-700">
              {errorMessage(list.error)}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="No complaints"
              body="Nothing waiting in this bucket."
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3">Complaint</th>
                  <th className="px-4 py-3">Ride</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => pickRow(c)}
                    className={classNames(
                      "cursor-pointer transition-colors hover:bg-gray-50",
                      selected?.id === c.id && "bg-blue-50/40",
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-brand-text">
                      {shortId(c.id)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link
                        href={`/admin/mopedu/rides?q=${encodeURIComponent(c.ride_id)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-brand-text/70 underline-offset-2 hover:underline"
                      >
                        {shortId(c.ride_id)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-800">
                        {c.category.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-brand-text/70">
                      {c.description ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {maskFirstName(c.customer_name)}
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-text/55">
                      {relativeTime(c.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          {selected ? (
            <div className="rounded-2xl border border-brand-divider bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/60">
                    {selected.category.replace(/_/g, " ")}
                  </p>
                  <p className="mt-1 font-mono text-sm text-brand-text">
                    {shortId(selected.id, 12)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closePanel}
                  className="rounded-full p-1 text-brand-text/40 hover:bg-gray-100 hover:text-brand-text"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <dl className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">Status</dt>
                  <dd>
                    <StatusPill
                      status={selected.status}
                      tone={toneForStatus(selected.status)}
                    />
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">Ride</dt>
                  <dd className="font-mono">{shortId(selected.ride_id, 12)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">Customer</dt>
                  <dd>{maskFirstName(selected.customer_name)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">Created</dt>
                  <dd>{formatDate(selected.created_at)}</dd>
                </div>
                {selected.resolved_at ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-brand-text/60">Resolved</dt>
                    <dd>{formatDate(selected.resolved_at)}</dd>
                  </div>
                ) : null}
              </dl>

              <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-brand-text/60">
                Description
              </p>
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-xs text-brand-text/80">
                {selected.description ?? "—"}
              </p>

              {selected.resolution_note ? (
                <>
                  <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-brand-text/60">
                    Resolution note
                  </p>
                  <p className="mt-1 whitespace-pre-wrap rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                    {selected.resolution_note}
                  </p>
                </>
              ) : null}

              {selected.status !== "resolved" &&
              selected.status !== "dismissed" ? (
                <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/60">
                    Update status
                  </p>
                  <div className="mt-2 space-y-1">
                    {UPDATE_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex cursor-pointer items-center gap-2 text-xs text-brand-text"
                      >
                        <input
                          type="radio"
                          name="complaint-status"
                          value={opt.value}
                          checked={nextStatus === opt.value}
                          onChange={() => setNextStatus(opt.value)}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 400))}
                    rows={3}
                    placeholder="Resolution note (optional)"
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:border-brand-text"
                  />
                  <div className="mt-2 flex justify-end">
                    <PrimaryButton
                      tone="green"
                      disabled={updateM.isPending}
                      onClick={() => void handleUpdate()}
                    >
                      {updateM.isPending ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Update
                    </PrimaryButton>
                  </div>
                  {updateM.isError ? (
                    <p className="mt-2 text-xs text-rose-700">
                      {errorMessage(updateM.error)}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-xs text-brand-text/55">
              Pick a complaint on the left to inspect it here.
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
