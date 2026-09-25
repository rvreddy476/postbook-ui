import { describe, expect, test } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'
import {
  applyGroupFeedPatch,
  groupFeedKey,
  groupPostSearchKey,
  MIN_GROUP_SEARCH_LENGTH,
  type GroupFeedCache,
  type GroupFeedPage,
} from '../patchGroupFeed'
import type { GroupPostV2 } from '@/types/groups'

function post(over: Partial<GroupPostV2> = {}): GroupPostV2 {
  return {
    id: 'p1',
    group_id: 'g1',
    author_id: 'u1',
    content_type: 'post',
    needs_approval: false,
    is_pinned: false,
    is_announcement: false,
    status: 'published',
    spark_count: 0,
    comment_count: 0,
    echo_count: 0,
    view_count: 0,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...over,
  }
}

function cache(...posts: GroupPostV2[]): GroupFeedCache {
  const page: GroupFeedPage = { data: posts, offset: 0 }
  return { pages: [page], pageParams: [0] }
}

function sparkOf(qc: QueryClient, key: readonly unknown[]): GroupPostV2 | undefined {
  return qc
    .getQueryData<GroupFeedCache>(key)
    ?.pages.flatMap(p => p.data)
    .find(p => p.id === 'p1')
}

describe('groupPostSearchKey', () => {
  test('a search is cached per group AND per query', () => {
    // Sharing one key across queries would show the previous query's results
    // for a moment after each keystroke.
    expect(groupPostSearchKey('g1', 'bikes')).not.toEqual(groupPostSearchKey('g1', 'coffee'))
    expect(groupPostSearchKey('g1', 'bikes')).not.toEqual(groupPostSearchKey('g2', 'bikes'))
  })

  test('surrounding whitespace does not make a different cache entry', () => {
    expect(groupPostSearchKey('g1', '  bikes  ')).toEqual(groupPostSearchKey('g1', 'bikes'))
  })

  test('the search key is never the feed key', () => {
    // If these ever collided, search results would overwrite the feed cache
    // and the feed would show search results after the box was closed.
    expect(groupPostSearchKey('g1', 'bikes')).not.toEqual(groupFeedKey('g1'))
  })
})

describe('MIN_GROUP_SEARCH_LENGTH', () => {
  test('is at least 1, because the server answers a blank q with a 400', () => {
    expect(MIN_GROUP_SEARCH_LENGTH).toBeGreaterThanOrEqual(1)
  })
})

describe('applyGroupFeedPatch across caches', () => {
  test('a spark while searching moves the post in BOTH the feed and the results', () => {
    /*
      The same post is cached twice while a search is open. Patching only the
      feed leaves the result's heart empty until the request round-trips —
      the post disagreeing with itself on one screen.
    */
    const qc = new QueryClient()
    const searchKey = groupPostSearchKey('g1', 'bikes')
    qc.setQueryData(groupFeedKey('g1'), cache(post({ spark_count: 4 })))
    qc.setQueryData(searchKey, cache(post({ spark_count: 4 })))

    applyGroupFeedPatch(qc, 'g1', 'p1', 'spark', 1, true, [searchKey])

    expect(sparkOf(qc, groupFeedKey('g1'))?.spark_count).toBe(5)
    expect(sparkOf(qc, groupFeedKey('g1'))?.viewer_sparked).toBe(true)
    expect(sparkOf(qc, searchKey)?.spark_count).toBe(5)
    expect(sparkOf(qc, searchKey)?.viewer_sparked).toBe(true)
  })

  test('a rollback undoes both caches, not just the feed', () => {
    const qc = new QueryClient()
    const searchKey = groupPostSearchKey('g1', 'bikes')
    qc.setQueryData(groupFeedKey('g1'), cache(post({ spark_count: 4 })))
    qc.setQueryData(searchKey, cache(post({ spark_count: 4 })))

    applyGroupFeedPatch(qc, 'g1', 'p1', 'spark', 1, true, [searchKey])
    applyGroupFeedPatch(qc, 'g1', 'p1', 'spark', -1, false, [searchKey])

    expect(sparkOf(qc, groupFeedKey('g1'))?.spark_count).toBe(4)
    expect(sparkOf(qc, searchKey)?.spark_count).toBe(4)
    expect(sparkOf(qc, searchKey)?.viewer_sparked).toBe(false)
  })

  test('with no extra keys the feed is still patched, so the old callers are unchanged', () => {
    const qc = new QueryClient()
    qc.setQueryData(groupFeedKey('g1'), cache(post({ spark_count: 4 })))

    applyGroupFeedPatch(qc, 'g1', 'p1', 'spark', 1, true)

    expect(sparkOf(qc, groupFeedKey('g1'))?.spark_count).toBe(5)
  })
})
