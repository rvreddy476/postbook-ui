'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import {
  useNotificationInbox,
  useMarkNotificationRead,
  type NotificationCategory,
} from '@/hooks/useNotificationInbox'

const TABS: { key: NotificationCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'activity', label: 'Activity' },
  { key: 'mentions', label: 'Mentions' },
  { key: 'groups', label: 'Groups' },
  { key: 'channels', label: 'Channels' },
  { key: 'communities', label: 'Communities' },
  { key: 'system', label: 'System' },
]

export default function NotificationsInboxPage() {
  const [tab, setTab] = useState<NotificationCategory>('all')
  const { data, isLoading } = useNotificationInbox(tab)
  const markRead = useMarkNotificationRead()

  const notifs = data?.notifications ?? []
  const unreadIds = useMemo(
    () => notifs.filter((n) => !n.is_read).map((n) => n.id),
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
              Mark all read
            </button>
          ) : null}
        </div>

        <div className="flex gap-1 mb-5 border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
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

        {isLoading ? (
          <div className="py-12 text-center text-neutral-500">Loading…</div>
        ) : notifs.length === 0 ? (
          <div className="py-16 text-center text-neutral-500">Nothing here.</div>
        ) : (
          <div className="space-y-2">
            {notifs.map((n) => {
              const body = (
                <div className="flex items-start gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 hover:border-violet-300 transition-colors">
                  {!n.is_read ? (
                    <div className="w-2 h-2 mt-2 rounded-full bg-violet-500 shrink-0" />
                  ) : (
                    <div className="w-2 h-2 mt-2 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${n.is_read ? 'text-neutral-700' : 'font-medium text-neutral-900 dark:text-neutral-100'}`}>
                      {n.title}
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
                  onClick={() => !n.is_read && markRead.mutate([n.id])}
                >
                  {body}
                </Link>
              ) : (
                <div key={n.id}>{body}</div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
