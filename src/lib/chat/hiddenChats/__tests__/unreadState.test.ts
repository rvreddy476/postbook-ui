import { describe, expect, test } from 'bun:test'

import { withoutConversations } from '../unreadState'

const state = {
  counts: { hid: 3, keep: 1 },
  lastSeenTimestamps: { hid: '2026-10-24T10:00:00Z', keep: '2026-10-24T09:00:00Z' },
  userConvMap: { alice: 'hid', bob: 'keep' },
}

describe('withoutConversations', () => {
  test('a hidden chat leaves counts, times and the person map', () => {
    expect(withoutConversations(state, ['hid'])).toEqual({
      counts: { keep: 1 },
      lastSeenTimestamps: { keep: '2026-10-24T09:00:00Z' },
      userConvMap: { bob: 'keep' },
    })
  })

  test('untouched state is returned as is (no needless write)', () => {
    expect(withoutConversations(state, ['other'])).toBe(state)
    expect(withoutConversations(state, [])).toBe(state)
    expect(withoutConversations(state, [''])).toBe(state)
  })

  test('a mention in only one place still goes', () => {
    const only = { counts: {}, lastSeenTimestamps: {}, userConvMap: { carol: 'hid' } }
    expect(withoutConversations(only, ['hid']).userConvMap).toEqual({})
  })
})
