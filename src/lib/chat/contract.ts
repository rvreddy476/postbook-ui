/*
  Chat parity contract (18 Oct 2026) — tolerant decoders for every shape the
  web reads from message-service.

  Rules, so a backend lane that ships later (or never) cannot break the app:
  - every field is optional on the wire; a missing one decodes to a neutral
    value (null, 0, false, []), never to an invented one;
  - Go marshals absent strings as "", so "" is treated as absent everywhere;
  - a row that cannot be identified (no id) is dropped, not guessed;
  - envelopes are accepted wrapped ({data, meta}) or bare.
  Pure functions only; the network layer is src/services/chatParityApi.ts.
*/

/* ------------------------------------------------------------------ */
/*  Primitive readers                                                  */
/* ------------------------------------------------------------------ */

type Obj = Record<string, unknown>

export function isObj(v: unknown): v is Obj {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v)
}

/** A non-empty string, else null. */
export function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null
}

export function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

export function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function boolOrNull(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null
}

export function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

/** `{data: X}` → X; anything else is returned as is. */
export function unwrap(body: unknown): unknown {
  return isObj(body) && 'data' in body ? body.data : body
}

/** The next-page cursor from `{meta:{next_cursor}}` or `{data:{next_cursor}}`. */
export function nextCursorOf(body: unknown): string | null {
  if (!isObj(body)) return null
  const meta = isObj(body.meta) ? body.meta : null
  const data = isObj(body.data) ? body.data : null
  return str(meta?.next_cursor) ?? str(data?.next_cursor) ?? str(body.next_cursor) ?? null
}

/** The first non-empty string among candidates (Go's "" never wins). */
function first(...vals: unknown[]): string | null {
  for (const v of vals) {
    const s = str(v)
    if (s) return s
  }
  return null
}

function mediaServe(mediaId: string | null): string | null {
  return mediaId ? `/v1/media/${mediaId}/serve` : null
}

/* ------------------------------------------------------------------ */
/*  People                                                             */
/* ------------------------------------------------------------------ */

export interface ChatPeer {
  userId: string
  displayName: string
  username: string | null
  avatarUrl: string | null
  /** null = privacy denies, or the server did not say. */
  isOnline: boolean | null
  lastActiveAt: string | null
}

export function decodePeer(raw: unknown): ChatPeer | null {
  if (!isObj(raw)) return null
  const userId = first(raw.user_id, raw.id)
  if (!userId) return null
  const username = first(raw.username, raw.handle)
  return {
    userId,
    displayName: first(raw.display_name, raw.name, username) ?? 'Someone',
    username,
    avatarUrl: first(raw.avatar_url) ?? mediaServe(first(raw.avatar_media_id)),
    isOnline: boolOrNull(raw.is_online),
    lastActiveAt: first(raw.last_active_at),
  }
}

/* ------------------------------------------------------------------ */
/*  Inbox rows (CONTRACT §1)                                           */
/* ------------------------------------------------------------------ */

export type InboxLane = 'primary' | 'requests' | 'archived'
export type OwnStatus = 'sent' | 'read'

export interface ChatStreak {
  days: number
  atRisk: boolean
  expiresAt: string | null
}

export interface InboxLastMessage {
  type: string
  preview: string
  senderId: string | null
  at: string | null
  ownStatus: OwnStatus | null
}

export interface InboxMember {
  userId: string
  role: string | null
  displayName: string | null
  avatarMediaId: string | null
  lastReadAt: string | null
}

export interface InboxRow {
  id: string
  type: string
  isGroup: boolean
  title: string | null
  createdBy: string | null
  isRequest: boolean
  sourceApp: string | null
  members: InboxMember[]
  /** The other person in a DM: the server's `peer`, else derived from members. */
  peer: ChatPeer | null
  /** Group avatar (resolved for the viewer) when the server sent one. */
  avatarUrl: string | null
  lastMessage: InboxLastMessage | null
  lastMessageAt: string | null
  unreadCount: number
  isPinned: boolean
  pinnedAt: string | null
  isMuted: boolean
  muteCalls: boolean
  label: string | null
  alertTone: string | null
  streak: ChatStreak | null
  updatedAt: string | null
}

