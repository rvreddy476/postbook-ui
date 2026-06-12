"use client"

// Admin audit log viewer. Filters by actor (user id), action, target_kind,
// since (datetime). Click a row to open a modal with the redacted request
// body + the full JSON row.

import { useMemo, useState } from "react"
import { Loader2 } from "lucide-react"

import { useMopeduAuditLogs } from "@/hooks/useMopeduAdmin"
import type { AuditLog } from "@/types/mopedu"

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

const TARGET_KINDS = [
  "",
  "partner",
  "vehicle",
  "document",
  "payment",
  "ride",
  "complaint",
  "safety_incident",
  "city",
  "zone",
  "fare_rule",
] as const

const PAGE_SIZE = 50

function statusTone(code: number): string {
  if (code >= 500) return "bg-rose-100 text-rose-800"
  if (code >= 400) return "bg-amber-100 text-amber-800"
  if (code >= 300) return "bg-blue-100 text-blue-800"
  if (code >= 200) return "bg-emerald-100 text-emerald-800"
  return "bg-gray-100 text-gray-700"
}

export default function MopeduAuditLogsPage() {
  const [actor, setActor] = useState<string>("")
  const [action, setAction] = useState<string>("")
  const [targetKind, setTargetKind] = useState<string>("")
  const [since, setSince] = useState<string>("")
  const [offset, setOffset] = useState<number>(0)
  const [selected, setSelected] = useState<AuditLog | null>(null)

  // Convert datetime-local → ISO for the backend, otherwise pass-through.
  const sinceIso = useMemo(() => {
    if (!since) return undefined
    const d = new Date(since)
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
  }, [since])

  const params = useMemo(
    () => ({
      actor: actor.trim() || undefined,
      action: action.trim() || undefined,
      target_kind: targetKind || undefined,
      since: sinceIso,
      limit: PAGE_SIZE,
      offset,
    }),
    [actor, action, targetKind, sinceIso, offset],
  )

  const list = useMopeduAuditLogs(params)
  const items = list.data?.items ?? []
  const total = list.data?.total ?? 0

  function applyFilters(e: React.FormEvent) {
    e.preventDefault()
    setOffset(0)
  }

  function clearFilters() {
    setActor("")
    setAction("")
    setTargetKind("")
    setSince("")
    setOffset(0)
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={applyFilters}
        className="rounded-2xl border border-brand-divider bg-brand-card px-4 py-3 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <input
            type="text"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            placeholder="Actor user id"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-text"
          />
          <input
            type="text"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Action (e.g. partner.approve)"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-text"
          />
          <select
            value={targetKind}
            onChange={(e) => setTargetKind(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-text"
          >
            {TARGET_KINDS.map((k) => (
              <option key={k} value={k}>
                {k === "" ? "Any target kind" : k}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            value={since}
            onChange={(e) => setSince(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-text"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-brand-text px-3 py-2 text-sm font-semibold text-white hover:bg-brand-text/90"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-brand-text/70 hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-brand-divider bg-brand-card shadow-sm">
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
            title="No audit log rows"
            body="Adjust the filters and try again."
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target kind</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelected(row)}
                    className="cursor-pointer transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-xs text-brand-text/70">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {shortId(row.actor_user_id)}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-brand-text">
                      {row.action}
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-text/70">
                      {row.target_kind}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {shortId(row.target_id)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs uppercase text-brand-text/70">
                      {row.request_method}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={classNames(
                          "inline-flex rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold",
                          statusTone(row.response_status),
                        )}
                      >
                        {row.response_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-text/70">
                      {row.latency_ms}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              total={total}
              limit={PAGE_SIZE}
              offset={offset}
              onChange={setOffset}
            />
          </>
        )}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Audit log entry"
        width="xl"
      >
        {selected ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <Field k="When" v={formatDate(selected.created_at)} />
              <Field k="Actor" v={selected.actor_user_id} mono />
              <Field k="Action" v={selected.action} />
              <Field k="Target kind" v={selected.target_kind} />
              <Field k="Target id" v={selected.target_id} mono />
              <Field k="Method" v={selected.request_method} mono />
              <Field k="Path" v={selected.request_path} mono />
              <Field k="Status" v={String(selected.response_status)} mono />
              <Field k="Latency" v={`${selected.latency_ms} ms`} />
              <Field k="IP" v={selected.ip_address ?? "—"} mono />
              {selected.user_agent ? (
                <div className="col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-text/55">
                    User agent
                  </p>
                  <p className="mt-0.5 break-all font-mono text-[11px] text-brand-text/70">
                    {selected.user_agent}
                  </p>
                </div>
              ) : null}
            </dl>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/60">
                Request body (redacted)
              </p>
              <div className="mt-2">
                <JsonViewer value={selected.request_body ?? null} />
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/60">
                Full row
              </p>
              <div className="mt-2">
                <JsonViewer value={selected} collapsedHeight="max-h-72" />
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

function Field({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-text/55">
        {k}
      </p>
      <p
        className={classNames(
          "mt-0.5 text-xs text-brand-text",
          mono && "font-mono",
        )}
      >
        {v}
      </p>
    </div>
  )
}
