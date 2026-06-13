'use client'

// PostMatch Safety Center.
//
// Web parity for the mobile Pulse safety center (PRODUCTION_GAP_ANALYSIS.md
// §P0-8 / §13 web gaps). Four sections:
//
//   1. Panic — one-tap escalation that POSTs /v1/dating/safety/panic.
//      Shares the viewer's geolocation when permission granted.
//   2. Safe meet — schedule + share a meet so a trusted contact gets a
//      check-in window. Premium-gated server-side (402 → upsell).
//   3. My reports — list of reports the viewer has filed + status.
//   4. Block list — users the viewer has blocked, with unblock action.
//
// This is the scaffold per the brief — surfaces are in place so deep
// links from the chat / match screens work. Polishing the UX inside each
// section is Phase 2 / 3 work.

import { useState } from 'react'
import Link from 'next/link'
import {
  usePostMatchPanic,
  useScheduleSafeMeet,
  useMyPostMatchReports,
  usePostMatchBlocks,
  useUnblockPostMatchUser,
} from '@/hooks/usePostmatch'

export default function PostMatchSafetyCenter() {
  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Safety Center</h1>
        <p className="text-sm text-gray-500">
          Tools to keep your dating experience safe. Reports stay private —
          we never tell anyone you reported them.
        </p>
      </header>

      <PanicCard />
      <SafeMeetCard />
      <ReportsCard />
      <BlocksCard />
    </div>
  )
}

// ── Panic ─────────────────────────────────────────────────────────────

function PanicCard() {
  const panic = usePostMatchPanic()
  const [confirmation, setConfirmation] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handlePanic = async () => {
    setErrorMsg(null)
    try {
      // Best-effort location capture. Browsers may deny — server still
      // accepts an empty body and falls back to last-known.
      const loc = await new Promise<{ lat?: number; lng?: number }>((resolve) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          resolve({})
          return
        }
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => resolve({}),
          { timeout: 5000, maximumAge: 30_000 },
        )
      })
      await panic.mutateAsync(loc)
      setConfirmation('success')
    } catch (err) {
      setErrorMsg(((err as Error)?.message) ?? 'Something went wrong.')
      setConfirmation('error')
    }
  }

  return (
    <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-rose-600 text-white flex items-center justify-center text-xl">⚠</div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-rose-700">Panic</h2>
          <p className="text-sm text-rose-700/80">
            Alerts our Trust &amp; Safety team and shares your location with the
            trusted contact you&apos;ve configured in your settings.
          </p>
        </div>
      </div>

      {confirmation === 'idle' && (
        <button
          type="button"
          onClick={handlePanic}
          disabled={panic.isPending}
          className="w-full bg-rose-600 text-white py-3 rounded-lg font-semibold disabled:bg-rose-300"
        >
          {panic.isPending ? 'Sending…' : 'Send panic alert'}
        </button>
      )}

      {confirmation === 'success' && (
        <div className="rounded-lg bg-white p-3 text-sm text-emerald-700 border border-emerald-200">
          ✓ Panic alert sent. Our safety team has been notified and your
          trusted contact will receive a live-location link.
        </div>
      )}

      {confirmation === 'error' && (
        <div className="rounded-lg bg-white p-3 text-sm text-rose-700 border border-rose-300">
          Couldn&apos;t send: {errorMsg}. Please call your local emergency
          services if you&apos;re in immediate danger.
        </div>
      )}
    </section>
  )
}

// ── Safe meet ─────────────────────────────────────────────────────────

function SafeMeetCard() {
  // Scaffold: full form lives behind a route, but the entry point is
  // here. Mobile parity for `lib/features/pulse/safety/safe_meet_screen.dart`.
  return (
    <section className="rounded-2xl border bg-white p-5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xl">📍</div>
        <div className="flex-1">
          <h2 className="text-base font-semibold">Safe meet</h2>
          <p className="text-sm text-gray-500">
            Schedule a meet with a match. Share the time + venue with your
            trusted contact and check in afterward — we&apos;ll alert your
            contact if you don&apos;t.
          </p>
        </div>
      </div>
      <SafeMeetForm />
    </section>
  )
}

