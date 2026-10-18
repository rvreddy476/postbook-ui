import { describe, expect, test } from 'bun:test'

import { decodeInboxRow, type InboxRow } from '../contract'
import {
  applyLiveMessage,
  filterRows,
  inboxUnreadTotal,
  mergeInboxPages,
  orderInbox,
  presenceLabel,
  primaryRows,
  rowName,
  rowPreview,
  shortAgo,
  streakBadge,
  unreadPillText,
  withoutDating,
  filteredLaneOrNull,
  archivedLane,
} from '../inbox'

const ME = 'me'
const row = (raw: Record<string, unknown>): InboxRow => decodeInboxRow({ type: 'direct', ...raw }, ME)!
const at = (h: number) => new Date(Date.UTC(2026, 9, 18, h)).toISOString()

describe('ordering and merge', () => {
  test('pinned first (newest pin first), then newest activity', () => {
    const rows = [
      row({ id: 'old', last_message_at: at(1) }),
      row({ id: 'pinA', is_pinned: true, pinned_at: at(2), last_message_at: at(0) }),
      row({ id: 'new', last_message_at: at(9) }),
      row({ id: 'pinB', is_pinned: true, pinned_at: at(5), last_message_at: at(0) }),
    ]
    expect(orderInbox(rows).map((r) => r.id)).toEqual(['pinB', 'pinA', 'new', 'old'])
  })

  test('merging page 2 keeps page 1, the incoming copy wins, dating chats leave', () => {
    const page1 = [row({ id: 'a', last_message_at: at(5), unread_count: 1 }), row({ id: 'b', last_message_at: at(4) })]
    const page2 = [row({ id: 'b', last_message_at: at(6), unread_count: 3 }), row({ id: 'c', last_message_at: at(1) }), row({ id: 'd', source_app: 'dating', last_message_at: at(9) })]
    const merged = mergeInboxPages(page1, page2)
    expect(merged.map((r) => r.id)).toEqual(['b', 'a', 'c'])
    expect(merged[0].unreadCount).toBe(3)
  })

  test('withoutDating drops dating rows only', () => {
    expect(withoutDating([row({ id: 'x', source_app: 'Dating' }), row({ id: 'y' })]).map((r) => r.id)).toEqual(['y'])
  })

  test('a live message moves its row up and counts unread only when it is theirs and the thread is closed', () => {
    const rows = [row({ id: 'a', last_message_at: at(5) }), row({ id: 'b', last_message_at: at(4) })]
    const theirs = applyLiveMessage(rows, { conversationId: 'b', senderId: 'u2', type: 'text', text: 'yo', at: at(7) }, ME, null)!
    expect(theirs.map((r) => r.id)).toEqual(['b', 'a'])
    expect(theirs[0].unreadCount).toBe(1)
    expect(theirs[0].lastMessage?.preview).toBe('yo')
    const open = applyLiveMessage(rows, { conversationId: 'b', senderId: 'u2', type: 'text', at: at(7) }, ME, 'b')!
    expect(open[0].unreadCount).toBe(0)
    const mine = applyLiveMessage(rows, { conversationId: 'b', senderId: ME, type: 'text', at: at(7) }, ME, null)!
    expect(mine[0].unreadCount).toBe(0)
    expect(mine[0].lastMessage?.ownStatus).toBe('sent')
    expect(applyLiveMessage(rows, { conversationId: 'zz', senderId: 'u2', type: 'text', at: at(7) }, ME, null)).toBeNull()
  })

  test('primary lane: no incoming requests, no archived; my sent request stays', () => {
    const rows = [
      row({ id: 'in', is_request: true, created_by: 'u2' }),
      row({ id: 'out', is_request: true, created_by: ME }),
      row({ id: 'arch', label: 'archived' }),
      row({ id: 'ok' }),
    ]
    expect(primaryRows(rows, ME).map((r) => r.id)).toEqual(['out', 'ok'])
  })

  test('unread total skips muted rows and incoming requests', () => {
    const rows = [row({ id: 'a', unread_count: 2 }), row({ id: 'b', unread_count: 5, is_muted: true }), row({ id: 'c', unread_count: 4, is_request: true, created_by: 'x' })]
    expect(inboxUnreadTotal(rows, ME)).toBe(2)
  })
})

