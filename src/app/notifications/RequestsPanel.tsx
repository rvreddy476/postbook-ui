'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Clapperboard, MessageSquare } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import { flattenFollowRequestPages, followRequestErrorCopy, requestsBadgeText, type FollowRequestEntry } from '@/lib/followRequests'
import { useIncomingFollowRequests, useRespondToFollowRequest } from './useFollowRequests'

function avatarSrc(mediaId?: string): string | null {
  return mediaId ? `${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/v1/media/${mediaId}/serve` : null
}

const PRIMARY_BUTTON = 'rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const SECONDARY_BUTTON = 'rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

interface PersonRowProps {
  name: string
  username?: string
  avatarMediaId?: string
  subtitle: string
  busy: boolean
  acceptLabel: string
  declineLabel: string
  kind: string
  onAccept: () => void
  onDecline: () => void
}

function PersonRow({ name, username, avatarMediaId, subtitle, busy, acceptLabel, declineLabel, kind, onAccept, onDecline }: PersonRowProps) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-brand-card p-3">
      <Avatar src={avatarSrc(avatarMediaId)} name={name} className="h-10 w-10" />
      <span className="min-w-0 flex-1">
        {username ? (
          <Link href={`/u/${encodeURIComponent(username)}`} className="block truncate text-sm font-semibold text-foreground hover:underline">
            {name}
          </Link>
        ) : (
          <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
        )}
        <span className="block text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <button type="button" disabled={busy} onClick={onAccept} aria-label={`${acceptLabel} ${kind} from ${name}`} className={PRIMARY_BUTTON}>
        {acceptLabel}
      </button>
      <button type="button" disabled={busy} onClick={onDecline} aria-label={`${declineLabel} ${kind} from ${name}`} className={SECONDARY_BUTTON}>
        {declineLabel}
      </button>
    </li>
  )
}

function SectionHeading({ id, title, count }: { id: string; title: string; count: string | null }) {
  return (
    <h2 id={id} className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {title}
      {count ? (
        <span data-request-count className="rounded-full bg-primary px-1.5 text-xs font-semibold normal-case tracking-normal tabular-nums text-primary-foreground">
          {count}<span className="sr-only"> pending</span>
        </span>
      ) : null}
    </h2>
  )
}

export interface FollowRequestsListProps {
  items: readonly FollowRequestEntry[]
  /** The requester whose answer is on its way; their row's buttons wait. */
  pendingId: string | null
  hasMore: boolean
  loadingMore: boolean
  error: string | null
  onAccept: (userId: string) => void
  onDecline: (userId: string) => void
  onLoadMore: () => void
}

/** People asking to follow a private account, with Accept / Decline. */
export function FollowRequestsList({ items, pendingId, hasMore, loadingMore, error, onAccept, onDecline, onLoadMore }: FollowRequestsListProps) {
  return (
    <section aria-labelledby="follow-requests-heading">
      <SectionHeading id="follow-requests-heading" title="Follow requests" count={requestsBadgeText(items.length, hasMore)} />
      {error ? <p role="alert" className="mb-3 text-sm text-danger">{error}</p> : null}
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
          No follow requests. When your account is private, people who ask to follow you show up here.
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Follow requests">
          {items.map((r) => (
            <PersonRow
              key={r.user_id}
              name={r.display_name}
              username={r.username}
              avatarMediaId={r.avatar_media_id}
              subtitle="Wants to follow you"
              busy={pendingId === r.user_id}
              acceptLabel="Accept"
              declineLabel="Decline"
              kind="follow request"
              onAccept={() => onAccept(r.user_id)}
              onDecline={() => onDecline(r.user_id)}
            />
          ))}
        </ul>
      )}
      {hasMore ? (
        <div className="mt-3 flex justify-center">
          <button type="button" onClick={onLoadMore} disabled={loadingMore} className={SECONDARY_BUTTON}>
            {loadingMore ? 'Loading…' : 'Show more follow requests'}
          </button>
        </div>
      ) : null}
    </section>
  )
}

/** The other request inboxes, which live on their own pages. */
export function RequestLinks() {
  const link = 'flex items-center gap-3 rounded-xl border border-border bg-brand-card p-4 text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  return (
    <div className="space-y-2">
      <Link href="/messenger?lane=requests" className={link}>
        <MessageSquare className="h-5 w-5 text-primary" aria-hidden />
        <span className="flex-1">Message requests</span>
      </Link>
      <Link href="/credits/requests" className={link}>
        <Clapperboard className="h-5 w-5 text-primary" aria-hidden />
        <span className="flex-1">Credit requests</span>
      </Link>
    </div>
  )
}

/** The Requests tab's badge: follow requests (connection requests are gone, founder 24 Oct 2026). */
export function useRequestsBadge(): string | null {
  const follow = useIncomingFollowRequests()
  const followItems = flattenFollowRequestPages(follow.data?.pages ?? [])
  return requestsBadgeText(followItems.length, !!follow.hasNextPage)
}

function FollowRequestsSection() {
  const follow = useIncomingFollowRequests()
  const respond = useRespondToFollowRequest()
  const [error, setError] = useState<string | null>(null)
  const items = flattenFollowRequestPages(follow.data?.pages ?? [])

  if (follow.isLoading) return <p className="py-6 text-center text-sm text-muted-foreground">Loading follow requests…</p>
  if (follow.isError && items.length === 0) {
    return (
      <div role="alert" className="py-6 text-center text-sm text-foreground">
        Follow requests couldn’t be loaded.{' '}
        <button type="button" onClick={() => void follow.refetch()} className="font-semibold text-primary-ink underline">Try again</button>
      </div>
    )
  }
  const answer = (requesterId: string, decision: 'accept' | 'decline') => {
    setError(null)
    respond.mutate({ requesterId, decision }, { onError: (err) => setError(followRequestErrorCopy(err)) })
  }
  return (
    <FollowRequestsList
      items={items}
      pendingId={respond.isPending ? respond.variables?.requesterId ?? null : null}
      hasMore={!!follow.hasNextPage}
      loadingMore={follow.isFetchingNextPage}
      error={error}
      onAccept={(id) => answer(id, 'accept')}
      onDecline={(id) => answer(id, 'decline')}
      onLoadMore={() => void follow.fetchNextPage()}
    />
  )
}

export function RequestsPanel() {
  return (
    <div className="space-y-6">
      <FollowRequestsSection />
      <RequestLinks />
    </div>
  )
}
