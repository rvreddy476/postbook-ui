/*
  Cache surgery for "Not interested" and "Delete".

  The home feed is an infinite query: { pages: [{ data: PostDetail[] }],
  pageParams }. Removing a post optimistically means walking every page and
  dropping the row, and then — because the request may fail, or the person
  may press Undo — putting exactly what was there back.

  Pure, so it can be unit-tested without react-query. Two properties matter:

  1. When the id is NOT in the cache, the SAME reference comes back. react-query
     compares the returned value by identity; a fresh-but-equal object would
     re-render every card on every feed for no reason.
  2. When the id IS in the cache, only the pages that held it are rebuilt;
     untouched pages keep their reference for the same reason.
*/

export interface PostLike {
  id: string
}

export interface PostPage<P extends PostLike = PostLike> {
  data: P[]
  [extra: string]: unknown
}

export interface InfinitePostCache<P extends PostLike = PostLike> {
  pages: PostPage<P>[]
  pageParams: unknown[]
}

/**
 * Drop `postId` from every page. Returns the input reference untouched when
 * the post is absent, or when the input is not an infinite-page cache at all
 * (a query that has not loaded yet is `undefined`).
 */
export function removePost<C>(cache: C, postId: string): C {
  const c = cache as unknown as InfinitePostCache | undefined
  if (!c || !Array.isArray(c.pages)) return cache

  let changed = false
  const pages = c.pages.map((page) => {
    if (!page || !Array.isArray(page.data)) return page
    if (!page.data.some((p) => p?.id === postId)) return page
    changed = true
    return { ...page, data: page.data.filter((p) => p?.id !== postId) }
  })

  if (!changed) return cache
  return { ...c, pages } as unknown as C
}

/** Does any page of this cache hold the post? */
export function cacheHasPost<C>(cache: C, postId: string): boolean {
  const c = cache as unknown as InfinitePostCache | undefined
  if (!c || !Array.isArray(c.pages)) return false
  return c.pages.some((page) => Array.isArray(page?.data) && page.data.some((p) => p?.id === postId))
}

/**
 * One captured query: its exact key and the data it held before we touched
 * it. The key is kept as the query client reported it so restore writes back
 * to precisely the same entry (home-feed has several variants — per tab,
 * per filter).
 */
export interface QuerySnapshot {
  queryKey: readonly unknown[]
  data: unknown
}

/**
 * Something that looks enough like a react-query QueryClient to snapshot and
 * restore. Typed structurally so the module stays free of react-query and the
 * tests can hand in a fake.
 */
export interface SnapshotClient {
  getQueriesData(filters: { queryKey: readonly unknown[] }): Array<[readonly unknown[], unknown]>
  setQueryData(queryKey: readonly unknown[], data: unknown): unknown
  setQueriesData(filters: { queryKey: readonly unknown[] }, updater: (old: unknown) => unknown): unknown
}

/**
 * Capture every query under each prefix BEFORE mutating it. Only queries
 * that actually hold the post are captured: restoring a query that never
 * changed would clobber whatever a concurrent refetch put there in between.
 */
export function snapshotQueries(
  client: SnapshotClient,
  prefixes: readonly (readonly unknown[])[],
  postId: string,
): QuerySnapshot[] {
  const out: QuerySnapshot[] = []
  for (const prefix of prefixes) {
    for (const [queryKey, data] of client.getQueriesData({ queryKey: prefix })) {
      if (cacheHasPost(data, postId)) out.push({ queryKey, data })
    }
  }
  return out
}

/** Remove the post from every query under each prefix. */
export function removePostFromQueries(
  client: SnapshotClient,
  prefixes: readonly (readonly unknown[])[],
  postId: string,
): void {
  for (const prefix of prefixes) {
    client.setQueriesData({ queryKey: prefix }, (old) => removePost(old, postId))
  }
}

/** Put every captured query back exactly as it was. */
export function restoreQueries(client: SnapshotClient, snapshots: readonly QuerySnapshot[]): void {
  for (const s of snapshots) client.setQueryData(s.queryKey, s.data)
}