export function decodeStreak(raw: unknown): ChatStreak | null {
  if (!isObj(raw)) return null
  const days = num(raw.days)
  // The server sends it only from 3 days; a lower value is not shown either.
  if (days < 3) return null
  return { days: Math.floor(days), atRisk: raw.at_risk === true, expiresAt: first(raw.expires_at) }
}

function decodeOwnStatus(v: unknown): OwnStatus | null {
  return v === 'sent' || v === 'read' ? v : null
}

function decodeMember(raw: unknown): InboxMember | null {
  if (!isObj(raw)) return null
  const userId = first(raw.user_id, raw.id)
  if (!userId) return null
  return {
    userId,
    role: first(raw.role),
    displayName: first(raw.display_name, raw.name),
    avatarMediaId: first(raw.avatar_media_id),
    lastReadAt: first(raw.last_read_at),
  }
}

/**
 * The last message: the contract's object, else the flat
 * last_message_preview / _at / _sender the server sends today.
 */
function decodeLastMessage(raw: Obj): InboxLastMessage | null {
  const lm = isObj(raw.last_message) ? raw.last_message : null
  if (lm) {
    return {
      type: first(lm.type, lm.message_type) ?? 'text',
      preview: first(lm.preview, lm.text) ?? '',
      senderId: first(lm.sender_id),
      at: first(lm.at, lm.created_at, lm.ts),
      ownStatus: decodeOwnStatus(lm.own_status),
    }
  }
  const preview = first(raw.last_message_preview)
  const at = first(raw.last_message_at)
  if (!preview && !at) return null
  return { type: 'text', preview: preview ?? '', senderId: first(raw.last_message_sender), at, ownStatus: null }
}

export function decodeInboxRow(raw: unknown, myId: string): InboxRow | null {
  if (!isObj(raw)) return null
  const id = first(raw.id, raw.conversation_id)
  if (!id) return null
  const type = first(raw.type) ?? 'direct'
  const isGroup = type === 'group' || type === 'channel'
  const members = arr(raw.members).map(decodeMember).filter((m): m is InboxMember => m !== null)
  let peer = isGroup ? null : decodePeer(raw.peer)
  if (!peer && !isGroup) {
    const other = members.find((m) => m.userId !== myId)
    if (other) {
      peer = {
        userId: other.userId,
        displayName: other.displayName ?? first(raw.title) ?? 'Someone',
        username: null,
        avatarUrl: mediaServe(other.avatarMediaId),
        isOnline: null,
        lastActiveAt: null,
      }
    }
  }
  const lastMessage = decodeLastMessage(raw)
  const unread = numOrNull(raw.unread_count)
  return {
    id,
    type,
    isGroup,
    title: first(raw.title, raw.name),
    createdBy: first(raw.created_by),
    isRequest: raw.is_request === true,
    sourceApp: first(raw.source_app),
    members,
    peer,
    avatarUrl: first(raw.avatar_url) ?? mediaServe(first(raw.avatar_media_id)),
    lastMessage,
    lastMessageAt: first(raw.last_message_at) ?? lastMessage?.at ?? null,
    unreadCount: unread !== null ? Math.max(0, Math.floor(unread)) : raw.has_unread === true ? 1 : 0,
    isPinned: raw.is_pinned === true || raw.pinned === true,
    pinnedAt: first(raw.pinned_at),
    isMuted: raw.is_muted === true,
    muteCalls: raw.mute_calls === true,
    label: first(raw.label),
    alertTone: first(raw.alert_tone),
    streak: isGroup ? null : decodeStreak(raw.streak),
    updatedAt: first(raw.updated_at),
  }
}

export interface InboxPage {
  rows: InboxRow[]
  nextCursor: string | null
}

export function decodeInboxPage(body: unknown, myId: string): InboxPage {
  const data = unwrap(body)
  const list = Array.isArray(data) ? data : isObj(data) ? arr(data.items ?? data.conversations) : []
  return {
    rows: list.map((r) => decodeInboxRow(r, myId)).filter((r): r is InboxRow => r !== null),
    nextCursor: nextCursorOf(body),
  }
}

/* ------------------------------------------------------------------ */
/*  Notes (CONTRACT §5)                                                */
/* ------------------------------------------------------------------ */

