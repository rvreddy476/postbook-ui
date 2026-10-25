import { describe, expect, test } from 'bun:test'

import {
  decodeConversationReceipts,
  decodeDeliveryReceiptFrame,
  decodeReadReceiptFrame,
  maxStatus,
  mergeWatermark,
  parseTickStatus,
  tickLabel,
  tickState,
  watermarkMs,
} from '../tickState'
import { createDeliveredAckBatcher } from '../deliveredAck'
import {
  applyReadTickColour,
  loadReadTickColour,
  parseReadTickColour,
  readTickColourValue,
  READ_TICK_COLOURS,
  READ_TICK_COLOUR_STORAGE_KEY,
} from '../readTickColour'

const T0 = '2026-10-22T10:00:00Z'
const ms = (iso: string) => Date.parse(iso)

describe('tickState (sent / delivered / read, 22 Oct 2026)', () => {
  test("others' messages show no tick; optimistic ones a spinner", () => {
    expect(tickState({ isMine: false, ts: T0, status: 'read', readUpTo: ms(T0) })).toBe('none')
    expect(tickState({ isMine: true, pending: true, ts: T0 })).toBe('pending')
  })

  test('the watermarks decide: read beats delivered beats sent', () => {
    expect(tickState({ isMine: true, ts: T0 })).toBe('sent')
    expect(tickState({ isMine: true, ts: T0, deliveredUpTo: ms(T0) })).toBe('delivered')
    expect(tickState({ isMine: true, ts: T0, deliveredUpTo: ms(T0) - 1 })).toBe('sent')
    expect(tickState({ isMine: true, ts: T0, deliveredUpTo: ms(T0), readUpTo: ms(T0) })).toBe('read')
    // A read watermark alone still means read (read implies delivered).
    expect(tickState({ isMine: true, ts: T0, readUpTo: ms(T0) + 5 })).toBe('read')
  })

  test('monotonic: a server status never goes backwards', () => {
    expect(tickState({ isMine: true, ts: T0, status: 'read' })).toBe('read')
    expect(tickState({ isMine: true, ts: T0, status: 'delivered', deliveredUpTo: null })).toBe('delivered')
    expect(tickState({ isMine: true, ts: T0, status: 'delivered', readUpTo: ms(T0) })).toBe('read')
    expect(tickState({ isMine: true, ts: T0, status: 'read', deliveredUpTo: ms(T0) })).toBe('read')
    expect(maxStatus('read', 'sent')).toBe('read')
    expect(maxStatus(null, 'delivered')).toBe('delivered')
    expect(maxStatus('sent', null)).toBe('sent')
  })

  test('a withheld read watermark leaves delivered showing', () => {
    expect(tickState({ isMine: true, ts: T0, deliveredUpTo: ms(T0), readUpTo: null })).toBe('delivered')
  })

  test('a message with no usable timestamp falls back to its status', () => {
    expect(tickState({ isMine: true, ts: '', deliveredUpTo: ms(T0) })).toBe('sent')
    expect(tickState({ isMine: true, ts: undefined, status: 'delivered' })).toBe('delivered')
  })

  test('labels', () => {
    expect(tickLabel('sent')).toBe('Sent')
    expect(tickLabel('delivered')).toBe('Delivered')
    expect(tickLabel('read')).toBe('Read')
    expect(tickLabel('none')).toBe('')
  })

  test('parseTickStatus accepts only the three wire values', () => {
    expect(parseTickStatus('sent')).toBe('sent')
    expect(parseTickStatus('delivered')).toBe('delivered')
    expect(parseTickStatus('read')).toBe('read')
    expect(parseTickStatus('seen')).toBeNull()
    expect(parseTickStatus(undefined)).toBeNull()
  })
})

