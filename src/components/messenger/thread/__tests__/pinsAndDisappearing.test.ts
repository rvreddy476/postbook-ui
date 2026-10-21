import { describe, expect, test } from 'bun:test'

import { decodeConversationPrefs, decodeMessageDeletedFrame, decodeMessageExtras } from '@/lib/chat/contract'
import { DISAPPEAR_OPTIONS, disappearLabel, disappearPatch, disappearingNotice } from '../chatSettings'
import { MESSAGE_ACTION_LABELS, isExpiryDelete, messageActions, nextPinIndex, type DisplayMessage } from '../threadModel'

const ME = 'me'
const DAY = 24 * 60 * 60 * 1000
const msg = (over: Partial<DisplayMessage> = {}): DisplayMessage => ({
  id: 'm1', senderId: 'u2', text: 'hi', time: '', ts: '2026-10-18T10:00:00Z', type: 'text', extras: decodeMessageExtras({}), ...over,
})

describe('pin in the message menu', () => {
  test('offered after Forward when asked for: Pin, or Unpin when it is pinned', () => {
    expect(messageActions(msg(), ME, { pinned: false })).toEqual(['reply', 'copy', 'forward', 'pin', 'deleteForMe', 'report'])
    expect(messageActions(msg({ senderId: ME }), ME, { pinned: true })).toEqual(['reply', 'copy', 'forward', 'unpin', 'edit', 'deleteForMe', 'unsend'])
  })
  test('not offered without the pin state, on system lines or calls, or on deleted messages', () => {
    expect(messageActions(msg(), ME)).not.toContain('pin')
    expect(messageActions(msg({ type: 'system' }), ME, { pinned: false })).not.toContain('pin')
    expect(messageActions(msg({ type: 'call' }), ME, { pinned: false })).not.toContain('pin')
    expect(messageActions(msg({ isDeleted: true }), ME, { pinned: false })).toEqual([])
  })
  test('every action has a label', () => {
    expect(MESSAGE_ACTION_LABELS.pin).toBe('Pin')
    expect(MESSAGE_ACTION_LABELS.unpin).toBe('Unpin')
  })
  test('the pin bar steps through the pins and wraps', () => {
    expect(nextPinIndex(0, 3)).toBe(1)
    expect(nextPinIndex(2, 3)).toBe(0)
    expect(nextPinIndex(0, 1)).toBe(0)
    expect(nextPinIndex(4, 0)).toBe(0)
  })
})

describe('disappearing messages setting', () => {
  test('Off, 24 hours, 7 days, 90 days', () => {
    expect(DISAPPEAR_OPTIONS.map((o) => o.label)).toEqual(['Off', '24 hours', '7 days', '90 days'])
    expect(DISAPPEAR_OPTIONS.map((o) => o.ms)).toEqual([null, DAY, 7 * DAY, 90 * DAY])
  })
  test('the PUT body: disappear_after_ms in ms, and 0 (not null) for Off', () => {
    expect(disappearPatch(DAY)).toEqual({ disappear_after_ms: 86_400_000 })
    expect(disappearPatch(90 * DAY)).toEqual({ disappear_after_ms: 7_776_000_000 })
    expect(disappearPatch(null)).toEqual({ disappear_after_ms: 0 })
  })
  test('reading it back: absent, null and 0 are all off', () => {
    expect(decodeConversationPrefs({ data: { disappear_after_ms: DAY } }).disappearAfterMs).toBe(DAY)
    expect(decodeConversationPrefs({ data: { disappear_after_ms: 0 } }).disappearAfterMs).toBeNull()
    expect(decodeConversationPrefs({ data: { disappear_after_ms: null } }).disappearAfterMs).toBeNull()
    expect(decodeConversationPrefs({ data: {} }).disappearAfterMs).toBeNull()
    expect(decodeConversationPrefs({ data: { disappear_after_ms: '86400000' } }).disappearAfterMs).toBeNull()
  })
  test('labels, including a value that is not one of the choices', () => {
    expect(disappearLabel(DAY)).toBe('24 hours')
    expect(disappearLabel(7 * DAY)).toBe('7 days')
    expect(disappearLabel(null)).toBe('Off')
    expect(disappearLabel(3 * DAY)).toBe('3 days')
    expect(disappearLabel(60 * 60 * 1000)).toBe('1 hour')
    expect(disappearLabel(6 * 60 * 60 * 1000)).toBe('6 hours')
  })
  test('the thread line while it is on', () => {
    expect(disappearingNotice(DAY)).toBe('Disappearing messages are on: 24 hours')
    expect(disappearingNotice(null)).toBeNull()
    expect(disappearingNotice(0)).toBeNull()
  })
})

describe('a server delete that is an expiry', () => {
  const now = Date.parse('2026-10-20T10:00:00Z')
  test('a frame that says "expired" always is', () => {
    expect(isExpiryDelete(undefined, { reason: 'expired', disappearAfterMs: null, now })).toBe(true)
  })
  test('a message older than the window is', () => {
    expect(isExpiryDelete(msg({ ts: '2026-10-19T09:59:00Z' }), { disappearAfterMs: DAY, now })).toBe(true)
  })
  test('a fresh message deleted while it is on was unsent, not expired', () => {
    expect(isExpiryDelete(msg({ ts: '2026-10-20T09:00:00Z' }), { disappearAfterMs: DAY, now })).toBe(false)
  })
  test('with the setting off, or an unknown message, it is an unsend', () => {
    expect(isExpiryDelete(msg({ ts: '2026-01-01T00:00:00Z' }), { disappearAfterMs: null, now })).toBe(false)
    expect(isExpiryDelete(undefined, { disappearAfterMs: DAY, now })).toBe(false)
  })
  test('the frame reason is passed through when present, and left out when not', () => {
    expect(decodeMessageDeletedFrame({ payload: { conversation_id: 'c', message_id: 'm', reason: 'expired' } })).toEqual({ conversationId: 'c', messageId: 'm', reason: 'expired' })
    expect(decodeMessageDeletedFrame({ payload: { conversation_id: 'c', message_id: 'm' } })).toEqual({ conversationId: 'c', messageId: 'm' })
  })
})
