/*
  Delivered acknowledgements (message ticks): when a message from someone
  else reaches this device — over the socket or in a history page — the
  client tells the server POST /conversations/:id/delivered {up_to_message_id, ts}.

  Acks are batched per conversation: everything that arrives inside one
  window coalesces into a single ack for the NEWEST message (max ts), and a
  conversation is acked at most once per second. Pure apart from the
  injected clock, timer and sender, so it is unit-testable.
*/

export interface DeliveredAck {
  messageId: string
  /** The message's server timestamp (RFC 3339). */
  ts: string
}

export interface DeliveredAckDeps {
  send: (conversationId: string, ack: DeliveredAck) => Promise<unknown> | void
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
  /** Minimum gap between two acks for one conversation (ms). */
  intervalMs?: number
}

interface Slot {
  pending: (DeliveredAck & { at: number }) | null
  /** The ts (ms) last sent, so an older or equal ack is never re-sent. */
  sentAt: number
  lastFlush: number
  timer: unknown
}

const tsMs = (ts: string): number => {
  const ms = Date.parse(ts)
  return Number.isNaN(ms) ? 0 : ms
}

export function createDeliveredAckBatcher(deps: DeliveredAckDeps) {
  const now = deps.now ?? (() => Date.now())
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms))
  const clearTimer = deps.clearTimer ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>))
  const interval = deps.intervalMs ?? 1000
  const slots = new Map<string, Slot>()

  const flush = (conversationId: string) => {
    const slot = slots.get(conversationId)
    if (!slot) return
    slot.timer = null
    const p = slot.pending
    if (!p) return
    slot.pending = null
    slot.lastFlush = now()
    slot.sentAt = Math.max(slot.sentAt, p.at)
    try {
      const r = deps.send(conversationId, { messageId: p.messageId, ts: p.ts })
      if (r && typeof (r as Promise<unknown>).catch === 'function') (r as Promise<unknown>).catch(() => {})
    } catch {
      /* an ack is best effort */
    }
  }

  return {
    /** Queue an ack for one received message. */
    enqueue(conversationId: string, ack: DeliveredAck) {
      if (!conversationId || !ack.messageId) return
      const at = tsMs(ack.ts)
      let slot = slots.get(conversationId)
      if (!slot) {
        slot = { pending: null, sentAt: 0, lastFlush: -Infinity, timer: null }
        slots.set(conversationId, slot)
      }
      // Already acknowledged up to here (a timestamp-less ack always goes).
      if (at > 0 && at <= slot.sentAt && !slot.pending) return
      if (!slot.pending || at >= slot.pending.at) slot.pending = { ...ack, at }
      if (slot.timer !== null) return
      const wait = slot.lastFlush + interval - now()
      if (wait <= 0) flush(conversationId)
      else slot.timer = setTimer(() => flush(conversationId), wait)
    },
    /** Send everything queued now (e.g. on page hide). */
    flushAll() {
      for (const [id, slot] of slots) {
        if (slot.timer !== null) clearTimer(slot.timer)
        slot.timer = null
        flush(id)
      }
    },
    /** Drop all state (sign-out). */
    reset() {
      for (const slot of slots.values()) if (slot.timer !== null) clearTimer(slot.timer)
      slots.clear()
    },
  }
}

export type DeliveredAckBatcher = ReturnType<typeof createDeliveredAckBatcher>
