import type { LiveChatAuthor, LiveChatMessage } from "./model"
import { MAX_MODERATORS, str } from "./model"
import type { LiveFrame } from "./realtime"
import { addJoin, joinTime, type LiveJoin } from "./joins"

// Live chat state as a pure reducer, so every rule (dedupe, removal,
// bans, moderators, mutes, the pin, join notices, replay) is testable
// without React or a socket.

export const CHAT_WINDOW = 200
const REMOVED_MEMORY = 500

/** The pinned message (GET /chat/pinned, or a moderation.pin frame, which carries no author card). */
export interface LivePinned {
  message_id: string
  user_id: string
  text: string
  author: LiveChatAuthor | null
}

export interface ChatState {
  streamId: string
  /** Oldest first, so arrivals append. */
  messages: LiveChatMessage[]
  /** Ids removed by a moderator; a late echo of one never reappears. */
  removed: string[]
  banned: string[]
  moderators: string[]
  /** Muted in this chat (GET /chat/mutes for host and moderators; frames for everyone). */
  muted: string[]
  pinned: LivePinned | null
  /**
   * viewer.joined notices, client-side only: never in `messages`, never
   * touched by an HTTP replay, capped (features/live/joins.ts).
   */
  joins: LiveJoin[]
}

export type ChatAction =
  | { type: "replay"; messages: LiveChatMessage[] }
  | { type: "frame"; frame: LiveFrame }
  | { type: "sent"; message: LiveChatMessage }
  | { type: "removed_locally"; message_id: string }
  | { type: "moderators_seed"; user_ids: string[] }
  /** GET /bans (host, moderators): the server's ban list replaces ours. */
  | { type: "bans_seed"; user_ids: string[] }
  /** GET /chat/mutes (host, moderators): the server's mute list replaces ours. */
  | { type: "mutes_seed"; user_ids: string[] }
  /** GET /chat/pinned (anyone), or our own pin/unpin answer. */
  | { type: "pinned_seed"; pinned: LivePinned | null }

export function initialChatState(streamId: string, moderators: string[] = []): ChatState {
  return { streamId, messages: [], removed: [], banned: [], moderators: uniq(moderators), muted: [], pinned: null, joins: [] }
}

function uniq(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)))
}

