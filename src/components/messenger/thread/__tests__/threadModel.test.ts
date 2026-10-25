import { describe, expect, test } from 'bun:test'

import { decodeMessageExtras } from '@/lib/chat/contract'
import {
  bubbleKind,
  callLogText,
  isBareBubble,
  lastOwnMessageId,
  messageActions,
  prependOlder,
  quoteLabel,
  searchThread,
  shouldBlurMedia,
  type DisplayMessage,
} from '../threadModel'

const ME = 'me'
const msg = (over: Partial<DisplayMessage> & { raw?: Record<string, unknown> } = {}): DisplayMessage => {
  const { raw, ...rest } = over
  return { id: 'm1', senderId: 'u2', text: 'hi', time: '', ts: '2026-10-18T10:00:00Z', type: 'text', extras: decodeMessageExtras(raw ?? {}), ...rest }
}

describe('message menu', () => {
  test("mine text: Reply, Copy, Forward, Edit, Delete for me, Unsend", () => {
    expect(messageActions(msg({ senderId: ME }), ME)).toEqual(['reply', 'copy', 'forward', 'edit', 'deleteForMe', 'unsend'])
  })
  test("theirs: no Edit/Unsend, has Report", () => {
    expect(messageActions(msg(), ME)).toEqual(['reply', 'copy', 'forward', 'deleteForMe', 'report'])
  })
  test('my photo: no Copy, no Edit', () => {
    expect(messageActions(msg({ senderId: ME, type: 'media', mediaId: 'x', text: '' }), ME)).toEqual(['reply', 'forward', 'deleteForMe', 'unsend'])
  })
  test('deleted or still sending: no menu', () => {
    expect(messageActions(msg({ isDeleted: true }), ME)).toEqual([])
    expect(messageActions(msg({ id: 'opt-1', senderId: ME }), ME)).toEqual([])
  })
})

describe('sensitive media', () => {
  const sensitive = msg({ raw: { media: { kind: 'image', sensitive: true } } })
  const clean = msg({ raw: { media: { kind: 'image', sensitive: false } } })
  test('always blurred inside a request, whatever the setting', () => {
    expect(shouldBlurMedia(clean, ME, { filterOn: false, isRequestThread: true })).toBe(true)
  })
  test('outside requests only when the filter is on and the server said sensitive', () => {
    expect(shouldBlurMedia(sensitive, ME, { filterOn: true, isRequestThread: false })).toBe(true)
    expect(shouldBlurMedia(sensitive, ME, { filterOn: false, isRequestThread: false })).toBe(false)
    expect(shouldBlurMedia(clean, ME, { filterOn: true, isRequestThread: false })).toBe(false)
    expect(shouldBlurMedia(msg({ raw: { media: { kind: 'image' } } }), ME, { filterOn: true, isRequestThread: false })).toBe(false)
  })
  test('never my own', () => {
    expect(shouldBlurMedia({ ...sensitive, senderId: ME }, ME, { filterOn: true, isRequestThread: true })).toBe(false)
  })
})

describe('bubble kinds', () => {
  test('every type', () => {
    expect(bubbleKind(msg({ isDeleted: true }))).toBe('deleted')
    expect(bubbleKind(msg({ type: 'voice', mediaId: 'a', raw: { type: 'voice', voice: { duration_ms: 3 } } }))).toBe('voice')
    expect(bubbleKind(msg({ type: 'voice', raw: { voice: { duration_ms: 3 } } }))).toBe('attachment')
    expect(bubbleKind(msg({ type: 'sticker', raw: { sticker: { id: 's', url: '/s' } } }))).toBe('sticker')
    expect(bubbleKind(msg({ type: 'sticker' }))).toBe('text')
    expect(bubbleKind(msg({ type: 'gif', raw: { gif: { id: 'g', url: '/g' } } }))).toBe('gif')
    expect(bubbleKind(msg({ type: 'post', postId: 'p' }))).toBe('post')
    expect(bubbleKind(msg({ type: 'profile', raw: { profile_user_id: 'u' } }))).toBe('profile')
    expect(bubbleKind(msg({ type: 'sound', raw: { sound_id: 's' } }))).toBe('sound')
    expect(bubbleKind(msg({ type: 'live', raw: { stream_id: 's' } }))).toBe('live')
    expect(bubbleKind(msg({ type: 'call', raw: { call: { kind: 'video', outcome: 'missed' } } }))).toBe('call')
    expect(bubbleKind(msg({ type: 'media', mediaId: 'x', raw: { media: { kind: 'video' } } }))).toBe('video')
    expect(bubbleKind(msg({ type: 'media', mediaId: 'x' }), 'image')).toBe('image')
    expect(bubbleKind(msg({ type: 'media', mediaId: 'x' }))).toBe('attachment')
    expect(bubbleKind(msg())).toBe('text')
  })
  test('bare bubbles', () => {
    expect(isBareBubble('sticker')).toBe(true)
    expect(isBareBubble('voice')).toBe(false)
    expect(isBareBubble('text')).toBe(false)
  })
  test('call log wording', () => {
    expect(callLogText({ kind: 'video', outcome: 'missed', durationMs: null }, false)).toBe('Missed video call')
    expect(callLogText({ kind: 'video', outcome: 'missed', durationMs: null }, true)).toBe('Video call · No answer')
    expect(callLogText({ kind: 'audio', outcome: 'ended', durationMs: 185_000 }, true)).toBe('Voice call · 3:05')
    expect(callLogText({ kind: 'audio', outcome: 'declined', durationMs: null }, true)).toBe('Voice call · Declined')
  })
  test('a reply to a Note says so', () => {
    expect(quoteLabel(msg({ raw: { reply_kind: 'note' } }), 'Asha')).toBe("Replied to Asha's note")
    expect(quoteLabel(msg(), 'Asha')).toBe('Asha')
  })
})

describe('history', () => {
  test('older page prepends oldest-first and drops overlap', () => {
    const cur = [msg({ id: 'c' }), msg({ id: 'd' })]
    const older = [msg({ id: 'c' }), msg({ id: 'b' }), msg({ id: 'a' })]
    expect(prependOlder(cur, older).map((m) => m.id)).toEqual(['a', 'b', 'c', 'd'])
  })
  test('last own message ignores deleted and optimistic', () => {
    const list = [msg({ id: 'a', senderId: ME }), msg({ id: 'b', senderId: ME, isDeleted: true }), msg({ id: 'opt-1', senderId: ME }), msg({ id: 'c' })]
    expect(lastOwnMessageId(list, ME)).toBe('a')
    expect(lastOwnMessageId([msg()], ME)).toBeNull()
  })
  test('search in chat: two characters, text only, case-insensitive', () => {
    const list = [msg({ id: 'a', text: 'Cricket at 6' }), msg({ id: 'b', text: 'no' }), msg({ id: 'c', text: 'cricket?', isDeleted: true })]
    expect(searchThread(list, 'CRICK')).toEqual(['a'])
    expect(searchThread(list, 'c')).toEqual([])
  })
})
