/*
  Chat parity fix pass 2 (18 Oct): mark unread, conversation report, the
  requests `sender` block, Giphy stickers (gif.is_sticker), alert tones.
  Shapes are the ones FIXES.md pins; the server lanes ship in parallel.
*/

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { decodeInboxRow, decodeMessageExtras, decodeRequestSender, DELETED_ACCOUNT_LABEL } from '../contract'
import { markedUnreadPatch, readToggleAction, READ_PATCH, rowName, unreadIndicator } from '../inbox'
import { gifPayloadFromGiphy, gifWireBody } from '../giphy'
import {
  AlertPrefsCache,
  alertSoundFor,
  alertToneSrc,
  claimAlert,
  isMutedNow,
  primeAlertPrefs,
  type AlertContext,
  type ClaimStore,
} from '../alertTone'
import { reportConversation, sendGifMessage, setConversationUnread } from '@/services/chatParityApi'

const ME = 'me-1'

/* ------------------------------------------------------------------ */
/*  Requests: sender block                                             */
/* ------------------------------------------------------------------ */

describe('requests sender block', () => {
  const request = (sender: unknown) => ({ id: 'r1', type: 'direct', is_request: true, created_by: 'u9', sender })

  test('a live sender names the row and becomes the peer', () => {
    const row = decodeInboxRow(request({ user_id: 'u9', display_name: 'Neha', username: 'neha', avatar_url: 'https://cdn/x.webp', deleted: false }), ME)!
    expect(row.peer).toMatchObject({ userId: 'u9', displayName: 'Neha', username: 'neha', avatarUrl: 'https://cdn/x.webp' })
    expect(row.peerDeleted).toBe(false)
    expect(rowName(row, ME)).toBe('Neha')
  })

  test('no display name: @username', () => {
    const row = decodeInboxRow(request({ user_id: 'u9', display_name: '', username: 'neha', deleted: false }), ME)!
    expect(rowName(row, ME)).toBe('@neha')
  })

  test('a deleted account says so, with no handle or photo', () => {
    const row = decodeInboxRow(request({ user_id: 'u9', display_name: '', username: 'gone', avatar_url: 'https://cdn/old.webp', deleted: true }), ME)!
    expect(row.peerDeleted).toBe(true)
    expect(rowName(row, ME)).toBe(DELETED_ACCOUNT_LABEL)
    expect(row.peer?.username).toBeNull()
    expect(row.peer?.avatarUrl).toBeNull()
    // The thread can still open on the id.
    expect(row.peer?.userId).toBe('u9')
  })

  test('deleted wins over a members-derived name', () => {
    const row = decodeInboxRow(
      { ...request({ user_id: 'u9', display_name: '', deleted: true }), members: [{ user_id: 'u9', display_name: 'Old Name' }, { user_id: ME }] },
      ME,
    )!
    expect(rowName(row, ME)).toBe(DELETED_ACCOUNT_LABEL)
  })

  test('a peer block next to a deleted sender loses its name, handle and photo', () => {
    const row = decodeInboxRow({ ...request({ user_id: 'u9', display_name: '', deleted: true }), peer: { user_id: 'u9', display_name: 'Old', username: 'old', avatar_url: 'https://cdn/o.webp', is_online: true } }, ME)!
    expect(row.peer).toMatchObject({ userId: 'u9', displayName: DELETED_ACCOUNT_LABEL, username: null, avatarUrl: null, isOnline: null })
  })

  test('rowName honours peerDeleted on its own', () => {
    const row = decodeInboxRow({ id: 'r3', type: 'direct', peer: { user_id: 'u9', display_name: 'Kept' } }, ME)!
    expect(rowName({ ...row, peerDeleted: true }, ME)).toBe(DELETED_ACCOUNT_LABEL)
  })

  test('never the word "Conversation"', () => {
    const bare = decodeInboxRow({ id: 'r2', type: 'direct', is_request: true }, ME)!
    expect(rowName(bare, ME)).not.toBe('Conversation')
    expect(rowName(bare, ME)).toBe('Someone')
    expect(decodeRequestSender({ user_id: 'u1', display_name: '', username: '' })?.label).toBe('Someone')
  })

  test('decodeRequestSender: absent or unidentifiable is null; deleted with no id still labels', () => {
    expect(decodeRequestSender(undefined)).toBeNull()
    expect(decodeRequestSender({ display_name: 'x' })).toBeNull()
    expect(decodeRequestSender({ deleted: true, display_name: '' })).toEqual({ peer: null, deleted: true, label: DELETED_ACCOUNT_LABEL })
  })
})