function order(a: LiveChatMessage, b: LiveChatMessage): number {
  const ta = Date.parse(a.created_at) || 0
  const tb = Date.parse(b.created_at) || 0
  return ta !== tb ? ta - tb : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function addMessage(state: ChatState, msg: LiveChatMessage): ChatState {
  if (!msg.id || msg.stream_id !== state.streamId) return state
  if (state.removed.includes(msg.id)) return state
  if (state.messages.some((m) => m.id === msg.id)) return state
  const messages = [...state.messages, msg].sort(order).slice(-CHAT_WINDOW)
  return { ...state, messages }
}

function removeMessage(state: ChatState, id: string): ChatState {
  if (!id) return state
  const removed = state.removed.includes(id) ? state.removed : [...state.removed, id].slice(-REMOVED_MEMORY)
  // A removed message is never shown pinned either.
  const pinned = state.pinned?.message_id === id ? null : state.pinned
  return { ...state, removed, pinned, messages: state.messages.filter((m) => m.id !== id) }
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "replay": {
      // The authorized list is the truth for the window it covers: a local
      // message at or before its newest row that it no longer contains was
      // removed while we were not hearing frames (polling). Anything newer
      // arrived over the socket after the fetch and is kept.
      const fresh = action.messages.filter((m) => m.id && m.stream_id === state.streamId && !state.removed.includes(m.id))
      const newest = fresh.reduce<LiveChatMessage | null>((acc, m) => (!acc || order(m, acc) > 0 ? m : acc), null)
      const ids = new Set(fresh.map((m) => m.id))
      const kept = newest ? state.messages.filter((m) => !ids.has(m.id) && order(m, newest) > 0) : state.messages
      const messages = [...fresh, ...kept].sort(order).slice(-CHAT_WINDOW)
      return { ...state, messages }
    }
    case "sent":
      return addMessage(state, action.message)
    case "removed_locally":
      return removeMessage(state, action.message_id)
    case "moderators_seed":
      return { ...state, moderators: uniq(action.user_ids) }
    case "bans_seed":
      return { ...state, banned: uniq(action.user_ids) }
    case "mutes_seed":
      return { ...state, muted: uniq(action.user_ids) }
    case "pinned_seed": {
      const p = action.pinned
      return { ...state, pinned: p && p.message_id && !state.removed.includes(p.message_id) ? p : null }
    }
    case "frame": {
      const f = action.frame
      if (f.stream_id !== state.streamId) return state
      switch (f.kind) {
        case "chat":
          return addMessage(state, f.message)
        case "removed":
          return removeMessage(state, f.message_id)
        case "ban":
          // A ban also deletes the moderator row (store BanFromStream) but
          // only moderation.ban is published, so drop the moderator here.
          return {
            ...state,
            banned: state.banned.includes(f.user_id) ? state.banned : [...state.banned, f.user_id],
            moderators: state.moderators.filter((id) => id !== f.user_id),
          }
        case "unban":
          return { ...state, banned: state.banned.filter((id) => id !== f.user_id) }
        case "moderators":
          return { ...state, moderators: uniq(f.user_ids) }
        case "mute":
          return { ...state, muted: state.muted.includes(f.user_id) ? state.muted : [...state.muted, f.user_id] }
        case "unmute":
          return { ...state, muted: state.muted.filter((id) => id !== f.user_id) }
        case "pin": {
          if (state.removed.includes(f.message_id)) return state
          // The frame has no author card; use the row's when it is in the window.
          const row = state.messages.find((m) => m.id === f.message_id)
          return {
            ...state,
            pinned: {
              message_id: f.message_id,
              user_id: f.user_id || row?.user_id || "",
              text: f.text || row?.text || "",
              author: row?.author ?? null,
            },
          }
        }
        case "unpin":
          return state.pinned?.message_id === f.message_id ? { ...state, pinned: null } : state
        case "joined": {
          // Client-side only; a banned viewer (stale token) is never announced.
          if (state.banned.includes(f.user_id)) return state
          const joins = addJoin(state.joins, { user_id: f.user_id, author: f.author, at: joinTime(f.joined_at, Date.now()) })
          return joins === state.joins ? state : { ...state, joins }
        }
        default:
          return state
      }
    }
  }
}

// ── Who may do what ──────────────────────────────────────────────────

export type ChatRole = "host" | "moderator" | "viewer" | "guest"

export function chatRole(meId: string | null | undefined, hostId: string, moderators: string[]): ChatRole {
  const me = str(meId)
  if (!me) return "guest"
  if (me === hostId) return "host"
  return moderators.includes(me) ? "moderator" : "viewer"
}

export type MessageActionKey =
  | "ban" | "unban" | "make_moderator" | "remove_moderator" | "remove" | "report"
  | "mute" | "unmute" | "pin" | "unpin"

export interface MessageAction {
  key: MessageActionKey
  label: string
  destructive: boolean
}

const LABELS: Record<MessageActionKey, string> = {
  ban: "Ban from stream",
  make_moderator: "Make moderator",
  mute: "Mute in chat",
  pin: "Pin message",
  remove: "Remove message",
  remove_moderator: "Remove moderator",
  report: "Report message",
  unban: "Unban from stream",
  unmute: "Unmute in chat",
  unpin: "Unpin message",
}

/**
 * The menu for one chat message, in ascending alphabetical order.
 * Host: remove and pin/unpin any message; ban/unban, mute/unmute and
 * (un)make moderator for others. Moderator: remove, ban/unban and
 * mute/unmute others, never the host or another moderator (removal of a
 * moderator's message is allowed). Viewer: report someone else's message.
 * Guests (signed out) get nothing.
 *
 * live-service-v2 (internal/http/handler.go): mute is host or moderator
 * (POST /chat/mute, DELETE /chat/mute/:userId), pin is the host's alone
 * (POST/DELETE /chat/pin). `messageId` and `pinnedId` decide Pin vs Unpin;
 * without a `messageId` no pin action is offered.
 */
