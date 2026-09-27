import { describe, expect, test } from 'bun:test'
import { applyReaction, patchCommentInList, reactionTotal, topReactions, QUICK_REACTIONS } from '../reactionMath'
import type { CommentItem } from '@/types/profile'

const base: CommentItem = {
  id: 'c1', post_id: 'p', author_id: 'a', body: 'hello', like_count: 3, dislike_count: 0, reply_count: 0, is_reply: false,
  created_at: '2026-09-27T00:00:00Z', updated_at: '2026-09-27T00:00:00Z',
  reactions: [{ emoji: '❤️', count: 2 }, { emoji: '👍', count: 1 }], reaction_count: 3, viewer_reaction: null,
}

describe('topReactions', () => {
  test('sorts by count, keeps ties in arrival order, drops zeros and caps at the limit', () => {
    expect(topReactions([{ emoji: '😂', count: 1 }, { emoji: '❤️', count: 5 }, { emoji: '👍', count: 1 }, { emoji: '😢', count: 0 }, { emoji: '😮', count: 2 }], 3))
      .toEqual([{ emoji: '❤️', count: 5 }, { emoji: '😮', count: 2 }, { emoji: '😂', count: 1 }])
  })
  test('tolerates missing or malformed lists', () => {
    expect(topReactions(undefined)).toEqual([])
    expect(topReactions(null)).toEqual([])
    expect(topReactions([{ emoji: '', count: 3 }, { emoji: '❤️', count: Number.NaN }] as never)).toEqual([])
  })
})

describe('applyReaction', () => {
  test('adding a first reaction bumps the total and its tally', () => {
    const next = applyReaction(base, '😂')
    expect(next.viewer_reaction).toBe('😂')
    expect(next.reaction_count).toBe(4)
    expect(next.like_count).toBe(4)
    expect(next.reactions).toEqual([{ emoji: '❤️', count: 2 }, { emoji: '👍', count: 1 }, { emoji: '😂', count: 1 }])
    expect(base.reaction_count).toBe(3) // never mutated
  })
  test('switching emoji moves the vote without changing the total', () => {
    const reacted = applyReaction(base, '❤️')
    expect(reacted.reaction_count).toBe(4)
    const switched = applyReaction(reacted, '😮')
    expect(switched.viewer_reaction).toBe('😮')
    expect(switched.reaction_count).toBe(4)
    expect(switched.reactions).toEqual([{ emoji: '❤️', count: 2 }, { emoji: '👍', count: 1 }, { emoji: '😮', count: 1 }])
  })
  test('removing the viewer reaction decrements and drops an emptied tally', () => {
    const reacted = applyReaction(base, '😂')
    const removed = applyReaction(reacted, null)
    expect(removed.viewer_reaction).toBeNull()
    expect(removed.reaction_count).toBe(3)
    expect(removed.reactions).toEqual([{ emoji: '❤️', count: 2 }, { emoji: '👍', count: 1 }])
  })
  test('choosing the same emoji again is a no-op on counts', () => {
    const reacted = applyReaction(base, '❤️')
    expect(applyReaction(reacted, '❤️')).toEqual(reacted)
  })
  test('a legacy row without reaction fields uses like_count as the total', () => {
    const legacy: CommentItem = { ...base, reactions: undefined, reaction_count: undefined, viewer_reaction: undefined, like_count: 2 }
    expect(reactionTotal(legacy)).toBe(2)
    const next = applyReaction(legacy, '👍')
    expect(next).toMatchObject({ viewer_reaction: '👍', reaction_count: 3, like_count: 3, reactions: [{ emoji: '👍', count: 1 }] })
  })
  test('removing when nothing was set never goes negative', () => {
    const empty: CommentItem = { ...base, reactions: [], reaction_count: 0, like_count: 0, viewer_reaction: null }
    expect(applyReaction(empty, null).reaction_count).toBe(0)
  })
  test('the quick bar offers exactly the six agreed emoji in order', () => {
    expect(QUICK_REACTIONS.map(option => option.emoji)).toEqual(['👍', '👎', '❤️', '😂', '😢', '😮'])
  })
})

describe('patchCommentInList', () => {
  test('patches a top-level comment and a nested first-reply preview, leaving others untouched', () => {
    const reply: CommentItem = { ...base, id: 'r1', is_reply: true }
    const list: CommentItem[] = [{ ...base, id: 'c1', reply }, { ...base, id: 'c2' }]
    const next = patchCommentInList(list, 'r1', item => ({ ...item, body: 'patched' }))
    expect(next[0].reply?.body).toBe('patched')
    expect(next[1]).toBe(list[1])
    expect(patchCommentInList(list, 'missing', item => ({ ...item, body: 'x' }))).toBe(list)
  })
})