export type NoteAudience = 'everyone' | 'friends' | 'only_me'
export const NOTE_AUDIENCES: readonly NoteAudience[] = ['everyone', 'friends', 'only_me']
export const NOTE_MAX_GRAPHEMES = 60

export interface ChatNote {
  id: string
  userId: string | null
  text: string
  audience: NoteAudience
  createdAt: string | null
  expiresAt: string | null
}

export interface OtherNote {
  note: ChatNote
  user: { userId: string; displayName: string; avatarUrl: string | null; isOnline: boolean | null }
}

export interface NotesFeed {
  mine: ChatNote | null
  others: OtherNote[]
}

export function decodeNote(raw: unknown): ChatNote | null {
  if (!isObj(raw)) return null
  const text = first(raw.text)
  if (!text) return null
  const audience = NOTE_AUDIENCES.includes(raw.audience as NoteAudience) ? (raw.audience as NoteAudience) : 'everyone'
  return {
    id: first(raw.id) ?? `note-${first(raw.user_id) ?? 'me'}`,
    userId: first(raw.user_id),
    text,
    audience,
    createdAt: first(raw.created_at),
    expiresAt: first(raw.expires_at),
  }
}

export function decodeNotesFeed(body: unknown): NotesFeed {
  const data = unwrap(body)
  if (!isObj(data)) return { mine: null, others: [] }
  const others: OtherNote[] = []
  for (const item of arr(data.others)) {
    if (!isObj(item)) continue
    const note = decodeNote(item.note)
    const peer = decodePeer(item.user)
    if (!note || !peer) continue
    others.push({
      note,
      user: { userId: peer.userId, displayName: peer.displayName, avatarUrl: peer.avatarUrl, isOnline: peer.isOnline },
    })
  }
  return { mine: decodeNote(data.mine), others }
}

/** Grapheme count, so an emoji note is measured the way the server measures it. */
export function graphemeCount(text: string): number {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<unknown> } }).Segmenter
  if (Seg) {
    let n = 0
    for (const _ of new Seg(undefined, { granularity: 'grapheme' }).segment(text)) n++
    return n
  }
  return Array.from(text).length
}

/* ------------------------------------------------------------------ */
/*  Search (CONTRACT §6)                                               */
/* ------------------------------------------------------------------ */

export interface SearchMessageHit {
  conversationId: string
  messageId: string
  snippet: string
  senderId: string | null
  at: string | null
}

export interface ChatSearchResult {
  people: ChatPeer[]
  conversations: InboxRow[]
  messages: SearchMessageHit[]
}

export const CHAT_SEARCH_MIN_CHARS = 2

export function decodeChatSearch(body: unknown, myId: string): ChatSearchResult {
  const data = unwrap(body)
  if (!isObj(data)) return { people: [], conversations: [], messages: [] }
  const messages: SearchMessageHit[] = []
  for (const m of arr(data.messages)) {
    if (!isObj(m)) continue
    const conversationId = first(m.conversation_id)
    const messageId = first(m.message_id, m.msg_id)
    if (!conversationId || !messageId) continue
    messages.push({ conversationId, messageId, snippet: first(m.snippet, m.text) ?? '', senderId: first(m.sender_id), at: first(m.at, m.created_at) })
  }
  return {
    people: arr(data.people).map(decodePeer).filter((p): p is ChatPeer => p !== null && p.userId !== myId),
    conversations: arr(data.conversations).map((r) => decodeInboxRow(r, myId)).filter((r): r is InboxRow => r !== null),
    messages,
  }
}

/* ------------------------------------------------------------------ */
/*  Shared posts / media (CONTRACT §1.4)                               */
/* ------------------------------------------------------------------ */

export interface SharedPostItem {
  messageId: string
  postId: string
  senderId: string | null
  at: string | null
}

export interface SharedMediaItem {
  messageId: string
  mediaId: string
  kind: 'image' | 'video' | 'audio' | null
  senderId: string | null
  at: string | null
}

function listOf(body: unknown): unknown[] {
  const data = unwrap(body)
  return Array.isArray(data) ? data : isObj(data) ? arr(data.items) : []
}

