import type { CommentItem } from '@/types/profile'

/*
  /post/<id>?focusComment=<comment_id> — the link every comment notification
  carries, a comment @mention included (post-service PublishUserMentionedInComment).
  The thread loads through GET /v1/posts/:id/comments/around/:commentId, which
  answers top-level comments only, so a reply target is found one of three ways.
*/

export type FocusTarget =
  /** The comment is a top-level row in the list. */
  | { kind: 'top'; id: string }
  /** It is the first-reply preview under `parentId`, already on screen. */
  | { kind: 'preview'; id: string; parentId: string }
  /** Not on screen: look through the replies of these parents, in order. */
  | { kind: 'search'; id: string; parents: string[] }
  /** Nothing in the list could hold it (no thread has replies). */
  | { kind: 'none'; id: string }

/** Parents whose replies are searched for a reply target, at most. */
export const MAX_FOCUS_PARENTS = 8
/** Reply pages read per parent, at most. */
export const MAX_FOCUS_PAGES = 5

/** Where the focused comment is, or which threads may hold it. */
export function focusTarget(list: readonly CommentItem[] | undefined, id: string): FocusTarget {
  const rows = list ?? []
  if (rows.some(row => row.id === id)) return { kind: 'top', id }
  const parent = rows.find(row => row.reply?.id === id)
  if (parent) return { kind: 'preview', id, parentId: parent.id }
  const parents = rows
    .filter(row => (row.reply_count ?? 0) > 1 || ((row.reply_count ?? 0) > 0 && !row.reply))
    .slice(0, MAX_FOCUS_PARENTS)
    .map(row => row.id)
  return parents.length ? { kind: 'search', id, parents } : { kind: 'none', id }
}

export interface ReplyPage {
  data: CommentItem[]
  meta?: { next_cursor?: string }
}

/**
 * Read a parent's replies page by page until `targetId` appears. Returns the
 * pages read (to seed the replies cache, so the opened thread shows the
 * target) and their cursors, or null when it is not there.
 */
export async function findReplyPages(
  fetchPage: (parentId: string, cursor: string) => Promise<ReplyPage>,
  parentId: string,
  targetId: string,
  maxPages = MAX_FOCUS_PAGES,
): Promise<{ pages: ReplyPage[]; pageParams: string[] } | null> {
  const pages: ReplyPage[] = []
  const pageParams: string[] = []
  let cursor = ''
  for (let i = 0; i < maxPages; i++) {
    const page = await fetchPage(parentId, cursor)
    pages.push(page)
    pageParams.push(cursor)
    if (page.data.some(reply => reply.id === targetId)) return { pages, pageParams }
    const next = page.meta?.next_cursor
    if (!next) return null
    cursor = next
  }
  return null
}

/** The around request failed because the comment is gone (deleted, hidden, or never on this post). */
export function isMissingComment(error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | null)?.response?.status
  return status === 404 || status === 400
}
