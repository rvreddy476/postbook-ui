/*
  The two realtime frames message-service sends for the shared disappearing
  timer and for pins, and what the web does with them:
    disappearing_timer_updated {conversation_id, disappear_after_ms, updated_by, updated_at}
    pin_update {conversation_id, action: "pinned"|"unpinned", pin_id, message_id, by, at}
  plus messages' expires_at and the 403 a plain group member gets.
*/

import { describe, expect, test } from 'bun:test'

import { decodeDisappearingTimerFrame, decodeInboxRow, decodePinUpdateFrame } from '../contract'
import { withDisappearTimer } from '../inbox'
import { disappearingTimerEventFromFrame, normalizeChatMessage, pinUpdateEventFromFrame, type PinnedMessage } from '@/services/messageService'
import { applyPinUpdate, dropExpired, isExpiryDelete, nextExpiryDelay, toDisplay } from '@/components/messenger/thread/threadModel'
import { SAVE_FAILED, TIMER_ADMINS_ONLY, disappearPatch, prefSaveError } from '@/components/messenger/thread/chatSettings'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-10-20T10:00:00Z')

describe('disappearing_timer_updated frame', () => {
  const frame = { type: 'disappearing_timer_updated', payload: { conversation_id: 'c1', disappear_after_ms: DAY, updated_by: 'u1', updated_at: '2026-10-20T10:00:00Z' } }

  test('decodes the payload', () => {
    expect(decodeDisappearingTimerFrame(frame)).toEqual({ conversationId: 'c1', disappearAfterMs: DAY, updatedBy: 'u1', updatedAt: '2026-10-20T10:00:00Z' })
  })
  test('turned off: 0 or null is null', () => {
    expect(decodeDisappearingTimerFrame({ payload: { conversation_id: 'c1', disappear_after_ms: 0 } })?.disappearAfterMs).toBeNull()
    expect(decodeDisappearingTimerFrame({ payload: { conversation_id: 'c1', disappear_after_ms: null } })?.disappearAfterMs).toBeNull()
  })
  test('without a conversation it is not a frame', () => {
    expect(decodeDisappearingTimerFrame({ payload: { disappear_after_ms: DAY } })).toBeNull()
    expect(decodeDisappearingTimerFrame(null)).toBeNull()
  })
  test('becomes the event the thread, settings and inbox listen to', () => {
    expect(disappearingTimerEventFromFrame(frame)).toEqual({ conversation_id: 'c1', disappear_after_ms: DAY, updated_by: 'u1', updated_at: '2026-10-20T10:00:00Z' })
    expect(disappearingTimerEventFromFrame({ type: 'disappearing_timer_updated', payload: {} })).toBeNull()
  })
})

describe('inbox rows carry the shared timer', () => {
  const row = (id: string, ms: number | null) => ({ ...decodeInboxRow({ id, type: 'direct', disappear_after_ms: ms }, 'me')! })

  test('decoded from the row', () => {
    expect(row('c1', DAY).disappearAfterMs).toBe(DAY)
    expect(row('c1', null).disappearAfterMs).toBeNull()
  })
  test('a frame patches only its conversation', () => {
    const rows = [row('c1', null), row('c2', null)]
    const next = withDisappearTimer(rows, 'c1', 7 * DAY)
    expect(next.map((r) => r.disappearAfterMs)).toEqual([7 * DAY, null])
    expect(next.map((r) => r.id)).toEqual(['c1', 'c2'])
  })
  test('nothing changes: the same array back', () => {
    const rows = [row('c1', DAY)]
    expect(withDisappearTimer(rows, 'c1', DAY)).toBe(rows)
    expect(withDisappearTimer(rows, 'other', null)).toBe(rows)
  })
})