function SafeMeetForm() {
  const schedule = useScheduleSafeMeet()
  const [withUserId, setWithUserId] = useState('')
  const [when, setWhen] = useState('')
  const [venue, setVenue] = useState('')
  const [confirmation, setConfirmation] = useState<'idle' | 'success' | 'error' | 'upgrade'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    try {
      // Best-effort geo for the venue lat/lng. A real venue picker comes
      // later — for the scaffold, we use the viewer's current position
      // as a placeholder.
      const loc = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          resolve(null)
          return
        }
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => resolve(null),
          { timeout: 5000 },
        )
      })
      if (!loc) {
        setErrorMsg('Location permission required to schedule a safe meet.')
        setConfirmation('error')
        return
      }
      await schedule.mutateAsync({
        with_user_id: withUserId,
        when: new Date(when).toISOString(),
        lat: loc.lat,
        lng: loc.lng,
        venue_name: venue,
      })
      setConfirmation('success')
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 402) {
        setConfirmation('upgrade')
        return
      }
      setErrorMsg(((err as Error)?.message) ?? 'Something went wrong.')
      setConfirmation('error')
    }
  }

  if (confirmation === 'success') {
    return (
      <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 border border-emerald-200">
        ✓ Safe meet scheduled. Your trusted contact will be notified at
        the start of the window.
      </div>
    )
  }
  if (confirmation === 'upgrade') {
    return (
      <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 border border-amber-200">
        Safe meet is a Premium feature.{' '}
        <Link href="/postmatch/settings" className="underline font-semibold">Upgrade →</Link>
      </div>
    )
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-2 text-sm">
      <input
        type="text"
        required
        placeholder="Match user ID"
        value={withUserId}
        onChange={(e) => setWithUserId(e.target.value)}
        className="w-full border rounded px-3 py-2"
      />
      <input
        type="datetime-local"
        required
        value={when}
        onChange={(e) => setWhen(e.target.value)}
        className="w-full border rounded px-3 py-2"
      />
      <input
        type="text"
        required
        placeholder="Venue name (e.g. Filter Coffee, Indiranagar)"
        value={venue}
        onChange={(e) => setVenue(e.target.value)}
        className="w-full border rounded px-3 py-2"
      />
      <button
        type="submit"
        disabled={schedule.isPending}
        className="w-full bg-emerald-600 text-white py-2 rounded font-semibold disabled:bg-gray-300"
      >
        {schedule.isPending ? 'Scheduling…' : 'Schedule safe meet'}
      </button>
      {confirmation === 'error' && errorMsg && (
        <p className="text-rose-700 text-xs">{errorMsg}</p>
      )}
    </form>
  )
}

// ── My reports ────────────────────────────────────────────────────────

function ReportsCard() {
  const { data, isLoading } = useMyPostMatchReports()
  return (
    <section className="rounded-2xl border bg-white p-5 space-y-3">
      <header className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl">📋</div>
        <div className="flex-1">
          <h2 className="text-base font-semibold">My reports</h2>
          <p className="text-sm text-gray-500">
            Track the status of reports you&apos;ve filed.
          </p>
        </div>
      </header>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

      {data && data.endpoint_available === false && (
        <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
          The dating service hasn&apos;t shipped this endpoint yet. Your
          report submissions still went through — they&apos;ll appear here
          once the status endpoint lands.
        </div>
      )}

      {data && data.endpoint_available && data.items.length === 0 && (
        <p className="text-sm text-gray-500">No reports filed.</p>
      )}

      {data && data.items.length > 0 && (
        <ul className="space-y-2">
          {data.items.map((r) => (
            <li key={r.id} className="border rounded-lg p-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{r.target_name ?? r.target_user_id}</span>
                <ReportStatusPill status={r.status} />
              </div>
              <p className="text-xs text-gray-500">
                Category: {r.category.replace(/_/g, ' ')} ·{' '}
                {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
              </p>
              {r.resolution_note && (
                <p className="text-xs text-gray-700 mt-1">{r.resolution_note}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ReportStatusPill({ status }: { status: string }) {
  const palette = ((): { bg: string; fg: string; label: string } => {
    switch (status) {
      case 'submitted':       return { bg: 'bg-gray-100',    fg: 'text-gray-700',    label: 'Submitted' }
      case 'under_review':    return { bg: 'bg-amber-100',   fg: 'text-amber-700',   label: 'Under review' }
      case 'investigating':   return { bg: 'bg-amber-100',   fg: 'text-amber-700',   label: 'Investigating' }
      case 'actioned':        return { bg: 'bg-emerald-100', fg: 'text-emerald-700', label: 'Action taken' }
      case 'resolved':        return { bg: 'bg-emerald-100', fg: 'text-emerald-700', label: 'Resolved' }
      case 'dismissed':       return { bg: 'bg-gray-100',    fg: 'text-gray-600',    label: 'Dismissed' }
      case 'closed_no_action':return { bg: 'bg-gray-100',    fg: 'text-gray-600',    label: 'Closed — no action' }
      default:                return { bg: 'bg-gray-100',    fg: 'text-gray-600',    label: status }
    }
  })()
  return <span className={`text-xs px-2 py-0.5 rounded-full ${palette.bg} ${palette.fg}`}>{palette.label}</span>
}

// ── Blocks ────────────────────────────────────────────────────────────

function BlocksCard() {
  const { data, isLoading } = usePostMatchBlocks()
  const unblock = useUnblockPostMatchUser()

  return (
    <section className="rounded-2xl border bg-white p-5 space-y-3">
      <header className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xl">🚫</div>
        <div className="flex-1">
          <h2 className="text-base font-semibold">Blocked users</h2>
          <p className="text-sm text-gray-500">
            Users you&apos;ve blocked. They won&apos;t see your profile or
            be able to message you.
          </p>
        </div>
      </header>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {data && data.length === 0 && (
        <p className="text-sm text-gray-500">No blocks.</p>
      )}
      {data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((b) => (
            <li key={b.blocked_user_id} className="border rounded-lg p-3 text-sm flex justify-between items-center">
              <div>
                <div className="font-medium">
                  {b.blocked_user?.display_name ?? b.blocked_user?.first_name ?? b.blocked_user_id}
                </div>
                <div className="text-xs text-gray-500">
                  Blocked {b.created_at ? new Date(b.created_at).toLocaleDateString() : '—'}
                  {b.reason ? ` · ${b.reason}` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => unblock.mutate(b.blocked_user_id)}
                disabled={unblock.isPending}
                className="text-xs px-3 py-1.5 rounded border text-rose-600 border-rose-200 disabled:text-gray-400"
              >
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
