/*
  Chat parity routes (CONTRACT, 18 Oct 2026) for the web.

  Backend lanes ship these in parallel, so every call is written to survive a
  route that does not exist yet: `optional()` turns 404/405/501 into
  `null`, and callers hide the feature on null. Shapes are decoded by
  src/lib/chat/contract.ts, never read raw in a component.
*/

import {
  ChatApiError,
  chatRequest,
  normalizeChatMessage,
  sendMessage,
  sendSignaling,
  type Message,
} from '@/services/messageService'
import {
  decodeChatSearch,
  decodeConversationPrefs,
  decodeForwardResults,
  decodeInboxPage,
  decodeNote,
  decodeNotesFeed,
  decodePresenceMap,
  decodeReactionGroups,
  decodeReadSummary,
  decodeSharedMedia,
  decodeSharedPosts,
  decodeStickerPacks,
  nextCursorOf,
  unwrap,
  type AlertTone,
  type ChatNote,
  type ChatSearchResult,
  type ConversationPrefs,
  type ForwardResult,
  type InboxLane,
  type InboxPage,
  type NoteAudience,
  type NotesFeed,
  type PresenceEntry,
  type ReactionGroup,
  type SeenByEntry,
  type SharedMediaItem,
  type SharedPostItem,
  type StickerPack,
} from '@/lib/chat/contract'
import { forwardTargets, outcomeFromError } from '@/lib/chat/forward'
import {
  decodeRequestCount,
  decodeRequestsPage,
  FIRST_REQUESTS_PAGE,
  requestsQuery,
  type RequestCount,
  type RequestsCursor,
  type RequestsFilter,
  type RequestsPage,
} from '@/lib/chat/requestsLane'
import { gifWireBody, type GifSendPayload } from '@/lib/chat/giphy'

const enc = encodeURIComponent

/** A route the server does not have (yet): the feature hides. */
export function isMissingRoute(err: unknown): boolean {
  return err instanceof ChatApiError && (err.status === 404 || err.status === 405 || err.status === 501)
}

/** Run a call; null when the route is missing. Other errors propagate. */
export async function optional<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run()
  } catch (err) {
    if (isMissingRoute(err)) return null
    throw err
  }
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) })

/* ---- Inbox (§1) --------------------------------------------------- */

export async function fetchInbox(myId: string, opts: { lane?: InboxLane; cursor?: string | null; limit?: number } = {}): Promise<InboxPage> {
  const q = new URLSearchParams({ limit: String(opts.limit ?? 30) })
  if (opts.lane && opts.lane !== 'primary') q.set('lane', opts.lane)
  if (opts.cursor) q.set('cursor', opts.cursor)
  return decodeInboxPage(await chatRequest(`/conversations?${q}`), myId)
}

/**
 * One page of incoming message requests (DM consent §5), `filtered` for the
 * Hidden requests sub-list. Cursor paging when the server has it, offset
 * paging otherwise (lib/chat/requestsLane.ts).
 */
export async function fetchRequestsPage(
  myId: string,
  filter: RequestsFilter = 'all',
  at: Exclude<RequestsCursor, null> = FIRST_REQUESTS_PAGE,
): Promise<RequestsPage> {
  return decodeRequestsPage(await chatRequest(`/requests?${requestsQuery(filter, at)}`), myId)
}

/**
 * The Requests badge and the Hidden requests count (`GET /requests/count`).
 * null when the route is missing (the badge then counts loaded rows).
 */
export async function fetchRequestCount(): Promise<RequestCount | null> {
  return optional(async () => decodeRequestCount(await chatRequest('/requests/count', {}, true)))
}

/** Block the person behind a request: the request closes and both memberships go. */
export async function blockMessageRequest(conversationId: string): Promise<void> {
  await chatRequest(`/conversations/${enc(conversationId)}/requests/block`, { method: 'POST' })
}

/** Report a request: it closes, and trust & safety gets the sender and the message. */
export async function reportMessageRequest(conversationId: string): Promise<void> {
  await chatRequest(`/conversations/${enc(conversationId)}/requests/report`, { method: 'POST' })
}

export interface PrefsPatch {
  is_pinned?: boolean
  is_muted?: boolean
  mute_until?: string | null
  mute_calls?: boolean
  alert_tone?: AlertTone
  label?: 'archived' | 'none'
  /**
   * Disappearing messages window in ms; 0 turns it off. Not null: the
   * settings handler ignores a null field (it only applies what is set).
   */
  disappear_after_ms?: number
}

export async function getConversationPrefs(conversationId: string): Promise<ConversationPrefs | null> {
  return optional(async () => decodeConversationPrefs(await chatRequest(`/conversations/${enc(conversationId)}/settings`, {}, true)))
}

export async function updateConversationPrefs(conversationId: string, patch: PrefsPatch): Promise<ConversationPrefs> {
  return decodeConversationPrefs(
    await chatRequest(`/conversations/${enc(conversationId)}/settings`, { method: 'PUT', ...json(patch) }),
  )
}

