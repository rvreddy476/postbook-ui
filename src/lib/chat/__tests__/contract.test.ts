import { describe, expect, test } from 'bun:test'

import {
  clampWaveform,
  decodeChatSearch,
  decodeConversationPrefs,
  decodeForwardResults,
  decodeInboxPage,
  decodeInboxRow,
  decodeMessageDeletedFrame,
  decodeMessageExtras,
  decodeNotesFeed,
  decodePresenceFrame,
  decodePresenceMap,
  decodeReactionGroups,
  decodeReadSummary,
  decodeSharedMedia,
  decodeSharedPosts,
  decodeStickerPacks,
  decodeStreak,
  graphemeCount,
} from '../contract'

const ME = 'me-1'

describe('inbox rows (CONTRACT §1)', () => {
  const full = {
    id: 'c1',
    type: 'direct',
    is_request: false,
    created_by: 'u2',
    members: [
      { user_id: ME, role: 'member', display_name: 'Me' },
      { user_id: 'u2', role: 'member', display_name: 'Asha', avatar_media_id: 'm2', last_read_at: '2026-10-18T09:00:00Z' },
    ],
    unread_count: 7,
    has_unread: true,
    is_muted: true,
    mute_calls: true,
    is_pinned: true,
    pinned_at: '2026-10-18T08:00:00Z',
    label: 'none',
    alert_tone: 'chime',
    streak: { days: 12, at_risk: true, expires_at: '2026-10-19T00:00:00Z' },
    peer: { user_id: 'u2', display_name: 'Asha K', username: 'asha', avatar_url: '/v1/media/m2/serve', is_online: false, last_active_at: '2026-10-18T09:10:00Z' },
    last_message: { type: 'voice', preview: '', sender_id: ME, at: '2026-10-18T09:05:00Z', own_status: 'read' },
    last_message_at: '2026-10-18T09:05:00Z',
    updated_at: '2026-10-18T09:05:00Z',
  }

  test('every contract field decodes', () => {
    const row = decodeInboxRow(full, ME)!
    expect(row.id).toBe('c1')
    expect(row.isGroup).toBe(false)
    expect(row.unreadCount).toBe(7)
    expect(row.isMuted).toBe(true)
    expect(row.muteCalls).toBe(true)
    expect(row.isPinned).toBe(true)
    expect(row.alertTone).toBe('chime')
    expect(row.streak).toEqual({ days: 12, atRisk: true, expiresAt: '2026-10-19T00:00:00Z' })
    expect(row.peer).toEqual({ userId: 'u2', displayName: 'Asha K', username: 'asha', avatarUrl: '/v1/media/m2/serve', isOnline: false, lastActiveAt: '2026-10-18T09:10:00Z' })
    expect(row.lastMessage).toEqual({ type: 'voice', preview: '', senderId: ME, at: '2026-10-18T09:05:00Z', ownStatus: 'read' })
  })

  test("today's server row (no contract fields) still decodes: flat preview, has_unread, peer from members", () => {
    const row = decodeInboxRow(
      {
        id: 'c2',
        type: 'direct',
        is_request: false,
        members: [{ user_id: ME }, { user_id: 'u3', display_name: 'Ravi', avatar_media_id: 'm3' }],
        last_message_preview: 'hey',
        last_message_at: '2026-10-18T07:00:00Z',
        last_message_sender: 'u3',
        has_unread: true,
        title: '',
        source_app: '',
      },
      ME,
    )!
    expect(row.unreadCount).toBe(1)
    expect(row.peer).toEqual({ userId: 'u3', displayName: 'Ravi', username: null, avatarUrl: '/v1/media/m3/serve', isOnline: null, lastActiveAt: null })
    expect(row.lastMessage).toEqual({ type: 'text', preview: 'hey', senderId: 'u3', at: '2026-10-18T07:00:00Z', ownStatus: null })
    expect(row.title).toBeNull()
    expect(row.sourceApp).toBeNull()
    expect(row.streak).toBeNull()
    expect(row.isMuted).toBe(false)
    expect(row.muteCalls).toBe(false)
  })

  test('a row with nothing but an id is neutral; a row without an id is dropped', () => {
    const row = decodeInboxRow({ id: 'c3' }, ME)!
    expect(row.unreadCount).toBe(0)
    expect(row.peer).toBeNull()
    expect(row.lastMessage).toBeNull()
    expect(decodeInboxRow({ type: 'direct' }, ME)).toBeNull()
    expect(decodeInboxRow(null, ME)).toBeNull()
  })

  test('a group has no peer and no streak even if sent', () => {
    const row = decodeInboxRow({ id: 'g', type: 'group', title: 'Trip', peer: { user_id: 'x' }, streak: { days: 9 } }, ME)!
    expect(row.isGroup).toBe(true)
    expect(row.peer).toBeNull()
    expect(row.streak).toBeNull()
  })

  test('streaks below 3 days are not shown', () => {
    expect(decodeStreak({ days: 2 })).toBeNull()
    expect(decodeStreak({ days: 3 })).toEqual({ days: 3, atRisk: false, expiresAt: null })
    expect(decodeStreak('x')).toBeNull()
  })

  test('page: wrapped, bare and cursor', () => {
    const page = decodeInboxPage({ data: [full, { nope: 1 }], meta: { next_cursor: 'abc' } }, ME)
    expect(page.rows.map((r) => r.id)).toEqual(['c1'])
    expect(page.nextCursor).toBe('abc')
    expect(decodeInboxPage([full], ME).rows).toHaveLength(1)
    expect(decodeInboxPage({ data: null }, ME)).toEqual({ rows: [], nextCursor: null })
  })

  test('unread_count wins over has_unread and is never negative', () => {
    expect(decodeInboxRow({ id: 'a', unread_count: 0, has_unread: true }, ME)!.unreadCount).toBe(0)
    expect(decodeInboxRow({ id: 'a', unread_count: -4 }, ME)!.unreadCount).toBe(0)
  })
})