describe('watermarks', () => {
  test('absent, empty, invalid and Go zero times are no watermark', () => {
    expect(watermarkMs(null)).toBeNull()
    expect(watermarkMs('')).toBeNull()
    expect(watermarkMs('not a time')).toBeNull()
    expect(watermarkMs('0001-01-01T00:00:00Z')).toBeNull()
    expect(watermarkMs(T0)).toBe(ms(T0))
  })

  test('merge keeps the later one and ignores junk', () => {
    expect(mergeWatermark(null, T0)).toBe(ms(T0))
    expect(mergeWatermark(ms(T0), '')).toBe(ms(T0))
    expect(mergeWatermark(ms(T0), '0001-01-01T00:00:00Z')).toBe(ms(T0))
    expect(mergeWatermark(ms(T0) + 10, T0)).toBe(ms(T0) + 10)
    expect(mergeWatermark(ms(T0), '2026-10-22T10:00:01Z')).toBe(ms(T0) + 1000)
    expect(mergeWatermark(undefined, undefined)).toBeNull()
  })
})

describe('frames', () => {
  test('delivery_receipt', () => {
    const f = decodeDeliveryReceiptFrame({
      type: 'delivery_receipt',
      payload: { conversation_id: 'c1', user_id: 'u2', message_id: 'm1', delivered_at: T0, delivered_up_to: T0 },
    })
    expect(f).toEqual({ conversationId: 'c1', userId: 'u2', messageId: 'm1', deliveredAt: ms(T0), deliveredUpTo: ms(T0) })
  })

  test('delivery_receipt with an unknown aggregate watermark', () => {
    const f = decodeDeliveryReceiptFrame({ type: 'delivery_receipt', payload: { conversation_id: 'c1', user_id: 'u2', message_id: '', delivered_at: T0, delivered_up_to: '' } })
    expect(f?.deliveredUpTo).toBeNull()
    expect(f?.messageId).toBe('')
  })

  test('not a delivery_receipt', () => {
    expect(decodeDeliveryReceiptFrame({ type: 'read_receipt', payload: { conversation_id: 'c1' } })).toBeNull()
    expect(decodeDeliveryReceiptFrame({ type: 'delivery_receipt', payload: {} })).toBeNull()
    expect(decodeDeliveryReceiptFrame(null)).toBeNull()
  })

  test('direct read_receipt: read_up_to, or read_at on an older frame', () => {
    const withUpTo = decodeReadReceiptFrame({ type: 'read_receipt', payload: { conversation_id: 'c1', user_id: 'u2', message_id: 'm1', read_at: T0, read_up_to: T0 } })
    expect(withUpTo).toEqual({ conversationId: 'c1', userId: 'u2', messageId: 'm1', readAt: ms(T0), readUpTo: ms(T0), aggregate: false })
    const legacy = decodeReadReceiptFrame({ type: 'read_receipt', payload: { conversation_id: 'c1', user_id: 'u2', message_id: 'm1', read_at: T0 } })
    expect(legacy?.readUpTo).toBe(ms(T0))
  })

  test('group aggregate read_receipt has no reader', () => {
    const f = decodeReadReceiptFrame({ type: 'read_receipt', payload: { conversation_id: 'g1', aggregate: true, read_up_to: T0 } })
    expect(f).toEqual({ conversationId: 'g1', userId: null, messageId: null, readAt: null, readUpTo: ms(T0), aggregate: true })
  })

  test('conversation receipts', () => {
    expect(decodeConversationReceipts({ receipts: { delivered_up_to: T0, read_up_to: null } })).toEqual({ deliveredUpTo: ms(T0), readUpTo: null })
    expect(decodeConversationReceipts({})).toEqual({ deliveredUpTo: null, readUpTo: null })
    expect(decodeConversationReceipts(null)).toEqual({ deliveredUpTo: null, readUpTo: null })
  })
})

