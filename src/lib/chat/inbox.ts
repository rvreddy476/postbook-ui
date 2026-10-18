/*
  The Messages inbox as pure functions: ordering, page merge, live updates
  and every label a row shows. The list itself is GET /v1/chat/conversations
  (CONTRACT §1); this file never invents a row — a person appears only when
  a conversation with them exists.
*/

import { isDatingConversation } from '@/lib/messengerConversations'
import { DELETED_ACCOUNT_LABEL, type ChatPeer, type ChatStreak, type InboxRow } from './contract'

const ts = (iso: string | null | undefined): number => {
  if (!iso) return 0
  const n = Date.parse(iso)
  return Number.isNaN(n) ? 0 : n
}

/** When the row last moved: its last message, else its update time. */
export function rowActivityAt(row: InboxRow): number {
  return Math.max(ts(row.lastMessageAt), ts(row.lastMessage?.at), ts(row.updatedAt))
}

/** Pinned first (newest pin first), then by last activity, newest first. Stable. */
export function orderInbox(rows: readonly InboxRow[]): InboxRow[] {
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => {
      if (a.row.isPinned !== b.row.isPinned) return a.row.isPinned ? -1 : 1
      if (a.row.isPinned) {
        const p = ts(b.row.pinnedAt) - ts(a.row.pinnedAt)
        if (p !== 0) return p
      }
      const d = rowActivityAt(b.row) - rowActivityAt(a.row)
      return d !== 0 ? d : a.i - b.i
    })
    .map((x) => x.row)
}

/** Dating chats belong to the dating product, never to Messages. */
export function withoutDating(rows: readonly InboxRow[]): InboxRow[] {
  return rows.filter((r) => !isDatingConversation({ source_app: r.sourceApp ?? undefined }))
}

/**
 * Merge a freshly fetched page into what is on screen. The incoming copy of a
 * row wins (it is newer); rows only on screen are kept, so loading page 2
 * never drops page 1. Result is re-ordered.
 */
export function mergeInboxPages(current: readonly InboxRow[], incoming: readonly InboxRow[]): InboxRow[] {
  const byId = new Map<string, InboxRow>()
  for (const r of current) byId.set(r.id, r)
  for (const r of incoming) byId.set(r.id, r)
  return orderInbox(withoutDating(Array.from(byId.values())))
}

export interface LiveInboxMessage {
  conversationId: string
  senderId: string
  type: string
  text?: string
  at: string
}

/**
 * A live message moves its row to the top with the new preview. It counts as
 * unread only when it is someone else's and the thread is not open. Returns
 * null when the conversation is not in the list (the caller refetches).
 */
export function applyLiveMessage(
  rows: readonly InboxRow[],
  msg: LiveInboxMessage,
  myId: string,
  openConversationId: string | null,
): InboxRow[] | null {
  const idx = rows.findIndex((r) => r.id === msg.conversationId)
  if (idx < 0) return null
  const row = rows[idx]
  const mine = msg.senderId === myId
  const next: InboxRow = {
    ...row,
    lastMessage: { type: msg.type || 'text', preview: msg.text ?? '', senderId: msg.senderId, at: msg.at, ownStatus: mine ? 'sent' : null },
    lastMessageAt: msg.at,
    unreadCount: mine || openConversationId === row.id ? row.unreadCount : row.unreadCount + 1,
  }
  const out = rows.slice()
  out[idx] = next
  return orderInbox(out)
}

