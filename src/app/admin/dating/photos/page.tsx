'use client'

// /admin/dating/photos — P0-8 photo moderation queue.
//
// Lists photos with moderation_status='pending', oldest-first. Each
// row exposes an approve / reject action that calls the existing
// POST /v1/dating/photos/:id/moderation endpoint, which fires deck
// invalidation + profile-state transition (pending_photo →
// pending_selfie) on approval, and a moderation_rejected push on
// rejection.

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

const ADMIN_HEADERS = { 'X-Scopes': 'admin superadmin moderator' } as const

interface PhotoRow {
  id: string
  user_id: string
  media_id: string
  sort_order: number
  is_primary: boolean
  visibility: string
  moderation_status: string
  created_at: string
}

export default function DatingPhotosQueue() {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-dating-photos-pending'],
    queryFn: async () => {
      const res = await api.get('/v1/dating/admin/photos/pending?limit=100', {
        headers: ADMIN_HEADERS,
      })
      const items = (res.data?.data?.items ?? res.data?.items ?? []) as PhotoRow[]
      return items
    },
    refetchInterval: 30_000,
  })

  const moderate = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: 'approved' | 'rejected'; reason?: string }) => {
      await api.post(
        `/v1/dating/photos/${id}/moderation`,
        { status, reason: reason ?? '' },
        { headers: ADMIN_HEADERS },
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-dating-photos-pending'] }),
  })

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Photo moderation</h1>
        <p className="text-sm text-gray-500">
          Oldest first. Approving graduates pending profiles to{' '}
          <code>pending_selfie</code>; rejecting pushes a
          <code>photo.moderation_rejected</code> notification to the owner.
        </p>
      </header>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && (
        <p className="text-sm text-rose-700">Failed to load: {(error as Error).message}</p>
      )}

      {data && data.length === 0 && !isLoading && (
        <div className="rounded-lg border bg-emerald-50 border-emerald-200 p-6 text-sm text-emerald-700">
          ✓ No photos awaiting moderation.
        </div>
      )}

      {data && data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((p) => (
            <PhotoCard
              key={p.id}
              photo={p}
              onApprove={() => moderate.mutate({ id: p.id, status: 'approved' })}
              onReject={(reason) => moderate.mutate({ id: p.id, status: 'rejected', reason })}
              busy={moderate.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PhotoCard({
  photo,
  onApprove,
  onReject,
  busy,
}: {
  photo: PhotoRow
  onApprove: () => void
  onReject: (reason: string) => void
  busy: boolean
}) {
  const [reason, setReason] = useState('')
  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* The media URL is rendered server-side by media-service; for
         the scaffold we link to its lookup endpoint. Replace with a
         signed-URL preview once that's exposed in Phase 2. */}
      <div className="aspect-square bg-gray-100 flex items-center justify-center text-xs text-gray-400">
        Media {photo.media_id.slice(0, 8)}…
        {photo.is_primary && <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">PRIMARY</span>}
      </div>
      <div className="p-3 space-y-2 text-sm">
        <div className="font-mono text-xs text-gray-600">
          user {photo.user_id.slice(0, 8)}… · sort {photo.sort_order} · {photo.visibility}
        </div>
        <div className="text-xs text-gray-400">
          Submitted {new Date(photo.created_at).toLocaleString()}
        </div>
        <textarea
          rows={2}
          placeholder="Reason (required for reject)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full border rounded px-2 py-1 text-xs"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onApprove}
            disabled={busy}
            className="flex-1 bg-emerald-600 text-white text-sm py-1.5 rounded disabled:bg-gray-300"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => reason && onReject(reason)}
            disabled={busy || !reason}
            className="flex-1 bg-rose-600 text-white text-sm py-1.5 rounded disabled:bg-gray-300"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}