describe('notes (§5)', () => {
  test('mine and others; bad entries dropped; unknown audience is everyone', () => {
    const feed = decodeNotesFeed({
      data: {
        mine: { id: 'n1', user_id: ME, text: 'hi', audience: 'friends', created_at: 'a', expires_at: 'b' },
        others: [
          { note: { id: 'n2', text: 'gym', audience: 'weird' }, user: { user_id: 'u2', display_name: 'Asha', is_online: true } },
          { note: { id: 'n3', text: '' }, user: { user_id: 'u3' } },
          { note: { id: 'n4', text: 'x' } },
        ],
      },
    })
    expect(feed.mine?.audience).toBe('friends')
    expect(feed.others).toHaveLength(1)
    expect(feed.others[0].note.audience).toBe('everyone')
    expect(feed.others[0].user).toEqual({ userId: 'u2', displayName: 'Asha', avatarUrl: null, isOnline: true })
  })
  test('empty body', () => {
    expect(decodeNotesFeed({})).toEqual({ mine: null, others: [] })
    expect(decodeNotesFeed({ data: { mine: null } })).toEqual({ mine: null, others: [] })
  })
  test('grapheme count counts an emoji with a modifier once', () => {
    expect(graphemeCount('ab')).toBe(2)
    expect(graphemeCount('\u{1F44D}\u{1F3FD}')).toBe(1)
  })
})

describe('search (§6)', () => {
  test('sections decode; me is not a person result; hits without ids drop', () => {
    const r = decodeChatSearch(
      {
        data: {
          people: [{ user_id: 'u2', display_name: 'Asha' }, { user_id: ME }],
          conversations: [{ id: 'c1' }],
          messages: [{ conversation_id: 'c1', message_id: 'm1', snippet: 'see you', sender_id: 'u2', at: 't' }, { conversation_id: 'c1' }],
        },
      },
      ME,
    )
    expect(r.people.map((p) => p.userId)).toEqual(['u2'])
    expect(r.conversations).toHaveLength(1)
    expect(r.messages).toEqual([{ conversationId: 'c1', messageId: 'm1', snippet: 'see you', senderId: 'u2', at: 't' }])
  })
  test('missing sections are empty', () => {
    expect(decodeChatSearch({ data: {} }, ME)).toEqual({ people: [], conversations: [], messages: [] })
  })
})