describe('labels', () => {
  test('unread pill', () => {
    expect([0, -1, 1, 99, 100, 1234].map(unreadPillText)).toEqual(['', '', '1', '99', '99+', '99+'])
  })

  test('presence: Active now, minutes, hours, yesterday, days, then nothing', () => {
    const now = Date.UTC(2026, 9, 18, 12)
    const ago = (ms: number) => ({ isOnline: false as const, lastActiveAt: new Date(now - ms).toISOString() })
    expect(presenceLabel({ isOnline: true, lastActiveAt: null }, now)).toBe('Active now')
    expect(presenceLabel(ago(20_000), now)).toBe('Active now')
    expect(presenceLabel(ago(5 * 60_000), now)).toBe('Active 5m ago')
    expect(presenceLabel(ago(3 * 3600_000), now)).toBe('Active 3h ago')
    expect(presenceLabel(ago(30 * 3600_000), now)).toBe('Active yesterday')
    expect(presenceLabel(ago(4 * 86400_000), now)).toBe('Active 4d ago')
    expect(presenceLabel(ago(9 * 86400_000), now)).toBeNull()
    expect(presenceLabel({ isOnline: null, lastActiveAt: null }, now)).toBeNull()
    expect(presenceLabel(null, now)).toBeNull()
  })

  test('streak badge: only from 3 days, at risk flagged', () => {
    expect(streakBadge(null)).toBeNull()
    expect(streakBadge({ days: 2, atRisk: false, expiresAt: null })).toBeNull()
    const b = streakBadge({ days: 12, atRisk: true, expiresAt: null })!
    expect(b.text).toBe('\u{1F525} 12')
    expect(b.atRisk).toBe(true)
    expect(b.title).toContain('Message today')
  })

  test('preview: mine says You and Seen; theirs plain; group prefixes the sender; type fallback', () => {
    const seen = row({ id: 'a', last_message: { type: 'text', preview: 'ok', sender_id: ME, own_status: 'read' } })
    expect(rowPreview(seen, ME)).toEqual({ text: 'You: ok', status: 'Seen' })
    const sent = row({ id: 'a', last_message: { type: 'voice', preview: '', sender_id: ME, own_status: 'sent' } })
    expect(rowPreview(sent, ME)).toEqual({ text: 'You: Voice message', status: 'Sent' })
    const theirs = row({ id: 'a', last_message: { type: 'sticker', sender_id: 'u2' } })
    expect(rowPreview(theirs, ME)).toEqual({ text: 'Sticker', status: null })
    const g = decodeInboxRow({ id: 'g', type: 'group', members: [{ user_id: 'u2', display_name: 'Asha Rao' }], last_message: { preview: 'hi', sender_id: 'u2' } }, ME)!
    expect(rowPreview(g, ME).text).toBe('Asha: hi')
    expect(rowPreview(row({ id: 'z' }), ME, { sentRequestWaiting: true }).text).toContain('waiting')
  })

  test('names: DM peer, titled group, untitled group from members', () => {
    expect(rowName(row({ id: 'a', peer: { user_id: 'u', display_name: 'Asha' } }), ME)).toBe('Asha')
    expect(rowName(decodeInboxRow({ id: 'g', type: 'group', title: 'Trip' }, ME)!, ME)).toBe('Trip')
    const g = decodeInboxRow({ id: 'g', type: 'group', members: [{ user_id: ME, display_name: 'Me' }, { user_id: 'a', display_name: 'A' }, { user_id: 'b', display_name: 'B' }] }, ME)!
    expect(rowName(g, ME)).toBe('A, B')
  })

  test('shortAgo', () => {
    const now = Date.UTC(2026, 9, 18, 12)
    expect(shortAgo(new Date(now - 10_000).toISOString(), now)).toBe('now')
    expect(shortAgo(new Date(now - 3 * 3600_000).toISOString(), now)).toBe('3h')
    expect(shortAgo(new Date(now - 15 * 86400_000).toISOString(), now)).toBe('2w')
    expect(shortAgo(null, now)).toBe('')
  })

  test('client filter matches name, handle and preview', () => {
    const rows = [row({ id: 'a', peer: { user_id: 'u', display_name: 'Asha', username: 'ashak' } }), row({ id: 'b', last_message_preview: 'cricket tonight' })]
    expect(filterRows(rows, 'ASHAK', ME).map((r) => r.id)).toEqual(['a'])
    expect(filterRows(rows, 'cricket', ME).map((r) => r.id)).toEqual(['b'])
    expect(filterRows(rows, '', ME)).toHaveLength(2)
  })
})

describe('lanes the server may not have yet', () => {
  test('filtered requests: disjoint lists are real, an overlap means the server ignored the filter', () => {
    const all = [row({ id: 'a' }), row({ id: 'b' })]
    expect(filteredLaneOrNull(all, [row({ id: 'c' })])!.map((r) => r.id)).toEqual(['c'])
    expect(filteredLaneOrNull(all, [row({ id: 'a' }), row({ id: 'b' })])).toBeNull()
    expect(filteredLaneOrNull(all, [])).toEqual([])
  })
  test('archived: rows also in the primary list are not archived (a lane-less server echoes primary)', () => {
    const primary = [row({ id: 'a' }), row({ id: 'b' })]
    expect(archivedLane(primary, primary)).toEqual([])
    expect(archivedLane([row({ id: 'a' }), row({ id: 'z', last_message_at: at(3) }), row({ id: 'd', source_app: 'dating' })], primary).map((r) => r.id)).toEqual(['z'])
  })
})
