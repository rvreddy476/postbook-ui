import { describe, expect, test } from 'bun:test'
import {
  datingConversationIds,
  isDatingConversation,
  messengerConversations,
  messengerUnreadForUser,
  messengerUnreadTotal,
  withoutDatingUnread,
} from '@/lib/messengerConversations'

const conv = (id: string, source_app?: string) => ({ id, type: 'direct', source_app, created_at: '', updated_at: '' })

describe('dating chats stay out of Messages', () => {
  test('only source_app "dating" is a dating chat', () => {
    expect(isDatingConversation(conv('a', 'dating'))).toBe(true)
    expect(isDatingConversation(conv('a', ' Dating '))).toBe(true)
    for (const s of [undefined, '', 'momentum', 'commerce', 'datingx']) expect(isDatingConversation(conv('a', s))).toBe(false)
    expect(isDatingConversation(null)).toBe(false)
  })

  test('the conversation list drops dating chats and keeps the rest in order', () => {
    const list = [conv('d1', 'dating'), conv('c1'), conv('c2', 'momentum'), conv('d2', 'dating'), conv('c3', '')]
    expect(messengerConversations(list).map((c) => c.id)).toEqual(['c1', 'c2', 'c3'])
    expect(messengerConversations(undefined)).toEqual([])
    expect(datingConversationIds([...list, { conversation_id: 'd3', source_app: 'dating' }])).toEqual(['d1', 'd2', 'd3'])
  })

  test('the unread total leaves dating chats out', () => {
    const counts = { c1: 2, d1: 5, c2: 1, d2: 3 }
    expect(messengerUnreadTotal(counts, new Set(['d1', 'd2']))).toBe(3)
    expect(messengerUnreadTotal(counts, new Set())).toBe(11)
    expect(messengerUnreadTotal({}, new Set(['d1']))).toBe(0)
  })

  test('a person mapped to a dating chat shows no Messages unread', () => {
    const map = { asha: 'd1', ravi: 'c1' }
    const counts = { d1: 4, c1: 2 }
    const dating = new Set(['d1'])
    expect(messengerUnreadForUser('asha', map, counts, dating)).toBe(0)
    expect(messengerUnreadForUser('ravi', map, counts, dating)).toBe(2)
    expect(messengerUnreadForUser('nobody', map, counts, dating)).toBe(0)
  })

  test('stored unread state is pruned of dating chats; unchanged state is returned as is', () => {
    const state = { counts: { c1: 2, d1: 4 }, userConvMap: { asha: 'd1', ravi: 'c1' }, lastSeenTimestamps: { d1: 't' } }
    const pruned = withoutDatingUnread(state, new Set(['d1']))
    expect(pruned.counts).toEqual({ c1: 2 })
    expect(pruned.userConvMap).toEqual({ ravi: 'c1' })
    expect(pruned.lastSeenTimestamps).toEqual({ d1: 't' })
    expect(withoutDatingUnread(state, new Set(['zz']))).toBe(state)
    expect(withoutDatingUnread(state, new Set())).toBe(state)
  })
})
