import { describe, expect, test } from 'bun:test'

import { groupTitleFor, toggleRecipient } from '../newMessagePicker'
import { activityStatusVisible, ACTIVITY_STATUS_OPTIONS } from '../inbox/ActivityStatus'
import { BUBBLE_STYLES, bubbleClass, bubbleSwatchClass, parseBubbleStyle } from '@/lib/chat/bubbleStyle'

const a = { id: 'a', name: 'Asha Rao' }
const b = { id: 'b', name: 'Ravi' }
const c = { id: 'c', name: 'Meena' }

describe('new message picker', () => {
  test('one-person mode replaces the pick', () => {
    expect(toggleRecipient([a], b, 1)).toEqual([b])
  })
  test('multi: add, remove, and the cap holds', () => {
    expect(toggleRecipient([a], b, 5)).toEqual([a, b])
    expect(toggleRecipient([a, b], a, 5)).toEqual([b])
    expect(toggleRecipient([a, b], c, 2)).toEqual([a, b])
  })
  test('group title: typed wins, else first names', () => {
    expect(groupTitleFor('  Trip  ', [a, b])).toBe('Trip')
    expect(groupTitleFor('', [a, b])).toBe('Asha, Ravi')
    expect(groupTitleFor('', [a, b, c, { id: 'd', name: 'Dev' }])).toBe('Asha, Ravi and 2 others')
    expect(groupTitleFor('', [])).toBe('New group')
  })
})

describe('activity status and bubble colour', () => {
  test('dot is off only for no_one; the sheet offers the server values', () => {
    expect(activityStatusVisible('no_one')).toBe(false)
    expect(activityStatusVisible('everyone')).toBe(true)
    expect(activityStatusVisible(undefined)).toBe(true)
    expect(ACTIVITY_STATUS_OPTIONS.map((o) => o.value)).toEqual(['everyone', 'connections_only', 'no_one'])
  })
  test('bubble style values and classes', () => {
    expect(BUBBLE_STYLES).toEqual(['default', 'ocean', 'ember', 'forest', 'violet', 'mono'])
    expect(parseBubbleStyle('violet')).toBe('violet')
    expect(parseBubbleStyle('neon')).toBe('default')
    expect(bubbleClass('default')).toBe('')
    expect(bubbleClass('ocean')).toBe('chat-bubble--ocean')
    expect(bubbleSwatchClass('default')).toBe('chat-swatch--default')
  })
})