/* ------------------------------------------------------------------ */
/*  Mark unread                                                        */
/* ------------------------------------------------------------------ */

describe('marked_unread', () => {
  test('decoded, and counts as at least one unread', () => {
    const row = decodeInboxRow({ id: 'c1', type: 'direct', marked_unread: true, unread_count: 0, has_unread: false }, ME)!
    expect(row.markedUnread).toBe(true)
    expect(row.unreadCount).toBe(1)
    const plain = decodeInboxRow({ id: 'c2', type: 'direct', unread_count: 0 }, ME)!
    expect(plain.markedUnread).toBe(false)
    expect(plain.unreadCount).toBe(0)
  })

  test('a real count is kept when also marked', () => {
    expect(decodeInboxRow({ id: 'c1', type: 'direct', marked_unread: true, unread_count: 7 }, ME)!.unreadCount).toBe(7)
  })

  test('indicator: dot for a bare mark, count otherwise, nothing when read', () => {
    expect(unreadIndicator({ unreadCount: 1, markedUnread: true })).toEqual({ kind: 'dot' })
    expect(unreadIndicator({ unreadCount: 4, markedUnread: true })).toEqual({ kind: 'count', text: '4' })
    expect(unreadIndicator({ unreadCount: 120, markedUnread: false })).toEqual({ kind: 'count', text: '99+' })
    expect(unreadIndicator({ unreadCount: 0, markedUnread: false })).toBeNull()
  })

  test('menu toggles between Mark as read and Mark as unread', () => {
    expect(readToggleAction({ unreadCount: 0, markedUnread: false })).toBe('unread')
    expect(readToggleAction({ unreadCount: 2, markedUnread: false })).toBe('read')
    expect(readToggleAction({ unreadCount: 0, markedUnread: true })).toBe('read')
  })

  test('patches', () => {
    expect(markedUnreadPatch({ unreadCount: 0 })).toEqual({ unreadCount: 1, markedUnread: true })
    expect(markedUnreadPatch({ unreadCount: 5 })).toEqual({ unreadCount: 5, markedUnread: true })
    expect(READ_PATCH).toEqual({ unreadCount: 0, markedUnread: false })
  })
})

/* ------------------------------------------------------------------ */
/*  Giphy stickers                                                     */
/* ------------------------------------------------------------------ */