describe('delivered ack batcher', () => {
  const rig = () => {
    let clock = 0
    const timers: { at: number; fn: () => void; dead: boolean }[] = []
    const sent: { conv: string; messageId: string; ts: string }[] = []
    const b = createDeliveredAckBatcher({
      send: (conv, ack) => { sent.push({ conv, ...ack }) },
      now: () => clock,
      setTimer: (fn, wait) => { const t = { at: clock + wait, fn, dead: false }; timers.push(t); return t },
      clearTimer: (h) => { (h as { dead: boolean }).dead = true },
    })
    const advance = (by: number) => {
      clock += by
      for (const t of timers) if (!t.dead && t.at <= clock) { t.dead = true; t.fn() }
    }
    return { b, sent, advance }
  }

  test('the first ack goes at once; a burst coalesces to the newest', () => {
    const { b, sent, advance } = rig()
    b.enqueue('c1', { messageId: 'm1', ts: '2026-10-22T10:00:01Z' })
    expect(sent).toEqual([{ conv: 'c1', messageId: 'm1', ts: '2026-10-22T10:00:01Z' }])
    b.enqueue('c1', { messageId: 'm3', ts: '2026-10-22T10:00:03Z' })
    b.enqueue('c1', { messageId: 'm2', ts: '2026-10-22T10:00:02Z' })
    expect(sent.length).toBe(1)
    advance(999)
    expect(sent.length).toBe(1)
    advance(1)
    expect(sent.length).toBe(2)
    expect(sent[1].messageId).toBe('m3')
  })

  test('at most once per second per conversation; conversations are independent', () => {
    const { b, sent, advance } = rig()
    b.enqueue('c1', { messageId: 'a', ts: '2026-10-22T10:00:01Z' })
    b.enqueue('c2', { messageId: 'b', ts: '2026-10-22T10:00:01Z' })
    expect(sent.map(s => s.conv)).toEqual(['c1', 'c2'])
    for (let i = 2; i < 12; i++) {
      b.enqueue('c1', { messageId: `a${i}`, ts: `2026-10-22T10:00:${String(i).padStart(2, '0')}Z` })
      advance(100)
    }
    // ~1 s of traffic: at most one more ack for c1.
    expect(sent.filter(s => s.conv === 'c1').length).toBe(2)
  })

  test('an ack at or below what was already sent is not repeated', () => {
    const { b, sent, advance } = rig()
    b.enqueue('c1', { messageId: 'm2', ts: '2026-10-22T10:00:02Z' })
    advance(2000)
    b.enqueue('c1', { messageId: 'm1', ts: '2026-10-22T10:00:01Z' })
    b.enqueue('c1', { messageId: 'm2', ts: '2026-10-22T10:00:02Z' })
    advance(2000)
    expect(sent.length).toBe(1)
  })

  test('flushAll sends what is queued', () => {
    const { b, sent } = rig()
    b.enqueue('c1', { messageId: 'm1', ts: '2026-10-22T10:00:01Z' })
    b.enqueue('c1', { messageId: 'm2', ts: '2026-10-22T10:00:02Z' })
    b.flushAll()
    expect(sent.map(s => s.messageId)).toEqual(['m1', 'm2'])
  })

  test('a failing sender is swallowed', () => {
    const b = createDeliveredAckBatcher({ send: () => Promise.reject(new Error('down')), now: () => 0 })
    expect(() => b.enqueue('c1', { messageId: 'm1', ts: T0 })).not.toThrow()
  })
})

describe('read tick colour', () => {
  test('five choices, default first', () => {
    expect(READ_TICK_COLOURS.length).toBe(5)
    expect(READ_TICK_COLOURS[0]).toBe('default')
    expect(parseReadTickColour('violet')).toBe('violet')
    expect(parseReadTickColour('hotpink')).toBe('default')
  })

  test('each choice points at a theme token', () => {
    expect(readTickColourValue('default')).toBe('var(--theme-receipt-seen)')
    expect(readTickColourValue('green')).toBe('var(--theme-tile-photo)')
  })

  test('storage that throws reads as the default', () => {
    const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => {}, removeItem: () => {} }
    expect(loadReadTickColour(broken)).toBe('default')
    const ok = { getItem: (k: string) => (k === READ_TICK_COLOUR_STORAGE_KEY ? 'amber' : null), setItem: () => {}, removeItem: () => {} }
    expect(loadReadTickColour(ok)).toBe('amber')
  })

  test('apply re-points --receipt-seen; default clears the override', () => {
    const props = new Map<string, string>()
    const root = { style: { setProperty: (n: string, v: string) => { props.set(n, v) }, removeProperty: (n: string) => { props.delete(n) } } }
    applyReadTickColour('rose', root)
    expect(props.get('--receipt-seen')).toBe('var(--theme-send)')
    applyReadTickColour('default', root)
    expect(props.has('--receipt-seen')).toBe(false)
  })
})
