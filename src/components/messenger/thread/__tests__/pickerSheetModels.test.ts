import { describe, expect, test } from 'bun:test'

import type { ReactionGroup } from '@/lib/chat/contract'
import { MESSAGE_REPORT_REASONS } from '@/services/chatParityApi'
import {
  fallbackReactionGroups,
  reactionTabs,
  reactorsFor,
  REPORT_NOTE_MAX,
  REPORT_REASON_LABELS,
  reportNote,
  seenAtLabel,
  seenByTitle,
} from '../pickerSheetModels'

const names: Record<string, string> = { u1: 'Asha', u2: 'Ravi', u3: 'Meena' }
const nameOf = (id: string) => names[id] ?? 'Someone'

describe('reactions', () => {
  test('the local list becomes named groups, biggest first, without blanks or repeats', () => {
    const g = fallbackReactionGroups(
      [
        { emoji: '\u{1F602}', user_ids: ['u1'] },
        { emoji: '❤️', user_ids: ['u1', 'u2', 'u2'] },
        { emoji: ' ', user_ids: ['u3'] },
        { emoji: '\u{1F44D}', user_ids: [] },
      ],
      nameOf,
      (id) => (id === 'u1' ? '/a.jpg' : null),
    )
    expect(g).toEqual([
      { emoji: '❤️', count: 2, users: [{ userId: 'u1', displayName: 'Asha', avatarUrl: '/a.jpg' }, { userId: 'u2', displayName: 'Ravi', avatarUrl: null }] },
      { emoji: '\u{1F602}', count: 1, users: [{ userId: 'u1', displayName: 'Asha', avatarUrl: '/a.jpg' }] },
    ])
  })

  test('the same emoji twice merges', () => {
    const g = fallbackReactionGroups([{ emoji: 'A', user_ids: ['u1'] }, { emoji: 'A', user_ids: ['u1', 'u3'] }], nameOf)
    expect(g).toHaveLength(1)
    expect(g[0].count).toBe(2)
  })

  const groups: ReactionGroup[] = [
    { emoji: 'A', count: 2, users: [{ userId: 'u1', displayName: 'Asha', avatarUrl: null }, { userId: 'u2', displayName: 'Ravi', avatarUrl: null }] },
    { emoji: 'B', count: 1, users: [{ userId: 'u1', displayName: 'Asha', avatarUrl: null }] },
  ]

  test('tabs: All with the total, then one per emoji', () => {
    expect(reactionTabs(groups)).toEqual([
      { key: 'all', label: 'All', count: 3 },
      { key: 'A', label: 'A', count: 2 },
      { key: 'B', label: 'B', count: 1 },
    ])
    expect(reactionTabs([])).toEqual([{ key: 'all', label: 'All', count: 0 }])
  })

  test('All lists each person once with every emoji; an emoji tab only its people', () => {
    expect(reactorsFor(groups, 'all').map((r) => [r.user.userId, r.emojis])).toEqual([
      ['u1', ['A', 'B']],
      ['u2', ['A']],
    ])
    expect(reactorsFor(groups, 'B').map((r) => r.user.userId)).toEqual(['u1'])
    expect(reactorsFor(groups, 'Z')).toEqual([])
  })
})

describe('seen by', () => {
  const now = Date.parse('2026-10-18T12:00:00Z')
  test('title and times', () => {
    expect(seenByTitle(4)).toBe('Seen by 4')
    expect(seenByTitle(0)).toBe('Seen by')
    expect(seenAtLabel('2026-10-18T11:59:40Z', now)).toBe('Just now')
    expect(seenAtLabel('2026-10-18T11:55:00Z', now)).toBe('5m ago')
    expect(seenAtLabel('2026-10-18T09:00:00Z', now)).toBe('3h ago')
    expect(seenAtLabel(null, now)).toBe('')
  })
})

describe('report', () => {
  test('every reason the server takes has our label', () => {
    expect(MESSAGE_REPORT_REASONS.map((r) => REPORT_REASON_LABELS[r])).toEqual([
      'Spam',
      'Harassment or bullying',
      'Hate speech',
      'Nudity or sexual content',
      'Violence or threats',
      'Scam or fraud',
      'Something else',
    ])
  })

  test('the note is trimmed, capped at 500, and dropped when empty', () => {
    expect(reportNote('  he keeps sending this  ')).toBe('he keeps sending this')
    expect(reportNote('   ')).toBeUndefined()
    expect(reportNote('x'.repeat(600))).toHaveLength(REPORT_NOTE_MAX)
  })
})
