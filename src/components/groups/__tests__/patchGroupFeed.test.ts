import { describe, expect, test } from 'bun:test'
import {
  patchGroupFeed,
  viewerEngaged,
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

function cache(...pages: GroupPostV2[][]): GroupFeedCache {
  return {
    pages: pages.map((data, i): GroupFeedPage => ({ data, offset: i * 20 })),
    pageParams: pages.map((_, i) => i * 20),
  }
}

/** The post as the cache holds it after a patch. */
function find(c: GroupFeedCache | undefined, id: string): GroupPostV2 | undefined {
  return c?.pages.flatMap(p => p.data).find(p => p.id === id)
}

describe('patchGroupFeed — spark', () => {
  test('sparking moves the count and the viewer flag together', () => {
    /*
      The whole point of patching the cache rather than holding a local
      `sparked` boolean: if only one of the two moved, the filled heart and
      the number would disagree, which is exactly what the old card did after
      a refetch overwrote the count but not the local flag.
    */
    const before = cache([post({ id: 'p1', spark_count: 4, viewer_sparked: false })])
    const after = patchGroupFeed(before, 'p1', 'spark', 1, true)

    expect(find(after, 'p1')?.spark_count).toBe(5)
    expect(find(after, 'p1')?.viewer_sparked).toBe(true)
  })

  test('unsparking takes the count back down and clears the flag', () => {
    const before = cache([post({ id: 'p1', spark_count: 5, viewer_sparked: true })])
    const after = patchGroupFeed(before, 'p1', 'spark', -1, false)

    expect(find(after, 'p1')?.spark_count).toBe(4)
    expect(find(after, 'p1')?.viewer_sparked).toBe(false)
  })

  test('a count already at zero cannot be driven negative', () => {
    // A stale card can ask to unspark a post the server has reset to 0.
    const after = patchGroupFeed(cache([post({ id: 'p1', spark_count: 0 })]), 'p1', 'spark', -1, false)
    expect(find(after, 'p1')?.spark_count).toBe(0)
  })

  test('the input cache is not mutated', () => {
    const before = cache([post({ id: 'p1', spark_count: 4 })])
    patchGroupFeed(before, 'p1', 'spark', 1, true)
    expect(before.pages[0].data[0].spark_count).toBe(4)
    expect(before.pages[0].data[0].viewer_sparked).toBeUndefined()
  })
})

describe('patchGroupFeed — echo', () => {
  test('echoing moves echo_count and viewer_echoed, and leaves spark alone', () => {
    const before = cache([post({ id: 'p1', spark_count: 7, echo_count: 1, viewer_sparked: true })])
    const after = patchGroupFeed(before, 'p1', 'echo', 1, true)

    expect(find(after, 'p1')?.echo_count).toBe(2)
    expect(find(after, 'p1')?.viewer_echoed).toBe(true)
    expect(find(after, 'p1')?.spark_count).toBe(7)
    expect(find(after, 'p1')?.viewer_sparked).toBe(true)
  })

  test('un-echoing reverses it', () => {
    const before = cache([post({ id: 'p1', echo_count: 2, viewer_echoed: true })])
    const after = patchGroupFeed(before, 'p1', 'echo', -1, false)

    expect(find(after, 'p1')?.echo_count).toBe(1)
    expect(find(after, 'p1')?.viewer_echoed).toBe(false)
  })
})

describe('patchGroupFeed — rollback on error', () => {
  test('applying the inverse patch restores the exact pre-toggle cache', () => {
    /*
      This is what engageGroupPost does in `onError`. If it did not round-trip
      exactly, a failed request would leave the feed showing a spark that the
      server never recorded.
    */
    const before = cache([post({ id: 'p1', spark_count: 4, viewer_sparked: false })])

    const optimistic = patchGroupFeed(before, 'p1', 'spark', 1, true)
    expect(find(optimistic, 'p1')?.spark_count).toBe(5)

    const rolledBack = patchGroupFeed(optimistic, 'p1', 'spark', -1, false)
    expect(rolledBack).toEqual(before)
  })

  test('rolling back an echo restores the count and the flag', () => {
    const before = cache([post({ id: 'p1', echo_count: 3, viewer_echoed: true })])
    const optimistic = patchGroupFeed(before, 'p1', 'echo', -1, false)
    const rolledBack = patchGroupFeed(optimistic, 'p1', 'echo', 1, true)
    expect(rolledBack).toEqual(before)
  })
})

describe('patchGroupFeed — unknown post id is a no-op', () => {
  test('a post id absent from every cached page changes nothing', () => {
    /*
      Returned by identity, not as an equal copy: react-query skips the
      re-render when the reference is unchanged, so a toggle for a post that
      has scrolled out of the cached pages cannot repaint the whole feed.
    */
    const before = cache([post({ id: 'p1' }), post({ id: 'p2' })], [post({ id: 'p3' })])
    const after = patchGroupFeed(before, 'nope', 'spark', 1, true)
    expect(after).toBe(before)
  })

  test('an empty cache is returned untouched', () => {
    expect(patchGroupFeed(undefined, 'p1', 'spark', 1, true)).toBeUndefined()
    const empty = cache([])
    expect(patchGroupFeed(empty, 'p1', 'spark', 1, true)).toBe(empty)
  })

  test('only the named post on the page that holds it is rewritten', () => {
    const before = cache([post({ id: 'p1', spark_count: 1 })], [post({ id: 'p2', spark_count: 1 })])
    const after = patchGroupFeed(before, 'p2', 'spark', 1, true)

    expect(find(after, 'p1')?.spark_count).toBe(1)
    expect(find(after, 'p2')?.spark_count).toBe(2)
    // The page that does not hold p2 keeps its identity.
    expect(after?.pages[0]).toBe(before.pages[0])
  })
})

describe('viewerEngaged', () => {
  test('an absent viewer_* field reads false', () => {
    /*
      Go omits these for an anonymous viewer and an older server build sends
      no such field at all. A `?? true` fallback here would light up every
      heart on the feed for a signed-out reader.
    */
    const anon = post({ id: 'p1' })
    expect(anon.viewer_sparked).toBeUndefined()
    expect(viewerEngaged(anon, 'spark')).toBe(false)
    expect(viewerEngaged(anon, 'echo')).toBe(false)
    expect(viewerEngaged(anon, 'stash')).toBe(false)
  })

  test('an explicit false reads false', () => {
    // Go marshals an unreacted post's bool as `false`, not as omitted.
    const unreacted = post({ viewer_sparked: false, viewer_echoed: false, viewer_stashed: false })
    expect(viewerEngaged(unreacted, 'spark')).toBe(false)
    expect(viewerEngaged(unreacted, 'echo')).toBe(false)
    expect(viewerEngaged(unreacted, 'stash')).toBe(false)
  })

  test('true reads true, per kind', () => {
    const p = post({ viewer_sparked: true, viewer_echoed: false, viewer_stashed: true })
    expect(viewerEngaged(p, 'spark')).toBe(true)
    expect(viewerEngaged(p, 'echo')).toBe(false)
    expect(viewerEngaged(p, 'stash')).toBe(true)
  })
})

describe('patchGroupFeed — stash', () => {
  test('stashing moves only the flag; there is no stash counter', () => {
    const before = cache([post({ id: 'p1', spark_count: 2, echo_count: 3 })])
    const after = patchGroupFeed(before, 'p1', 'stash', 0, true)

    expect(find(after, 'p1')?.viewer_stashed).toBe(true)
    expect(find(after, 'p1')?.spark_count).toBe(2)
    expect(find(after, 'p1')?.echo_count).toBe(3)
  })
})