describe('Giphy stickers (gif.is_sticker)', () => {
  const sdk = { id: 'st1', images: { fixed_width: { url: 'https://media1.giphy.com/media/st1/200w.webp?cid=1', width: 200, height: 200 } } }

  test('a pick from the Stickers tab is a sticker; a GIF pick is not', () => {
    expect(gifPayloadFromGiphy(sdk, 'stickers')?.is_sticker).toBe(true)
    expect(gifPayloadFromGiphy(sdk, 'gifs')?.is_sticker).toBeUndefined()
    expect(gifPayloadFromGiphy(sdk)?.is_sticker).toBeUndefined()
  })

  test('the SDK flag alone also makes it a sticker', () => {
    expect(gifPayloadFromGiphy({ ...sdk, is_sticker: true })?.is_sticker).toBe(true)
  })

  test('wire body: is_sticker only when true; URL untouched', () => {
    const sticker = gifWireBody(gifPayloadFromGiphy(sdk, 'stickers')!)
    expect(sticker).toEqual({ provider: 'giphy', id: 'st1', url: 'https://media1.giphy.com/media/st1/200w.webp?cid=1', width: 200, height: 200, still_url: null, is_sticker: true })
    expect('is_sticker' in gifWireBody(gifPayloadFromGiphy(sdk, 'gifs')!)).toBe(false)
  })

  test('received: is_sticker decodes; absent or non-true is a plain GIF', () => {
    const gif = { provider: 'giphy', id: 'st1', url: 'https://media1.giphy.com/x.gif', width: 200, height: 200 }
    expect(decodeMessageExtras({ type: 'gif', gif: { ...gif, is_sticker: true } }).gif?.isSticker).toBe(true)
    expect(decodeMessageExtras({ type: 'gif', gif }).gif?.isSticker).toBe(false)
    expect(decodeMessageExtras({ type: 'gif', gif: { ...gif, is_sticker: 'true' } }).gif?.isSticker).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/*  Alert tones                                                        */
/* ------------------------------------------------------------------ */

describe('alert tones', () => {
  test('tone → file; silent is none; default (and unknown) is the pop', () => {
    expect(alertToneSrc('chime')).toBe('/sounds/msg_tone_chime.wav')
    expect(alertToneSrc('pop')).toBe('/sounds/msg_tone_pop.wav')
    expect(alertToneSrc('bell')).toBe('/sounds/msg_tone_bell.wav')
    expect(alertToneSrc('silent')).toBeNull()
    expect(alertToneSrc('default')).toBe('/sounds/msg_tone_pop.wav')
    expect(alertToneSrc('trumpet')).toBe('/sounds/msg_tone_pop.wav')
    expect(alertToneSrc(null)).toBe('/sounds/msg_tone_pop.wav')
  })

  const base: AlertContext = { myId: ME, soundEnabled: true, chatOnScreen: false, pageVisible: true, isDating: false, prefs: { tone: 'bell', muted: false } }
  const msg = { senderId: 'u2', conversationId: 'c1' }

  test('a chat not on screen plays its own tone', () => {
    expect(alertSoundFor(msg, base)).toBe('/sounds/msg_tone_bell.wav')
  })

  test('nothing: my own message, sound off, silent, muted, dating, chat on screen', () => {
    expect(alertSoundFor({ ...msg, senderId: ME }, base)).toBeNull()
    expect(alertSoundFor(msg, { ...base, soundEnabled: false })).toBeNull()
    expect(alertSoundFor(msg, { ...base, prefs: { tone: 'silent', muted: false } })).toBeNull()
    expect(alertSoundFor(msg, { ...base, prefs: { tone: 'chime', muted: true } })).toBeNull()
    expect(alertSoundFor(msg, { ...base, isDating: true })).toBeNull()
    expect(alertSoundFor(msg, { ...base, chatOnScreen: true })).toBeNull()
  })

  test('the open chat in a hidden tab still rings', () => {
    expect(alertSoundFor(msg, { ...base, chatOnScreen: true, pageVisible: false })).toBe('/sounds/msg_tone_bell.wav')
  })

  test('unknown prefs play the default; an expired mute rings again', () => {
    expect(alertSoundFor(msg, { ...base, prefs: undefined })).toBe('/sounds/msg_tone_pop.wav')
    const now = Date.parse('2026-10-18T12:00:00Z')
    expect(alertSoundFor(msg, { ...base, now, prefs: { tone: 'chime', muted: true, muteUntil: '2026-10-18T11:00:00Z' } })).toBe('/sounds/msg_tone_chime.wav')
    expect(alertSoundFor(msg, { ...base, now, prefs: { tone: 'chime', muted: true, muteUntil: '2026-10-18T13:00:00Z' } })).toBeNull()
    expect(isMutedNow({ muted: true, muteUntil: null }, now)).toBe(true)
  })

  test('cache: set, patch, TTL', () => {
    let t = 0
    const c = new AlertPrefsCache(() => t)
    c.set('c1', { tone: 'chime', muted: false })
    c.patch('c1', { muted: true })
    expect(c.get('c1')).toEqual({ tone: 'chime', muted: true })
    c.patch('c2', { tone: 'bell' })
    expect(c.get('c2')).toEqual({ tone: 'bell', muted: false })
    t = 5 * 60_000 + 1
    expect(c.get('c1')).toBeUndefined()
  })

  test('prime from server rows; a row without alert_tone is skipped', () => {
    const c = new AlertPrefsCache(() => 0)
    c.set('c3', { tone: 'bell', muted: false })
    primeAlertPrefs([
      { id: 'c1', alert_tone: 'chime', is_muted: true, mute_until: '2027-01-01T00:00:00Z' },
      { conversation_id: 'c2', alert_tone: 'nonsense' },
      { id: 'c3', alert_tone: '' },
      null,
    ], c)
    expect(c.get('c1')).toEqual({ tone: 'chime', muted: true, muteUntil: '2027-01-01T00:00:00Z' })
    expect(c.get('c2')).toEqual({ tone: 'default', muted: false, muteUntil: null })
    expect(c.get('c3')).toEqual({ tone: 'bell', muted: false })
  })

  test('one tab plays each message', () => {
    const mem = new Map<string, string>()
    const store: ClaimStore = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) }
    expect(claimAlert('m1', store)).toBe(true)
    expect(claimAlert('m1', store)).toBe(false)
    expect(claimAlert('m2', store)).toBe(true)
    // No storage (private mode) or broken storage: this tab plays.
    expect(claimAlert('m1', null)).toBe(true)
    expect(claimAlert('m3', { getItem: () => '{bad', setItem: () => undefined })).toBe(true)
  })

  test('the claim ring stays short', () => {
    const mem = new Map<string, string>()
    const store: ClaimStore = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) }
    for (let i = 0; i < 80; i++) claimAlert(`m${i}`, store)
    expect((JSON.parse(mem.get('chat_alert_played')!) as string[]).length).toBe(50)
  })
})