export function messageActions(input: {
  role: ChatRole
  meId: string | null | undefined
  hostId: string
  authorId: string
  moderators: string[]
  banned: string[]
  muted?: string[]
  messageId?: string
  pinnedId?: string | null
}): MessageAction[] {
  const { role, hostId, authorId, moderators, banned } = input
  const muted = input.muted ?? []
  const me = str(input.meId)
  const own = !!me && authorId === me
  const keys: MessageActionKey[] = []
  const muteKey: MessageActionKey = muted.includes(authorId) ? "unmute" : "mute"
  if (role === "host") {
    keys.push("remove")
    if (input.messageId) keys.push(input.pinnedId && input.pinnedId === input.messageId ? "unpin" : "pin")
    if (!own) {
      keys.push(banned.includes(authorId) ? "unban" : "ban")
      keys.push(muteKey)
      keys.push(moderators.includes(authorId) ? "remove_moderator" : "make_moderator")
    }
  } else if (role === "moderator") {
    if (authorId !== hostId) {
      keys.push("remove")
      if (!own && !moderators.includes(authorId)) {
        keys.push(banned.includes(authorId) ? "unban" : "ban")
        keys.push(muteKey)
      }
    }
  } else if (role === "viewer") {
    if (!own) keys.push("report")
  }
  return keys
    .map((key) => ({ key, label: LABELS[key], destructive: key === "ban" || key === "remove" }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** Stream-level tools (outside any one message). */
export function streamTools(role: ChatRole) {
  return {
    /** Moderation panel (bans and mutes with Unban / Unmute). */
    moderationPanel: role === "host" || role === "moderator",
    /** Report the stream itself. */
    reportStream: role === "viewer" || role === "moderator",
    /** Choose moderators (PUT /moderators). */
    setModerators: role === "host",
  }
}

/** Panel sections by role; the server enforces the same split (requireCreator vs requireHostOrModerator). */
export function moderationTools(role: ChatRole) {
  return {
    /** GET /chat/mutes, DELETE /chat/mute/:userId: host and moderators. */
    mutes: role === "host" || role === "moderator",
    /** GET/POST /chat/word-filters, DELETE /chat/word-filters/:word: host only. */
    wordFilters: role === "host",
    /** DELETE /chat/pin: host only. */
    pin: role === "host",
  }
}

export type ModeratorChange =
  | { ok: true; user_ids: string[] }
  | { ok: false; reason: "host" | "limit" }

/** The next moderator list for PUT /moderators; the host is never one, max 5. */
export function nextModerators(current: string[], userId: string, op: "add" | "remove", hostId: string): ModeratorChange {
  const list = uniq(current)
  if (op === "remove") return { ok: true, user_ids: list.filter((id) => id !== userId) }
  if (userId === hostId) return { ok: false, reason: "host" }
  if (list.includes(userId)) return { ok: true, user_ids: list }
  if (list.length >= MAX_MODERATORS) return { ok: false, reason: "limit" }
  return { ok: true, user_ids: [...list, userId] }
}

/** Can this person type in the chat box right now? */
export function canSendChat(input: { role: ChatRole; meId: string | null | undefined; banned: string[]; chatOpen: boolean; muted?: string[] }): boolean {
  if (!input.chatOpen || input.role === "guest") return false
  const me = str(input.meId)
  return !input.banned.includes(me) && !(input.muted ?? []).includes(me)
}

/**
 * Word-filter input as live-service-v2 stores it: trimmed, lower-cased,
 * 1..100 characters (runes, not bytes). Null when the server would refuse
 * it with INVALID_WORD.
 */
export const MAX_FILTER_WORD_CHARS = 100

export function normalizeFilterWord(raw: string): string | null {
  const w = str(raw).trim().toLowerCase()
  if (!w || Array.from(w).length > MAX_FILTER_WORD_CHARS) return null
  return w
}
