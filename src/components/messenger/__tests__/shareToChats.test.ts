import { describe, expect, test } from 'bun:test'

import type { ForwardResult } from '@/lib/chat/contract'
import { forwardSummary } from '@/lib/chat/forward'
import { ChatApiError } from '@/services/messageService'
import { conversationKey, personKey, type ChatTarget } from '../chatTargets'
import {
  forwardToTargets,
  newIdempotencyKey,
  resolveTargets,
  shareErrorText,
  shareSummary,
  shareToChats,
  type ShareOutcome,
} from '../shareToChats'

const dm = (id: string, name: string, userId = `u-${id}`): ChatTarget => ({ key: conversationKey(id), kind: 'conversation', conversationId: id, userId, name, avatarUrl: null, isGroup: false })
const group = (id: string, name: string): ChatTarget => ({ key: conversationKey(id), kind: 'conversation', conversationId: id, userId: null, name, avatarUrl: null, isGroup: true })
const person = (userId: string, name: string): ChatTarget => ({ key: personKey(userId), kind: 'person', conversationId: null, userId, name, avatarUrl: null, isGroup: false })

function recorder(opts: { open?: Record<string, unknown>; fail?: Record<string, unknown> } = {}) {
  const sent: { conversationId: string; postId: string; caption?: string }[] = []
  const opened: string[] = []
  return {
    sent,
    opened,
    deps: {
      openDirect: async (userId: string) => {
        opened.push(userId)
        const v = opts.open?.[userId]
        if (v instanceof Error) throw v
        return v ?? { data: { conversation_id: `dm-${userId}` } }
      },
      send: async (conversationId: string, postId: string, caption?: string) => {
        const err = opts.fail?.[conversationId]
        if (err) throw err
        sent.push({ conversationId, postId, caption })
      },
    },
  }
}

describe('resolveTargets', () => {
  test('chats keep their id; people get their DM opened; in pick order', async () => {
    const rec = recorder()
    const { resolved, unresolved } = await resolveTargets([dm('c1', 'Asha'), person('u9', 'Neha'), group('g1', 'Riders')], rec.deps.openDirect)
    expect(resolved.map((r) => r.conversationId)).toEqual(['c1', 'dm-u9', 'g1'])
    expect(unresolved).toEqual([])
    expect(rec.opened).toEqual(['u9'])
  })

  test('a person whose chat cannot be opened is reported, not dropped', async () => {
    const refused = new ChatApiError('no', 403, 'MESSAGING_NOT_ALLOWED')
    const rec = recorder({ open: { u9: refused, u8: { data: { conversation_id: '' } } } })
    const { resolved, unresolved } = await resolveTargets([person('u9', 'Neha'), person('u8', 'Om')], rec.deps.openDirect)
    expect(resolved).toEqual([])
    expect(unresolved.map((u) => u.target.userId)).toEqual(['u9', 'u8'])
    expect(unresolved[0].error).toBe(refused)
  })
})

