import { describe, expect, test } from 'bun:test'
import {
  cacheHasPost,
  removePost,
  removePostFromQueries,
  restoreQueries,
  snapshotQueries,
  type InfinitePostCache,
  type SnapshotClient,
} from '../removePostFromPages'

function cache(...pages: string[][]): InfinitePostCache {
  return {
    pages: pages.map((ids, i) => ({ data: ids.map((id) => ({ id })), cursor: `c${i}` })),
    pageParams: pages.map((_, i) => `c${i}`),
  }
}

function ids(c: InfinitePostCache | undefined): string[] {
  return c?.pages.flatMap((p) => p.data.map((x) => x.id)) ?? []
}

describe('removePost', () => {
  test('returns the SAME reference when the id is absent (react-query skips the re-render)', () => {
    const before = cache(['a', 'b'], ['c'])
    const after = removePost(before, 'zzz')
    expect(after).toBe(before)
  })

  test('returns the same reference for a query that has not loaded (undefined) or is not paged', () => {
    expect(removePost(undefined, 'a')).toBeUndefined()
    const notPaged = { data: [{ id: 'a' }] }
    expect(removePost(notPaged, 'a')).toBe(notPaged)
  })

  test('drops the post from the page that holds it', () => {
    const before = cache(['a', 'b'], ['c', 'd'])
    const after = removePost(before, 'c')
    expect(ids(after)).toEqual(['a', 'b', 'd'])
  })

  test('drops every copy when the same post sits in several pages', () => {
    const before = cache(['a', 'x'], ['x', 'b'])
    expect(ids(removePost(before, 'x'))).toEqual(['a', 'b'])
  })

  test('does not mutate the input', () => {
    const before = cache(['a', 'b'])
    removePost(before, 'a')
    expect(ids(before)).toEqual(['a', 'b'])
  })

  test('untouched pages keep their reference; touched pages keep their other fields', () => {
    const before = cache(['a'], ['b'])
    const after = removePost(before, 'b')
    expect(after.pages[0]).toBe(before.pages[0])
    expect(after.pages[1]).not.toBe(before.pages[1])
    expect(after.pages[1].cursor).toBe('c1')
    expect(after.pageParams).toBe(before.pageParams)
  })
})

describe('cacheHasPost', () => {
  test('finds a post in any page and says no for undefined', () => {
    expect(cacheHasPost(cache(['a'], ['b']), 'b')).toBe(true)
    expect(cacheHasPost(cache(['a'], ['b']), 'q')).toBe(false)
    expect(cacheHasPost(undefined, 'a')).toBe(false)
  })
})

/** A QueryClient stand-in: a map from JSON key to data, prefix-matched like react-query. */
function fakeClient(initial: Record<string, unknown>) {
  const store = new Map<string, { key: readonly unknown[]; data: unknown }>()
  for (const [k, v] of Object.entries(initial)) store.set(k, { key: JSON.parse(k), data: v })
  const matches = (prefix: readonly unknown[]) =>
    [...store.values()].filter((e) => prefix.every((p, i) => JSON.stringify(e.key[i]) === JSON.stringify(p)))
  const client: SnapshotClient = {
    getQueriesData: ({ queryKey }) => matches(queryKey).map((e) => [e.key, e.data] as [readonly unknown[], unknown]),
    setQueryData: (queryKey, data) => {
      store.set(JSON.stringify(queryKey), { key: queryKey, data })
    },
    setQueriesData: ({ queryKey }, updater) => {
      for (const e of matches(queryKey)) e.data = updater(e.data)
    },
  }
  const get = (k: string) => store.get(k)?.data as InfinitePostCache | undefined
  return { client, get }
}

describe('snapshot → remove → restore', () => {
  const PREFIXES = [['home-feed'], ['profile-posts']] as const

  test('snapshots only the queries that hold the post, across both prefixes', () => {
    const { client } = fakeClient({
      '["home-feed","for-you"]': cache(['a', 'b']),
      '["home-feed","following"]': cache(['c']),
      '["profile-posts","u1"]': cache(['b']),
      '["comments","b"]': cache(['b']),
    })
    const snaps = snapshotQueries(client, PREFIXES, 'b')
    expect(snaps.map((s) => JSON.stringify(s.queryKey)).sort()).toEqual([
      '["home-feed","for-you"]',
      '["profile-posts","u1"]',
    ])
  })

  test('remove takes the post out of every matching query and leaves others alone', () => {
    const { client, get } = fakeClient({
      '["home-feed","for-you"]': cache(['a', 'b']),
      '["home-feed","following"]': cache(['b', 'c']),
      '["comments","b"]': cache(['b']),
    })
    removePostFromQueries(client, PREFIXES, 'b')
    expect(ids(get('["home-feed","for-you"]'))).toEqual(['a'])
    expect(ids(get('["home-feed","following"]'))).toEqual(['c'])
    expect(ids(get('["comments","b"]'))).toEqual(['b'])
  })

  test('restore puts back exactly the snapshotted data, by identity, to the same key', () => {
    const forYou = cache(['a', 'b'])
    const { client, get } = fakeClient({
      '["home-feed","for-you"]': forYou,
      '["home-feed","following"]': cache(['c']),
    })
    const snaps = snapshotQueries(client, PREFIXES, 'b')
    removePostFromQueries(client, PREFIXES, 'b')
    expect(ids(get('["home-feed","for-you"]'))).toEqual(['a'])

    restoreQueries(client, snaps)
    expect(get('["home-feed","for-you"]')).toBe(forYou)
    expect(ids(get('["home-feed","for-you"]'))).toEqual(['a', 'b'])
  })

  test('a query that never held the post is not written on restore (a concurrent refetch survives)', () => {
    const { client, get } = fakeClient({
      '["home-feed","for-you"]': cache(['a', 'b']),
      '["home-feed","following"]': cache(['c']),
    })
    const snaps = snapshotQueries(client, PREFIXES, 'b')
    removePostFromQueries(client, PREFIXES, 'b')
    // Something else refreshed "following" in the meantime.
    const refreshed = cache(['c', 'd'])
    client.setQueryData(['home-feed', 'following'], refreshed)

    restoreQueries(client, snaps)
    expect(get('["home-feed","following"]')).toBe(refreshed)
  })
})
