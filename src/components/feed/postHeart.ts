import type { Reaction } from '@/lib/reactions'

/*
  The heart on a post (founder, 24 Oct 2026): posts take one reaction, the
  like, shown as a TikTok-style heart with its count. Tap likes, tap again
  unlikes. Comments keep the six reactions; posts never offer them.

  A viewer who reacted before with an older reaction (love, haha…) reads as
  liked, so ANY viewer_reaction counts. Go sends an empty string for "none",
  so empty is not liked. Pure: the tests pin it down without rendering.
*/

/** True when the viewer has reacted to the post with anything at all. */
export function isPostLiked(viewerReaction: unknown): boolean {
  if (typeof viewerReaction === 'string') return viewerReaction.trim() !== ''
  if (typeof viewerReaction === 'object' && viewerReaction !== null) {
    const type = (viewerReaction as { type?: unknown }).type
    return typeof type === 'string' && type.trim() !== ''
  }
  return false
}

export interface HeartView {
  liked: boolean
  count: number
}

/**
 * What the heart shows. `pending` is the state a tap asked for while the
 * request is in flight (null when none is): the heart and its count move at
 * once, and fall back to the server's answer when it lands.
 */
export function heartView(viewerReaction: unknown, likes: number | null | undefined, pending: boolean | null = null): HeartView {
  const liked = isPostLiked(viewerReaction)
  const count = Number.isFinite(likes) && (likes as number) > 0 ? Math.floor(likes as number) : 0
  if (pending === null || pending === liked) return { liked, count }
  return { liked: pending, count: Math.max(0, count + (pending ? 1 : -1)) }
}

/**
 * The request a tap makes. The post-service's /react is a toggle and only
 * takes "like" on posts now, so a tap always sends the like: on a liked post
 * (whatever the old reaction was) it removes it, otherwise it adds it.
 */
export function heartRequest(liked: boolean): { next: Reaction | null; current: Reaction | null } {
  return liked ? { next: null, current: 'like' } : { next: 'like', current: null }
}

/** The plain sentence for a refusal from the post-service's reaction or repost routes. */
export function postActionErrorText(code: unknown): string | null {
  if (code === 'REACTION_NOT_ALLOWED') return 'Posts take a like only. Tap the heart to like it.'
  if (code === 'REPOST_NOT_ALLOWED') return 'Reels cannot be reposted. Share the link instead.'
  return null
}