describe('shareToChats', () => {
  test('one Send: the post goes to every chat with the note as its caption', async () => {
    const rec = recorder()
    const progress: string[] = []
    const out = await shareToChats([dm('c1', 'Asha'), group('g1', 'Riders'), person('u9', 'Neha')], 'p1', '  look at this ', rec.deps, (d, t) => progress.push(`${d}/${t}`))
    expect(rec.sent).toEqual([
      { conversationId: 'c1', postId: 'p1', caption: 'look at this' },
      { conversationId: 'g1', postId: 'p1', caption: 'look at this' },
      { conversationId: 'dm-u9', postId: 'p1', caption: 'look at this' },
    ])
    expect(out.every((o) => o.ok && o.error === null)).toBe(true)
    expect(progress).toEqual(['1/3', '2/3', '3/3'])
  })

  test('an empty note sends no caption', async () => {
    const rec = recorder()
    await shareToChats([dm('c1', 'Asha')], 'p1', '   ', rec.deps)
    expect(rec.sent[0].caption).toBeUndefined()
  })

  test('each chat is judged on its own; a failure carries its reason in words', async () => {
    const rec = recorder({ fail: { c2: new ChatApiError('x', 403, 'MESSAGING_NOT_ALLOWED') } })
    const out = await shareToChats([dm('c1', 'Asha'), dm('c2', 'Ravi Kumar'), dm('c3', 'Meena')], 'p1', undefined, rec.deps)
    expect(out.map((o) => o.ok)).toEqual([true, false, true])
    expect(out[1].error).toBe("Ravi isn't accepting messages from you.")
    expect(rec.sent.map((s) => s.conversationId)).toEqual(['c1', 'c3'])
  })

  test('a person whose chat cannot be opened fails with the reason; the others still go', async () => {
    const rec = recorder({ open: { u9: new ChatApiError('x', 403, 'MESSAGING_NOT_ALLOWED') } })
    const out = await shareToChats([person('u9', 'Neha'), dm('c1', 'Asha')], 'p1', undefined, rec.deps)
    expect(out.map((o) => [o.target.key, o.ok])).toEqual([
      ['p:u9', false],
      ['c:c1', true],
    ])
    expect(out[0].error).toBe("Neha isn't accepting messages from you.")
  })

  test('two picks that land in the same chat get one copy', async () => {
    const rec = recorder({ open: { 'u-c1': { data: { conversation_id: 'c1' } } } })
    const out = await shareToChats([dm('c1', 'Asha'), person('u-c1', 'Asha')], 'p1', undefined, rec.deps)
    expect(rec.sent).toHaveLength(1)
    expect(out.map((o) => o.ok)).toEqual([true, true])
  })
})

describe('shareErrorText', () => {
  test('a group refusal is about the group', () => {
    expect(shareErrorText(new ChatApiError('x', 403, ''), { name: 'Riders', isGroup: true })).toBe("You can't send messages in this group.")
    expect(shareErrorText(new ChatApiError('x', 429, 'RATE_LIMITED'), { name: 'Riders', isGroup: true })).toBe("You're sending too fast. Wait a moment and try again.")
    expect(shareErrorText(new Error('boom'), { name: 'Riders', isGroup: true })).toBe("Couldn't send the post. Try again.")
  })

  test('a person refusal reads like the single-person share', () => {
    expect(shareErrorText(new ChatApiError('x', 422, 'INVALID_REQUEST_MESSAGE'), { name: 'Asha Rao', isGroup: false })).toContain('Send Asha a message first')
  })
})

describe('shareSummary', () => {
  const ok = (t: ChatTarget): ShareOutcome => ({ target: t, ok: true, conversationId: t.conversationId, error: null })
  const bad = (t: ChatTarget, error: string): ShareOutcome => ({ target: t, ok: false, conversationId: t.conversationId, error })

  test('nothing', () => {
    expect(shareSummary([])).toEqual({ sent: 0, failed: 0, text: 'Nothing to send.', label: '' })
  })

  test('one chat: its name', () => {
    expect(shareSummary([ok(dm('c1', 'Asha'))])).toEqual({ sent: 1, failed: 0, text: 'Sent to Asha', label: 'Asha' })
  })

  test('several chats: the count', () => {
    expect(shareSummary([ok(dm('c1', 'Asha')), ok(group('g1', 'Riders')), ok(dm('c3', 'Meena'))])).toEqual({ sent: 3, failed: 0, text: 'Sent to 3 chats', label: '3 chats' })
  })

  test('partly sent, one failure: how many, and who with the reason', () => {
    const s = shareSummary([ok(dm('c1', 'Asha')), bad(dm('c2', 'Ravi'), "Ravi isn't accepting messages from you."), ok(dm('c3', 'Meena'))])
    expect(s.text).toBe("Sent to 2 of 3 · Couldn't send to Ravi: Ravi isn't accepting messages from you.")
    expect(s).toMatchObject({ sent: 2, failed: 1 })
  })

  test('partly sent, several failures: the names (reasons are shown per chat)', () => {
    const s = shareSummary([ok(dm('c1', 'Asha')), bad(dm('c2', 'Ravi'), 'r1'), bad(group('g1', 'Riders'), 'r2')])
    expect(s.text).toBe("Sent to 1 of 3 · Couldn't send to Ravi, Riders")
  })

  test('none sent', () => {
    expect(shareSummary([bad(dm('c2', 'Ravi'), 'Try again.')]).text).toBe("Couldn't send to Ravi: Try again.")
    expect(shareSummary([bad(dm('c2', 'Ravi'), 'a'), bad(dm('c3', 'Meena'), 'b')])).toEqual({ sent: 0, failed: 2, text: "Couldn't send to Ravi, Meena", label: '' })
  })
})

