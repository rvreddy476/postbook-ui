"use client"

// Safety incidents queue. Sorted by severity desc → created_at desc.
// Filters: status + severity. Inline acknowledge / resolve actions.

import Link from "next/link"
import { useMemo, useState } from "react"
import { Loader2 } from "lucide-react"

import {
  useAcknowledgeSafetyIncident,
  useMopeduSafetyIncidents,
  useResolveSafetyIncident,
} from "@/hooks/useMopeduAdmin"
import type { SafetyIncidentRow } from "@/lib/mopedu_api"
import type {
  SafetyIncidentSeverity,
  SafetyIncidentStatus,
} from "@/types/mopedu"

import {
  ConfirmDialog,
  EmptyState,
  StatusPill,
  classNames,
  errorMessage,
  formatDate,
  maskFirstName,
  relativeTime,
  severityTone,
  shortId,
  toneForStatus,
} from "../_shared"

const STATUS_FILTERS: Array<{ key: "all" | SafetyIncidentStatus; label: string }> = [
  { key: "open", label: "Open" },
  { key: "acknowledged", label: "Acknowledged" },
  { key: "resolved", label: "Resolved" },
  { key: "dismissed", label: "Dismissed" },
  { key: "all", label: "All" },
]

const SEVERITY_FILTERS: Array<{
  key: "all" | SafetyIncidentSeverity
  label: string
}> = [
  { key: "all", label: "Any" },
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
]

const SEVERITY_RANK: Record<SafetyIncidentSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export default function MopeduSafetyPage() {
  const [status, setStatus] = useState<"all" | SafetyIncidentStatus>("open")
  const [severity, setSeverity] = useState<"all" | SafetyIncidentSeverity>(
    "all",
  )

  const params = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
      severity: severity === "all" ? undefined : severity,
      limit: 100,
      offset: 0,
    }),
    [status, severity],
  )

  const list = useMopeduSafetyIncidents(params)
  const ackM = useAcknowledgeSafetyIncident()
  const resolveM = useResolveSafetyIncident()

  const [resolveTarget, setResolveTarget] = useState<SafetyIncidentRow | null>(
    null,
  )

  const sorted = useMemo(() => {
    const items = list.data?.items ?? []
    return [...items].sort((a, b) => {
      const sr = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
      if (sr !== 0) return sr
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    })
  }, [list.data])

  function handleResolveConfirm(note: string) {
    if (!resolveTarget) return
    resolveM.mutate(
      { id: resolveTarget.id, note },
      {
        onSuccess: () => setResolveTarget(null),
      },
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-brand-divider bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((f) => {
            const active = status === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatus(f.key)}
                className={classNames(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "border-brand-text bg-brand-text text-white"
                    : "border-gray-300 bg-white text-brand-text/70 hover:bg-gray-50",
                )}
              >
                {f.label}
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-text/55">
            Severity
          </span>
          {SEVERITY_FILTERS.map((f) => {
            const active = severity === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setSeverity(f.key)}
                className={classNames(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  active
                    ? "border-brand-text bg-brand-text text-white"
                    : "border-gray-300 bg-white text-brand-text/70 hover:bg-gray-50",
                )}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

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
        ) : sorted.length === 0 ? (
          <EmptyState
            title="Queue is empty"
            body="No safety incidents matching this filter."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3">Incident</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ride</th>
                <th className="px-4 py-3">Parties</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-brand-text">
                    {shortId(s.id)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                      {s.kind.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill
                      status={s.severity}
                      tone={severityTone(s.severity)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill
                      status={s.status}
                      tone={toneForStatus(s.status)}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {s.ride_id ? (
                      <Link
                        href={`/admin/mopedu/rides?q=${encodeURIComponent(s.ride_id)}`}
                        className="text-brand-text/70 underline-offset-2 hover:underline"
                      >
                        {shortId(s.ride_id)}
                      </Link>
                    ) : (
                      <span className="text-brand-text/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <p>C: {maskFirstName(s.customer_name)}</p>
                    <p className="text-brand-text/55">
                      P: {maskFirstName(s.partner_name)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-text/55">
                    {relativeTime(s.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex flex-wrap justify-end gap-2">
                      {s.status === "open" ? (
                        <button
                          type="button"
                          disabled={ackM.isPending}
                          onClick={() => ackM.mutate(s.id)}
                          className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {ackM.isPending && ackM.variables === s.id
                            ? "…"
                            : "Acknowledge"}
                        </button>
                      ) : null}
                      {s.status !== "resolved" && s.status !== "dismissed" ? (
                        <button
                          type="button"
                          onClick={() => setResolveTarget(s)}
                          className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                        >
                          Resolve
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {ackM.isError ? (
        <p className="text-xs text-rose-700">{errorMessage(ackM.error)}</p>
      ) : null}

      <ConfirmDialog
        open={!!resolveTarget}
        title={`Resolve incident ${resolveTarget ? shortId(resolveTarget.id) : ""}`}
        description="Add a brief note describing the outcome (required for the audit log)."
        confirmLabel={resolveM.isPending ? "Resolving…" : "Resolve"}
        cancelLabel="Cancel"
        tone="green"
        reasonRequired
        pending={resolveM.isPending}
        onConfirm={handleResolveConfirm}
        onClose={() => setResolveTarget(null)}
      />
    </div>
  )
}