/** Hide + clear my history (§1.2). null when the route is not there yet. */
export async function deleteChatForMe(conversationId: string): Promise<true | null> {
  return optional(async () => {
    await chatRequest(`/conversations/${enc(conversationId)}/for-me`, { method: 'DELETE' })
    return true as const
  })
}

/**
 * Mark a conversation unread (or clear the mark) for me (fix pass 2):
 * `PUT /conversations/:id/unread {unread}` → 204. Opening or reading the
 * chat (POST /read) clears it server-side. null when the route is not there.
 */
export async function setConversationUnread(conversationId: string, unread: boolean): Promise<true | null> {
  return optional(async () => {
    await chatRequest(`/conversations/${enc(conversationId)}/unread`, { method: 'PUT', ...json({ unread }) })
    return true as const
  })
}

/**
 * Report a whole conversation (fix pass 2): `POST /conversations/:id/report
 * {reason, note?}` → 202. A DM reports the other person (the server attaches
 * recent messages as evidence); a group reports the group.
 */
export async function reportConversation(conversationId: string, reason: MessageReportReason, note?: string): Promise<true | null> {
  return optional(async () => {
    await chatRequest(`/conversations/${enc(conversationId)}/report`, {
      method: 'POST',
      ...json(note?.trim() ? { reason, note: note.trim() } : { reason }),
    })
    return true as const
  })
}

/** Clear my history without hiding (§1.3). */
export async function clearChat(conversationId: string): Promise<true | null> {
  return optional(async () => {
    await chatRequest(`/conversations/${enc(conversationId)}/clear`, { method: 'POST' })
    return true as const
  })
}

export async function fetchSharedPosts(conversationId: string, cursor?: string | null): Promise<{ items: SharedPostItem[]; nextCursor: string | null } | null> {
  const q = new URLSearchParams({ kind: 'posts' })
  if (cursor) q.set('cursor', cursor)
  return optional(async () => decodeSharedPosts(await chatRequest(`/conversations/${enc(conversationId)}/shared?${q}`, {}, true)))
}

export async function fetchSharedMedia(conversationId: string, cursor?: string | null): Promise<{ items: SharedMediaItem[]; nextCursor: string | null } | null> {
  const q = new URLSearchParams({ kind: 'media' })
  if (cursor) q.set('cursor', cursor)
  return optional(async () => decodeSharedMedia(await chatRequest(`/conversations/${enc(conversationId)}/shared?${q}`, {}, true)))
}

/* ---- Messages (§2) ------------------------------------------------ */

/**
 * One page of history, newest first, and the cursor for the page before it.
 * message-service pages with `cursor` (meta.next_cursor); that is the
 * "before" cursor of CONTRACT §2.10.
 */
export async function fetchMessagePage(conversationId: string, cursor?: string | null, limit = 30): Promise<{ messages: Message[]; nextCursor: string | null }> {
  const q = new URLSearchParams({ limit: String(limit) })
  if (cursor) q.set('cursor', cursor)
  const body = await chatRequest(`/conversations/${enc(conversationId)}/messages?${q}`)
  const data = unwrap(body)
  const list = Array.isArray(data) ? data : []
  return { messages: list.map((r) => normalizeChatMessage(r as Record<string, unknown>)), nextCursor: nextCursorOf(body) }
}

async function postMessage(conversationId: string, body: Record<string, unknown>): Promise<Message | undefined> {
  const res = await chatRequest(`/conversations/${enc(conversationId)}/messages`, { method: 'POST', ...json(body) })
  const raw = unwrap(res)
  return raw && typeof raw === 'object' ? normalizeChatMessage(raw as Record<string, unknown>) : undefined
}

export interface ReplyRef {
  reply_to_id?: string
  reply_to_preview?: string
  reply_to_sender_id?: string
}

export function voiceMessageBody(mediaId: string, durationMs: number, waveform: number[], reply?: ReplyRef) {
  return { type: 'voice', media_id: mediaId, duration_ms: durationMs, waveform, ...(reply ?? {}) }
}

export const sendVoiceMessage = (conversationId: string, mediaId: string, durationMs: number, waveform: number[], reply?: ReplyRef) =>
  postMessage(conversationId, voiceMessageBody(mediaId, durationMs, waveform, reply))

export const sendStickerMessage = (conversationId: string, stickerId: string) =>
  postMessage(conversationId, { type: 'sticker', sticker_id: stickerId })

/**
 * A GIF picked in the browser from Giphy's SDK (no server GIF route). The
 * payload is what the SDK returned, URLs untouched (lib/chat/giphy.ts).
 */
export const sendGifMessage = (conversationId: string, gif: GifSendPayload) =>
  postMessage(conversationId, { type: 'gif', gif: gifWireBody(gif) })

/** Photo or video with the kind the picker knew (media responses gain media.kind). */
export const sendMediaKindMessage = (conversationId: string, mediaId: string, reply?: ReplyRef) =>
  postMessage(conversationId, { type: 'media', media_id: mediaId, ...(reply ?? {}) })

