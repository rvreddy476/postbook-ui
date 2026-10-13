'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import {
  useNotificationInbox,
  useMarkNotificationRead,
  type NotificationCategory,
} from '@/hooks/useNotificationInbox'
import {
  HelpCircle,
  MessageCircle,
  CheckCircle2,
  Pin,
  ThumbsUp,
  AtSign,
} from 'lucide-react'

type FilterKey = NotificationCategory

const TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'activity', label: 'Activity' },
  { key: 'mentions', label: 'Mentions' },
  { key: 'groups', label: 'Groups' },
  { key: 'channels', label: 'Channels' },
  // Communities feature disabled — tab hidden, category handling kept.
  // { key: 'communities', label: 'Communities' },
  { key: 'qa', label: 'Q&A' },
  { key: 'system', label: 'System' },
]

const QA_TYPES = new Set([
  'qa.answer.created',
  'qa.answer.best_selected',
  'qa.answer.comment.created',
  'qa.answer.requested',
  'qa.question.voted',
  'qa.answer.voted',
  'qa.question.pinned',
])

interface QARenderInfo {
  icon: React.ReactNode
  message: string
}

function describeQA(type: string, fallbackTitle: string): QARenderInfo {
  switch (type) {
    case 'qa.answer.created':
      return {
        icon: <MessageCircle className="w-4 h-4 text-violet-600" />,
        message: 'New answer to your question',
      }
    case 'qa.answer.best_selected':
      return {
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
        message: 'Your answer was marked as best',
      }
    case 'qa.answer.comment.created':
      return {
        icon: <MessageCircle className="w-4 h-4 text-blue-600" />,
        message: 'New comment on your answer',
      }
    case 'qa.answer.requested':
      return {
        icon: <AtSign className="w-4 h-4 text-fuchsia-600" />,
        message: 'Someone requested your answer',
      }
    case 'qa.question.voted':
      return {
        icon: <ThumbsUp className="w-4 h-4 text-violet-600" />,
        message: 'Your question received a vote',
      }
    case 'qa.answer.voted':
      return {
        icon: <ThumbsUp className="w-4 h-4 text-violet-600" />,
        message: 'Your answer received a vote',
      }
    case 'qa.question.pinned':
      return {
        icon: <Pin className="w-4 h-4 text-amber-600" />,
        message: 'Your question was pinned',
      }
    default:
      return {
        icon: <HelpCircle className="w-4 h-4 text-violet-600" />,
        message: fallbackTitle || 'Q&A update',
      }
  }
}

export default function NotificationsInboxPage() {
  const [tab, setTab] = useState<FilterKey>('all')

  // Backend now filters by category server-side, including 'qa'.
  const [cursors, setCursors] = useState<(string | null)[]>([null])
  const { data, isLoading, isError, refetch } = useNotificationInbox(tab, cursors[cursors.length - 1])
  const markRead = useMarkNotificationRead()

  const notifs = data?.notifications ?? []

  const unreadIds = useMemo(
    () => notifs.filter((n) => !n.is_read),
    [notifs]
  )

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Notifications</h1>
          {unreadIds.length > 0 ? (
            <button
              onClick={() => markRead.mutate(unreadIds)}
              disabled={markRead.isPending}
              className="text-sm text-violet-600 hover:underline disabled:opacity-50"
            >
              Mark this page as read
            </button>
          ) : null}
        </div>

        <div className="flex gap-1 mb-5 border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setCursors([null]) }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.key
                  ? 'border-violet-600 text-violet-600'
                  : 'border-transparent text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {markRead.isError && <p role="alert">Could not update read status. Please try again.</p>}
        {isError ? <div role="alert">Notifications couldn’t be loaded. <button onClick={() => void refetch()}>Try again</button></div> : isLoading ? (
          <div className="py-12 text-center text-neutral-500">Loading…</div>
        ) : notifs.length === 0 ? (
          <div className="py-16 text-center text-neutral-500">Nothing here.</div>
        ) : (
          <div className="space-y-2">
            {notifs.map((n) => {
              const isQA = QA_TYPES.has(n.type)
              const qaInfo = isQA ? describeQA(n.type, n.title) : null

              const body = (
                <div className="flex items-start gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 hover:border-violet-300 transition-colors">
                  {!n.is_read ? (
                    <div className="w-2 h-2 mt-2 rounded-full bg-violet-500 shrink-0" />
                  ) : (
                    <div className="w-2 h-2 mt-2 shrink-0" />
                  )}
                  {qaInfo && (
                    <div className="w-8 h-8 rounded-full bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                      {qaInfo.icon}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${n.is_read ? 'text-neutral-700' : 'font-medium text-neutral-900 dark:text-neutral-100'}`}>
                      {qaInfo ? qaInfo.message : n.title}
                    </div>
                    {n.body ? (
                      <div className="text-sm text-neutral-500 mt-0.5 line-clamp-2">{n.body}</div>
                    ) : null}
                    <div className="text-xs text-neutral-400 mt-1">
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              )
              return n.deep_link ? (
                <Link
                  key={n.id}
                  href={n.deep_link}
                  onClick={() => !n.is_read && markRead.mutate([n])}
                >
                  {body}
                </Link>
              ) : (
                <div key={n.id}>{body}</div>
              )
            })}
          </div>
        )}
        <div className="flex gap-4 mt-5">{cursors.length > 1 && <button onClick={() => setCursors(v => v.slice(0, -1))}>Newer updates</button>}{data?.next_cursor && <button onClick={() => setCursors(v => [...v, data.next_cursor])}>Older updates</button>}</div>
      </div>
    </AppShell>
  )
}
