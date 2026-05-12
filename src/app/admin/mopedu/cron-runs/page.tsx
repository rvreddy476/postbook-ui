"use client"

// Mopedu admin cron run viewer.
//
// Filters by job + since, table refreshes every 60s. Click a row to inspect
// the full JSON payload in a modal — handy when ops needs to dig into the
// `error_summary` field of a failed run.

import { useMemo, useState } from "react"
import { Loader2 } from "lucide-react"

import { useMopeduCronRuns } from "@/hooks/useMopeduAdmin"
import type { CronRunRow, CronRunStatus } from "@/types/mopedu"

import {
  EmptyState,
  JsonViewer,
  Modal,
  Pagination,
  classNames,
  errorMessage,
  formatDate,
  shortId,
} from "../_shared"

// All 11 background jobs we run. Keeping this in sync with the worker
// scheduler is a lightweight contract — adding a new job means appending
// here so ops can filter by it.
const JOBS = [
  "",
  "subscription_billing",
  "subscription_expiry_reminder",
  "ride_no_show_sweep",
  "stale_partner_offline_sweep",
  "fraud_score_recompute",
  "kyc_expiry_reminder",
  "vehicle_doc_expiry_reminder",
  "audit_log_archive",
  "metrics_rollup_daily",
  "cohort_metrics_rollup",
  "cron_run_history_purge",
] as const

const PAGE_SIZE = 50

// ── status pill ───────────────────────────────────────────────────────────

const STATUS_TONES: Record<CronRunStatus, string> = {
  succeeded: "bg-emerald-100 text-emerald-800",
  running: "bg-blue-100 text-blue-800",
  failed: "bg-rose-100 text-rose-800",
}

function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONES[status as CronRunStatus] ?? "bg-gray-100 text-gray-700"
  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        tone,
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  )
}

// ── duration formatter ────────────────────────────────────────────────────

function formatDuration(startedAt: string, finishedAt?: string): string {
  if (!finishedAt) return "—"
  const start = new Date(startedAt).getTime()
  const end = new Date(finishedAt).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return "—"
  const ms = end - start
  if (ms < 0) return "—"
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const rs = Math.round(s - m * 60)
  return `${m}m ${rs}s`
}

// ── page ─────────────────────────────────────────────────────────────────

export default function MopeduCronRunsPage() {
  const [job, setJob] = useState<string>("")
  const [since, setSince] = useState<string>("")
  const [offset, setOffset] = useState<number>(0)
  const [selected, setSelected] = useState<CronRunRow | null>(null)

  const sinceIso = useMemo(() => {
    if (!since) return undefined
    const d = new Date(since)
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
  }, [since])

  const params = useMemo(
    () => ({
      job: job || undefined,
      since: sinceIso,
      limit: PAGE_SIZE,
      offset,
    }),
    [job, sinceIso, offset],
  )

  const list = useMopeduCronRuns(params)
  const items = list.data?.items ?? []
  const total = list.data?.total ?? 0

  function applyFilters(e: React.FormEvent) {
    e.preventDefault()
    setOffset(0)
  }

  function resetFilters() {
    setJob("")
    setSince("")
    setOffset(0)
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={applyFilters}
        className="rounded-2xl border border-brand-divider bg-white px-4 py-3 shadow-sm"
      >
        <div className="flex flex-wrap items-end gap-3">
          <FilterField label="Job">
            <select
              value={job}
              onChange={(e) => {
                setJob(e.target.value)
                setOffset(0)
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-text"
            >
              {JOBS.map((j) => (
                <option key={j} value={j}>
                  {j === "" ? "All jobs" : j}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Since">
            <input
              type="datetime-local"
              value={since}
              onChange={(e) => {
                setSince(e.target.value)
                setOffset(0)
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-text"
            />
          </FilterField>
          <button
            type="submit"
            className="rounded-lg bg-brand-text px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-brand-text/70 hover:bg-gray-50"
          >
            Reset
          </button>
          <div className="ml-auto flex items-center gap-2 text-[11px] text-brand-text/55">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Auto-refreshing every 60s
          </div>
        </div>
      </form>

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
            title="No cron runs"
            body="Adjust filters or wait for the next scheduled run."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Started</th>
                    <th className="px-4 py-3">Job</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Rows</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Error</th>
                    <th className="px-4 py-3">Run ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-xs text-brand-text/70">
                        {formatDate(r.started_at)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{r.job}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {r.rows_processed.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {formatDuration(r.started_at, r.finished_at)}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-xs text-rose-700">
                        {r.error_summary ?? ""}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-brand-text/55">
                        {shortId(r.id, 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              total={total}
              limit={PAGE_SIZE}
              offset={offset}
              onChange={(next) => setOffset(next)}
            />
          </>
        )}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Cron run · ${selected.job}` : ""}
        width="xl"
      >
        {selected ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <KvRow label="Job" value={selected.job} mono />
              <KvRow label="Status">
                <StatusBadge status={selected.status} />
              </KvRow>
              <KvRow label="Started" value={formatDate(selected.started_at)} />
              <KvRow
                label="Finished"
                value={
                  selected.finished_at
                    ? formatDate(selected.finished_at)
                    : "Still running"
                }
              />
              <KvRow
                label="Duration"
                value={formatDuration(selected.started_at, selected.finished_at)}
                mono
              />
              <KvRow
                label="Rows processed"
                value={selected.rows_processed.toLocaleString()}
                mono
              />
              <KvRow label="Run ID" value={selected.id} mono />
            </div>
            {selected.error_summary ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                <p className="mb-1 font-semibold uppercase tracking-wider text-rose-700">
                  Error summary
                </p>
                <p className="whitespace-pre-wrap break-words">
                  {selected.error_summary}
                </p>
              </div>
            ) : null}
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-text/55">
                Full row JSON
              </p>
              <JsonViewer value={selected} />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

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

function KvRow({
  label,
  value,
  children,
  mono,
}: {
  label: string
  value?: string
  children?: React.ReactNode
  mono?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-text/55">
        {label}
      </p>
      <div
        className={classNames(
          "mt-0.5 break-words text-brand-text",
          mono ? "font-mono text-xs" : "text-sm",
        )}
      >
        {children ?? value ?? "—"}
      </div>
    </div>
  )
}
