import { describe, expect, test } from 'bun:test'
import { activeMention, insertMention } from '../mentions'

describe('activeMention', () => {
  test('"hi @ra|" is a mention with query ra starting at the @', () => {
    expect(activeMention('hi @ra', 6)).toEqual({ query: 'ra', start: 3 })
  })
  test('a bare @ has no query yet', () => {
    expect(activeMention('hi @', 4)).toBeNull()
  })
  test('a space ends the mention', () => {
    expect(activeMention('hi @ra ', 7)).toBeNull()
    expect(activeMention('hi @ra there', 12)).toBeNull()
  })
  test('a second @ ends the mention', () => {
    expect(activeMention('@ra@b', 5)).toBeNull()
  })
  test('an @ preceded by a word character is an email, not a mention', () => {
    expect(activeMention('mail me at bob@ex', 17)).toBeNull()
  })
  test('the caret in the middle of the text only looks at what is before it', () => {
    expect(activeMention('@ra after', 3)).toEqual({ query: 'ra', start: 0 })
    expect(activeMention('@ra after', 2)).toEqual({ query: 'r', start: 0 })
  })
  test('dots and underscores are part of the username, punctuation before the @ is fine', () => {
    expect(activeMention('(@a.b_c', 7)).toEqual({ query: 'a.b_c', start: 1 })
  })
  test('a caret past the end is clamped', () => {
    expect(activeMention('@ra', 99)).toEqual({ query: 'ra', start: 0 })
  })
})

describe('insertMention', () => {
  test('replaces the typed run with @username plus a trailing space and moves the caret after it', () => {
    expect(insertMention('hi @ra', 3, 6, 'raghu')).toEqual({ text: 'hi @raghu ', caret: 10 })
  })
  test('keeps whatever follows the caret', () => {
    expect(insertMention('hi @ra and bye', 3, 6, 'raghu')).toEqual({ text: 'hi @raghu  and bye', caret: 10 })
  })
  test('clamps out-of-range positions', () => {
    expect(insertMention('@x', 0, 50, 'yy')).toEqual({ text: '@yy ', caret: 4 })
  })
})
