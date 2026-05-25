'use client'

// /admin/dating/panic — P0-8 panic queue.
//
// Recent dating_safety_events of kind='panic'. The "on-call" queue —
// each row has a 15-minute SLA before alerting. Notification-service
// already pushes safety.panic to the dating-admins group; this view
// is for retrospective + queue visibility.

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

const ADMIN_HEADERS = { 'X-Scopes': 'admin superadmin moderator' } as const

interface PanicRow {
  id: string
  user_id: string
  kind: string
  details?: Record<string, unknown>
  created_at: string
}

const SLA_MINUTES = 15

export default function DatingPanicQueue() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-dating-panic'],
    queryFn: async () => {
      const res = await api.get('/v1/dating/admin/safety/panic?limit=100', {
        headers: ADMIN_HEADERS,
      })
      const items = (res.data?.data?.items ?? res.data?.items ?? []) as PanicRow[]
      return items
    },
    refetchInterval: 15_000,
  })

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Panic queue</h1>
          <p className="text-sm text-gray-500">
            15-minute SLA. Refreshes every 15 seconds.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-sm px-3 py-2 border rounded hover:bg-gray-50"
        >
          Refresh now
        </button>
      </header>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

      {data && data.length === 0 && !isLoading && (
        <div className="rounded-lg border bg-emerald-50 border-emerald-200 p-6 text-sm text-emerald-700">
          ✓ No panic events.
        </div>
      )}

      {data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((r) => (
            <PanicRow key={r.id} row={r} />
          ))}
        </ul>
      )}
    </div>
  )
}

function PanicRow({ row }: { row: PanicRow }) {
  const occurred = new Date(row.created_at)
  const ageMin = Math.floor((Date.now() - occurred.getTime()) / 60_000)
  const breached = ageMin >= SLA_MINUTES
  const within = ageMin < 60
  return (
    <li
      className={`border rounded-lg p-4 flex items-center gap-4 ${
        breached
          ? 'bg-rose-50 border-rose-300'
          : within
          ? 'bg-amber-50 border-amber-200'
          : 'bg-white border-gray-200'
      }`}
    >
      <div
        className={`h-10 w-10 rounded-full flex items-center justify-center text-xl ${
          breached ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
        }`}
      >
        ⚠
      </div>
      <div className="flex-1">
        <div className="font-medium font-mono text-sm">user {row.user_id.slice(0, 12)}…</div>
        <div className="text-xs text-gray-600">
          {occurred.toLocaleString()} · {ageMin} min ago
          {breached && <span className="text-rose-700 font-semibold ml-2">SLA BREACHED</span>}
        </div>
        {row.details && Object.keys(row.details).length > 0 && (
          <pre className="text-xs text-gray-500 mt-1 font-mono">
            {JSON.stringify(row.details)}
          </pre>
        )}
      </div>
      <button
        type="button"
        disabled
        className="text-xs px-3 py-1.5 border rounded text-gray-400 cursor-not-allowed"
        title="Acknowledge action lands in Phase 2"
      >
        Acknowledge
      </button>
    </li>
  )
}
