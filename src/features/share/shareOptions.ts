/*
  Which rows the post Share dialog (components/ShareDialog) offers.

  Founder, 24 Oct 2026: reels take no repost and no quote repost, anywhere
  (the server refuses them with REPOST_NOT_ALLOWED). Feed posts keep both.
  Long videos are unchanged for now. A reel cross-posted into the feed
  (flick_embed) is still the reel, so it follows the reel rule.

  Pure, so the tests pin the rows down without rendering.
*/

export type ShareOption = 'message' | 'repost' | 'quote' | 'copy-link'

/** Content types that are a reel (short) or carry one. */
const REEL_TYPES: ReadonlySet<string> = new Set(['short', 'reel', 'flick', 'flick_embed'])

export function isReelContentType(contentType: string | null | undefined): boolean {
  return !!contentType && REEL_TYPES.has(contentType)
}

/** True when a post of this type may be reposted or quoted. */
export function canRepostContentType(contentType: string | null | undefined): boolean {
  return !isReelContentType(contentType)
}

export function shareOptions({ canMessage, allowRepost }: { canMessage: boolean; allowRepost: boolean }): ShareOption[] {
  const rows: ShareOption[] = []
  if (canMessage) rows.push('message')
  if (allowRepost) rows.push('repost', 'quote')
  rows.push('copy-link')
  return rows
}
