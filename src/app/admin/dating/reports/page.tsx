'use client'

// /admin/dating/reports — P0-8 reports queue.
//
// Lists rows from /v1/dating/admin/reports with filters by status +
// category. Each row links to the reported user's profile snapshot
// and exposes the existing photo-moderation + (eventually)
// suspend/restrict actions.

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

const ADMIN_HEADERS = { 'X-Scopes': 'admin superadmin moderator' } as const

interface ReportRow {
  id: string
  reporter_id: string
  target_id: string
  category: string
  details: string
  status: string
  created_at: string
}

type AdminAction = 'dismiss' | 'resolved' | 'warn' | 'restrict' | 'suspend'

const STATUSES = ['', 'submitted', 'under_review', 'investigating', 'actioned', 'resolved', 'dismissed', 'closed_no_action']
const CATEGORIES = ['', 'underage', 'fake_profile', 'scam', 'inappropriate_photos', 'harassment', 'violence', 'other']

export default function DatingReportsQueue() {
  const qc = useQueryClient()
  const [status, setStatus] = useState('submitted')
  const [category, setCategory] = useState('')

  const params = new URLSearchParams({ limit: '100' })
  if (status) params.set('status', status)
  if (category) params.set('category', category)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-dating-reports', status, category],
    queryFn: async () => {
      const res = await api.get(`/v1/dating/admin/reports?${params.toString()}`, {
        headers: ADMIN_HEADERS,
      })
      const items = (res.data?.data?.items ?? res.data?.items ?? []) as ReportRow[]
      return items
    },
  })

  const act = useMutation({
    mutationFn: async (vars: { reportId: string; targetId: string; action: AdminAction }) => {
      await api.post(
        `/v1/dating/admin/reports/${vars.reportId}/action`,
        { action: vars.action, target_user_id: vars.targetId },
        { headers: ADMIN_HEADERS },
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-dating-reports'] }),
  })

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <div className="text-xs text-gray-500">
          Filters apply server-side • {data?.length ?? 0} matches
        </div>
      </header>

      <div className="flex gap-3 items-end">
        <label className="text-sm">
          <div className="text-gray-500 mb-1">Status</div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border rounded px-3 py-2"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s || 'any'}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="text-gray-500 mb-1">Category</div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border rounded px-3 py-2"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c || 'any'}</option>
            ))}
          </select>
        </label>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && (
        <p className="text-sm text-rose-700">Failed to load reports: {(error as Error).message}</p>
      )}

      {data && data.length === 0 && !isLoading && (
        <div className="rounded-lg border bg-gray-50 p-6 text-sm text-gray-500">
          No reports match the current filters.
        </div>
      )}

      {data && data.length > 0 && (
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Reporter → Target</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Details</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => {
                const terminal = ['actioned', 'resolved', 'dismissed', 'closed_no_action'].includes(r.status)
                return (
                  <tr key={r.id} className="border-t align-top">
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      <div>{r.reporter_id.slice(0, 8)}</div>
                      <div className="text-rose-600">→ {r.target_id.slice(0, 8)}</div>
                    </td>
                    <td className="px-3 py-2">{r.category.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-3 py-2 max-w-md truncate text-gray-600" title={r.details}>
                      {r.details}
                    </td>
                    <td className="px-3 py-2">
                      {terminal ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          <ActionButton
                            label="Dismiss"
                            tone="gray"
                            disabled={act.isPending}
                            onClick={() => act.mutate({ reportId: r.id, targetId: r.target_id, action: 'dismiss' })}
                          />
                          <ActionButton
                            label="Warn"
                            tone="amber"
                            disabled={act.isPending}
                            onClick={() => act.mutate({ reportId: r.id, targetId: r.target_id, action: 'warn' })}
                          />
                          <ActionButton
                            label="Restrict"
                            tone="orange"
                            disabled={act.isPending}
                            confirm
                            onClick={() => act.mutate({ reportId: r.id, targetId: r.target_id, action: 'restrict' })}
                          />
                          <ActionButton
                            label="Suspend"
                            tone="rose"
                            disabled={act.isPending}
                            confirm
                            onClick={() => act.mutate({ reportId: r.id, targetId: r.target_id, action: 'suspend' })}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Action surfaces (suspend / warn / restrict) are wired to{' '}
        <code>POST /v1/dating/admin/reports/:id/action</code> in Phase 2.
      </p>
    </div>
  )
}

function ActionButton({
  label,
  tone,
  disabled,
  onClick,
  confirm,
}: {
  label: string
  tone: 'gray' | 'amber' | 'orange' | 'rose'
  disabled: boolean
  onClick: () => void
  confirm?: boolean
}) {
  const palette = {
    gray: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    amber: 'bg-amber-100 text-amber-800 hover:bg-amber-200',
    orange: 'bg-orange-100 text-orange-800 hover:bg-orange-200',
    rose: 'bg-rose-100 text-rose-800 hover:bg-rose-200',
  }[tone]
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (confirm) {
          const ok = typeof window !== 'undefined' &&
            window.confirm(`${label} the reported user? This action is logged.`)
          if (!ok) return
        }
        onClick()
      }}
      className={`text-xs px-2 py-1 rounded ${palette} disabled:opacity-50`}
    >
      {label}
    </button>
  )
}

function StatusPill({ status }: { status: string }) {
  const palette = ((): { bg: string; fg: string } => {
    switch (status) {
      case 'submitted':       return { bg: 'bg-gray-100',    fg: 'text-gray-700' }
      case 'under_review':    return { bg: 'bg-amber-100',   fg: 'text-amber-700' }
      case 'investigating':   return { bg: 'bg-amber-100',   fg: 'text-amber-700' }
      case 'actioned':        return { bg: 'bg-emerald-100', fg: 'text-emerald-700' }
      case 'resolved':        return { bg: 'bg-emerald-100', fg: 'text-emerald-700' }
      case 'dismissed':       return { bg: 'bg-gray-100',    fg: 'text-gray-600' }
      case 'closed_no_action':return { bg: 'bg-gray-100',    fg: 'text-gray-600' }
      default:                return { bg: 'bg-gray-100',    fg: 'text-gray-600' }
    }
  })()
  return <span className={`text-xs px-2 py-0.5 rounded-full ${palette.bg} ${palette.fg}`}>{status}</span>
}
