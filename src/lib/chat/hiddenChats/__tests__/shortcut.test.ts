import { describe, expect, test } from 'bun:test'

import {
  DEFAULT_SHORTCUT,
  effectiveShortcut,
  formatShortcut,
  keyOfEvent,
  matchesShortcut,
  parseShortcut,
  shortcutFromEvent,
  shortcutLabel,
  shortcutProblem,
} from '../shortcut'

const ev = (over: Partial<{ ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean; code: string; key: string; repeat: boolean }>) => ({
  ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, code: '', key: '', ...over,
})

describe('parseShortcut', () => {
  test('the default', () => {
    expect(parseShortcut('Ctrl+Shift+H')).toEqual({ ctrl: true, alt: false, shift: true, meta: false, key: 'H' })
  })

  test('aliases, spacing and case', () => {
    expect(parseShortcut(' control + option + k ')).toEqual({ ctrl: true, alt: true, shift: false, meta: false, key: 'K' })
    expect(parseShortcut('Cmd+Shift+7')).toEqual({ ctrl: false, alt: false, shift: true, meta: true, key: '7' })
  })

  test.each([null, undefined, '', 'H', 'Ctrl', 'Ctrl+Shift', 'Ctrl+Ctrl+H', 'Ctrl+Hyper+H', 'Ctrl+Shift+F5', 'Ctrl+Shift+Enter', 'Ctrl+Shift+HH', 'Shift+Ctrl'])(
    'refuses %p',
    (raw) => {
      expect(parseShortcut(raw as string)).toBeNull()
    },
  )

  test('round-trips through the canonical spelling', () => {
    const s = parseShortcut('shift+alt+ctrl+q')!
    expect(formatShortcut(s)).toBe('Ctrl+Alt+Shift+Q')
    expect(parseShortcut(formatShortcut(s))).toEqual(s)
  })
})

describe('matching key events', () => {
  const s = parseShortcut(DEFAULT_SHORTCUT)

  test('Ctrl+Shift+H matches by physical key', () => {
    expect(matchesShortcut(ev({ ctrlKey: true, shiftKey: true, code: 'KeyH', key: 'H' }), s)).toBe(true)
  })

  test('extra or missing modifiers do not match', () => {
    expect(matchesShortcut(ev({ ctrlKey: true, code: 'KeyH' }), s)).toBe(false)
    expect(matchesShortcut(ev({ ctrlKey: true, shiftKey: true, altKey: true, code: 'KeyH' }), s)).toBe(false)
    expect(matchesShortcut(ev({ ctrlKey: true, shiftKey: true, metaKey: true, code: 'KeyH' }), s)).toBe(false)
    expect(matchesShortcut(ev({ shiftKey: true, code: 'KeyH' }), s)).toBe(false)
  })

  test('another key does not match; a held key does not repeat', () => {
    expect(matchesShortcut(ev({ ctrlKey: true, shiftKey: true, code: 'KeyJ' }), s)).toBe(false)
    expect(matchesShortcut(ev({ ctrlKey: true, shiftKey: true, code: 'KeyH', repeat: true }), s)).toBe(false)
    expect(matchesShortcut(ev({ ctrlKey: true, shiftKey: true, code: 'KeyH' }), null)).toBe(false)
  })

  test('Option on a Mac changes event.key; the code still names the key', () => {
    expect(keyOfEvent({ code: 'KeyH', key: '˙' })).toBe('H')
    expect(keyOfEvent({ code: 'Digit4', key: '¢' })).toBe('4')
    expect(keyOfEvent({ key: 'h' })).toBe('H')
    expect(keyOfEvent({ code: 'ShiftLeft', key: 'Shift' })).toBeNull()
  })

  test('shortcutFromEvent records what was pressed', () => {
    expect(shortcutFromEvent(ev({ ctrlKey: true, altKey: true, code: 'KeyM' }))).toEqual({ ctrl: true, alt: true, shift: false, meta: false, key: 'M' })
    expect(shortcutFromEvent(ev({ ctrlKey: true, key: 'Control', code: 'ControlLeft' }))).toBeNull()
  })
})

describe('shortcutProblem: browser-reserved and weak combinations', () => {
  test('the default is allowed', () => {
    expect(shortcutProblem(parseShortcut(DEFAULT_SHORTCUT))).toBeNull()
  })

  test.each(['Ctrl+Alt+K', 'Ctrl+Shift+L', 'Meta+Alt+K', 'Ctrl+Alt+Shift+9', 'Meta+Shift+H'])('allows %p', (raw) => {
    expect(shortcutProblem(parseShortcut(raw))).toBeNull()
  })

  test.each([
    'Ctrl+Shift+T', 'Ctrl+Shift+N', 'Ctrl+Shift+W', 'Ctrl+Shift+I', 'Ctrl+Shift+J', 'Ctrl+Shift+C', 'Ctrl+Shift+R', 'Ctrl+Shift+B',
    'Meta+Shift+T', 'Meta+Shift+N', 'Meta+Shift+3', 'Meta+Shift+4', 'Meta+Alt+I', 'Ctrl+Alt+T', 'Ctrl+Alt+L',
  ])('refuses the reserved %p', (raw) => {
    expect(shortcutProblem(parseShortcut(raw))).toContain('already uses')
  })

  test('one modifier is too weak, Shift alone is not a modifier for this', () => {
    expect(shortcutProblem({ ctrl: true, alt: false, shift: false, meta: false, key: 'M' })).toContain('two modifier')
    expect(shortcutProblem({ ctrl: false, alt: false, shift: true, meta: false, key: 'M' })).toContain('Ctrl, Alt or Cmd')
    expect(shortcutProblem(null)).toContain('Press')
  })

  test('effectiveShortcut falls back to the default for a missing or unusable saved value', () => {
    expect(formatShortcut(effectiveShortcut(null))).toBe(DEFAULT_SHORTCUT)
    expect(formatShortcut(effectiveShortcut('nonsense'))).toBe(DEFAULT_SHORTCUT)
    expect(formatShortcut(effectiveShortcut('Ctrl+Shift+T'))).toBe(DEFAULT_SHORTCUT)
    expect(formatShortcut(effectiveShortcut('Ctrl+Alt+K'))).toBe('Ctrl+Alt+K')
  })

  test('labels say Cmd and Option on a Mac', () => {
    expect(shortcutLabel(parseShortcut('Meta+Alt+K')!, true)).toBe('Option+Cmd+K')
    expect(shortcutLabel(parseShortcut('Meta+Alt+K')!, false)).toBe('Alt+Meta+K')
  })
})