export function decodeSharedPosts(body: unknown): { items: SharedPostItem[]; nextCursor: string | null } {
  const items: SharedPostItem[] = []
  const seen = new Set<string>()
  for (const r of listOf(body)) {
    if (!isObj(r)) continue
    const postId = first(r.post_id)
    const messageId = first(r.message_id, r.msg_id) ?? postId
    if (!postId || !messageId || seen.has(messageId)) continue
    seen.add(messageId)
    items.push({ messageId, postId, senderId: first(r.sender_id), at: first(r.at, r.created_at) })
  }
  return { items, nextCursor: nextCursorOf(body) }
}

function mediaKind(v: unknown): 'image' | 'video' | 'audio' | null {
  return v === 'image' || v === 'video' || v === 'audio' ? v : null
}

export function decodeSharedMedia(body: unknown): { items: SharedMediaItem[]; nextCursor: string | null } {
  const items: SharedMediaItem[] = []
  for (const r of listOf(body)) {
    if (!isObj(r)) continue
    const mediaId = first(r.media_id)
    const messageId = first(r.message_id, r.msg_id) ?? mediaId
    if (!mediaId || !messageId) continue
    items.push({ messageId, mediaId, kind: mediaKind(r.kind), senderId: first(r.sender_id), at: first(r.at, r.created_at) })
  }
  return { items, nextCursor: nextCursorOf(body) }
}

/* ------------------------------------------------------------------ */
/*  Reactions detail, read summary (CONTRACT §2.5, §2.9)               */
/* ------------------------------------------------------------------ */

export interface ReactionUser {
  userId: string
  displayName: string
  avatarUrl: string | null
}

export interface ReactionGroup {
  emoji: string
  count: number
  users: ReactionUser[]
}

function decodeReactionUser(raw: unknown): ReactionUser | null {
  const p = decodePeer(raw)
  return p ? { userId: p.userId, displayName: p.displayName, avatarUrl: p.avatarUrl } : null
}

export function decodeReactionGroups(body: unknown): ReactionGroup[] {
  const data = unwrap(body)
  const list = Array.isArray(data) ? data : isObj(data) ? arr(data.reactions ?? data.items) : []
  const out: ReactionGroup[] = []
  for (const r of list) {
    if (!isObj(r)) continue
    const emoji = first(r.emoji)
    if (!emoji) continue
    const users = arr(r.users).map(decodeReactionUser).filter((u): u is ReactionUser => u !== null)
    out.push({ emoji, count: Math.max(num(r.count), users.length), users })
  }
  return out.sort((a, b) => b.count - a.count)
}

export interface SeenByEntry extends ReactionUser {
  at: string | null
}

export function decodeReadSummary(body: unknown): { seenBy: SeenByEntry[]; count: number } {
  const data = unwrap(body)
  if (!isObj(data)) return { seenBy: [], count: 0 }
  const seenBy: SeenByEntry[] = []
  for (const r of arr(data.seen_by)) {
    const u = decodeReactionUser(r)
    if (u) seenBy.push({ ...u, at: isObj(r) ? first(r.at, r.read_at) : null })
  }
  return { seenBy, count: Math.max(num(data.count), seenBy.length) }
}

/* ------------------------------------------------------------------ */
/*  Stickers (CONTRACT §2.7) and received GIFs                         */
/* ------------------------------------------------------------------ */

export interface Sticker {
  id: string
  url: string
  width: number
  height: number
}

export interface StickerPack {
  id: string
  name: string
  stickers: Sticker[]
}

function decodeSticker(raw: unknown): Sticker | null {
  if (!isObj(raw)) return null
  const id = first(raw.id, raw.sticker_id)
  const url = first(raw.url)
  if (!id || !url) return null
  return { id, url, width: num(raw.width, 128), height: num(raw.height, 128) }
}

/** Packs with at least one usable sticker; an empty catalogue is []. */
export function decodeStickerPacks(body: unknown): StickerPack[] {
  const data = unwrap(body)
  const packs = isObj(data) ? arr(data.packs) : Array.isArray(data) ? data : []
  const out: StickerPack[] = []
  for (const p of packs) {
    if (!isObj(p)) continue
    const id = first(p.id)
    const stickers = arr(p.stickers).map(decodeSticker).filter((s): s is Sticker => s !== null)
    if (!id || stickers.length === 0) continue
    out.push({ id, name: first(p.name) ?? 'Stickers', stickers })
  }
  return out
}

