/*
  A chat thread as pure functions (DmChat.tsx draws it): what one message
  shows, which actions its menu offers, how an older page merges in, and
  when media is blurred. No React, so every rule has a test.
*/

import type { Message } from '@/services/messageService'
import type { MessageExtras } from '@/lib/chat/contract'

export interface DisplayMessage {
  id: string
  senderId: string
  text: string
  time: string
  ts: string
  type: string
  mediaId?: string
  postId?: string
  replyToId?: string
  replyToPreview?: string
  replyToSenderId?: string
  forwardedFromId?: string
  isEdited?: boolean
  editedAt?: string
  isDeleted?: boolean
  reactions?: { emoji: string; user_ids: string[] }[]
  extras?: MessageExtras
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  let h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${m} ${ampm}`
}

export function toDisplay(msg: Message): DisplayMessage {
  return {
    id: msg.id,
    senderId: msg.sender_id,
    text: msg.text ?? '',
    time: formatTime(msg.created_at || msg.ts),
    ts: msg.ts || msg.created_at,
    type: msg.type || 'text',
    mediaId: msg.media_id,
    postId: msg.post_id,
    replyToId: msg.reply_to_id,
    replyToPreview: msg.reply_to_preview,
    replyToSenderId: msg.reply_to_sender_id,
    forwardedFromId: msg.forwarded_from_id,
    isEdited: msg.is_edited,
    editedAt: msg.edited_at,
    isDeleted: msg.is_deleted,
    reactions: msg.reactions,
    extras: msg.extras,
  }
}

/**
 * An older page (newest-first from the server) joined to what is on screen
 * (oldest-first). Duplicates — a page boundary that overlaps — are dropped.
 */
export function prependOlder(current: readonly DisplayMessage[], olderNewestFirst: readonly DisplayMessage[]): DisplayMessage[] {
  const have = new Set(current.map((m) => m.id))
  const older = olderNewestFirst.filter((m) => !have.has(m.id)).reverse()
  return [...older, ...current]
}

export type MessageAction = 'reply' | 'copy' | 'forward' | 'edit' | 'deleteForMe' | 'unsend' | 'report' | 'pin'

/** The long-press menu for one message, in order. */
export function messageActions(msg: DisplayMessage, myId: string): MessageAction[] {
  if (msg.isDeleted || msg.id.startsWith('opt-')) return []
  const mine = msg.senderId === myId
  const isText = (msg.type === 'text' || !msg.type) && Boolean(msg.text)
  const out: MessageAction[] = ['reply']
  if (msg.text) out.push('copy')
  out.push('forward')
  if (mine && isText) out.push('edit')
  out.push('deleteForMe')
  if (mine) out.push('unsend')
  if (!mine) out.push('report')
  return out
}

export const MESSAGE_ACTION_LABELS: Record<MessageAction, string> = {
  reply: 'Reply',
  copy: 'Copy',
  forward: 'Forward',
  edit: 'Edit',
  deleteForMe: 'Delete for me',
  unsend: 'Unsend',
  report: 'Report',
  pin: 'Pin',
}

/**
 * Blur a photo or video until it is tapped: always inside a message request
 * (CONTRACT §7), otherwise only when the viewer turned the filter on and the
 * server labelled it sensitive. My own media is never blurred for me.
 */
export function shouldBlurMedia(
  msg: Pick<DisplayMessage, 'senderId' | 'extras'>,
  myId: string,
  opts: { filterOn: boolean; isRequestThread: boolean },
): boolean {
  if (msg.senderId === myId) return false
  if (opts.isRequestThread) return true
  return opts.filterOn && msg.extras?.media?.sensitive === true
}

/** The newest message of mine that is not deleted (where "Seen" goes). */
export function lastOwnMessageId(messages: readonly DisplayMessage[], myId: string): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.senderId === myId && !m.isDeleted && !m.id.startsWith('opt-')) return m.id
  }
  return null
}

/** What kind of bubble a message draws. */
export type BubbleKind =
  | 'deleted' | 'system' | 'call' | 'voice' | 'sticker' | 'gif' | 'post' | 'profile' | 'sound' | 'live'
  | 'image' | 'video' | 'audio' | 'attachment' | 'text'

export function bubbleKind(msg: DisplayMessage, resolvedMediaKind?: string): BubbleKind {
  if (msg.isDeleted) return 'deleted'
  const t = msg.type
  if (t === 'system') return 'system'
  if (t === 'call' || msg.extras?.call) return 'call'
  if (t === 'voice' || msg.extras?.voice) return msg.mediaId ? 'voice' : 'attachment'
  if (t === 'sticker' && msg.extras?.sticker) return 'sticker'
  if (t === 'gif' && msg.extras?.gif) return 'gif'
  if (t === 'post' && msg.postId) return 'post'
  if (t === 'profile' && msg.extras?.profileUserId) return 'profile'
  if (t === 'sound' && msg.extras?.soundId) return 'sound'
  if (t === 'live' && msg.extras?.streamId) return 'live'
  if (msg.mediaId) {
    const kind = (['image', 'video', 'audio'].includes(t) ? t : null) ?? msg.extras?.media?.kind ?? resolvedMediaKind
    if (kind === 'image' || kind === 'video' || kind === 'audio') return kind
    return 'attachment'
  }
  return 'text'
}

/** Bubbles drawn without the coloured pill around them. */
export function isBareBubble(kind: BubbleKind): boolean {
  return kind === 'sticker' || kind === 'gif' || kind === 'post' || kind === 'profile' || kind === 'image' || kind === 'video'
}

/** The call log line: "Missed video call", "Voice call · 3:05". */
export function callLogText(call: { kind: 'audio' | 'video'; outcome: string; durationMs: number | null }, mine: boolean): string {
  const what = call.kind === 'video' ? 'video call' : 'voice call'
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  if (call.outcome === 'missed' || call.outcome === 'no_answer') return mine ? `${cap(what)} · No answer` : `Missed ${what}`
  if (call.outcome === 'declined' || call.outcome === 'rejected') return `${cap(what)} · Declined`
  if (call.outcome === 'cancelled') return `${cap(what)} · Cancelled`
  if (call.durationMs && call.durationMs > 0) {
    const s = Math.round(call.durationMs / 1000)
    const mm = Math.floor(s / 60)
    const ss = (s % 60).toString().padStart(2, '0')
    return `${cap(what)} · ${mm}:${ss}`
  }
  return cap(what)
}

/** The quoted-reply label: a reply to someone's Note says so. */
export function quoteLabel(msg: DisplayMessage, senderName: string): string {
  if (msg.extras?.replyKind === 'note') return `Replied to ${senderName}'s note`
  return senderName
}

/** Client-side search over the loaded thread: ids of text matches, oldest first. */
export function searchThread(messages: readonly DisplayMessage[], query: string): string[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  return messages.filter((m) => !m.isDeleted && m.text.toLowerCase().includes(q)).map((m) => m.id)
}
