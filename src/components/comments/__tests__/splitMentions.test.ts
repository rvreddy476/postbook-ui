import { describe, expect, test } from 'bun:test'
import { splitMentions } from '../mentions'

describe('splitMentions', () => {
  test('a mention in the middle of a sentence becomes its own segment', () => {
    expect(splitMentions('thanks @raghu for this')).toEqual([
      { type: 'text', value: 'thanks ' }, { type: 'mention', username: 'raghu' }, { type: 'text', value: ' for this' },
    ])
  })
  test('a mention at the start and one at the end', () => {
    expect(splitMentions('@ann hi @bob')).toEqual([
      { type: 'mention', username: 'ann' }, { type: 'text', value: ' hi ' }, { type: 'mention', username: 'bob' },
    ])
  })
  test('punctuation after the name stays text, including a trailing dot', () => {
    expect(splitMentions('cc @bob, @ann.')).toEqual([
      { type: 'text', value: 'cc ' }, { type: 'mention', username: 'bob' }, { type: 'text', value: ', ' }, { type: 'mention', username: 'ann' }, { type: 'text', value: '.' },
    ])
  })
  test('dots and underscores inside the name are kept', () => {
    expect(splitMentions('@a.b_c!')).toEqual([{ type: 'mention', username: 'a.b_c' }, { type: 'text', value: '!' }])
  })
  test('an email address is not a mention', () => {
    expect(splitMentions('write to bob@example.com')).toEqual([{ type: 'text', value: 'write to bob@example.com' }])
  })
  test('one-character and over-long names are plain text', () => {
    expect(splitMentions('@a')).toEqual([{ type: 'text', value: '@a' }])
    const long = '@' + 'x'.repeat(31)
    expect(splitMentions(long)).toEqual([{ type: 'mention', username: 'x'.repeat(30) }, { type: 'text', value: 'x' }])
  })
  test('empty and mention-free bodies', () => {
    expect(splitMentions('')).toEqual([])
    expect(splitMentions('no handles here')).toEqual([{ type: 'text', value: 'no handles here' }])
  })
})