describe('pin_update frame', () => {
  const pinned = { type: 'pin_update', payload: { conversation_id: 'c1', action: 'pinned', pin_id: 'p2', message_id: 'm2', by: 'u9', at: '2026-10-20T10:00:00Z' } }
  const unpinned = { type: 'pin_update', payload: { conversation_id: 'c1', action: 'unpinned', pin_id: 'p1', message_id: 'm1', by: 'u9', at: '2026-10-20T10:01:00Z' } }

  test('decodes pinned and unpinned', () => {
    expect(decodePinUpdateFrame(pinned)).toEqual({ conversationId: 'c1', action: 'pin', pinId: 'p2', messageId: 'm2', by: 'u9', at: '2026-10-20T10:00:00Z' })
    expect(decodePinUpdateFrame(unpinned)?.action).toBe('unpin')
  })
  test('an unknown action or no conversation is not a pin frame', () => {
    expect(decodePinUpdateFrame({ payload: { conversation_id: 'c1', action: 'moved' } })).toBeNull()
    expect(decodePinUpdateFrame({ payload: { action: 'pinned' } })).toBeNull()
  })
  test('becomes the event with the pin id', () => {
    expect(pinUpdateEventFromFrame(pinned)).toEqual({ conversation_id: 'c1', message_id: 'm2', pinned_by: 'u9', action: 'pin', pin_id: 'p2', at: '2026-10-20T10:00:00Z' })
  })

  const existing: PinnedMessage[] = [{ id: 'p1', conversation_id: 'c1', message_id: 'm1', pinned_by: 'u1', pinned_at: '2026-10-19T00:00:00Z' }]

  test('someone else pins: the new pin goes on top of the bar', () => {
    const next = applyPinUpdate(existing, pinUpdateEventFromFrame(pinned)!)
    expect(next.map((p) => p.id)).toEqual(['p2', 'p1'])
    expect(next[0]).toEqual({ id: 'p2', conversation_id: 'c1', message_id: 'm2', pinned_by: 'u9', pinned_at: '2026-10-20T10:00:00Z' })
  })
  test('my own pin echoed back is not added twice', () => {
    const mine = applyPinUpdate(existing, pinUpdateEventFromFrame(pinned)!)
    expect(applyPinUpdate(mine, pinUpdateEventFromFrame(pinned)!)).toBe(mine)
  })
  test('someone unpins: removed by pin id; an unknown pin changes nothing', () => {
    expect(applyPinUpdate(existing, pinUpdateEventFromFrame(unpinned)!)).toEqual([])
    const other = pinUpdateEventFromFrame({ payload: { ...unpinned.payload, pin_id: 'p-x', message_id: 'm-x' } })!
    expect(applyPinUpdate(existing, other)).toBe(existing)
  })
  test('an unpin without a pin id falls back to the message id', () => {
    const noId = pinUpdateEventFromFrame({ payload: { conversation_id: 'c1', action: 'unpinned', message_id: 'm1' } })!
    expect(applyPinUpdate(existing, noId)).toEqual([])
  })
})

describe('expires_at', () => {
  const at = (iso: string | undefined) => toDisplay(normalizeChatMessage({ msg_id: 'm', sender_id: 'u', conversation_id: 'c', ts: '2026-10-20T09:00:00Z', created_at: '2026-10-20T09:00:00Z', expires_at: iso }))

  test('carried from the wire onto the bubble', () => {
    expect(at('2026-10-21T09:00:00Z').expiresAt).toBe('2026-10-21T09:00:00Z')
    expect(at(undefined).expiresAt).toBeUndefined()
  })
  test('a bubble past expires_at is dropped; the rest stay', () => {
    const list = [{ id: 'a', expiresAt: '2026-10-20T09:59:59Z' }, { id: 'b', expiresAt: '2026-10-20T10:00:01Z' }, { id: 'c' }]
    expect(dropExpired(list, NOW).map((m) => m.id)).toEqual(['b', 'c'])
    const fresh = [{ id: 'b', expiresAt: '2026-10-20T11:00:00Z' }]
    expect(dropExpired(fresh, NOW)).toBe(fresh)
  })
  test('the timer waits for the soonest expiry, never negative, none when nothing expires', () => {
    expect(nextExpiryDelay([{ expiresAt: '2026-10-20T10:00:05Z' }, { expiresAt: '2026-10-20T10:00:02Z' }], NOW)).toBe(2000)
    expect(nextExpiryDelay([{ expiresAt: '2026-10-20T09:00:00Z' }], NOW)).toBe(0)
    expect(nextExpiryDelay([{}], NOW)).toBeNull()
  })
  test('a delete frame for a message past its expires_at is an expiry; before it, an unsend', () => {
    expect(isExpiryDelete({ ts: '2026-10-20T09:59:00Z', expiresAt: '2026-10-20T10:00:00Z' }, { disappearAfterMs: null, now: NOW })).toBe(true)
    expect(isExpiryDelete({ ts: '2026-10-19T00:00:00Z', expiresAt: '2026-10-21T00:00:00Z' }, { disappearAfterMs: DAY, now: NOW })).toBe(false)
  })
})

describe('saving the timer as a plain group member', () => {
  test('403 says only owners and admins can change it', () => {
    expect(prefSaveError(disappearPatch(DAY), 403)).toBe(TIMER_ADMINS_ONLY)
  })
  test('other failures, or a 403 on another setting, are the generic line', () => {
    expect(prefSaveError(disappearPatch(DAY), 500)).toBe(SAVE_FAILED)
    expect(prefSaveError({ is_muted: true }, 403)).toBe(SAVE_FAILED)
    expect(prefSaveError(disappearPatch(null), undefined)).toBe(SAVE_FAILED)
  })
})
