import { describe, expect, test } from 'bun:test'

import { readMyJoin, type MyJoin } from '@/services/messageService'
import { JOIN_NOTE_HISTORY_TEXT, joinNoteDate, joinNoteText } from '../joinNote'

const now = new Date('2026-10-22T12:00:00Z')
const join = (method: MyJoin['method'], addedByUserId: string | null = null): MyJoin => ({
  joinedAt: '2026-10-22T09:30:00Z',
  method,
  addedByUserId,
})

describe('joinNoteText (the "you joined" note, 22 Oct 2026)', () => {
  test('each way in, in the viewer locale', () => {
    expect(joinNoteText(join('invite_link'), null, 'en-GB', now)).toBe("You joined using this group's invite link · 22 Oct")
    expect(joinNoteText(join('added', 'u1'), 'Asha', 'en-GB', now)).toBe('Asha added you · 22 Oct')
    expect(joinNoteText(join('invitation', 'u1'), 'Asha', 'en-GB', now)).toBe('You joined · 22 Oct')
  })

  test('an unknown adder is "Someone"', () => {
    expect(joinNoteText(join('added'), null, 'en-GB', now)).toBe('Someone added you · 22 Oct')
    expect(joinNoteText(join('added', 'u1'), '   ', 'en-GB', now)).toBe('Someone added you · 22 Oct')
  })

  test('the date follows the locale and adds the year only for another year', () => {
    expect(joinNoteDate('2026-10-22T09:30:00Z', 'en-US', now)).toBe('Oct 22')
    expect(joinNoteDate('2025-10-22T09:30:00Z', 'en-GB', now)).toBe('22 Oct 2025')
  })

  test('a bad date drops the date, not the note', () => {
    expect(joinNoteText({ ...join('invitation'), joinedAt: 'nope' }, null, 'en-GB', now)).toBe('You joined')
  })

  test('the second line', () => {
    expect(JOIN_NOTE_HISTORY_TEXT).toBe("Messages sent before you joined aren't shown.")
  })
})

describe('readMyJoin (GET /conversations/:id my_join)', () => {
  const wire = { joined_at: '2026-10-22T09:30:00Z', method: 'added', added_by_user_id: 'u1' }

  test('reads the wrapped and the bare shape', () => {
    const want = { joinedAt: '2026-10-22T09:30:00Z', method: 'added', addedByUserId: 'u1' }
    expect(readMyJoin({ data: { id: 'c', my_join: wire } })).toEqual(want)
    expect(readMyJoin({ id: 'c', my_join: wire })).toEqual(want)
  })

  test('no note: absent, null, created, unknown, empty or bad date', () => {
    expect(readMyJoin({ data: { id: 'c' } })).toBeNull()
    expect(readMyJoin({ data: { id: 'c', my_join: null } })).toBeNull()
    expect(readMyJoin({ data: { my_join: { ...wire, method: 'created' } } })).toBeNull()
    expect(readMyJoin({ data: { my_join: { ...wire, method: 'teleported' } } })).toBeNull()
    expect(readMyJoin({ data: { my_join: { ...wire, joined_at: '' } } })).toBeNull()
    expect(readMyJoin({ data: { my_join: { ...wire, joined_at: 'not a date' } } })).toBeNull()
    expect(readMyJoin(null)).toBeNull()
  })

  test('an empty adder is unknown, and a link never names one', () => {
    expect(readMyJoin({ data: { my_join: { ...wire, added_by_user_id: '' } } })?.addedByUserId).toBeNull()
    expect(readMyJoin({ data: { my_join: { ...wire, method: 'invite_link' } } })?.addedByUserId).toBeNull()
  })
})
