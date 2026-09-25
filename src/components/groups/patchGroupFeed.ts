import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { GroupPostV2 } from '@/types/groups'

/**
 * Optimistic engagement patching for the group feed cache.
 *
 * Lifted out of GroupPanel so the group feed tab and the messenger panel
 * agree on one mechanism: the count AND the viewer's own flag move together,
 * written straight into the cached feed page. The card then reads a single
 * source of truth, and the next refetch overwrites both with the server's
 * answer instead of fighting a local `useState` override that survives it.
 */

/** One page of `GET /v1/groups/:id/feed/v2`, as useGroupFeedV2 stores it. */
export type GroupFeedPage = { data: GroupPostV2[]; offset: number }

/** The shape react-query holds under ['group-feed-v2', groupId]. */
export type GroupFeedCache = InfiniteData<GroupFeedPage, number>

/**
 * `stash` has no counter on the post — only the viewer flag moves — so its
 * delta is ignored. Spark and echo move a count and a flag together.
 */
export type EngagementKind = 'spark' | 'echo' | 'stash'

export function groupFeedKey(groupId: string): readonly unknown[] {
  return ['group-feed-v2', groupId]
}

/**
 * Whether the signed-in viewer has already engaged with this post.
 *
 * `=== true`, never `?? true`: Go marshals an unreacted post's flag as
 * `false`, and for an anonymous viewer (or an older server build) the field
 * is absent entirely. Both have to read as "not reacted", so a nullish
 * fallback would light up every button on a feed that omits the fields.
 */
export function viewerEngaged(post: GroupPostV2, kind: EngagementKind): boolean {
  switch (kind) {
    case 'spark':
      return post.viewer_sparked === true
    case 'echo':
      return post.viewer_echoed === true
    case 'stash':
      return post.viewer_stashed === true
  }
}

function patchPost(
  post: GroupPostV2,
  kind: EngagementKind,
  delta: number,
  viewerFlag: boolean,
): GroupPostV2 {
  switch (kind) {
    case 'spark':
      return {
        ...post,
        spark_count: Math.max(0, (post.spark_count ?? 0) + delta),
        viewer_sparked: viewerFlag,
      }
    case 'echo':
      return {
        ...post,
        echo_count: Math.max(0, (post.echo_count ?? 0) + delta),
        viewer_echoed: viewerFlag,
      }
    case 'stash':
      return { ...post, viewer_stashed: viewerFlag }
  }
}

/**
 * Pure cache transform: returns a new cache with `postId`'s count and viewer
 * flag moved, or the SAME object when there is nothing to patch.
 *
 * Returning `prev` by identity for an unknown post id (or an empty cache)
 * matters: react-query treats an identical reference as no change, so a
 * stray toggle for a post that has scrolled out of the cached pages cannot
 * re-render the whole feed, and rollback stays symmetric.
 */
export function patchGroupFeed(
  prev: GroupFeedCache | undefined,
  postId: string,
  kind: EngagementKind,
  delta: number,
  viewerFlag: boolean,
): GroupFeedCache | undefined {
  if (!prev) return prev

  let found = false
  const pages = prev.pages.map(page => {
    if (!page.data.some(p => p.id === postId)) return page
    found = true
    return {
      ...page,
      data: page.data.map(p => (p.id === postId ? patchPost(p, kind, delta, viewerFlag) : p)),
    }
  })

  if (!found) return prev
  return { ...prev, pages }
}

/** Applies {@link patchGroupFeed} to the live cache for one group. */
export function applyGroupFeedPatch(
  qc: QueryClient,
  groupId: string,
  postId: string,
  kind: EngagementKind,
  delta: number,
  viewerFlag: boolean,
): void {
  qc.setQueryData<GroupFeedCache>(groupFeedKey(groupId), prev =>
    patchGroupFeed(prev, postId, kind, delta, viewerFlag),
  )
}

/** Just enough of a react-query mutation for {@link engageGroupPost}. */
export interface EngagementMutation {
  mutate: (
    vars: { groupId: string; postId: string; echoType?: string },
    opts?: { onError?: () => void },
  ) => void
}

/**
 * Patches the cache to the requested end state, fires the mutation, and rolls
 * the patch back if the request fails — so a rejected spark does not leave a
 * filled heart and a count that never existed on the server.
 *
 * `engaged` is the state being moved TO, which is why the caller does not
 * have to work out a delta: the card already decided the direction from the
 * flag it read out of this same cache.
 */
export function engageGroupPost(args: {
  qc: QueryClient
  groupId: string
  postId: string
  kind: EngagementKind
  engaged: boolean
  mutation: EngagementMutation
  echoType?: string
}): void {
  const { qc, groupId, postId, kind, engaged, mutation, echoType } = args
  const delta = kind === 'stash' ? 0 : engaged ? 1 : -1

  applyGroupFeedPatch(qc, groupId, postId, kind, delta, engaged)

  mutation.mutate(
    { groupId, postId, ...(echoType ? { echoType } : {}) },
    { onError: () => applyGroupFeedPatch(qc, groupId, postId, kind, -delta, !engaged) },
  )
}