describe('forwardToTargets', () => {
  test('people are opened, then ONE forward covers every chat, with the key', async () => {
    const calls: { source: string; ids: readonly string[]; key: string }[] = []
    const run = await forwardToTargets('src', { id: 'm1', text: 'hi' }, [dm('c1', 'Asha'), person('u9', 'Neha')], 'k1', {
      openDirect: async (u) => ({ conversation_id: `dm-${u}` }),
      forward: async (source, _m, ids, key) => {
        calls.push({ source, ids, key })
        return ids.map((id): ForwardResult => ({ conversationId: id, outcome: 'sent', messageId: 'x' }))
      },
    })
    expect(calls).toEqual([{ source: 'src', ids: ['c1', 'dm-u9'], key: 'k1' }])
    expect(forwardSummary(run.results, run.nameOf).text).toBe('Sent to 2 chats')
    expect(run.failedTargets).toEqual([])
  })

  test('a person whose chat cannot be opened counts as not sent, by name', async () => {
    const run = await forwardToTargets('src', { id: 'm1', text: 'hi' }, [dm('c1', 'Asha'), person('u9', 'Neha')], 'k1', {
      openDirect: async () => {
        throw new ChatApiError('x', 403, 'MESSAGING_NOT_ALLOWED')
      },
      forward: async (_s, _m, ids) => ids.map((id): ForwardResult => ({ conversationId: id, outcome: 'sent', messageId: 'x' })),
    })
    expect(run.results.map((r) => r.outcome)).toEqual(['sent', 'blocked'])
    expect(forwardSummary(run.results, run.nameOf).text).toBe('Sent to 1 of 2 · Not sent to Neha')
    expect(run.failedTargets.map((t) => t.key)).toEqual(['p:u9'])
  })

  test('a chat the server refused stays picked for a retry', async () => {
    const run = await forwardToTargets('src', { id: 'm1' }, [dm('c1', 'Asha'), group('g1', 'Riders')], 'k', {
      forward: async () => [
        { conversationId: 'c1', outcome: 'sent', messageId: 'x' },
        { conversationId: 'g1', outcome: 'unavailable', messageId: null },
      ],
    })
    expect(run.failedTargets.map((t) => t.key)).toEqual(['c:g1'])
    expect(forwardSummary(run.results, run.nameOf).text).toBe('Sent to 1 of 2 · Not sent to Riders')
  })

  test('nobody resolvable: the forward route is not called', async () => {
    let called = false
    const run = await forwardToTargets('src', { id: 'm1' }, [person('u9', 'Neha')], 'k', {
      openDirect: async () => ({}),
      forward: async () => {
        called = true
        return []
      },
    })
    expect(called).toBe(false)
    expect(run.results).toEqual([{ conversationId: 'p:u9', outcome: 'unavailable', messageId: null }])
  })
})

test('idempotency keys are fresh each time', () => {
  const a = newIdempotencyKey()
  const b = newIdempotencyKey()
  expect(a).not.toBe(b)
  expect(a.length).toBeGreaterThan(8)
})
