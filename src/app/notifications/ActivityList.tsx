'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { AtSign, CheckCircle2, HelpCircle, MessageCircle, Pin, ThumbsUp } from 'lucide-react'
import type { InboxNotification } from '@/lib/notificationInbox'
import { groupInboxByTime, type InboxTab } from '@/lib/activityInbox'
import { notificationHasActor } from '@/lib/notificationPresentation'
import { NotificationGlyph } from '@/components/notifications/NotificationGlyph'

const ICON = 'h-4 w-4 text-primary'

/**
 * Q&A rows still show under All; the ones the web knows keep their own
 * wording and icon. Any other qa.* row takes the server's sentence, if sent.
 */
function describeQA(type: string, serverTitle?: string): { icon: ReactNode; message: string } | null {
  switch (type) {
    case 'qa.answer.created': return { icon: <MessageCircle className={ICON} aria-hidden />, message: 'New answer to your question' }
    case 'qa.answer.best_selected': return { icon: <CheckCircle2 className={ICON} aria-hidden />, message: 'Your answer was marked as best' }
    case 'qa.answer.comment.created': return { icon: <MessageCircle className={ICON} aria-hidden />, message: 'New comment on your answer' }
    case 'qa.answer.requested': return { icon: <AtSign className={ICON} aria-hidden />, message: 'Someone requested your answer' }
    case 'qa.question.voted': return { icon: <ThumbsUp className={ICON} aria-hidden />, message: 'Your question received a vote' }
    case 'qa.answer.voted': return { icon: <ThumbsUp className={ICON} aria-hidden />, message: 'Your answer received a vote' }
    case 'qa.question.pinned': return { icon: <Pin className={ICON} aria-hidden />, message: 'Your question was pinned' }
    default: return type.startsWith('qa.') ? { icon: <HelpCircle className={ICON} aria-hidden />, message: serverTitle ?? 'Q&A update' } : null
  }
}

export const EMPTY_COPY: Record<Exclude<InboxTab, 'requests'>, string> = {
  all: 'No activity yet. Likes, comments, mentions and new followers will show up here.',
  likes: 'When someone likes your posts or comments, you will see it here.',
  comments: 'Comments and replies on your posts will show up here.',
  mentions: 'When someone mentions you, you will see it here.',
  followers: 'New followers and friend requests will show up here.',
}

function Row({ n, onOpen }: { n: InboxNotification; onOpen: (n: InboxNotification) => void }) {
  const qa = describeQA(n.type, n.server_title)
  // No one to show (no actor, or no name for it): the row's category glyph.
  const glyph = !qa && n.icon && !notificationHasActor(n.actor_id, n.actor_name) ? n.icon : undefined
  const body = (
    <div
      className={`flex items-start gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-muted ${n.is_read ? 'bg-brand-card' : 'bg-primary-tint'}`}
      data-unread={n.is_read ? undefined : 'true'}
    >
      {n.is_read ? (
        <span className="mt-2 h-2 w-2 shrink-0" aria-hidden />
      ) : (
        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" data-unread-dot>
          <span className="sr-only">Unread</span>
        </span>
      )}
      {qa ? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">{qa.icon}</span>
      ) : glyph ? (
        <NotificationGlyph icon={glyph} className="h-8 w-8" surface="bg-muted" />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className={`block text-sm text-foreground ${n.is_read ? '' : 'font-semibold'}`}>{qa ? qa.message : n.title}</span>
        {n.body ? <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{n.body}</span> : null}
        <time dateTime={n.created_at} className="mt-1 block text-xs text-muted-foreground">
          {new Date(n.created_at).toLocaleString()}
        </time>
      </span>
    </div>
  )
  return n.deep_link ? (
    <Link href={n.deep_link} onClick={() => onOpen(n)} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    body
  )
}

/** The rows of a notification tab in time bands (Today, Yesterday, ...). */
export function ActivityList({ notifications, onOpen, now }: { notifications: readonly InboxNotification[]; onOpen: (n: InboxNotification) => void; now?: Date }) {
  const groups = groupInboxByTime(notifications, now)
  return (
    <div className="space-y-6">
      {groups.map((g, gi) => (
        <section key={`${g.key}-${gi}`} aria-labelledby={`activity-group-${gi}`}>
          <h2 id={`activity-group-${gi}`} className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {g.label}
          </h2>
          <ul className="space-y-2">
            {g.items.map((n) => (
              <li key={n.id}>
                <Row n={n} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
