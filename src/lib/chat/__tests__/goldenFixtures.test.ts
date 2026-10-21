/*
  message-service's golden contract fixtures, decoded by the web's decoders.

  The JSON files in ./fixtures/chat are copied verbatim from
  chat-service/services/message-service/internal/http/testdata/contracts/chat/
  (refreshed there with -update-contracts). Re-copy them when the server
  refreshes; a file this test has no specific check for still has to decode
  through every decoder without throwing.
*/

import { describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { normalizeChatMessage } from '@/services/messageService'
import {
  decodeChatSearch,
  decodeConversationPrefs,
  decodeForwardResults,
  decodeInboxPage,
  decodeInboxRow,
  decodeNotesFeed,
  decodeReactionGroups,
  decodeReadSummary,
  decodeSharedMedia,
  decodeSharedPosts,
  decodeStickerPacks,
  unwrap,
} from '../contract'

const DIR = join(import.meta.dir, 'fixtures', 'chat')
const load = (name: string): unknown => JSON.parse(readFileSync(join(DIR, name), 'utf8'))
const ASHA = '0a000000-0000-4000-8000-00000000000a'
const BILAL = '0b000000-0000-4000-8000-00000000000b'
const message = (name: string) => normalizeChatMessage(unwrap(load(name)) as Record<string, unknown>)

const checks: Record<string, () => void> = {
  'conversations_list.json': () => {
    const page = decodeInboxPage(load('conversations_list.json'), ASHA)
    expect(page.rows.map((r) => r.id)).toEqual(['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005'])
    const [group, dm] = page.rows
    expect(group.isGroup).toBe(true)
    expect(group.title).toBe('Trip')
    expect(group.peer).toBeNull()
    expect(group.streak).toBeNull()
    expect(dm.peer?.displayName).toBe('Asha')
    expect(dm.peer?.username).toBe('asha')
    expect(dm.unreadCount).toBe(9)
    expect(dm.streak).toEqual({ days: 5, atRisk: false, expiresAt: '2026-10-18T09:30:00Z' })
    expect(dm.alertTone).toBe('default')
    expect(dm.lastMessage?.ownStatus).toBeNull()
    expect(dm.markedUnread).toBe(false)
    expect(dm.peerDeleted).toBe(false)
  },
  'conversation_detail.json': () => {
    const row = decodeInboxRow(unwrap(load('conversation_detail.json')), ASHA)!
    expect(row.peer?.userId).toBe(BILAL)
    expect(row.lastMessage?.ownStatus).toBe('read')
    expect(row.muteCalls).toBe(false)
    expect(row.members.find((m) => m.userId === BILAL)?.lastReadAt).toBe('2026-10-18T09:30:00Z')
    const prefs = decodeConversationPrefs(load('conversation_detail.json'))
    expect(prefs.alertTone).toBe('default')
  },
  'forward_result.json': () => {
    const res = decodeForwardResults(load('forward_result.json'), ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003'])
    expect(res.map((r) => r.outcome)).toEqual(['sent', 'unavailable'])
    expect(res[0].messageId).toBe('00000000-0000-4000-8000-000000000002')
  },
  'message_gif.json': () => {
    const m = message('message_gif.json')
    expect(m.id).toBe('00000000-0000-4000-8000-000000000002')
    expect(m.extras?.gif?.provider).toBe('giphy')
    expect(m.extras?.gif?.url).toContain('?cid=79&rid=giphy.gif&ct=g')
    expect(m.extras?.gif?.stillUrl).toContain('giphy_s.gif')
    expect(m.extras?.gif?.width).toBe(480)
    // is_sticker absent on a plain GIF → not a sticker.
    expect(m.extras?.gif?.isSticker).toBe(false)
  },
  'message_live.json': () => expect(message('message_live.json').extras?.streamId).toBe('00000000-0000-4000-8000-000000000003'),
  'message_sound.json': () => expect(message('message_sound.json').extras?.soundId).toBe('00000000-0000-4000-8000-000000000003'),
  'message_profile.json': () => expect(message('message_profile.json').extras?.profileUserId).toBe('0d000000-0000-4000-8000-00000000000d'),
  'message_media.json': () => {
    const m = message('message_media.json')
    expect(m.media_id).toBe('00000000-0000-4000-8000-000000000002')
    expect(m.extras?.media).toEqual({ kind: 'image', width: 1080, height: 1350, durationMs: null, sensitive: null })
  },
  'message_note_reply.json': () => {
    const m = message('message_note_reply.json')
    expect(m.extras?.replyKind).toBe('note')
    expect(m.reply_to_preview).toBe('On a train 🚆')
  },
  'message_sticker.json': () => {
    const s = message('message_sticker.json').extras?.sticker
    expect(s).toEqual({ id: '00000000-0000-4000-8000-000000000003', url: 'https://cdn.atpost.test/00000000-0000-4000-8000-000000000004/thumb_300.webp', width: 512, height: 512 })
  },
  'message_voice.json': () => {
    const m = message('message_voice.json')
    expect(m.extras?.voice).toEqual({ durationMs: 4200, waveform: [0, 40, 255, 12] })
    expect(m.extras?.media?.kind).toBe('audio')
  },
  'notes_feed.json': () => {
    const feed = decodeNotesFeed(load('notes_feed.json'))
    expect(feed.mine?.text).toBe('Back at 6')
    expect(feed.others).toHaveLength(1)
    expect(feed.others[0].note.audience).toBe('friends')
    expect(feed.others[0].user.displayName).toBe('Asha')
  },
  'reactions_list.json': () => {
    const groups = decodeReactionGroups(load('reactions_list.json'))
    expect(groups.map((g) => [g.emoji, g.count])).toEqual([['❤️', 2], ['👍🏽', 1]])
    expect(groups[0].users.map((u) => u.displayName)).toEqual(['Asha', 'Bilal'])
  },
  'read_summary.json': () => {
    const s = decodeReadSummary(load('read_summary.json'))
    expect(s.count).toBe(1)
    expect(s.seenBy[0]).toMatchObject({ displayName: 'Dev', at: '2026-10-18T09:30:00Z' })
  },
  'requests_filtered.json': () => {
    const page = decodeInboxPage(load('requests_filtered.json'), ASHA)
    expect(page.rows).toHaveLength(1)
    expect(page.rows[0].isRequest).toBe(true)
    expect(page.rows[0].createdBy).toBe('0c000000-0000-4000-8000-00000000000c')
  },
  'search_result.json': () => {
    const r = decodeChatSearch(load('search_result.json'), BILAL)
    expect(r.people.map((p) => p.displayName)).toEqual(['Asha'])
    expect(r.conversations).toHaveLength(1)
    expect(r.messages[0]).toMatchObject({ messageId: '00000000-0000-4000-8000-000000000004', snippet: 'see you at the <em>station</em>' })
  },
  'shared_media.json': () => {
    const { items } = decodeSharedMedia(load('shared_media.json'))
    expect(items).toEqual([{ messageId: '00000000-0000-4000-8000-000000000002', mediaId: '00000000-0000-4000-8000-000000000001', kind: 'image', senderId: ASHA, at: '2026-10-18T09:30:00Z' }])
  },
  'shared_posts.json': () => {
    const { items } = decodeSharedPosts(load('shared_posts.json'))
    expect(items).toEqual([{ messageId: '00000000-0000-4000-8000-000000000001', postId: '00000000-0000-4000-8000-000000000002', senderId: ASHA, at: '2026-10-18T09:30:00Z' }])
  },
  'stickers.json': () => {
    const packs = decodeStickerPacks(load('stickers.json'))
    expect(packs.map((p) => [p.name, p.stickers.length])).toEqual([['Momentum basics', 1]])
  },
}

/** A fixture with no specific check yet: every decoder must take it without throwing. */
function smoke(name: string): void {
  const body = load(name)
  const data = unwrap(body)
  expect(() => {
    decodeInboxPage(body, ASHA)
    decodeInboxRow(data, ASHA)
    decodeConversationPrefs(body)
    decodeChatSearch(body, ASHA)
    decodeNotesFeed(body)
    decodeReactionGroups(body)
    decodeReadSummary(body)
    decodeSharedMedia(body)
    decodeSharedPosts(body)
    decodeStickerPacks(body)
    decodeForwardResults(body, [])
    if (data && typeof data === 'object' && !Array.isArray(data)) normalizeChatMessage(data as Record<string, unknown>)
  }).not.toThrow()
}

describe('golden contract fixtures from message-service', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()

  test('the fixtures are there', () => {
    expect(files.length).toBeGreaterThanOrEqual(Object.keys(checks).length)
  })

  for (const f of files) {
    test(f, () => {
      smoke(f)
      checks[f]?.()
    })
  }
})
