'use client'

// /admin/dating/audit — P0-8 append-only audit log view.
//
// Surfaces dating_admin_audit rows from GET /v1/dating/admin/audit
// with optional filters by actor, target user, and action. The
// backing table has a Postgres trigger that refuses UPDATE/DELETE so
// the log is tamper-proof — PHASE_0_TEST_PLANS.md §P0-8 test D.
//
// Refetch interval: 60s (the table only grows when an admin clicks
// somewhere; a faster cadence is wasted polling).

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

const ADMIN_HEADERS = { 'X-Scopes': 'admin superadmin moderator' } as const

interface AuditRow {
  id: string
  actor_admin_id: string
  action: string
  target_user_id?: string
  target_resource?: string
  reason?: string
  policy_code?: string
  internal_notes?: string
  created_at: string
}

// Known action verbs the service-layer wiring emits today. Adding a
// new one server-side does NOT require a frontend change — the
// dropdown stays in sync as new actions appear, but the filter list
// is a stable allow-list so the UI doesn't get noisy.
const ACTIONS = [
  '',
  'report_dismiss',
  'report_resolved',
  'report_warn',
  'report_restrict',
  'report_suspend',
  'photo_approved',
  'photo_rejected',
  'photo_pending',
]

export default function DatingAuditLog() {
  const [actor, setActor] = useState('')
  const [targetUserId, setTargetUserId] = useState('')
  const [action, setAction] = useState('')

  const params = new URLSearchParams({ limit: '100' })
  if (actor) params.set('actor', actor)
  if (targetUserId) params.set('target_user_id', targetUserId)
  if (action) params.set('action', action)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-dating-audit', actor, targetUserId, action],
    queryFn: async () => {
      const res = await api.get(`/v1/dating/admin/audit?${params.toString()}`, {
        headers: ADMIN_HEADERS,
      })
      const items = (res.data?.data?.items ?? res.data?.items ?? []) as AuditRow[]
      return items
    },
    refetchInterval: 60_000,
  })

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="text-sm text-text-muted">
          Append-only record of every admin action taken from the dating
          console. Rows cannot be modified or deleted — the
          <code className="mx-1">dating_admin_audit</code>table is
          guarded by a database trigger.
        </p>
      </header>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          <div className="text-text-muted mb-1">Action</div>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="border rounded-sm px-3 py-2 min-w-48"
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{a || 'any'}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="text-text-muted mb-1">Actor admin UUID</div>
          <input
            value={actor}
            onChange={(e) => setActor(e.target.value.trim())}
            placeholder="00000000-0000-0000-0000-000000000000"
            className="border rounded-sm px-3 py-2 font-mono text-xs w-88"
          />
        </label>
        <label className="text-sm">
          <div className="text-text-muted mb-1">Target user UUID</div>
          <input
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value.trim())}
            placeholder="00000000-0000-0000-0000-000000000000"
            className="border rounded-sm px-3 py-2 font-mono text-xs w-88"
          />
        </label>
        {(actor || targetUserId || action) && (
          <button
            type="button"
            onClick={() => { setActor(''); setTargetUserId(''); setAction('') }}
            className="text-xs px-3 py-2 border rounded-sm hover:bg-brand-secondary"
          >
            Clear filters
          </button>
        )}
      </div>

      {isLoading && <p className="text-sm text-text-muted">Loading…</p>}
      {error && (
        <p className="text-sm text-danger">
          Failed to load audit log: {(error as Error).message}
        </p>
      )}

      {data && data.length === 0 && !isLoading && (
        <div className="rounded-lg border bg-brand-secondary p-6 text-sm text-text-muted">
          No audit rows match the current filters.
        </div>
      )}

      {data && data.length > 0 && (
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-brand-secondary text-left text-xs text-text-muted">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="px-3 py-2 text-xs text-text-muted whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.actor_admin_id === '00000000-0000-0000-0000-000000000000'
                      ? <span className="text-warning">(missing X-Admin-Id)</span>
                      : <span title={r.actor_admin_id}>{r.actor_admin_id.slice(0, 8)}…</span>}
                  </td>
                  <td className="px-3 py-2">
                    <ActionPill action={r.action} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.target_user_id && (
                      <div title={r.target_user_id}>
                        user {r.target_user_id.slice(0, 8)}…
                      </div>
                    )}
                    {r.target_resource && (
                      <div className="text-text-muted" title={r.target_resource}>
                        {r.target_resource.length > 32
                          ? `${r.target_resource.slice(0, 32)}…`
                          : r.target_resource}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 max-w-md text-text-muted">
                    {r.reason || <span className="text-text-muted">—</span>}
                    {r.policy_code && (
                      <div className="text-xs text-text-muted">
                        policy {r.policy_code}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-text-muted">
        Showing the {data?.length ?? 0} most recent rows that match the
        current filters. Pagination ships in Phase 2.
      </p>
    </div>
  )
}

function ActionPill({ action }: { action: string }) {
  const tone = ((): { bg: string; fg: string } => {
    if (action.startsWith('report_suspend') || action.startsWith('report_restrict')) {
      return { bg: 'bg-danger/10', fg: 'text-danger' }
    }
    if (action.startsWith('report_warn')) {
      return { bg: 'bg-warning/10', fg: 'text-warning' }
    }
    if (action.startsWith('report_dismiss') || action.startsWith('report_resolved')) {
      return { bg: 'bg-brand-secondary', fg: 'text-brand-text' }
    }
    if (action === 'photo_approved') {
      return { bg: 'bg-success/10', fg: 'text-success' }
    }
    if (action === 'photo_rejected') {
      return { bg: 'bg-danger/10', fg: 'text-danger' }
    }
    return { bg: 'bg-primary-ink/10', fg: 'text-primary-ink' }
  })()
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${tone.bg} ${tone.fg}`}>
      {action}
    </span>
  )
}
