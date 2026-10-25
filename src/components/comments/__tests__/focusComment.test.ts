import { describe, expect, test } from 'bun:test'
import { MAX_FOCUS_PARENTS, findReplyPages, focusTarget, isMissingComment, type ReplyPage } from '../focusComment'
import type { CommentItem } from '@/types/profile'

const row = (id: string, over: Partial<CommentItem> = {}): CommentItem => ({
  id, post_id: 'p', author_id: 'a', body: id, like_count: 0, dislike_count: 0, reply_count: 0, is_reply: false,
  created_at: '', updated_at: '', ...over,
})

describe('focusTarget — where ?focusComment= points', () => {
  test('a top-level comment in the list', () => {
    expect(focusTarget([row('a'), row('b')], 'b')).toEqual({ kind: 'top', id: 'b' })
  })
  test('the first-reply preview under a comment', () => {
    const list = [row('a', { reply_count: 1, reply: row('r1', { is_reply: true }) })]
    expect(focusTarget(list, 'r1')).toEqual({ kind: 'preview', id: 'r1', parentId: 'a' })
  })
  test('a deeper reply: search the threads that have more replies than the preview shows', () => {
    const list = [
      row('a'),                                                          // no replies
      row('b', { reply_count: 1, reply: row('rb', { is_reply: true }) }), // the only reply is on screen
      row('c', { reply_count: 4, reply: row('rc', { is_reply: true }) }), // more behind the toggle
      row('d', { reply_count: 2 }),                                       // replies, no preview
    ]
    expect(focusTarget(list, 'r9')).toEqual({ kind: 'search', id: 'r9', parents: ['c', 'd'] })
  })
  test('the search is capped', () => {
    const list = Array.from({ length: 20 }, (_, i) => row(`t${i}`, { reply_count: 3 }))
    const target = focusTarget(list, 'x')
    expect(target.kind).toBe('search')
    if (target.kind === 'search') expect(target.parents).toHaveLength(MAX_FOCUS_PARENTS)
  })
  test('nothing could hold it', () => {
    expect(focusTarget([row('a')], 'gone')).toEqual({ kind: 'none', id: 'gone' })
    expect(focusTarget(undefined, 'gone')).toEqual({ kind: 'none', id: 'gone' })
  })
})

describe('findReplyPages', () => {
  const pages: Record<string, ReplyPage> = {
    '': { data: [row('r1'), row('r2')], meta: { next_cursor: 'k1' } },
    k1: { data: [row('r3')], meta: { next_cursor: 'k2' } },
    k2: { data: [row('r4')] },
  }
  const fetchPage = async (_parent: string, cursor: string) => pages[cursor]

  test('reads page by page until the reply appears, keeping the cursors for the cache', async () => {
    const found = await findReplyPages(fetchPage, 'c', 'r3')
    expect(found?.pageParams).toEqual(['', 'k1'])
    expect(found?.pages.flatMap(page => page.data.map(reply => reply.id))).toEqual(['r1', 'r2', 'r3'])
  })
  test('null when the thread ends without it', async () => {
    expect(await findReplyPages(fetchPage, 'c', 'nope')).toBeNull()
  })
  test('stops at the page cap', async () => {
    let reads = 0
    const endless = async () => { reads++; return { data: [row(`x${reads}`)], meta: { next_cursor: `n${reads}` } } }
    expect(await findReplyPages(endless, 'c', 'never', 3)).toBeNull()
    expect(reads).toBe(3)
  })
})

test('a 404 from the around endpoint means the comment is gone; a 500 does not', () => {
  expect(isMissingComment({ response: { status: 404 } })).toBe(true)
  expect(isMissingComment({ response: { status: 500 } })).toBe(false)
  expect(isMissingComment(new Error('network'))).toBe(false)
  expect(isMissingComment(null)).toBe(false)
})
