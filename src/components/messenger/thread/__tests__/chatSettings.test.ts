import { describe, expect, test } from 'bun:test'

import { ALERT_TONES, type ConversationPrefs } from '@/lib/chat/contract'

import {
  ALERT_TONE_LABELS,
  PREF_SWITCHES,
  alertTonePatch,
  applyPrefSwitch,
  prefSwitchPatch,
  profileHref,
  sharedMediaSrc,
  sharedTabsVisible,
} from '../chatSettings'

const base: ConversationPrefs = { isMuted: false, muteUntil: null, muteCalls: false, isPinned: false, label: null, alertTone: 'default' }

describe('prefSwitchPatch', () => {
  test('each switch sends only its own wire field', () => {
    expect(prefSwitchPatch('isMuted', true)).toEqual({ is_muted: true })
    expect(prefSwitchPatch('isMuted', false)).toEqual({ is_muted: false })
    expect(prefSwitchPatch('muteCalls', true)).toEqual({ mute_calls: true })
    expect(prefSwitchPatch('isPinned', false)).toEqual({ is_pinned: false })
  })

  test('no switch touches another switch', () => {
    for (const key of PREF_SWITCHES) {
      expect(Object.keys(prefSwitchPatch(key, true))).toHaveLength(1)
    }
  })
})

describe('applyPrefSwitch', () => {
  test('flips only the one value, without mutating the old prefs', () => {
    const next = applyPrefSwitch(base, 'muteCalls', true)
    expect(next).toEqual({ ...base, muteCalls: true })
    expect(base.muteCalls).toBe(false)
  })
})

describe('alert tone', () => {
  test('every tone has our label and its own patch', () => {
    expect(ALERT_TONES.map((t) => ALERT_TONE_LABELS[t])).toEqual(['Default', 'Chime', 'Pop', 'Bell', 'Silent'])
    expect(alertTonePatch('bell')).toEqual({ alert_tone: 'bell' })
  })
})

describe('profileHref', () => {
  test('the handle when known, else the id', () => {
    expect(profileHref({ userId: 'u1', username: 'ada' })).toBe('/u/ada')
    expect(profileHref({ userId: 'u1', username: null })).toBe('/u/u1')
    expect(profileHref({ userId: 'u1', username: '' })).toBe('/u/u1')
  })
})

describe('sharedMediaSrc', () => {
  test('photos and videos serve through media-service; audio has no picture', () => {
    expect(sharedMediaSrc({ mediaId: 'm1', kind: 'image' })).toBe('/v1/media/m1/serve')
    expect(sharedMediaSrc({ mediaId: 'm2', kind: 'video' })).toBe('/v1/media/m2/serve')
    expect(sharedMediaSrc({ mediaId: 'm3', kind: null })).toBe('/v1/media/m3/serve')
    expect(sharedMediaSrc({ mediaId: 'm4', kind: 'audio' })).toBeNull()
  })
})

describe('sharedTabsVisible', () => {
  test('hidden while loading and when both routes are missing', () => {
    expect(sharedTabsVisible(undefined, undefined)).toBe(false)
    expect(sharedTabsVisible(null, null)).toBe(false)
    expect(sharedTabsVisible(null, undefined)).toBe(false)
  })

  test('shown as soon as one route answers, even empty', () => {
    expect(sharedTabsVisible([], null)).toBe(true)
    expect(sharedTabsVisible(null, [])).toBe(true)
    expect(sharedTabsVisible(undefined, [1])).toBe(true)
  })
})