export interface GifItem {
  provider: string
  id: string
  url: string
  previewUrl: string
  width: number
  height: number
  /** First frame, when the sender's SDK gave one (Giphy still rendition). */
  stillUrl: string | null
}

/* ------------------------------------------------------------------ */
/*  Forward (CONTRACT §2.4)                                            */
/* ------------------------------------------------------------------ */

export type ForwardOutcome = 'sent' | 'blocked' | 'unavailable'
export const FORWARD_MAX_TARGETS = 5

export interface ForwardResult {
  conversationId: string
  outcome: ForwardOutcome
  messageId: string | null
}

export function decodeForwardResults(body: unknown, requested: readonly string[]): ForwardResult[] {
  const data = unwrap(body)
  const list = isObj(data) ? arr(data.results) : Array.isArray(data) ? data : []
  const byId = new Map<string, ForwardResult>()
  for (const r of list) {
    if (!isObj(r)) continue
    const conversationId = first(r.conversation_id)
    if (!conversationId) continue
    const outcome: ForwardOutcome = r.outcome === 'sent' || r.outcome === 'blocked' ? r.outcome : 'unavailable'
    byId.set(conversationId, { conversationId, outcome, messageId: first(r.message_id) })
  }
  // A target the server did not answer for did not get the message.
  return requested.map((id) => byId.get(id) ?? { conversationId: id, outcome: 'unavailable', messageId: null })
}

/* ------------------------------------------------------------------ */
/*  Message extras (CONTRACT §2.2)                                     */
/* ------------------------------------------------------------------ */

export const VOICE_MAX_MS = 300_000
export const WAVEFORM_MAX_BARS = 64

export interface VoiceInfo {
  durationMs: number
  waveform: number[]
}

export interface MediaInfo {
  kind: 'image' | 'video' | 'audio' | null
  width: number | null
  height: number | null
  durationMs: number | null
  /** null = unknown (moderation has not said). */
  sensitive: boolean | null
}

export interface CallInfo {
  kind: 'audio' | 'video'
  outcome: string
  durationMs: number | null
}

export interface MessageExtras {
  forwarded: boolean
  voice: VoiceInfo | null
  sticker: Sticker | null
  gif: GifItem | null
  profileUserId: string | null
  soundId: string | null
  streamId: string | null
  replyKind: 'message' | 'note' | null
  media: MediaInfo | null
  call: CallInfo | null
  senderDisplayName: string | null
}

export function clampWaveform(v: unknown): number[] {
  return arr(v)
    .slice(0, WAVEFORM_MAX_BARS)
    .map((n) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(255, Math.round(n))) : 0))
}

export function decodeMessageExtras(raw: unknown): MessageExtras {
  const r = isObj(raw) ? raw : {}
  const voiceRaw = isObj(r.voice) ? r.voice : null
  const mediaRaw = isObj(r.media) ? r.media : null
  const callRaw = isObj(r.call) ? r.call : null
  const gifRaw = isObj(r.gif) ? r.gif : null
  let gif: GifItem | null = null
  if (gifRaw) {
    const url = first(gifRaw.url)
    const id = first(gifRaw.id)
    if (url && id) {
      // Giphy URLs are kept exactly as stored (their query params matter).
      gif = { provider: first(gifRaw.provider) ?? 'gif', id, url, previewUrl: first(gifRaw.preview_url) ?? url, width: num(gifRaw.width, 200), height: num(gifRaw.height, 200), stillUrl: first(gifRaw.still_url) }
    }
  }
  const sensitive = boolOrNull(mediaRaw?.sensitive ?? r.sensitive)
  const kind = mediaKind(mediaRaw?.kind ?? r.media_kind)
  return {
    forwarded: r.forwarded === true || Boolean(first(r.forwarded_from_id)),
    voice: voiceRaw
      ? { durationMs: Math.max(0, Math.min(VOICE_MAX_MS, num(voiceRaw.duration_ms))), waveform: clampWaveform(voiceRaw.waveform) }
      : r.type === 'voice'
        ? { durationMs: Math.max(0, Math.min(VOICE_MAX_MS, num(r.duration_ms))), waveform: clampWaveform(r.waveform) }
        : null,
    sticker: decodeSticker(r.sticker),
    gif,
    profileUserId: first(r.profile_user_id),
    soundId: first(r.sound_id),
    streamId: first(r.stream_id),
    replyKind: r.reply_kind === 'note' ? 'note' : r.reply_kind === 'message' ? 'message' : null,
    media:
      mediaRaw || kind || sensitive !== null
        ? {
            kind,
            width: numOrNull(mediaRaw?.width),
            height: numOrNull(mediaRaw?.height),
            durationMs: numOrNull(mediaRaw?.duration_ms),
            sensitive,
          }
        : null,
    call: callRaw
      ? { kind: callRaw.kind === 'video' || callRaw.call_type === 'video' ? 'video' : 'audio', outcome: first(callRaw.outcome, callRaw.status) ?? 'ended', durationMs: numOrNull(callRaw.duration_ms) }
      : null,
    senderDisplayName: first(r.sender_display_name),
  }
}

