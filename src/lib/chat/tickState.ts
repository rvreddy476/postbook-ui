/*
  Message ticks (WhatsApp-style), for MY messages in direct chats and groups:

    one grey tick        sent       the server has it
    two grey ticks       delivered  every other member's device received it
    two coloured ticks   read       every other member opened it

  The server gives two inputs and this file merges them:
    - per message, history carries `status` ("sent" | "delivered" | "read")
      for the viewer's own messages;
    - per conversation, aggregate watermarks `delivered_up_to` / `read_up_to`
      (RFC 3339) from the conversation response and the live
      `delivery_receipt` / `read_receipt` frames. A message of mine with
      ts <= read_up_to is read; else ts <= delivered_up_to is delivered.

  A tick only ever moves forward: the result is the max of the server status
  and the watermark-derived state. Read is privacy-gated on the server (the
  watermark is withheld), delivered never is.
*/

export type TickStatus = 'sent' | 'delivered' | 'read'
export type TickState = 'none' | 'pending' | TickStatus

const RANK: Record<TickStatus, number> = { sent: 0, delivered: 1, read: 2 }

/** A server `status` value, or null when absent / unknown. */
export function parseTickStatus(v: unknown): TickStatus | null {
  return v === 'sent' || v === 'delivered' || v === 'read' ? v : null
}

/**
 * Milliseconds for an RFC 3339 time, or null when absent, empty, invalid or
 * Go's zero time ("0001-01-01T00:00:00Z" — a zero value is not a time).
 */
export function watermarkMs(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null
  if (typeof v !== 'string' || v === '' || v.startsWith('0001-01-01')) return null
  const ms = Date.parse(v)
  return Number.isNaN(ms) || ms <= 0 ? null : ms
}

/** The later of two watermarks (ms); either may be absent. */
export function mergeWatermark(a: number | null | undefined, b: unknown): number | null {
  const bm = watermarkMs(b)
  const am = typeof a === 'number' && Number.isFinite(a) && a > 0 ? a : null
  if (am === null) return bm
  if (bm === null) return am
  return Math.max(am, bm)
}

/** The later of two statuses. */
export function maxStatus(a: TickStatus | null | undefined, b: TickStatus | null | undefined): TickStatus | null {
  if (!a) return b ?? null
  if (!b) return a
  return RANK[b] > RANK[a] ? b : a
}

export interface TickInput {
  isMine: boolean
  /** Optimistic (not yet acknowledged by the server). */
  pending?: boolean
  /** The message's server timestamp (RFC 3339). */
  ts: string | null | undefined
  /** The per-message status from history, when the server sent one. */
  status?: TickStatus | null
  /** Aggregate watermarks (ms since epoch), null when unknown or withheld. */
  deliveredUpTo?: number | null
  readUpTo?: number | null
}

/** The tick a message shows. Others' messages show none. */
export function tickState(input: TickInput): TickState {
  if (!input.isMine) return 'none'
  if (input.pending) return 'pending'
  let derived: TickStatus = 'sent'
  const at = watermarkMs(input.ts)
  if (at !== null) {
    if (input.readUpTo != null && at <= input.readUpTo) derived = 'read'
    else if (input.deliveredUpTo != null && at <= input.deliveredUpTo) derived = 'delivered'
  }
  return maxStatus(input.status ?? null, derived) ?? 'sent'
}

/** The tooltip / accessible label for a tick. */
export function tickLabel(state: TickState): string {
  switch (state) {
    case 'pending': return 'Sending'
    case 'sent': return 'Sent'
    case 'delivered': return 'Delivered'
    case 'read': return 'Read'
    default: return ''
  }
}

/* ---- Frames ---- */

export interface DeliveryReceiptFrame {
  conversationId: string
  /** Who acknowledged (the recipient's device); may be "" in an aggregate. */
  userId: string
  messageId: string
  deliveredAt: number | null
  /** The aggregate watermark for the viewer (every other member received up to it). */
  deliveredUpTo: number | null
}

export interface ReadReceiptFrame {
  conversationId: string
  /** The reader (direct only; absent on a group aggregate). */
  userId: string | null
  messageId: string | null
  readAt: number | null
  /** The aggregate read watermark (direct: = read_at). */
  readUpTo: number | null
  aggregate: boolean
}

function payloadOf(frame: unknown, type: string): Record<string, unknown> | null {
  if (!frame || typeof frame !== 'object') return null
  const f = frame as Record<string, unknown>
  if (f.type !== type) return null
  const p = f.payload && typeof f.payload === 'object' ? (f.payload as Record<string, unknown>) : f
  return typeof p.conversation_id === 'string' && p.conversation_id ? p : null
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** A `delivery_receipt` frame, or null when it is not one. */
export function decodeDeliveryReceiptFrame(frame: unknown): DeliveryReceiptFrame | null {
  const p = payloadOf(frame, 'delivery_receipt')
  if (!p) return null
  return {
    conversationId: p.conversation_id as string,
    userId: str(p.user_id),
    messageId: str(p.message_id),
    deliveredAt: watermarkMs(p.delivered_at),
    deliveredUpTo: watermarkMs(p.delivered_up_to),
  }
}

/** A `read_receipt` frame (direct or group aggregate), or null when it is not one. */
export function decodeReadReceiptFrame(frame: unknown): ReadReceiptFrame | null {
  const p = payloadOf(frame, 'read_receipt')
  if (!p) return null
  const readAt = watermarkMs(p.read_at)
  const aggregate = p.aggregate === true
  return {
    conversationId: p.conversation_id as string,
    userId: str(p.user_id) || null,
    messageId: str(p.message_id) || null,
    readAt,
    // A direct frame predating read_up_to still carries read_at.
    readUpTo: watermarkMs(p.read_up_to) ?? (aggregate ? null : readAt),
    aggregate,
  }
}

/** The viewer-scoped watermarks on a conversation response (`receipts`). */
export function decodeConversationReceipts(conv: unknown): { deliveredUpTo: number | null; readUpTo: number | null } {
  const c = conv && typeof conv === 'object' ? (conv as Record<string, unknown>) : {}
  const r = c.receipts && typeof c.receipts === 'object' ? (c.receipts as Record<string, unknown>) : {}
  return { deliveredUpTo: watermarkMs(r.delivered_up_to), readUpTo: watermarkMs(r.read_up_to) }
}
