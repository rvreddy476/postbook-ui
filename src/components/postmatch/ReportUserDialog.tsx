'use client'

import { useState } from 'react'
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await submit.mutateAsync({
      reported_user_id: userId,
      category,
      details: details || undefined,
    })
    onReported?.()
    onClose()
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
      </div>
    </div>
  )
}