/* ------------------------------------------------------------------ */
/*  Wire: the new routes                                               */
/* ------------------------------------------------------------------ */

describe('wire', () => {
  const calls: { url: string; method: string; body: unknown }[] = []
  let status = 204
  const realFetch = globalThis.fetch

  // Another suite may leave a bare `window` behind with no storage; the client reads the session from it.
  const g = globalThis as { localStorage?: unknown }
  let addedStorage = false

  beforeEach(() => {
    if (typeof window !== 'undefined' && g.localStorage === undefined) {
      const mem = new Map<string, string>()
      g.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) }
      addedStorage = true
    }
    calls.length = 0
    status = 204
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      // The token helper may refresh first; only chat calls are recorded.
      if (!String(url).startsWith('/api/chat/')) return new Response(JSON.stringify({}), { status: 401, headers: { 'content-type': 'application/json' } })
      calls.push({ url: String(url), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined })
      if (status === 204) return new Response(null, { status: 204 })
      return new Response(JSON.stringify({ error: { message: 'x' } }), { status, headers: { 'content-type': 'application/json' } })
    }) as unknown as typeof fetch
  })
  afterEach(() => {
    if (addedStorage) {
      delete g.localStorage
      addedStorage = false
    }
    globalThis.fetch = realFetch
  })

  test('mark unread: PUT /conversations/:id/unread {unread}', async () => {
    expect(await setConversationUnread('c 1', true)).toBe(true)
    expect(await setConversationUnread('c1', false)).toBe(true)
    expect(calls).toEqual([
      { url: '/api/chat/conversations/c%201/unread', method: 'PUT', body: { unread: true } },
      { url: '/api/chat/conversations/c1/unread', method: 'PUT', body: { unread: false } },
    ])
  })

  test('mark unread: a missing route is null, other errors throw', async () => {
    status = 404
    expect(await setConversationUnread('c1', true)).toBeNull()
    status = 500
    await expect(setConversationUnread('c1', true)).rejects.toThrow()
  })

  test('report: POST /conversations/:id/report {reason, note?}', async () => {
    expect(await reportConversation('c1', 'scam', '  sent a fake link ')).toBe(true)
    expect(await reportConversation('c1', 'spam', '   ')).toBe(true)
    expect(calls).toEqual([
      { url: '/api/chat/conversations/c1/report', method: 'POST', body: { reason: 'scam', note: 'sent a fake link' } },
      { url: '/api/chat/conversations/c1/report', method: 'POST', body: { reason: 'spam' } },
    ])
    status = 404
    expect(await reportConversation('c1', 'spam')).toBeNull()
  })

  test('a Giphy sticker is sent as type gif with is_sticker', async () => {
    status = 204
    await sendGifMessage('c1', { provider: 'giphy', id: 'st1', url: 'https://media1.giphy.com/a.webp?cid=1', width: 200, height: 200, still_url: null, is_sticker: true })
    expect(calls[0]).toEqual({
      url: '/api/chat/conversations/c1/messages',
      method: 'POST',
      body: { type: 'gif', gif: { provider: 'giphy', id: 'st1', url: 'https://media1.giphy.com/a.webp?cid=1', width: 200, height: 200, still_url: null, is_sticker: true } },
    })
  })
})