describe('shared, reactions, read summary, stickers, gifs, forward', () => {
  test('shared posts dedupe by message and need a post id', () => {
    const r = decodeSharedPosts({ data: [{ message_id: 'm1', post_id: 'p1' }, { message_id: 'm1', post_id: 'p1' }, { message_id: 'm2' }], meta: { next_cursor: 'n' } })
    expect(r.items).toEqual([{ messageId: 'm1', postId: 'p1', senderId: null, at: null }])
    expect(r.nextCursor).toBe('n')
  })
  test('shared media keeps kind only when known', () => {
    const r = decodeSharedMedia({ data: { items: [{ message_id: 'm', media_id: 'x', kind: 'video' }, { message_id: 'n', media_id: 'y', kind: 'pdf' }] } })
    expect(r.items.map((i) => i.kind)).toEqual(['video', null])
  })
  test('reaction groups: users decoded, count never below users, sorted', () => {
    const g = decodeReactionGroups({ data: [{ emoji: 'a', count: 1, users: [] }, { emoji: 'b', count: 0, users: [{ user_id: 'u', display_name: 'U' }, { user_id: 'v' }] }, { count: 3 }] })
    expect(g.map((x) => [x.emoji, x.count])).toEqual([['b', 2], ['a', 1]])
  })
  test('read summary', () => {
    expect(decodeReadSummary({ data: { seen_by: [{ user_id: 'u', display_name: 'U', at: 't' }], count: 4 } })).toEqual({ seenBy: [{ userId: 'u', displayName: 'U', avatarUrl: null, at: 't' }], count: 4 })
    expect(decodeReadSummary({})).toEqual({ seenBy: [], count: 0 })
  })
  test('sticker packs: empty catalogue is [], packs without usable stickers drop', () => {
    expect(decodeStickerPacks({ data: { packs: [] } })).toEqual([])
    const packs = decodeStickerPacks({ data: { packs: [{ id: 'p', name: 'Cats', stickers: [{ id: 's', url: '/s.png', width: 100, height: 90 }, { id: 'bad' }] }, { id: 'q', stickers: [] }] } })
    expect(packs).toEqual([{ id: 'p', name: 'Cats', stickers: [{ id: 's', url: '/s.png', width: 100, height: 90 }] }])
  })
  test('forward results follow the requested order; a target not answered is unavailable', () => {
    const r = decodeForwardResults({ data: { results: [{ conversation_id: 'b', outcome: 'blocked' }, { conversation_id: 'a', outcome: 'sent', message_id: 'm' }, { conversation_id: 'z', outcome: 'odd' }] } }, ['a', 'b', 'c'])
    expect(r).toEqual([
      { conversationId: 'a', outcome: 'sent', messageId: 'm' },
      { conversationId: 'b', outcome: 'blocked', messageId: null },
      { conversationId: 'c', outcome: 'unavailable', messageId: null },
    ])
  })
})