export type DeleteScope = 'everyone' | 'me'

/** Unsend (everyone) or delete for me (§2.3). `timestamp` is the message ts the server keys on. */
export async function deleteMessageScoped(conversationId: string, messageId: string, timestamp: string, scope: DeleteScope): Promise<void> {
  await chatRequest(`/conversations/${enc(conversationId)}/messages/${enc(messageId)}`, {
    method: 'DELETE',
    ...json({ timestamp, scope }),
  })
}

/**
 * Forward to ≤5 chats (§2.4). Falls back to one copy per chat through the
 * existing send (text only, forwarded_from_id set) when the route is missing.
 */
export async function forwardToChats(
  conversationId: string,
  message: { id: string; text?: string; type?: string },
  targetIds: readonly string[],
  idempotencyKey: string,
): Promise<ForwardResult[]> {
  const targets = forwardTargets(targetIds)
  if (targets.length === 0) return []
  try {
    const res = await chatRequest(`/conversations/${enc(conversationId)}/messages/${enc(message.id)}/forward`, {
      method: 'POST',
      ...json({ conversation_ids: targets, idempotency_key: idempotencyKey }),
    })
    return decodeForwardResults(res, targets)
  } catch (err) {
    if (!isMissingRoute(err)) throw err
  }
  if (!message.text) return targets.map((id) => ({ conversationId: id, outcome: 'unavailable' as const, messageId: null }))
  const out: ForwardResult[] = []
  for (const id of targets) {
    try {
      const sent = await sendMessage(id, message.text, undefined, { forwarded_from_id: message.id })
      out.push({ conversationId: id, outcome: 'sent', messageId: sent?.data?.id ?? null })
    } catch (e) {
      out.push({ conversationId: id, outcome: outcomeFromError(e), messageId: null })
    }
  }
  return out
}

export async function fetchReactionGroups(conversationId: string, messageId: string): Promise<ReactionGroup[] | null> {
  return optional(async () => decodeReactionGroups(await chatRequest(`/conversations/${enc(conversationId)}/messages/${enc(messageId)}/reactions`, {}, true)))
}

export const MESSAGE_REPORT_REASONS = ['spam', 'harassment', 'hate', 'sexual', 'violence', 'scam', 'other'] as const
export type MessageReportReason = (typeof MESSAGE_REPORT_REASONS)[number]

export async function reportMessage(conversationId: string, messageId: string, reason: MessageReportReason, note?: string): Promise<true | null> {
  return optional(async () => {
    await chatRequest(`/conversations/${enc(conversationId)}/messages/${enc(messageId)}/report`, {
      method: 'POST',
      ...json(note?.trim() ? { reason, note: note.trim() } : { reason }),
    })
    return true as const
  })
}

export async function fetchStickerPacks(): Promise<StickerPack[]> {
  return (await optional(async () => decodeStickerPacks(await chatRequest('/stickers', {}, true)))) ?? []
}

export async function fetchReadSummary(conversationId: string, messageId: string): Promise<{ seenBy: SeenByEntry[]; count: number } | null> {
  return optional(async () => decodeReadSummary(await chatRequest(`/conversations/${enc(conversationId)}/read-summary?message_id=${enc(messageId)}`, {}, true)))
}

/* ---- Presence and typing (§4) --------------------------------------- */

export async function fetchPresenceDetail(userIds: readonly string[]): Promise<Record<string, PresenceEntry>> {
  if (userIds.length === 0) return {}
  try {
    return decodePresenceMap(await chatRequest('/presence', { method: 'POST', ...json({ user_ids: userIds }) }, true))
  } catch {
    return {}
  }
}

/** typing.stop over the socket (sent on send / blur), plus the REST form. */
export function sendTypingStop(conversationId: string): void {
  sendSignaling({ type: 'typing.stop', conversation_id: conversationId })
  void chatRequest(`/conversations/${enc(conversationId)}/typing`, { method: 'POST', ...json({ is_typing: false }) }, true).catch(() => undefined)
}

/* ---- Notes (§5) ------------------------------------------------------ */

export async function fetchNotes(): Promise<NotesFeed | null> {
  return optional(async () => decodeNotesFeed(await chatRequest('/notes', {}, true)))
}

export async function putMyNote(text: string, audience: NoteAudience): Promise<ChatNote | null> {
  const res = await chatRequest('/notes/me', { method: 'PUT', ...json({ text, audience }) })
  return decodeNote(unwrap(res))
}

export async function deleteMyNote(): Promise<void> {
  await chatRequest('/notes/me', { method: 'DELETE' })
}

/* ---- Search (§6) ----------------------------------------------------- */

export async function chatSearch(query: string, myId: string): Promise<ChatSearchResult | null> {
  return optional(async () => decodeChatSearch(await chatRequest(`/search?q=${enc(query)}`, {}, true), myId))
}
