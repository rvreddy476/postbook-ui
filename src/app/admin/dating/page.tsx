'use client'

// PRODUCTION_GAP_ANALYSIS.md §P0-8 — Dating admin dashboard scaffold.
//
// Surface: top-line metrics for the three queues plus deep links to
// the dedicated pages. Wires the read-side endpoints landed in the
// matching backend commit:
//   GET /v1/dating/admin/reports?status=submitted&limit=1   (count via meta)
//   GET /v1/dating/admin/safety/panic?limit=1
//   GET /v1/dating/admin/photos/pending?limit=1
//
// Action surfaces (suspend / warn / approve) follow in Phase 2; this
// scaffold establishes the routes + the data plumbing.

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

interface QueueCount { count: number; loaded: boolean }

const ADMIN_HEADERS = { 'X-Scopes': 'admin superadmin moderator' } as const

function useQueueCount(path: string): QueueCount {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dating-count', path],
    queryFn: async () => {
      const res = await api.get(path, { headers: ADMIN_HEADERS })
      const items = (res.data?.data?.items ?? res.data?.items ?? []) as unknown[]
      return items.length
    },
    refetchInterval: 60_000,
    retry: false,
  })
  return { count: data ?? 0, loaded: !isLoading }
}

export default function DatingAdminDashboard() {
  const reports = useQueueCount('/v1/dating/admin/reports?status=submitted&limit=100')
  const panic = useQueueCount('/v1/dating/admin/safety/panic?limit=50')
  const photos = useQueueCount('/v1/dating/admin/photos/pending?limit=100')

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Dating safety console</h1>
        <p className="text-sm text-gray-500 mt-1">
          Trust + safety operations for PostMatch / Pulse. Each action is logged
          to the dating_admin_audit append-only table — no anonymous moderation.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QueueCard
          title="Open reports"
          count={reports.count}
          loaded={reports.loaded}
          href="/admin/dating/reports"
          tone="indigo"
          hint="Pending review"
        />
        <QueueCard
          title="Panic events (24h)"
          count={panic.count}
          loaded={panic.loaded}
          href="/admin/dating/panic"
          tone="rose"
          hint="On-call queue"
          urgent={panic.count > 0}
        />
        <QueueCard
          title="Photos awaiting moderation"
          count={photos.count}
          loaded={photos.loaded}
          href="/admin/dating/photos"
          tone="amber"
          hint="Oldest first"
        />
      </div>

      <section className="rounded-2xl border bg-white p-5 text-sm space-y-2">
        <h2 className="font-semibold">Notes</h2>
        <ul className="list-disc pl-5 text-gray-600 space-y-1">
          <li>
            Reports queue lists rows with <code>status=submitted</code>. After
            an action is taken the status transitions
            (<code>under_review</code> → <code>actioned</code> /{' '}
            <code>dismissed</code>) and the row drops from this default view.
          </li>
          <li>
            Panic events page on-call automatically (notification-service emits
            the &quot;safety.panic&quot; push to the dating-admins group). This
            console shows everything in the last 50 events.
          </li>
          <li>
            Photo moderation actions call{' '}
            <code>POST /v1/dating/photos/:id/moderation</code>, which fires deck
            cache invalidation + profile-state transition automatically.
          </li>
          <li>
            Every report transition + photo flip writes one row to the
            append-only <code>dating_admin_audit</code> log — visit the{' '}
            <Link href="/admin/dating/audit" className="text-indigo-700 underline">
              audit view
            </Link>{' '}
            to see who-did-what.
          </li>
          <li>
            Fake-account risk queue not built yet (§P0-7 — Phase 2). The
            scoring schema is documented in <code>PHASE_0_TEST_PLANS.md</code>.
          </li>
        </ul>
      </section>
    </div>
  )
}

function QueueCard({
  title,
  count,
  loaded,
  href,
  tone,
  hint,
  urgent,
}: {
  title: string
  count: number
  loaded: boolean
  href: string
  tone: 'indigo' | 'rose' | 'amber'
  hint: string
  urgent?: boolean
}) {
  const palette = {
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    rose: 'bg-rose-50 border-rose-200 text-rose-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
  }[tone]
  return (
    <Link
      href={href}
      className={`block rounded-2xl border p-5 ${palette} hover:shadow-sm transition ${
        urgent ? 'ring-2 ring-rose-400' : ''
      }`}
    >
      <div className="text-sm opacity-70">{title}</div>
      <div className="text-3xl font-semibold mt-2">{loaded ? count : '—'}</div>
      <div className="text-xs opacity-60 mt-1">{hint}</div>
    </Link>
  )
}
