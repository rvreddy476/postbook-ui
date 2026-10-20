import { describe, expect, test } from 'bun:test'

import {
  decodeRequestCount,
  decodeRequestRemovedFrame,
  decodeRequestsPage,
  decrementCount,
  FIRST_REQUESTS_PAGE,
  mergeRequestPages,
  nextRequestsCursor,
  requestBadgeCount,
  requestCountText,
  requestsQuery,
  withoutRequest,
  type RequestsPage,
} from '../requestsLane'

const ME = 'me'

/** A request row as message-service returns it. */
function raw(id: string, opts: { direction?: string; createdBy?: string; sender?: string; source?: string; preview?: string; requestedAt?: string } = {}) {
  return {
    id,
    type: 'direct',
    is_request: true,
    created_by: opts.createdBy ?? opts.sender ?? 'them',
    ...(opts.direction ? { direction: opts.direction } : {}),
    ...(opts.source ? { source_app: opts.source } : {}),
    ...(opts.preview ? { preview: opts.preview } : {}),
    ...(opts.requestedAt ? { requested_at: opts.requestedAt } : {}),
    filtered: false,
    sender: { user_id: opts.sender ?? 'them', display_name: 'Asha', username: 'asha', deleted: false },
  }
}

describe('requests query', () => {
  test('first page: no cursor, no offset; incoming; filtered=false', () => {
    expect(requestsQuery('all', FIRST_REQUESTS_PAGE)).toBe('limit=30&direction=incoming&filtered=false')
  })

  test("next pages use the server's cursor", () => {
    expect(requestsQuery('all', { cursor: 'abc' }, 10)).toBe('limit=10&direction=incoming&filtered=false&cursor=abc')
  })

  test('Hidden requests: filtered=true (plus the legacy filter=filtered)', () => {
    const q = new URLSearchParams(requestsQuery('filtered', FIRST_REQUESTS_PAGE))
    expect(q.get('filtered')).toBe('true')
    expect(q.get('filter')).toBe('filtered')
  })

  test('limit is kept in 1..100; offset only for the legacy fallback', () => {
    expect(new URLSearchParams(requestsQuery('all', FIRST_REQUESTS_PAGE, 500)).get('limit')).toBe('100')
    expect(new URLSearchParams(requestsQuery('all', FIRST_REQUESTS_PAGE, 0)).get('limit')).toBe('1')
    expect(new URLSearchParams(requestsQuery('all', { offset: 30 })).get('offset')).toBe('30')
  })
})

describe('decodeRequestsPage', () => {
  test('keeps incoming requests, drops outgoing and dating ones; reads next_cursor and has_more', () => {
    const page = decodeRequestsPage(
      {
        data: [
          raw('a', { direction: 'incoming' }),
          raw('b', { direction: 'outgoing', sender: ME }),
          raw('c'), // no direction: someone else created it → incoming
          raw('d', { createdBy: ME, sender: ME }), // no direction, mine → outgoing
          raw('e', { direction: 'incoming', source: 'dating' }),
        ],
        meta: { next_cursor: 'n1', has_more: true },
      },
      ME,
    )
    expect(page.rows.map((r) => r.id)).toEqual(['a', 'c'])
    expect(page.rows.every((r) => r.isRequest)).toBe(true)
    expect(page.rows[0].peer?.userId).toBe('them')
    expect(page).toMatchObject({ nextCursor: 'n1', hasMore: true, received: 5 })
  })

  test("the row shows the request's own message (preview) and when it was sent", () => {
    const [row] = decodeRequestsPage({ data: [raw('a', { direction: 'incoming', preview: 'Hi! Loved your reel', requestedAt: '2026-10-20T10:00:00Z' })] }, ME).rows
    expect(row.lastMessage).toEqual({ type: 'text', preview: 'Hi! Loved your reel', senderId: 'them', at: '2026-10-20T10:00:00Z', ownStatus: null })
    expect(row.lastMessageAt).toBe('2026-10-20T10:00:00Z')
  })

  test('an older server: a bare list, no cursor, no has_more', () => {
    expect(decodeRequestsPage({ data: [raw('a')] }, ME)).toMatchObject({ nextCursor: null, hasMore: null, received: 1 })
  })
})

