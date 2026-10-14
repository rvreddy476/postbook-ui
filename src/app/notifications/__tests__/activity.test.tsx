import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  INBOX_MAX_WINDOWS_PER_LOAD,
  INBOX_TABS,
  INBOX_TAB_CATEGORY,
  flattenInboxLoads,
  groupInboxByTime,
  inboxListPath,
  isInboxTab,
  loadInboxWindows,
  markAllNotificationsRead,
  markInboxDataRead,
  nextTabIndex,
  shouldAutoLoadMore,
  unreadBadgeText,
  type InboxLoad,
} from '@/lib/activityInbox'
import { decodeNotificationPage, type InboxNotification } from '@/lib/notificationInbox'
import { ActivityTabs } from '../ActivityTabs'
import { ActivityList, EMPTY_COPY } from '../ActivityList'
import { RequestsList } from '../RequestsPanel'

const row = (id: string, extra: Record<string, unknown> = {}) => ({
  notification_id: id, type: 'post.liked', bucket: 202610, ts: `ts-${id}`, created_at: '2026-10-14T09:00:00Z', is_read: false, deep_link: '/post/p1', ...extra,
})
const envelope = (ids: string[], next?: string) => ({ data: ids.map((id) => row(id)), meta: next ? { next_cursor: next } : {} })

/** A fake GET that serves scripted envelopes by cursor and records every path. */
function server(script: Record<string, unknown>) {
  const calls: string[] = []
  const getJson = async (path: string) => {
    calls.push(path)
    const cursor = new URL(path, 'http://x').searchParams.get('cursor') ?? ''
    if (!(cursor in script)) throw new Error(`unexpected cursor ${cursor}`)
    return script[cursor]
  }
  return { calls, getJson }
}

describe('tab → request mapping', () => {
  test('the six tabs, in order', () => {
    expect(INBOX_TABS.map((t) => t.label)).toEqual(['All', 'Likes', 'Comments', 'Mentions', 'Followers', 'Requests'])
  })

  test('each notification tab asks for its server category; All sends none; Requests is not a notification list', () => {
    expect(inboxListPath(INBOX_TAB_CATEGORY.all as string, null)).toBe('/v1/notifications?limit=30')
    for (const tab of ['likes', 'comments', 'mentions', 'followers'] as const) {
      expect(inboxListPath(INBOX_TAB_CATEGORY[tab] as string, null)).toBe(`/v1/notifications?category=${tab}&limit=30`)
    }
    expect(INBOX_TAB_CATEGORY.requests).toBeNull()
    expect(inboxListPath('likes', 'c/2+')).toBe('/v1/notifications?category=likes&limit=30&cursor=c%2F2%2B')
  })

  test('only known tabs are read from the address', () => {
    expect(isInboxTab('mentions')).toBe(true)
    for (const v of ['qa', 'activity', 'groups', '', null, 3]) expect(isInboxTab(v)).toBe(false)
  })
})

