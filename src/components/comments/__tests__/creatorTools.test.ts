import { describe, expect, test } from 'bun:test'
import { applyPin, commentCreatorRequest, createCommentCreatorTools, pinnedFirst } from '../creatorTools'
import type { CommentItem } from '@/types/profile'

describe('creator request paths (post-service comment_creator.go)', () => {
  test('heart is POST on, DELETE off', () => {
    expect(commentCreatorRequest('heart', 'c1', true)).toEqual({ method: 'post', url: '/v1/comments/c1/heart' })
    expect(commentCreatorRequest('heart', 'c1', false)).toEqual({ method: 'delete', url: '/v1/comments/c1/heart' })
  })
  test('pin is PUT on, DELETE off', () => {
    expect(commentCreatorRequest('pin', 'c1', true)).toEqual({ method: 'put', url: '/v1/comments/c1/pin' })
    expect(commentCreatorRequest('pin', 'c1', false)).toEqual({ method: 'delete', url: '/v1/comments/c1/pin' })
  })
  test('the id is path-escaped', () => {
    expect(commentCreatorRequest('pin', 'a/b', true).url).toBe('/v1/comments/a%2Fb/pin')
  })
  test('the tools send exactly those requests', async () => {
    const calls: string[] = []
    const client = {
      post: async (url: string) => { calls.push(`POST ${url}`) },
      put: async (url: string) => { calls.push(`PUT ${url}`) },
      delete: async (url: string) => { calls.push(`DELETE ${url}`) },
    }
    const tools = createCommentCreatorTools(client)
    await tools.onHeart('c1', true)
    await tools.onHeart('c1', false)
    await tools.onPin('c2', true)
    await tools.onPin('c2', false)
    expect(calls).toEqual(['POST /v1/comments/c1/heart', 'DELETE /v1/comments/c1/heart', 'PUT /v1/comments/c2/pin', 'DELETE /v1/comments/c2/pin'])
  })
  test('a refused request rejects, so the row can roll back', async () => {
    const tools = createCommentCreatorTools({ post: async () => { throw new Error('403') }, put: async () => {}, delete: async () => {} })
    await expect(tools.onHeart('c1', true)).rejects.toThrow('403')
  })
})

const row = (id: string, pinned = false): CommentItem => ({
  id, post_id: 'p', author_id: 'a', body: id, like_count: 0, dislike_count: 0, reply_count: 0, is_reply: false,
  created_at: '', updated_at: '', pinned,
})

describe('one pinned comment, shown first', () => {
  test('pinning one comment unpins the other', () => {
    const next = applyPin([row('a', true), row('b'), row('c')], 'c', true)
    expect(next.map(item => [item.id, item.pinned])).toEqual([['a', false], ['b', false], ['c', true]])
  })
  test('unpinning touches only that comment', () => {
    const list = [row('a', true), row('b')]
    expect(applyPin(list, 'a', false).map(item => item.pinned)).toEqual([false, false])
    expect(applyPin(list, 'b', false)).toBe(list)
  })
  test('the pinned comment leads, the rest keep their order', () => {
    expect(pinnedFirst([row('a'), row('b'), row('c', true), row('d')]).map(item => item.id)).toEqual(['c', 'a', 'b', 'd'])
  })
  test('nothing pinned, or already first, is left alone', () => {
    const plain = [row('a'), row('b')]
    expect(pinnedFirst(plain)).toBe(plain)
    const first = [row('a', true), row('b')]
    expect(pinnedFirst(first)).toBe(first)
  })
})
