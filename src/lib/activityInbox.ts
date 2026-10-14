import { decodeNotificationPage, type InboxNotification } from '@/lib/notificationInbox'

/*
  The Activity page's tabs and paging (parity item T-11, web).

  Each notification tab is one server category of GET /v1/notifications
  (notification-service inbox_tabs.go). The server derives the category
  from the notification type, so the client keeps no type lists of its own.

  Requests is not a notification category: it is the pending connection
  requests list (GET /v1/graph/connection-requests), shown in place, with a
  way into message requests.

  Paging contract: a filtered page can come back short or EMPTY and still
  carry next_cursor, because the server filters a window of the whole inbox.
  Only a missing next_cursor means the end. So one load follows the cursor
  through empty windows until it has rows, reaches the end, or has spent
  INBOX_MAX_WINDOWS_PER_LOAD requests. When the cap is spent with nothing
  found, the page asks the viewer before looking further — it never spins.
*/

export type InboxTab = 'all' | 'likes' | 'comments' | 'mentions' | 'followers' | 'requests'

export const INBOX_TABS: readonly { key: InboxTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'mentions', label: 'Mentions' },
  { key: 'followers', label: 'Followers' },
  { key: 'requests', label: 'Requests' },
]

/**
 * The server category a tab lists. '' is the whole inbox (no ?category=);
 * null means the tab is not a notification list at all.
 */
export const INBOX_TAB_CATEGORY: Record<InboxTab, string | null> = {
  all: '',
  likes: 'likes',
  comments: 'comments',
  mentions: 'mentions',
  followers: 'followers',
  requests: null,
}

export const INBOX_PAGE_SIZE = 30
/** Requests one load may spend walking past empty filtered windows. */
export const INBOX_MAX_WINDOWS_PER_LOAD = 5

export function isInboxTab(value: unknown): value is InboxTab {
  return typeof value === 'string' && INBOX_TABS.some((t) => t.key === value)
}

/** The GET path for one window of a category ('' = everything). */
export function inboxListPath(category: string, cursor: string | null, limit = INBOX_PAGE_SIZE): string {
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  params.set('limit', String(limit))
  if (cursor) params.set('cursor', cursor)
  return `/v1/notifications?${params}`
}

export interface InboxLoad {
  notifications: InboxNotification[]
  /** null = the end of this category. */
  next_cursor: string | null
  /** Requests this load spent. */
  windows: number
  /** The cap ran out before any row turned up; more may exist past next_cursor. */
  capped: boolean
}

/**
 * One user-visible load: follows next_cursor through empty windows until a
 * window has rows, the cursor runs out, or the cap is spent.
 */
export async function loadInboxWindows(
  getJson: (path: string) => Promise<unknown>,
  category: string,
  cursor: string | null,
  maxWindows = INBOX_MAX_WINDOWS_PER_LOAD,
): Promise<InboxLoad> {
  let next = cursor
  let windows = 0
  const seen = new Set<string>()
  if (cursor) seen.add(cursor)
  while (windows < Math.max(1, maxWindows)) {
    const page = decodeNotificationPage(await getJson(inboxListPath(category, next)))
    windows += 1
    // A cursor that repeats would page forever; treat it as the end.
    const advanced = page.next_cursor && !seen.has(page.next_cursor) ? page.next_cursor : null
    if (advanced) seen.add(advanced)
    next = advanced
    if (page.notifications.length > 0 || !next) {
      return { notifications: page.notifications, next_cursor: next, windows, capped: false }
    }
  }
  return { notifications: [], next_cursor: next, windows, capped: next !== null }
}

/**
 * Whether the list may fetch the next load by itself (scrolled to the end).
 * Not after a load that came back empty at the cap: that one waits for the
 * viewer to ask, so an inbox with nothing in a tab cannot loop.
 */
export function shouldAutoLoadMore(pages: readonly InboxLoad[], hasNextPage: boolean, isFetching: boolean): boolean {
  if (!hasNextPage || isFetching) return false
  const last = pages[pages.length - 1]
  return !!last && !last.capped
}

/** Every row of every load, without the same notification twice. */
export function flattenInboxLoads(pages: readonly InboxLoad[]): InboxNotification[] {
  const seen = new Set<string>()
  const out: InboxNotification[] = []
  for (const page of pages) {
    for (const n of page.notifications) {
      if (seen.has(n.id)) continue
      seen.add(n.id)
      out.push(n)
    }
  }
  return out
}

/** Marks every cached row read: the infinite-list shape and the single-page shape. */
export function markInboxDataRead<T>(data: T): T {
  if (!data || typeof data !== 'object') return data
  const d = data as unknown as { pages?: unknown[]; notifications?: InboxNotification[] }
  const markPage = (page: unknown) => {
    const p = page as { notifications?: InboxNotification[] } | null
    return p && Array.isArray(p.notifications) ? { ...p, notifications: p.notifications.map((n) => ({ ...n, is_read: true })) } : page
  }
  if (Array.isArray(d.pages)) return { ...d, pages: d.pages.map(markPage) } as unknown as T
  if (Array.isArray(d.notifications)) return markPage(d) as T
  return data
}

/** PATCH /v1/notifications/read-all — the one mark-all-read route. */
export async function markAllNotificationsRead(http: { patch: (path: string) => Promise<unknown> }): Promise<void> {
  await http.patch('/v1/notifications/read-all')
}

/** Arrow keys, Home and End across a tab list (WAI-ARIA tabs pattern). */
export function nextTabIndex(current: number, key: string, count: number): number | null {
  if (count <= 0) return null
  switch (key) {
    case 'ArrowRight': return (current + 1) % count
    case 'ArrowLeft': return (current - 1 + count) % count
    case 'Home': return 0
    case 'End': return count - 1
    default: return null
  }
}

export type InboxTimeGroupKey = 'today' | 'yesterday' | 'week' | 'month' | 'earlier'

const TIME_GROUP_LABEL: Record<InboxTimeGroupKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This week',
  month: 'This month',
  earlier: 'Earlier',
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function inboxTimeGroup(createdAt: string, now: Date): InboxTimeGroupKey {
  const t = new Date(createdAt).getTime()
  if (Number.isNaN(t)) return 'earlier'
  const today = startOfDay(now)
  const day = 24 * 60 * 60 * 1000
  if (t >= today) return 'today'
  if (t >= today - day) return 'yesterday'
  if (t >= today - 6 * day) return 'week'
  if (t >= today - 29 * day) return 'month'
  return 'earlier'
}

/** Consecutive rows in time bands, keeping the server's newest-first order. */
export function groupInboxByTime(rows: readonly InboxNotification[], now = new Date()): { key: InboxTimeGroupKey; label: string; items: InboxNotification[] }[] {
  const groups: { key: InboxTimeGroupKey; label: string; items: InboxNotification[] }[] = []
  for (const n of rows) {
    const key = inboxTimeGroup(n.created_at, now)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(n)
    else groups.push({ key, label: TIME_GROUP_LABEL[key], items: [n] })
  }
  return groups
}

/** The Activity nav badge text: null for none, "99+" past 99. */
export function unreadBadgeText(count: unknown): string | null {
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 1) return null
  return count > 99 ? '99+' : String(Math.floor(count))
}