describe('message extras (§2.2)', () => {
  test('a plain old message has neutral extras', () => {
    const x = decodeMessageExtras({ msg_id: 'm', type: 'text', text: 'hi' })
    expect(x).toEqual({ forwarded: false, voice: null, sticker: null, gif: null, profileUserId: null, soundId: null, streamId: null, replyKind: null, media: null, call: null, senderDisplayName: null })
  })
  test('voice, sticker, gif, profile, sound, live, forwarded, note reply, media', () => {
    const x = decodeMessageExtras({
      type: 'voice', forwarded: true, voice: { duration_ms: 999999, waveform: [0, 300, -5, 12.6, 'x'] },
      sticker: { id: 's', url: '/s', width: 64, height: 64 },
      gif: { provider: 'giphy', id: 'g', url: 'https://media.giphy.com/g.gif?cid=abc&rid=x', still_url: 'https://media.giphy.com/s.gif?cid=abc' },
      profile_user_id: 'u', sound_id: 'snd', stream_id: 'st', reply_kind: 'note',
      media: { kind: 'image', width: 10, height: 20, sensitive: true },
      sender_display_name: 'Asha',
    })
    expect(x.forwarded).toBe(true)
    expect(x.voice).toEqual({ durationMs: 300000, waveform: [0, 255, 0, 13, 0] })
    expect(x.sticker?.id).toBe('s')
    // Kept byte for byte, query params included.
    expect(x.gif?.url).toBe('https://media.giphy.com/g.gif?cid=abc&rid=x')
    expect(x.gif?.stillUrl).toBe('https://media.giphy.com/s.gif?cid=abc')
    expect([x.profileUserId, x.soundId, x.streamId, x.replyKind]).toEqual(['u', 'snd', 'st', 'note'])
    expect(x.media).toEqual({ kind: 'image', width: 10, height: 20, durationMs: null, sensitive: true })
    expect(x.senderDisplayName).toBe('Asha')
  })
  test('legacy forwarded_from_id counts as forwarded; flat voice fields are read', () => {
    expect(decodeMessageExtras({ forwarded_from_id: 'm0' }).forwarded).toBe(true)
    expect(decodeMessageExtras({ type: 'voice', duration_ms: 4000, waveform: [1, 2] }).voice).toEqual({ durationMs: 4000, waveform: [1, 2] })
  })
  test('waveform is capped at 64 bars', () => {
    expect(clampWaveform(new Array(100).fill(9))).toHaveLength(64)
  })
})

describe('presence and live frames (§4, §2.3)', () => {
  test('presence map: legacy booleans and the contract objects', () => {
    expect(decodePresenceMap({ data: { a: true, b: { is_online: false, last_active_at: 't' }, c: 'x' } })).toEqual({
      a: { isOnline: true, lastActiveAt: null },
      b: { isOnline: false, lastActiveAt: 't' },
    })
  })
  test('presence_update frame: top-level legacy, payload contract', () => {
    expect(decodePresenceFrame({ type: 'presence_update', user_id: 'u', online: true })).toEqual({ userId: 'u', isOnline: true, lastActiveAt: null })
    expect(decodePresenceFrame({ type: 'presence_update', payload: { user_id: 'u', is_online: false, last_active_at: 't' } })).toEqual({ userId: 'u', isOnline: false, lastActiveAt: 't' })
    expect(decodePresenceFrame({ type: 'presence_update' })).toBeNull()
  })
  test('message_deleted frame: contract message_id and legacy msg_id', () => {
    expect(decodeMessageDeletedFrame({ payload: { conversation_id: 'c', message_id: 'm' } })).toEqual({ conversationId: 'c', messageId: 'm' })
    expect(decodeMessageDeletedFrame({ payload: { conversation_id: 'c', msg_id: 'm' } })).toEqual({ conversationId: 'c', messageId: 'm' })
    expect(decodeMessageDeletedFrame({ payload: { conversation_id: 'c' } })).toBeNull()
  })
})

describe('conversation prefs (§1.1)', () => {
  test('expired mute is not muted; unknown tone is default', () => {
    const p = decodeConversationPrefs({ data: { is_muted: true, mute_until: '2000-01-01T00:00:00Z', alert_tone: 'siren', mute_calls: true } })
    expect(p.isMuted).toBe(false)
    expect(p.alertTone).toBe('default')
    expect(p.muteCalls).toBe(true)
  })
  test('missing fields are neutral', () => {
    expect(decodeConversationPrefs({})).toEqual({ isMuted: false, muteUntil: null, muteCalls: false, isPinned: false, label: null, alertTone: 'default' })
  })
})
