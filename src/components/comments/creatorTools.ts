import api from '@/lib/api'
import type { CommentItem } from '@/types/profile'

/**
 * The post author's tools on a comment thread: heart and pin. Every surface
 * that shows a post's comments (long video, reels, feed cards, the post page,
 * the notification popup) passes the same set; rows show the controls only to
 * the post's author (myId === postAuthorId). The server enforces the same
 * rule (post-service comment_creator.go: post author only, one pin per post,
 * replies cannot be pinned).
 */
export interface CommentCreatorTools {
  onHeart: (commentId: string, on: boolean) => Promise<void>
  onPin: (commentId: string, on: boolean) => Promise<void>
}

export type CreatorAction = 'heart' | 'pin'
export type CreatorMethod = 'post' | 'put' | 'delete'

/**
 * The request for one creator toggle:
 *   heart  POST | DELETE /v1/comments/:id/heart
 *   pin    PUT  | DELETE /v1/comments/:id/pin
 */
export function commentCreatorRequest(action: CreatorAction, commentId: string, on: boolean): { method: CreatorMethod; url: string } {
  const url = `/v1/comments/${encodeURIComponent(commentId)}/${action}`
  if (!on) return { method: 'delete', url }
  return { method: action === 'heart' ? 'post' : 'put', url }
}

export interface CreatorClient {
  post: (url: string) => Promise<unknown>
  put: (url: string) => Promise<unknown>
  delete: (url: string) => Promise<unknown>
}

export function createCommentCreatorTools(client: CreatorClient): CommentCreatorTools {
  const send = async (action: CreatorAction, commentId: string, on: boolean) => {
    const { method, url } = commentCreatorRequest(action, commentId, on)
    await client[method](url)
  }
  return {
    onHeart: (commentId, on) => send('heart', commentId, on),
    onPin: (commentId, on) => send('pin', commentId, on),
  }
}

/** The shared set, on the app's API client. Stable, so it is safe as a prop. */
export const commentCreatorTools: CommentCreatorTools = createCommentCreatorTools({
  post: url => api.post(url),
  put: url => api.put(url),
  delete: url => api.delete(url),
})

/**
 * Pin `id` (on) or clear it (off) in a top-level list. A post holds one pin,
 * so pinning one comment unpins every other row.
 */
export function applyPin<T extends CommentItem>(list: readonly T[], id: string, on: boolean): T[] {
  let changed = false
  const next = list.map(item => {
    const pinned = item.id === id ? on : on ? false : !!item.pinned
    if (!!item.pinned === pinned) return item
    changed = true
    return { ...item, pinned }
  })
  return changed ? next : (list as T[])
}

/**
 * The pinned comment first, everything else in the server's order. The server
 * already leads with it on the plain list; the around-a-comment list and an
 * optimistic pin need the client to do the same. Only one row is lifted.
 */
export function pinnedFirst<T extends CommentItem>(list: readonly T[]): T[] {
  const index = list.findIndex(item => item.pinned)
  if (index <= 0) return list as T[]
  return [list[index], ...list.slice(0, index), ...list.slice(index + 1)]
}
