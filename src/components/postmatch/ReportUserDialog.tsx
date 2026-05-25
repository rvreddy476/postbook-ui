'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSubmitPostMatchReport } from '@/hooks/usePostmatch'

const CATEGORIES = [
  { value: 'underage', label: 'Under 18' },
  { value: 'fake_profile', label: 'Fake profile' },
  { value: 'scam', label: 'Scam or spam' },
  { value: 'inappropriate_photos', label: 'Inappropriate photos' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'violence', label: 'Threats of violence' },
  { value: 'other', label: 'Other' },
]

type Props = {
  userId: string
  userName?: string
  onClose: () => void
  onReported?: () => void
}

export function ReportUserDialog({ userId, userName, onClose, onReported }: Props) {
  const submit = useSubmitPostMatchReport()
  const [category, setCategory] = useState(CATEGORIES[0].value)
  const [details, setDetails] = useState('')
  // P0-8 confirmation states — keep the dialog open after submit so the
  // user sees success/failure feedback. Auto-close on success after the
  // viewer dismisses the confirmation.
  const [phase, setPhase] = useState<'form' | 'success' | 'error'>('form')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await submit.mutateAsync({
        reported_user_id: userId,
        category,
        details: details || undefined,
      })
      onReported?.()
      setPhase('success')
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        (err as Error)?.message ??
        'Something went wrong submitting your report.'
      setErrorMsg(msg)
      setPhase('error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {phase === 'success' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl">✓</div>
              <h2 className="text-lg font-semibold">Report submitted</h2>
            </div>
            <p className="text-sm text-gray-600">
              Our safety team will review your report. {userName ?? 'They'} won&apos;t be told you reported.
              You can track the status in your Safety Center.
            </p>
            <div className="flex gap-2 justify-end">
              <Link
                href="/postmatch/safety"
                className="px-4 py-2 rounded border text-sm"
                onClick={onClose}
              >
                View in Safety Center
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="bg-red-600 text-white px-4 py-2 rounded text-sm"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xl">!</div>
              <h2 className="text-lg font-semibold">Couldn&apos;t submit</h2>
            </div>
            <p className="text-sm text-gray-600">{errorMsg}</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded border text-sm">
                Close
              </button>
              <button
                type="button"
                onClick={() => { setErrorMsg(null); setPhase('form') }}
                className="bg-red-600 text-white px-4 py-2 rounded text-sm"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {phase === 'form' && (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Report {userName ?? 'user'}</h2>
              <p className="text-sm text-gray-500 mt-1">
                Reports are reviewed by our safety team. We won&apos;t tell them you reported.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Reason</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Additional details (optional)</label>
              <textarea
                rows={4}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="What happened?"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded border text-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={submit.isPending}
                className="bg-red-600 text-white px-4 py-2 rounded text-sm disabled:bg-gray-300"
              >
                {submit.isPending ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