/** A row patched in place (pin, mute, read …), re-ordered. */
export function patchRow(rows: readonly InboxRow[], id: string, patch: Partial<InboxRow>): InboxRow[] {
  return orderInbox(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
}

/* ------------------------------------------------------------------ */
/*  Lanes                                                              */
/* ------------------------------------------------------------------ */

/** A request somebody else started: it waits in Requests for my answer. */
export function isIncomingRequest(row: InboxRow, myId: string): boolean {
  return row.isRequest && row.createdBy !== myId
}

/**
 * Primary lane on screen: no incoming requests and nothing archived. A request
 * I sent stays (it is my thread, waiting on them). The server already filters
 * by lane; this guards a server that does not yet.
 */
export function primaryRows(rows: readonly InboxRow[], myId: string): InboxRow[] {
  return rows.filter((r) => !isIncomingRequest(r, myId) && r.label !== 'archived')
}

/* ------------------------------------------------------------------ */
/*  Labels                                                             */
/* ------------------------------------------------------------------ */

/**
 * A DM's name: "Deleted account" for a gone account, else their name, else
 * @username, else the title. Never the word "Conversation" (fix pass 2).
 */
export function rowName(row: InboxRow, myId: string): string {
  if (!row.isGroup) {
    if (row.peerDeleted) return DELETED_ACCOUNT_LABEL
    return row.peer?.displayName || (row.peer?.username ? `@${row.peer.username}` : null) || row.title || 'Someone'
  }
  if (row.title) return row.title
  const names = row.members.filter((m) => m.userId !== myId).map((m) => m.displayName).filter(Boolean) as string[]
  if (names.length === 0) return 'Group'
  return names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} +${names.length - 3}`
}

/** 0 → "", 1..99 → the number, more → "99+". */
export function unreadPillText(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ''
  return n > 99 ? '99+' : String(Math.floor(n))
}

/**
 * What a row shows for unread: a number pill, a plain dot for a chat I
 * marked unread with nothing new in it, or nothing.
 */
export type UnreadIndicator = { kind: 'count'; text: string } | { kind: 'dot' } | null

export function unreadIndicator(row: Pick<InboxRow, 'unreadCount' | 'markedUnread'>): UnreadIndicator {
  if (row.markedUnread && row.unreadCount <= 1) return { kind: 'dot' }
  const text = unreadPillText(row.unreadCount)
  return text ? { kind: 'count', text } : null
}

/** The row menu offers Mark as read when anything is unread, else Mark as unread. */
export function readToggleAction(row: Pick<InboxRow, 'unreadCount' | 'markedUnread'>): 'read' | 'unread' {
  return row.unreadCount > 0 || row.markedUnread ? 'read' : 'unread'
}

/** The row once read: no count, no mark. */
export const READ_PATCH: Pick<InboxRow, 'unreadCount' | 'markedUnread'> = { unreadCount: 0, markedUnread: false }

/** The row once marked unread: at least one, and the mark. */
export function markedUnreadPatch(row: Pick<InboxRow, 'unreadCount'>): Pick<InboxRow, 'unreadCount' | 'markedUnread'> {
  return { unreadCount: Math.max(1, row.unreadCount), markedUnread: true }
}

/** Short relative time for a row: now, 5m, 3h, 2d, 3w. */
export function shortAgo(iso: string | null | undefined, now = Date.now()): string {
  const t = ts(iso)
  if (!t) return ''
  const min = Math.floor((now - t) / 60000)
  if (min < 1) return 'now'
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return `${Math.floor(d / 7)}w`
}

/**
 * The presence line under a name: "Active now" or "Active 5m ago"; null when
 * the server withheld it (privacy) or it is older than a week.
 */
export function presenceLabel(p: Pick<ChatPeer, 'isOnline' | 'lastActiveAt'> | null | undefined, now = Date.now()): string | null {
  if (!p) return null
  if (p.isOnline === true) return 'Active now'
  const t = ts(p.lastActiveAt)
  if (!t) return null
  const min = Math.max(0, Math.floor((now - t) / 60000))
  if (min < 1) return 'Active now'
  if (min < 60) return `Active ${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `Active ${h}h ago`
  const d = Math.floor(h / 24)
  if (d === 1) return 'Active yesterday'
  if (d < 7) return `Active ${d}d ago`
  return null
}

/** Online dot: only an explicit true. */
export function showOnlineDot(p: Pick<ChatPeer, 'isOnline'> | null | undefined): boolean {
  return p?.isOnline === true
}

export interface StreakBadge {
  text: string
  atRisk: boolean
  title: string
}

/** "🔥 12"; at risk when today has not counted yet late in the day. */
export function streakBadge(s: ChatStreak | null | undefined): StreakBadge | null {
  if (!s || s.days < 3) return null
  return {
    text: `\u{1F525} ${s.days}`,
    atRisk: s.atRisk,
    title: s.atRisk ? `${s.days}-day streak. Message today to keep it going.` : `${s.days}-day streak`,
  }
}

const TYPE_PREVIEW: Record<string, string> = {
  voice: 'Voice message',
  sticker: 'Sticker',
  gif: 'GIF',
  media: 'Photo or video',
  image: 'Photo',
  video: 'Video',
  audio: 'Audio',
  post: 'Shared a post',
  profile: 'Shared a profile',
  sound: 'Shared a sound',
  live: 'Shared a LIVE',
  call: 'Call',
}

export interface RowPreview {
  text: string
  /** "Seen" / "Sent" for my own last message, when the server said. */
  status: 'Seen' | 'Sent' | null
}

export function rowPreview(row: InboxRow, myId: string, opts: { sentRequestWaiting?: boolean } = {}): RowPreview {
  if (opts.sentRequestWaiting) return { text: 'Request sent · waiting for them to accept', status: null }
  const lm = row.lastMessage
  if (!lm) return { text: row.isRequest ? 'Wants to send you a message' : 'Say hi', status: null }
  const body = lm.preview || TYPE_PREVIEW[lm.type] || 'Message'
  const mine = lm.senderId !== null && lm.senderId === myId
  if (!mine) {
    if (row.isGroup && lm.senderId) {
      const sender = row.members.find((m) => m.userId === lm.senderId)?.displayName
      if (sender) return { text: `${sender.split(' ')[0]}: ${body}`, status: null }
    }
    return { text: body, status: null }
  }
  return {
    text: `You: ${body}`,
    status: lm.ownStatus === 'read' && !row.isGroup ? 'Seen' : lm.ownStatus === 'sent' ? 'Sent' : null,
  }
}

/** Client-side filter, used when /v1/chat/search is not there. */
export function filterRows(rows: readonly InboxRow[], query: string, myId: string): InboxRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows.slice()
  return rows.filter((r) => {
    const hay = [rowName(r, myId), r.peer?.username ?? '', r.lastMessage?.preview ?? ''].join(' ').toLowerCase()
    return hay.includes(q)
  })
}

/** Total unread across the primary lane, muted rows excluded. */
export function inboxUnreadTotal(rows: readonly InboxRow[], myId: string): number {
  return primaryRows(rows, myId).reduce((sum, r) => sum + (r.isMuted ? 0 : r.unreadCount), 0)
}

/**
 * The Filtered requests sub-list (CONTRACT §7), or null when the server does
 * not separate it yet. With safe requests on, `all` excludes filtered ones, so
 * the two lists are disjoint; an overlap means the server ignored
 * `filter=filtered` and answered with every request.
 */
export function filteredLaneOrNull(all: readonly InboxRow[], filtered: readonly InboxRow[]): InboxRow[] | null {
  const allIds = new Set(all.map((r) => r.id))
  if (filtered.some((r) => allIds.has(r.id))) return null
  return filtered.slice()
}

/**
 * Archived chats (lane=archived). A server without lanes answers with the
 * primary list; anything that is also in the primary list is not archived.
 */
export function archivedLane(archived: readonly InboxRow[], primary: readonly InboxRow[]): InboxRow[] {
  const primaryIds = new Set(primary.map((r) => r.id))
  return orderInbox(withoutDating(archived.filter((r) => !primaryIds.has(r.id))))
}
