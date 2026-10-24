import { describe, expect, test } from 'bun:test'
import {
  FOLLOW_REQUEST_NOTIFICATION_TYPES,
  decodeFollowRequestPage,
  decodeProfileBatch,
  flattenFollowRequestPages,
  followRequestActionPath,
  followRequestErrorCopy,
  followRequestsListPath,
  isFollowRequestNotification,
  loadFollowRequests,
  removeFollowRequest,
  requestsBadgeText,
  respondToFollowRequest,
  type FollowRequestHttp,
} from '@/lib/followRequests'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

function fakeHttp(answers: { get?: unknown; post?: unknown; postThrows?: boolean }) {
  const calls: { method: string; path: string; body?: unknown }[] = []
  const http: FollowRequestHttp = {
    get: async (path) => { calls.push({ method: 'GET', path }); return answers.get },
    post: async (path, body) => {
      calls.push({ method: 'POST', path, body })
      if (answers.postThrows) throw new Error('down')
      return answers.post
    },
  }
  return { http, calls }
}

describe('follow request routes', () => {
  test('the incoming list path carries limit and, when paging, the cursor', () => {
    expect(followRequestsListPath(null)).toBe('/v1/graph/follow-requests/incoming?limit=20')
    expect(followRequestsListPath('1700:abc', 5)).toBe('/v1/graph/follow-requests/incoming?limit=5&cursor=1700%3Aabc')
  })

  test('accept and decline name the requester in the path', () => {
    expect(followRequestActionPath(A, 'accept')).toBe(`/v1/graph/follow-requests/${A}/accept`)
    expect(followRequestActionPath(A, 'decline')).toBe(`/v1/graph/follow-requests/${A}/decline`)
  })

  test('a requester that is not a UUID never reaches the server', () => {
    expect(() => followRequestActionPath('../connection-request', 'accept')).toThrow()
    expect(() => followRequestActionPath('ada', 'decline')).toThrow()
  })
})

describe('decodeFollowRequestPage', () => {
  test('reads rows and the cursor', () => {
    const page = decodeFollowRequestPage({ data: [{ requester_id: A, created_at: '2026-10-24T09:00:00Z' }], meta: { next_cursor: 'c2' } })
    expect(page).toEqual({ items: [{ requester_id: A, created_at: '2026-10-24T09:00:00Z' }], next_cursor: 'c2' })
  })

  test('a missing or empty cursor is the last page', () => {
    expect(decodeFollowRequestPage({ data: [] }).next_cursor).toBeNull()
    expect(decodeFollowRequestPage({ data: [], meta: { next_cursor: '' } }).next_cursor).toBeNull()
    expect(decodeFollowRequestPage({ data: [], meta: null }).next_cursor).toBeNull()
  })

  test('skips rows without a UUID requester and repeats, keeps the rest', () => {
    const page = decodeFollowRequestPage({ data: [null, { requester_id: 'x' }, { requester_id: A }, { requester_id: A }, { requester_id: B, created_at: 7 }] })
    expect(page.items).toEqual([{ requester_id: A, created_at: '' }, { requester_id: B, created_at: '' }])
  })

  test('a body that is not the envelope is an error, not an empty inbox', () => {
    expect(() => decodeFollowRequestPage(null)).toThrow('Follow requests could not be loaded')
    expect(() => decodeFollowRequestPage({ data: {} })).toThrow()
    expect(() => decodeFollowRequestPage([])).toThrow()
  })
})

describe('decodeProfileBatch', () => {
  test('reads {profiles:[…]}, {data:{profiles}} and id-keyed maps', () => {
    expect(decodeProfileBatch({ profiles: [{ user_id: A, display_name: 'Ada', username: 'ada' }] }).get(A)?.username).toBe('ada')
    expect(decodeProfileBatch({ data: { profiles: [{ id: B, display_name: 'Bo' }] } }).get(B)?.display_name).toBe('Bo')
    expect(decodeProfileBatch({ [A]: { display_name: 'Ada', avatar_media_id: 'm1' } }).get(A)?.avatar_media_id).toBe('m1')
    expect(decodeProfileBatch(null).size).toBe(0)
  })
})