/* ------------------------------------------------------------------ */
/*  Presence (CONTRACT §4)                                             */
/* ------------------------------------------------------------------ */

export interface PresenceEntry {
  isOnline: boolean | null
  lastActiveAt: string | null
}

/**
 * POST /presence: today `{user_id: bool}`; the contract adds last_active_at,
 * accepted as `{user_id: {is_online, last_active_at}}` too.
 */
export function decodePresenceMap(body: unknown): Record<string, PresenceEntry> {
  const data = unwrap(body)
  const out: Record<string, PresenceEntry> = {}
  if (!isObj(data)) return out
  for (const [id, v] of Object.entries(data)) {
    if (typeof v === 'boolean') out[id] = { isOnline: v, lastActiveAt: null }
    else if (isObj(v)) out[id] = { isOnline: boolOrNull(v.is_online ?? v.online), lastActiveAt: first(v.last_active_at) }
  }
  return out
}

/** A `presence_update` frame: `{user_id, is_online, last_active_at}` at the top or in payload; legacy `online`. */
export function decodePresenceFrame(frame: unknown): ({ userId: string } & PresenceEntry) | null {
  if (!isObj(frame)) return null
  const p = isObj(frame.payload) ? frame.payload : frame
  const userId = first(p.user_id, frame.user_id)
  if (!userId) return null
  return {
    userId,
    isOnline: boolOrNull(p.is_online ?? p.online ?? frame.online),
    lastActiveAt: first(p.last_active_at, frame.last_active_at),
  }
}

/** A `message_deleted` frame: contract `message_id`, legacy `msg_id`. */
export function decodeMessageDeletedFrame(frame: unknown): { conversationId: string; messageId: string } | null {
  if (!isObj(frame)) return null
  const p = isObj(frame.payload) ? frame.payload : frame
  const conversationId = first(p.conversation_id)
  const messageId = first(p.message_id, p.msg_id)
  return conversationId && messageId ? { conversationId, messageId } : null
}

/* ------------------------------------------------------------------ */
/*  Per-conversation settings (CONTRACT §1.1)                          */
/* ------------------------------------------------------------------ */

export type AlertTone = 'default' | 'chime' | 'pop' | 'bell' | 'silent'
export const ALERT_TONES: readonly AlertTone[] = ['default', 'chime', 'pop', 'bell', 'silent']

export interface ConversationPrefs {
  isMuted: boolean
  muteUntil: string | null
  muteCalls: boolean
  isPinned: boolean
  label: string | null
  alertTone: AlertTone
}

export function decodeConversationPrefs(body: unknown): ConversationPrefs {
  const d = unwrap(body)
  const s = isObj(d) ? d : {}
  const muteUntil = first(s.mute_until)
  // Mute honours expiry even if the server has not caught up.
  const expired = muteUntil ? Date.parse(muteUntil) < Date.now() : false
  return {
    isMuted: s.is_muted === true && !expired,
    muteUntil,
    muteCalls: s.mute_calls === true,
    isPinned: s.is_pinned === true,
    label: first(s.label),
    alertTone: ALERT_TONES.includes(s.alert_tone as AlertTone) ? (s.alert_tone as AlertTone) : 'default',
  }
}
