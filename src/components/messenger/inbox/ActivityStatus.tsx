'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown, Loader2, X } from 'lucide-react'

import { useMessagingSettings, useUpdateMessagingSettings } from '@/hooks/useMessagingSettings'

/*
  The activity-status control beside "Messages": a dot that says whether
  people can see when you're active, and a sheet that changes it. It writes
  the existing who_can_see_online_status setting (CONTRACT §4, §7).
*/

export const ACTIVITY_STATUS_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: 'everyone', label: 'Everyone', hint: 'Anyone you chat with can see when you are active.' },
  { value: 'connections_only', label: 'Connections only', hint: 'Only your connections see when you are active.' },
  { value: 'no_one', label: 'No one', hint: 'Nobody sees when you are active or were last active.' },
]

/** The dot is "on" for any audience but no_one (an unknown value counts as on). */
export function activityStatusVisible(value: string | undefined | null): boolean {
  return value !== 'no_one'
}

export function ActivityStatusButton() {
  const { data } = useMessagingSettings()
  const [open, setOpen] = useState(false)
  const value = data?.who_can_see_online_status
  const visible = activityStatusVisible(value)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Activity status"
        title={visible ? 'Your activity status is on' : 'Your activity status is off'}
        className="flex items-center gap-0.5 rounded-full px-1.5 py-1 text-brand-text/60 transition-colors hover:bg-brand-secondary hover:text-brand-text"
      >
        <span className={`h-2.5 w-2.5 rounded-full ${visible ? 'bg-success' : 'border border-brand-text/40'}`} aria-hidden />
        <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>
      {open && <ActivityStatusSheet current={value ?? null} onClose={() => setOpen(false)} />}
    </>
  )
}

function ActivityStatusSheet({ current, onClose }: { current: string | null; onClose: () => void }) {
  const update = useUpdateMessagingSettings()
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const choose = async (value: string) => {
    if (value === current) return onClose()
    setError(null)
    try {
      await update.mutateAsync({ who_can_see_online_status: value })
      onClose()
    } catch {
      setError("Couldn't change your activity status. Try again.")
    }
  }

  return (
    <div className="fixed inset-0 z-1100 flex items-end justify-center bg-brand-text/30 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-label="Activity status" onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-t-2xl border border-brand-divider bg-brand-card p-4 shadow-2xl sm:rounded-2xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-brand-text">Activity status</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full text-brand-text/50 hover:bg-brand-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-[12px] text-brand-text/60">Choose who can see when you&apos;re active. When it&apos;s off, you won&apos;t appear as active to anyone.</p>
        <div role="radiogroup" className="overflow-hidden rounded-xl border border-brand-divider">
          {ACTIVITY_STATUS_OPTIONS.map((o) => {
            const selected = o.value === current
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={update.isPending}
                onClick={() => void choose(o.value)}
                className="flex w-full items-start gap-3 border-b border-brand-divider px-3.5 py-3 text-left last:border-b-0 hover:bg-brand-secondary disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-brand-text">{o.label}</span>
                  <span className="block text-[12px] text-brand-text/60">{o.hint}</span>
                </span>
                {selected ? <Check className="mt-0.5 h-4 w-4 text-primary-ink" /> : update.isPending && update.variables?.who_can_see_online_status === o.value ? <Loader2 className="mt-0.5 h-4 w-4 animate-spin" /> : null}
              </button>
            )
          })}
        </div>
        {error && <p role="alert" className="mt-2 text-[12px] text-danger">{error}</p>}
      </div>
    </div>
  )
}
