'use client'

import Link from 'next/link'
import {
  Lock, ShieldAlert, ArrowLeft, Loader2, AlertTriangle, Trash2,
} from 'lucide-react'

/* ===== Helpers ===== */

const typeEmojis: Record<string, string> = {
  announcement: '\uD83D\uDCE2',
  image: '\uD83D\uDCF8',
  video: '\uD83C\uDFAC',
  audio: '\uD83C\uDFA7',
  poll: '\uD83D\uDCCA',
  event: '\uD83D\uDCC5',
  commerce: '\uD83D\uDECD',
  alert: '\u26A0\uFE0F',
  digest: '\uD83D\uDCD6',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/* ===================================================================
   1. LockedUpdateCard
   =================================================================== */

export function LockedUpdateCard({ update, channelName, onSubscribe }: {
  update: { id: string; title?: string; update_type: string; created_at: string }
  channelName: string
  onSubscribe: () => void
}) {
  const emoji = typeEmojis[update.update_type] || typeEmojis.announcement

  return (
    <div className="relative overflow-hidden bg-brand-card border border-brand-divider rounded-2xl">
      {/* Visible header */}
      <div className="p-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-brand-text/5 text-brand-text/40">
            {emoji} {update.update_type.charAt(0).toUpperCase() + update.update_type.slice(1)}
          </span>
          <span className="text-[11px] text-brand-text/40 font-medium">
            {timeAgo(update.created_at)}
          </span>
        </div>

        {update.title && (
          <h3 className="text-[15px] font-bold text-brand-text leading-snug truncate">
            {update.title}
          </h3>
        )}
      </div>

      {/* Blurred body placeholder */}
      <div className="relative px-4 pb-4">
        <div className="select-none pointer-events-none" aria-hidden="true">
          <div className="space-y-2 blur-md opacity-60">
            <div className="h-3 w-full rounded bg-brand-text/10" />
            <div className="h-3 w-5/6 rounded bg-brand-text/10" />
            <div className="h-3 w-4/6 rounded bg-brand-text/10" />
            <div className="h-20 w-full rounded-lg bg-brand-text/5 mt-2" />
          </div>
        </div>

        {/* Gradient overlay + lock CTA */}
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/90 to-transparent flex flex-col items-center justify-center px-6">
          <div className="w-10 h-10 rounded-full bg-brand-text/5 flex items-center justify-center mb-3">
            <Lock className="w-5 h-5 text-brand-text/50" />
          </div>
          <p className="text-sm text-brand-text/70 text-center font-medium leading-snug">
            Subscribe to {channelName} to see this update
          </p>
          <button
            onClick={onSubscribe}
            className="mt-3 px-5 py-2 rounded-xl bg-brand-text text-white text-sm font-semibold hover:bg-brand-text/90 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-text/50 focus:ring-offset-2"
          >
            Subscribe
          </button>
        </div>
      </div>
    </div>
  )
}

/* ===================================================================
   2. BlockedChannelView
   =================================================================== */

export function BlockedChannelView({ channelName }: { channelName: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-sm w-full">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-secondary mb-6">
          <ShieldAlert className="w-8 h-8 text-brand-text/50" />
        </div>

        <h2 className="text-xl font-semibold text-brand-text">
          You cannot view this channel
        </h2>

        <p className="mt-3 text-sm text-brand-text/60 leading-relaxed">
          You have been blocked from accessing {channelName}.
        </p>

        <div className="mt-8">
          <Link
            href="/channels"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-text text-white text-sm font-medium hover:bg-brand-text/90 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-text/50 focus:ring-offset-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Channels
          </Link>
        </div>
      </div>
    </div>
  )
}

/* ===================================================================
   3. DeletedChannelView
   =================================================================== */

export function DeletedChannelView({ channelName, isOwner, recoveryDaysLeft, onRestore }: {
  channelName: string
  isOwner: boolean
  recoveryDaysLeft: number
  onRestore?: () => void
}) {
  const TOTAL_RECOVERY_DAYS = 30
  const progressPct = Math.max(0, Math.min(100, (recoveryDaysLeft / TOTAL_RECOVERY_DAYS) * 100))

  if (!isOwner) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-sm w-full">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-secondary mb-6">
            <AlertTriangle className="w-8 h-8 text-brand-text/50" />
          </div>

          <h2 className="text-xl font-semibold text-brand-text">
            This channel is no longer available
          </h2>

          <p className="mt-3 text-sm text-brand-text/60 leading-relaxed">
            {channelName} has been removed.
          </p>

          <div className="mt-8">
            <Link
              href="/channels"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-text text-white text-sm font-medium hover:bg-brand-text/90 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-text/50 focus:ring-offset-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Channels
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Owner view
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md w-full">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-6">
          <Trash2 className="w-8 h-8 text-red-400" />
        </div>

        <h2 className="text-xl font-semibold text-brand-text">
          This channel has been deleted
        </h2>

        <p className="mt-3 text-sm text-brand-text/60 leading-relaxed">
          You have {recoveryDaysLeft} {recoveryDaysLeft === 1 ? 'day' : 'days'} to restore it before permanent deletion.
        </p>

        {/* Recovery progress bar */}
        <div className="mt-6 mx-auto max-w-xs">
          <div className="flex items-center justify-between text-[11px] text-brand-text/40 mb-1.5">
            <span>Time remaining</span>
            <span>{recoveryDaysLeft} / {TOTAL_RECOVERY_DAYS} days</span>
          </div>
          <div className="h-2 w-full rounded-full bg-brand-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-text/70 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          {onRestore && (
            <button
              onClick={onRestore}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-text text-white text-sm font-semibold hover:bg-brand-text/90 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-text/50 focus:ring-offset-2"
            >
              Restore Channel
            </button>
          )}

          <Link
            href="/channels"
            className="inline-flex items-center gap-2 text-sm text-brand-text/60 hover:text-brand-text transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Channels
          </Link>
        </div>
      </div>
    </div>
  )
}

/* ===================================================================
   4. SubscriberOnlyBanner
   =================================================================== */

export function SubscriberOnlyBanner({ channelName, onSubscribe, isSubscribing }: {
  channelName: string
  onSubscribe: () => void
  isSubscribing?: boolean
}) {
  return (
    <div className="bg-brand-text/5 border border-brand-divider rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-2.5 min-w-0">
        <Lock className="w-4 h-4 text-brand-text/50 shrink-0" />
        <p className="text-sm text-brand-text/70 font-medium leading-snug">
          Some updates on {channelName} are for subscribers only
        </p>
      </div>

      <button
        onClick={onSubscribe}
        disabled={isSubscribing}
        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-brand-divider text-xs font-semibold text-brand-text hover:bg-brand-secondary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
      >
        {isSubscribing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        Subscribe to see all updates
      </button>
    </div>
  )
}