describe('paging through filtered windows', () => {
  test('an empty page with a cursor keeps paging until rows turn up', async () => {
    const { calls, getJson } = server({ '': envelope([], 'c1'), c1: envelope([], 'c2'), c2: envelope(['a', 'b'], 'c3') })
    const load = await loadInboxWindows(getJson, 'likes', null)
    expect(load.notifications.map((n) => n.id)).toEqual(['a', 'b'])
    expect(load.next_cursor).toBe('c3')
    expect(load.windows).toBe(3)
    expect(load.capped).toBe(false)
    expect(calls).toEqual([
      '/v1/notifications?category=likes&limit=30',
      '/v1/notifications?category=likes&limit=30&cursor=c1',
      '/v1/notifications?category=likes&limit=30&cursor=c2',
    ])
  })

  test('a missing cursor is the end, even straight after empty pages', async () => {
    const { calls, getJson } = server({ '': envelope([], 'c1'), c1: envelope([]) })
    const load = await loadInboxWindows(getJson, 'mentions', null)
    expect(load).toEqual({ notifications: [], next_cursor: null, windows: 2, capped: false })
    expect(calls).toHaveLength(2)
    expect(shouldAutoLoadMore([load], false, false)).toBe(false)
  })

  test('a short non-empty page stops the load and keeps the cursor', async () => {
    const { getJson } = server({ '': envelope(['a'], 'c1') })
    const load = await loadInboxWindows(getJson, 'comments', null)
    expect(load.notifications).toHaveLength(1)
    expect(load.next_cursor).toBe('c1')
    expect(shouldAutoLoadMore([load], true, false)).toBe(true)
  })

  test('one load spends at most the cap, then waits for the viewer', async () => {
    const script: Record<string, unknown> = { '': envelope([], 'c1') }
    for (let i = 1; i < 50; i++) script[`c${i}`] = envelope([], `c${i + 1}`)
    const { calls, getJson } = server(script)
    const first = await loadInboxWindows(getJson, 'followers', null)
    expect(calls).toHaveLength(INBOX_MAX_WINDOWS_PER_LOAD)
    expect(first.capped).toBe(true)
    expect(first.next_cursor).toBe(`c${INBOX_MAX_WINDOWS_PER_LOAD}`)
    // No automatic fetch after a capped empty load: the viewer has to ask.
    expect(shouldAutoLoadMore([first], true, false)).toBe(false)
    // Asking resumes from the cursor, and spends another capped batch.
    const second = await loadInboxWindows(getJson, 'followers', first.next_cursor)
    expect(calls).toHaveLength(INBOX_MAX_WINDOWS_PER_LOAD * 2)
    expect(calls[INBOX_MAX_WINDOWS_PER_LOAD]).toContain(`cursor=c${INBOX_MAX_WINDOWS_PER_LOAD}`)
    expect(second.capped).toBe(true)
  })

  test('a cursor that repeats is treated as the end instead of looping', async () => {
    const { calls, getJson } = server({ '': envelope([], 'loop'), loop: envelope([], 'loop') })
    const load = await loadInboxWindows(getJson, 'likes', null)
    expect(load.next_cursor).toBeNull()
    expect(load.capped).toBe(false)
    expect(calls).toHaveLength(2)
  })

  test('no auto-fetch while a fetch is running or with no next page', () => {
    const page: InboxLoad = { notifications: [], next_cursor: 'c', windows: 1, capped: false }
    expect(shouldAutoLoadMore([page], true, true)).toBe(false)
    expect(shouldAutoLoadMore([], true, false)).toBe(false)
  })

  test('pages flatten without duplicate rows', () => {
    const a = decodeNotificationPage(envelope(['a', 'b'])).notifications
    const b = decodeNotificationPage(envelope(['b', 'c'])).notifications
    const pages: InboxLoad[] = [
      { notifications: a, next_cursor: 'x', windows: 1, capped: false },
      { notifications: b, next_cursor: null, windows: 1, capped: false },
    ]
    expect(flattenInboxLoads(pages).map((n) => n.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('mark all read', () => {
  test('uses the read-all route', async () => {
    const calls: string[] = []
    await markAllNotificationsRead({ patch: async (path: string) => { calls.push(path) } })
    expect(calls).toEqual(['/v1/notifications/read-all'])
  })

  test('marks every cached row read in both cache shapes', () => {
    const notes = decodeNotificationPage(envelope(['a', 'b'])).notifications
    const infinite = { pages: [{ notifications: notes, next_cursor: null, windows: 1, capped: false }], pageParams: [null] }
    const marked = markInboxDataRead(infinite)
    expect(marked.pages[0].notifications.every((n) => n.is_read)).toBe(true)
    expect(notes.every((n) => !n.is_read)).toBe(true) // not mutated
    const single = markInboxDataRead({ notifications: notes, next_cursor: null })
    expect(single.notifications.every((n) => n.is_read)).toBe(true)
    expect(markInboxDataRead(undefined)).toBeUndefined()
  })
})

describe('rendering', () => {
  test('tabs render as an ARIA tablist with one tab stop', () => {
    const html = renderToStaticMarkup(<ActivityTabs active="likes" onSelect={() => undefined} />)
    expect(html).toContain('role="tablist"')
    expect((html.match(/role="tab"/g) ?? []).length).toBe(6)
    expect((html.match(/tabindex="0"/g) ?? []).length).toBe(1)
    expect(html).toMatch(/id="activity-tab-likes"[^>]*aria-selected="true"[^>]*tabindex="0"|aria-selected="true"[^>]*id="activity-tab-likes"/)
    for (const label of ['All', 'Likes', 'Comments', 'Mentions', 'Followers', 'Requests']) expect(html).toContain(`>${label}</button>`)
    for (const gone of ['Q&amp;A', 'Groups', 'Channels', 'System']) expect(html).not.toContain(gone)
  })

  test('arrow keys, Home and End move between tabs and wrap', () => {
    expect(nextTabIndex(0, 'ArrowRight', 6)).toBe(1)
    expect(nextTabIndex(5, 'ArrowRight', 6)).toBe(0)
    expect(nextTabIndex(0, 'ArrowLeft', 6)).toBe(5)
    expect(nextTabIndex(3, 'Home', 6)).toBe(0)
    expect(nextTabIndex(1, 'End', 6)).toBe(5)
    expect(nextTabIndex(1, 'Enter', 6)).toBeNull()
  })

  test('rows show an unread dot only when unread, grouped by time', () => {
    const now = new Date('2026-10-14T12:00:00')
    const local = (d: Date) => d.toISOString()
    const rows: InboxNotification[] = decodeNotificationPage({
      data: [
        row('n1', { created_at: local(new Date('2026-10-14T10:00:00')) }),
        row('n2', { created_at: local(new Date('2026-10-13T10:00:00')), is_read: true }),
        row('n3', { created_at: local(new Date('2026-09-01T10:00:00')), type: 'user.followed' }),
      ],
    }).notifications
    expect(groupInboxByTime(rows, now).map((g) => [g.label, g.items.map((n) => n.id)])).toEqual([
      ['Today', ['n1']], ['Yesterday', ['n2']], ['Earlier', ['n3']],
    ])
    const html = renderToStaticMarkup(<ActivityList notifications={rows} onOpen={() => undefined} now={now} />)
    expect((html.match(/data-unread-dot/g) ?? []).length).toBe(2)
    expect(html).toContain('New like')
    expect(html).toContain('New follower')
    expect(html).toContain('>Today</h2>')
    expect(html).toContain('href="/post/p1"')
  })

  test('every notification tab has its own empty copy', () => {
    for (const t of INBOX_TABS) if (t.key !== 'requests') expect(EMPTY_COPY[t.key].length).toBeGreaterThan(10)
  })

  test('requests list shows confirm/delete per request and the message-requests way in', () => {
    const html = renderToStaticMarkup(
      <RequestsList items={[{ user_id: 'u1', display_name: 'Ada', username: 'ada', created_at: '2026-10-14T09:00:00Z' }]} busy={false} onAccept={() => undefined} onDecline={() => undefined} />,
    )
    expect(html).toContain('href="/messenger?lane=requests"')
    expect(html).toContain('href="/u/ada"')
    expect(html).toContain('>Confirm</button>')
    expect(html).toContain('>Delete</button>')
    expect(renderToStaticMarkup(<RequestsList items={[]} busy={false} onAccept={() => undefined} onDecline={() => undefined} />)).toContain('No pending friend requests.')
  })

  test('activity badge text', () => {
    expect(unreadBadgeText(0)).toBeNull()
    expect(unreadBadgeText(undefined)).toBeNull()
    expect(unreadBadgeText(7)).toBe('7')
    expect(unreadBadgeText(120)).toBe('99+')
  })
})
