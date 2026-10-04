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

interface QueueCount { count: number; loaded: boolean; failed: boolean }

const ADMIN_HEADERS = { 'X-Scopes': 'admin superadmin moderator' } as const

function useQueueCount(path: string): QueueCount {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-dating-count', path],
    queryFn: async () => {
      const res = await api.get(path, { headers: ADMIN_HEADERS })
      const items = (res.data?.data?.items ?? res.data?.items ?? []) as unknown[]
      return items.length
    },
    refetchInterval: 60_000,
    retry: false,
  })
  return { count: data ?? 0, loaded: !isLoading && !isError, failed: isError }
}

export default function DatingAdminDashboard() {
  const reports = useQueueCount('/v1/dating/admin/reports?status=submitted&limit=100')
  const panic = useQueueCount('/v1/dating/admin/safety/panic?limit=50')
  const photos = useQueueCount('/v1/dating/admin/photos/pending?limit=100')

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="workspace-page-head">
        <h1 className="text-2xl font-semibold">Dating safety console</h1>
        <p className="text-sm text-text-muted mt-1">
          Review reports, respond to safety events, and moderate profile photos.
          Sensitive actions require the appropriate permissions.
        </p>
      </header>

      {reports.failed || panic.failed || photos.failed ? <p role="alert" className="rounded-xl border border-warning/20 bg-warning/10 p-4 text-sm text-brand-text">Some queues couldn't load. Open a queue to check access or try again.</p> : null}

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

      <section className="rounded-2xl border bg-brand-card p-5 text-sm space-y-2">
        <h2 className="font-semibold">Review with care</h2>
        <ul className="list-disc pl-5 text-text-muted space-y-1">
          <li>
            Read the original report and available evidence before changing an account's status.
          </li>
          <li>
            Prioritise panic events using your team's safety-response process.
          </li>
          <li>
            Only approve profile photos that meet the community guidelines.
          </li>
          <li>
            Check the{' '}
            <Link href="/admin/dating/audit" className="text-primary-ink underline">
              audit view
            </Link>{' '}
            to understand previous decisions and who made them.
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
    indigo: 'bg-primary-ink/10 border-primary-ink/20 text-primary-ink',
    rose: 'bg-danger/10 border-danger/20 text-danger',
    amber: 'bg-warning/10 border-warning/20 text-warning',
  }[tone]
  return (
    <Link
      href={href}
      className={`block rounded-2xl border p-5 ${palette} hover:shadow-xs transition ${
        urgent ? 'ring-2 ring-danger' : ''
      }`}
    >
      <div className="text-sm opacity-70">{title}</div>
      <div className="text-3xl font-semibold mt-2">{loaded ? count : '—'}</div>
      <div className="text-xs opacity-60 mt-1">{hint}</div>
    </Link>
  )
}