describe('paging', () => {
  const page = (over: Partial<RequestsPage>): RequestsPage => ({ rows: [], nextCursor: null, hasMore: null, received: 0, ...over })

  test("the server's cursor; has_more false ends the list", () => {
    expect(nextRequestsCursor(page({ nextCursor: 'c2', hasMore: true, received: 30 }), FIRST_REQUESTS_PAGE, 30)).toEqual({ cursor: 'c2' })
    expect(nextRequestsCursor(page({ nextCursor: 'c2', hasMore: false, received: 30 }), FIRST_REQUESTS_PAGE, 30)).toBeNull()
    expect(nextRequestsCursor(page({ hasMore: false, received: 30 }), FIRST_REQUESTS_PAGE, 30)).toBeNull()
  })

  test('legacy offset fallback: a full page asks for the next offset; a short page is the end', () => {
    expect(nextRequestsCursor(page({ received: 30 }), { offset: 0 }, 30)).toEqual({ offset: 30 })
    expect(nextRequestsCursor(page({ received: 30 }), { offset: 30 }, 30)).toEqual({ offset: 60 })
    expect(nextRequestsCursor(page({ received: 12 }), { offset: 30 }, 12)).toBeNull()
  })

  test('a page that added nothing stops paging', () => {
    expect(nextRequestsCursor(page({ received: 30 }), { offset: 30 }, 0)).toBeNull()
  })

  test('merge keeps the server order (newest first) and each request once', () => {
    const a = decodeRequestsPage({ data: [raw('1'), raw('2')] }, ME).rows
    const b = decodeRequestsPage({ data: [raw('2'), raw('3')] }, ME).rows
    const merged = mergeRequestPages(a, b)
    expect(merged.rows.map((r) => r.id)).toEqual(['1', '2', '3'])
    expect(merged.added).toBe(1)
    expect(mergeRequestPages(merged.rows, a).added).toBe(0)
  })

  test('an answered or expired request leaves the list', () => {
    const rows = decodeRequestsPage({ data: [raw('1'), raw('2')] }, ME).rows
    expect(withoutRequest(rows, '1').map((r) => r.id)).toEqual(['2'])
  })
})

describe('count (GET /requests/count)', () => {
  test('decodes {data: {count, filtered_count, capped}}', () => {
    expect(decodeRequestCount({ data: { count: 4, filtered_count: 2, capped: false } })).toEqual({ count: 4, filteredCount: 2, capped: false })
    expect(decodeRequestCount({ data: { count: 999, filtered_count: 0, capped: true } })).toEqual({ count: 999, filteredCount: 0, capped: true })
    expect(decodeRequestCount({ data: {} })).toBeNull()
    expect(decodeRequestCount(null)).toBeNull()
  })

  test('badge words: the number, "999+" when capped, nothing for zero', () => {
    expect(requestCountText(4, false)).toBe('4')
    expect(requestCountText(999, true)).toBe('999+')
    // capped is one flag for the response: a small count stays a number
    expect(requestCountText(3, true)).toBe('3')
    expect(requestCountText(0, false)).toBe('')
  })

  test('without the count route the badge counts the rows loaded', () => {
    const rows = decodeRequestsPage({ data: [raw('1'), raw('2')] }, ME).rows
    expect(requestBadgeCount(9, rows)).toBe(9)
    expect(requestBadgeCount(null, rows)).toBe(2)
  })

  test('a request leaving its list lowers that count; a capped count is left alone', () => {
    const c = { count: 5, filteredCount: 2, capped: false }
    expect(decrementCount(c, false)).toEqual({ count: 4, filteredCount: 2, capped: false })
    expect(decrementCount(c, true)).toEqual({ count: 5, filteredCount: 1, capped: false })
    expect(decrementCount({ count: 0, filteredCount: 0, capped: false }, false)?.count).toBe(0)
    const capped = { count: 999, filteredCount: 0, capped: true }
    expect(decrementCount(capped, false)).toBe(capped)
    expect(decrementCount(null, false)).toBeNull()
  })
})

describe('message_request_removed frame', () => {
  test('the conversation id, top level or in the payload', () => {
    expect(decodeRequestRemovedFrame({ type: 'message_request_removed', conversation_id: 'c1', reason: 'expired' })).toEqual({ conversationId: 'c1', reason: 'expired' })
    expect(decodeRequestRemovedFrame({ type: 'message_request_removed', payload: { conversation_id: 'c2' } })).toEqual({ conversationId: 'c2', reason: null })
  })

  test('anything else is not one', () => {
    expect(decodeRequestRemovedFrame({ type: 'message_deleted', conversation_id: 'c1' })).toBeNull()
    expect(decodeRequestRemovedFrame({ type: 'message_request_removed' })).toBeNull()
    expect(decodeRequestRemovedFrame(null)).toBeNull()
  })
})
