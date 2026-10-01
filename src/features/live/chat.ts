import type { LiveChatMessage } from "./model"
import { MAX_MODERATORS, str } from "./model"
import type { LiveFrame } from "./realtime"

// Live chat state as a pure reducer, so every rule (dedupe, removal,
// bans, moderators, replay) is testable without React or a socket.

export const CHAT_WINDOW = 200
const REMOVED_MEMORY = 500

export interface ChatState {
  streamId: string
  /** Oldest first, so arrivals append. */
  messages: LiveChatMessage[]
  /** Ids removed by a moderator; a late echo of one never reappears. */
  removed: string[]
  banned: string[]
  moderators: string[]
}

export type ChatAction =
  | { type: "replay"; messages: LiveChatMessage[] }
  | { type: "frame"; frame: LiveFrame }
  | { type: "sent"; message: LiveChatMessage }
  | { type: "removed_locally"; message_id: string }
  | { type: "moderators_seed"; user_ids: string[] }
  /** GET /bans (host, moderators): the server's ban list replaces ours. */
  | { type: "bans_seed"; user_ids: string[] }

export function initialChatState(streamId: string, moderators: string[] = []): ChatState {
  return { streamId, messages: [], removed: [], banned: [], moderators: uniq(moderators) }
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
  return { ...state, removed, messages: state.messages.filter((m) => m.id !== id) }
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

export type MessageActionKey = "ban" | "unban" | "make_moderator" | "remove_moderator" | "remove" | "report"

export interface MessageAction {
  key: MessageActionKey
  label: string
  destructive: boolean
}

const LABELS: Record<MessageActionKey, string> = {
  ban: "Ban from stream",
  make_moderator: "Make moderator",
  remove: "Remove message",
  remove_moderator: "Remove moderator",
  report: "Report message",
  unban: "Unban from stream",
}

/**
 * The menu for one chat message, in ascending alphabetical order.
 * Host: remove any message; ban, unban and (un)make moderator for others.
 * Moderator: remove and ban/unban others, never the host. Viewer: report
 * someone else's message. Guests (signed out) get nothing.
 */
export function messageActions(input: {
  role: ChatRole
  meId: string | null | undefined
  hostId: string
  authorId: string
  moderators: string[]
  banned: string[]
}): MessageAction[] {
  const { role, hostId, authorId, moderators, banned } = input
  const me = str(input.meId)
  const own = !!me && authorId === me
  const keys: MessageActionKey[] = []
  if (role === "host") {
    keys.push("remove")
    if (!own) {
      keys.push(banned.includes(authorId) ? "unban" : "ban")
      keys.push(moderators.includes(authorId) ? "remove_moderator" : "make_moderator")
    }
  } else if (role === "moderator") {
    if (authorId !== hostId) {
      keys.push("remove")
      if (!own && !moderators.includes(authorId)) keys.push(banned.includes(authorId) ? "unban" : "ban")
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
    /** Moderation panel (bans list with Unban). */
    moderationPanel: role === "host" || role === "moderator",
    /** Report the stream itself. */
    reportStream: role === "viewer" || role === "moderator",
    /** Choose moderators (PUT /moderators). */
    setModerators: role === "host",
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
export function canSendChat(input: { role: ChatRole; meId: string | null | undefined; banned: string[]; chatOpen: boolean }): boolean {
  if (!input.chatOpen || input.role === "guest") return false
  return !input.banned.includes(str(input.meId))
}
