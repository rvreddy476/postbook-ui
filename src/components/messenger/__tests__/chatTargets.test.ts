import { describe, expect, test } from 'bun:test'

import { decodeInboxRow, type InboxRow } from '@/lib/chat/contract'
import {
  conversationKey,
  filterTargets,
  isPicked,
  personKey,
  pickerTargets,
  pickLimit,
  pickLimitHint,
  sameTarget,
  searchResults,
  targetFromRow,
  targetFromUser,
  toggleTarget,
  type ChatTarget,
} from '../chatTargets'

const ME = 'me'

function row(raw: Record<string, unknown>): InboxRow {
  const r = decodeInboxRow(raw, ME)
  if (!r) throw new Error('bad row')
  return r
}

const dmAsha = row({ id: 'c-asha', type: 'direct', peer: { user_id: 'u-asha', display_name: 'Asha Rao', username: 'asha', avatar_url: '/a.jpg', is_online: true } })
const dmRavi = row({ id: 'c-ravi', type: 'direct', peer: { user_id: 'u-ravi', display_name: 'Ravi', username: 'ravi' } })
const group = row({ id: 'c-grp', type: 'group', title: 'Weekend Riders', avatar_url: '/g.jpg' })
const channel = row({ id: 'c-chan', type: 'channel', title: 'Announcements' })
const dating = row({ id: 'c-date', type: 'direct', source_app: 'dating', peer: { user_id: 'u-d', display_name: 'Match' } })
const incoming = row({ id: 'c-req', type: 'direct', is_request: true, created_by: 'u-x', peer: { user_id: 'u-x', display_name: 'Stranger' } })
const archived = row({ id: 'c-arch', type: 'direct', label: 'archived', peer: { user_id: 'u-y', display_name: 'Old' } })

const person = (id: string, name = id): ChatTarget => ({ key: personKey(id), kind: 'person', conversationId: null, userId: id, name, avatarUrl: null, isGroup: false })
const convo = (id: string, userId: string | null = null, isGroup = false): ChatTarget => ({ key: conversationKey(id), kind: 'conversation', conversationId: id, userId, name: id, avatarUrl: null, isGroup })

describe('targets from inbox rows', () => {
  test('a DM is keyed by its conversation and carries the peer', () => {
    expect(targetFromRow(dmAsha, ME)).toEqual({
      key: 'c:c-asha',
      kind: 'conversation',
      conversationId: 'c-asha',
      userId: 'u-asha',
      name: 'Asha Rao',
      avatarUrl: '/a.jpg',
      isGroup: false,
      isOnline: true,
      subtitle: '@asha',
    })
  })

  test('a group has no user, its own photo, and says Group', () => {
    const t = targetFromRow(group, ME)
    expect(t).toMatchObject({ key: 'c:c-grp', userId: null, name: 'Weekend Riders', avatarUrl: '/g.jpg', isGroup: true, isOnline: false, subtitle: 'Group' })
  })

  test('offered: primary DMs and groups; never dating, channels, incoming requests or archived', () => {
    const keys = pickerTargets([dmAsha, dating, group, channel, incoming, archived, dmRavi], ME).map((t) => t.key)
    expect(keys).toEqual(['c:c-asha', 'c:c-grp', 'c:c-ravi'])
  })

  test('groups can be turned off, and a chat can be left out', () => {
    expect(pickerTargets([dmAsha, group, dmRavi], ME, { includeGroups: false }).map((t) => t.key)).toEqual(['c:c-asha', 'c:c-ravi'])
    expect(pickerTargets([dmAsha, group, dmRavi], ME, { excludeConversationIds: ['c-asha'] }).map((t) => t.key)).toEqual(['c:c-grp', 'c:c-ravi'])
  })
})

describe('targets from search', () => {
  const chats = pickerTargets([dmAsha, group, dmRavi], ME)

  test('someone I already have a DM with becomes that DM', () => {
    expect(targetFromUser({ id: 'u-asha', name: 'Asha Rao', avatar: '' }, chats).key).toBe('c:c-asha')
  })

  test('someone new is a person target, opened on send', () => {
    expect(targetFromUser({ id: 'u-new', name: 'Neha', username: 'neha', avatar: '/n.jpg', isOnline: true }, chats)).toEqual({
      key: 'p:u-new',
      kind: 'person',
      conversationId: null,
      userId: 'u-new',
      name: 'Neha',
      avatarUrl: '/n.jpg',
      isGroup: false,
      isOnline: true,
      subtitle: '@neha',
    })
    expect(targetFromUser({ id: 'u-z', name: ' ', username: 'zed', avatar: '' }, chats).name).toBe('@zed')
  })

  test('chat filter matches name or handle, any case, with or without @', () => {
    expect(filterTargets(chats, 'riders').map((t) => t.key)).toEqual(['c:c-grp'])
    expect(filterTargets(chats, '@ASHA').map((t) => t.key)).toEqual(['c:c-asha'])
    expect(filterTargets(chats, '  ')).toHaveLength(3)
  })

  test('results: matching chats, then people, each chat once, never me', () => {
    const people = [
      { id: 'u-asha', name: 'Asha Rao', avatar: '' },
      { id: 'me', name: 'Me', avatar: '' },
      { id: 'u-new', name: 'Ashwin', avatar: '' },
      { id: '', name: 'Broken', avatar: '' },
    ]
    expect(searchResults(chats, 'ash', people, ME).map((t) => t.key)).toEqual(['c:c-asha', 'p:u-new'])
  })
})

describe('picking', () => {
  test('a tap picks, a second tap unpicks', () => {
    const one = toggleTarget([], person('a'), 5)
    expect(one).toEqual({ next: [person('a')], atLimit: false })
    expect(toggleTarget(one.next, person('a'), 5)).toEqual({ next: [], atLimit: false })
  })

  test('the sixth pick is refused and nothing changes', () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map((id) => person(id))
    const r = toggleTarget(five, person('f'), 5)
    expect(r.atLimit).toBe(true)
    expect(r.next.map((t) => t.key)).toEqual(five.map((t) => t.key))
  })

  test('at the cap, unpicking still works', () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map((id) => person(id))
    expect(toggleTarget(five, person('c'), 5).next.map((t) => t.userId)).toEqual(['a', 'b', 'd', 'e'])
  })

  test('the cap is never above five, whatever the caller asks', () => {
    expect(pickLimit()).toBe(5)
    expect(pickLimit(12)).toBe(5)
    expect(pickLimit(3)).toBe(3)
    expect(pickLimit(0)).toBe(1)
    expect(pickLimit(Number.NaN)).toBe(5)
    const five = ['a', 'b', 'c', 'd', 'e'].map((id) => person(id))
    expect(toggleTarget(five, person('f'), 50).atLimit).toBe(true)
    expect(pickLimitHint(5)).toBe('You can pick up to 5')
  })

  test('a person and their DM are the same pick', () => {
    const dm = convo('c-asha', 'u-asha')
    expect(sameTarget(dm, person('u-asha'))).toBe(true)
    expect(isPicked([dm], person('u-asha'))).toBe(true)
    expect(toggleTarget([dm], person('u-asha'), 5).next).toEqual([])
  })

  test('groups never match by user', () => {
    expect(sameTarget(convo('g1', null, true), convo('g2', null, true))).toBe(false)
    expect(sameTarget(convo('g1', 'u1', true), person('u1'))).toBe(false)
  })
})