describe('loadFollowRequests', () => {
  test('lists, then names the requesters in one batch call', async () => {
    const { http, calls } = fakeHttp({
      get: { data: [{ requester_id: A, created_at: 't1' }, { requester_id: B, created_at: 't2' }], meta: { next_cursor: 'n' } },
      post: { profiles: [{ user_id: A, display_name: 'Ada', username: 'ada' }] },
    })
    const load = await loadFollowRequests(http, null)
    expect(calls).toEqual([
      { method: 'GET', path: '/v1/graph/follow-requests/incoming?limit=20' },
      { method: 'POST', path: '/v1/profiles/batch', body: { user_ids: [A, B] } },
    ])
    expect(load.next_cursor).toBe('n')
    expect(load.items[0]).toEqual({ user_id: A, display_name: 'Ada', username: 'ada', avatar_media_id: undefined, created_at: 't1' })
    // No profile: still answerable, never a blank name.
    expect(load.items[1].display_name).toBe('Someone')
    expect(load.items[1].username).toBeUndefined()
  })

  test('a failed name lookup still returns the requests', async () => {
    const { http } = fakeHttp({ get: { data: [{ requester_id: A, created_at: 't' }] }, postThrows: true })
    const load = await loadFollowRequests(http, 'c1')
    expect(load.items.map((i) => i.user_id)).toEqual([A])
  })

  test('an empty page makes no profile call', async () => {
    const { http, calls } = fakeHttp({ get: { data: [] } })
    await loadFollowRequests(http, null)
    expect(calls.length).toBe(1)
  })

  test('respond posts to the accept or decline route with no body', async () => {
    const { http, calls } = fakeHttp({ post: { data: { status: 'accepted' } } })
    await respondToFollowRequest(http, A, 'accept')
    await respondToFollowRequest(http, B, 'decline')
    expect(calls).toEqual([
      { method: 'POST', path: `/v1/graph/follow-requests/${A}/accept`, body: undefined },
      { method: 'POST', path: `/v1/graph/follow-requests/${B}/decline`, body: undefined },
    ])
  })
})

describe('paging helpers', () => {
  const e = (id: string) => ({ user_id: id, display_name: id, created_at: '' })
  test('flatten keeps order and drops repeats across pages', () => {
    expect(flattenFollowRequestPages([{ items: [e(A)], next_cursor: 'x' }, { items: [e(A), e(B)], next_cursor: null }]).map((i) => i.user_id)).toEqual([A, B])
  })
  test('remove drops the answered requester from every page', () => {
    const pages = removeFollowRequest([{ items: [e(A), e(B)], next_cursor: 'x' }, { items: [e(A)], next_cursor: null }], A)
    expect(pages.map((p) => p.items.map((i) => i.user_id))).toEqual([[B], []])
  })
})

describe('notifications and badge', () => {
  test('only follow-request types with a real actor get inline answers', () => {
    for (const t of FOLLOW_REQUEST_NOTIFICATION_TYPES) expect(isFollowRequestNotification(t, A)).toBe(true)
    expect(isFollowRequestNotification('follow_request', undefined)).toBe(false)
    expect(isFollowRequestNotification('follow_request', 'ada')).toBe(false)
    expect(isFollowRequestNotification('user.followed', A)).toBe(false)
    expect(isFollowRequestNotification('friend_request', A)).toBe(false)
  })

  test('badge text counts both kinds, says + when more pages wait, caps at 99+', () => {
    expect(requestsBadgeText(0, false, 0)).toBeNull()
    expect(requestsBadgeText(2, false, 1)).toBe('3')
    expect(requestsBadgeText(20, true, 0)).toBe('20+')
    expect(requestsBadgeText(0, false, 4)).toBe('4')
    expect(requestsBadgeText(90, false, 10)).toBe('99+')
  })

  test('refusals read as sentences', () => {
    expect(followRequestErrorCopy({ response: { status: 404, data: { error: { code: 'NOT_FOUND' } } } })).toBe('This request is no longer pending.')
    expect(followRequestErrorCopy({ response: { status: 429 } })).toContain('Too many')
    expect(followRequestErrorCopy({ isAxiosError: true })).toContain('offline')
    expect(followRequestErrorCopy(new Error('boom'))).toBe('That request couldn’t be updated. Please try again.')
  })
})
