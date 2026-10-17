'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import AppShell from '@/components/AppShell'
import { useActivityInbox, useMarkAllRead, useMarkNotificationRead } from '@/hooks/useNotificationInbox'
import { flattenInboxLoads, isInboxTab, shouldAutoLoadMore, type InboxTab } from '@/lib/activityInbox'
import { ActivityTabs, ACTIVITY_PANEL_ID, activityTabId } from './ActivityTabs'
import { ActivityList, EMPTY_COPY } from './ActivityList'
import { RequestsPanel } from './RequestsPanel'

/*
  Activity: All · Likes · Comments · Mentions · Followers · Requests.

  The notification tabs are server categories (lib/activityInbox.ts). A
  filtered page can be empty and still have more behind it, so each load
  walks past empty windows up to a cap; scrolling to the end loads the next
  one, except after a load that found nothing at the cap — then the viewer
  is asked, so a quiet tab never loops.
*/

function readTabFromAddress(): InboxTab {
  if (typeof window === 'undefined') return 'all'
  const tab = new URLSearchParams(window.location.search).get('tab')
  return isInboxTab(tab) ? tab : 'all'
}

export default function NotificationsInboxPage() {
  const [tab, setTab] = useState<InboxTab>('all')
  useEffect(() => setTab(readTabFromAddress()), [])

  const selectTab = (next: InboxTab) => {
    setTab(next)
    try {
      const url = new URL(window.location.href)
      if (next === 'all') url.searchParams.delete('tab')
      else url.searchParams.set('tab', next)
      window.history.replaceState(window.history.state, '', url)
    } catch {
      // The address is a convenience; the tab still changes.
    }
  }

  const inbox = useActivityInbox(tab)
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllRead()

  const pages = inbox.data?.pages
  const notifs = useMemo(() => flattenInboxLoads(pages ?? []), [pages])
  const hasUnread = notifs.some((n) => !n.is_read)
  const lastCapped = !!pages && pages.length > 0 && pages[pages.length - 1].capped
  const autoLoad = shouldAutoLoadMore(pages ?? [], !!inbox.hasNextPage, inbox.isFetchingNextPage)

  // Scrolled to the end: fetch the next load whenever the end comes into view.
  const sentinel = useRef<HTMLDivElement | null>(null)
  const fetchNext = inbox.fetchNextPage
  useEffect(() => {
    const el = sentinel.current
    if (!el || !autoLoad || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void fetchNext()
    }, { rootMargin: '400px 0px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [autoLoad, fetchNext, pages?.length])

  const isRequests = tab === 'requests'

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Activity</h1>
          {!isRequests ? (
            <button
              type="button"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending || !hasUnread}
              className="rounded-md text-sm font-medium text-primary-ink hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Mark all as read
            </button>
          ) : null}
        </div>

        <ActivityTabs active={tab} onSelect={selectTab} />

        <div role="tabpanel" id={ACTIVITY_PANEL_ID} aria-labelledby={activityTabId(tab)} tabIndex={0} className="focus-visible:outline-none">
          {markRead.isError || markAll.isError ? (
            <p role="alert" className="mb-3 text-sm text-danger">Could not update read status. Please try again.</p>
          ) : null}

          {isRequests ? (
            <RequestsPanel />
          ) : inbox.isError && notifs.length === 0 && !inbox.isFetchNextPageError ? (
            <div role="alert" className="py-12 text-center text-sm text-foreground">
              Activity couldn’t be loaded.{' '}
              <button type="button" onClick={() => void inbox.refetch()} className="font-semibold text-primary-ink underline">Try again</button>
            </div>
          ) : inbox.isLoading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              {notifs.length > 0 ? (
                <ActivityList notifications={notifs} onOpen={(n) => { if (!n.is_read) markRead.mutate([n]) }} />
              ) : lastCapped && inbox.hasNextPage ? (
                <p className="py-16 text-center text-sm text-muted-foreground">Nothing here in your recent activity.</p>
              ) : !inbox.hasNextPage ? (
                <p className="py-16 text-center text-sm text-muted-foreground">{EMPTY_COPY[tab]}</p>
              ) : null}

              <div ref={sentinel} aria-hidden className="h-px" />
              <div className="mt-5 flex justify-center" aria-live="polite">
                {inbox.isFetchingNextPage ? (
                  <p className="text-sm text-muted-foreground">Loading more…</p>
                ) : inbox.isFetchNextPageError ? (
                  <button type="button" onClick={() => void inbox.fetchNextPage()} className="text-sm font-semibold text-primary-ink underline">
                    Couldn’t load more. Try again
                  </button>
                ) : inbox.hasNextPage ? (
                  <button
                    type="button"
                    onClick={() => void inbox.fetchNextPage()}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {lastCapped ? 'Look further back' : 'Load more'}
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
