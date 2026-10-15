'use client'

import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import { useAcceptFriendRequest, usePendingFriendRequests, useRejectFriendRequest, type FriendRequestEntry } from '@/hooks/useConnections'

function avatarSrc(mediaId?: string): string | null {
  return mediaId ? `${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/v1/media/${mediaId}/serve` : null
}

export interface RequestsListProps {
  items: readonly FriendRequestEntry[]
  busy: boolean
  onAccept: (userId: string) => void
  onDecline: (userId: string) => void
}

/** Pending connection requests, with Confirm / Delete, plus the way into message requests. */
export function RequestsList({ items, busy, onAccept, onDecline }: RequestsListProps) {
  return (
    <div className="space-y-4">
      <Link
        href="/messenger?lane=requests"
        className="flex items-center gap-3 rounded-xl border border-border bg-brand-card p-4 text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MessageSquare className="h-5 w-5 text-primary" aria-hidden />
        <span className="flex-1">Message requests</span>
      </Link>
      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No pending friend requests.</p>
      ) : (
        <ul className="space-y-2" aria-label="Friend requests">
          {items.map((r) => (
            <li key={r.user_id} className="flex items-center gap-3 rounded-xl border border-border bg-brand-card p-3">
              <Avatar src={avatarSrc(r.avatar_media_id)} name={r.display_name} className="h-10 w-10" />
              <span className="min-w-0 flex-1">
                {r.username ? (
                  <Link href={`/u/${encodeURIComponent(r.username)}`} className="block truncate text-sm font-semibold text-foreground hover:underline">
                    {r.display_name}
                  </Link>
                ) : (
                  <span className="block truncate text-sm font-semibold text-foreground">{r.display_name}</span>
                )}
                <span className="block text-xs text-muted-foreground">Wants to be friends</span>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => onAccept(r.user_id)}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Confirm
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDecline(r.user_id)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function RequestsPanel() {
  const { data, isLoading, isError, refetch } = usePendingFriendRequests()
  const accept = useAcceptFriendRequest()
  const reject = useRejectFriendRequest()

  if (isLoading) return <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
  if (isError) {
    return (
      <div role="alert" className="py-12 text-center text-sm text-foreground">
        Requests couldn’t be loaded.{' '}
        <button type="button" onClick={() => void refetch()} className="font-semibold text-primary-ink underline">Try again</button>
      </div>
    )
  }
  return (
    <>
      {accept.isError || reject.isError ? <p role="alert" className="mb-3 text-sm text-danger">That request couldn’t be updated. Please try again.</p> : null}
      <RequestsList
        items={data?.items ?? []}
        busy={accept.isPending || reject.isPending}
        onAccept={(id) => accept.mutate(id)}
        onDecline={(id) => reject.mutate(id)}
      />
    </>
  )
}
