import type { LiveChatAuthor, LiveChatAuthorRole, LiveChatMessage } from "./model"
import { str } from "./model"

// Who wrote a chat message (contract 2 Oct 2026). Every chat row — the
// GET /streams/:id/chat list, the POST answer and the `chat.message` frame —
// carries
//   author: {user_id, name?, handle?, avatar_url?, badges: [], role: "host|moderator|viewer"}
// hydrated by live-service-v2. Only user_id and role are guaranteed; a
// failed lookup leaves the rest out. The web never asks another service for
// a chat name and never prints a piece of a user id.

type Obj = Record<string, unknown>

function asObj(v: unknown): Obj | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null
}

export const VIEWER_NAME = "Viewer"

function parseRole(raw: unknown): LiveChatAuthorRole {
  return raw === "host" || raw === "moderator" ? raw : "viewer"
}

function badgeKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const entry of raw) {
    const key = str(entry)
    if (key && !out.includes(key)) out.push(key)
  }
  return out
}

/** The author card of one row; null when the row carries none (an older backend). */
export function parseChatAuthor(raw: unknown, fallbackUserId = ""): LiveChatAuthor | null {
  const o = asObj(raw)
  if (!o) return null
  return {
    user_id: str(o.user_id) || fallbackUserId,
    name: str(o.name).trim(),
    handle: str(o.handle).trim().replace(/^@/, ""),
    avatar_url: str(o.avatar_url),
    badges: badgeKeys(o.badges),
    role: parseRole(o.role),
  }
}

/** One chat row as GET /chat, the POST answer and the frame all send it; null without an id. */
export function parseChatMessage(raw: unknown): LiveChatMessage | null {
  const o = asObj(raw)
  const id = str(o?.id)
  if (!o || !id) return null
  const userId = str(o.user_id) || str(asObj(o.author)?.user_id)
  return {
    id,
    stream_id: str(o.stream_id),
    user_id: userId,
    text: str(o.text),
    is_pinned: o.is_pinned === true,
    created_at: str(o.created_at),
    author: parseChatAuthor(o.author, userId),
  }
}

/** GET /streams/:id/chat → {data:[row…]}; anything else is no messages. */
export function parseChatList(body: unknown): LiveChatMessage[] {
  const data = asObj(body)?.data
  if (!Array.isArray(data)) return []
  const out: LiveChatMessage[] = []
  for (const raw of data) {
    const row = parseChatMessage(raw)
    if (row) out.push(row)
  }
  return out
}

type AuthorLike = Pick<LiveChatAuthor, "name" | "handle"> | null | undefined

/** The name on a chat row: the name, else @handle, else "Viewer". Never an id. */
export function chatAuthorName(author: AuthorLike): string {
  const name = str(author?.name).trim()
  if (name) return name
  const handle = str(author?.handle).trim().replace(/^@/, "")
  if (handle) return `@${handle}`
  return VIEWER_NAME
}

export type ChatRoleTag = "Host" | "Mod"

/**
 * The mark beside a name. The row's own author.role decides; a row with no
 * author card (an older backend) falls back to the stream's host id and
 * moderator list.
 */
export function chatRoleTag(
  message: Pick<LiveChatMessage, "user_id" | "author">,
  hostId: string,
  moderators: readonly string[],
): ChatRoleTag | undefined {
  const author = message.author
  if (author) return author.role === "host" ? "Host" : author.role === "moderator" ? "Mod" : undefined
  if (message.user_id && message.user_id === hostId) return "Host"
  return moderators.includes(message.user_id) ? "Mod" : undefined
}

export function chatAuthorAvatar(author: Pick<LiveChatAuthor, "avatar_url"> | null | undefined): string | null {
  return str(author?.avatar_url) || null
}

/**
 * The authors seen in chat so far, by user id. It only grows, so a person
 * whose messages were removed (a ban) still has a name in the moderation
 * panel. A later card replaces an earlier one only when it can be named.
 */
export function collectAuthors(
  seen: ReadonlyMap<string, LiveChatAuthor>,
  messages: readonly Pick<LiveChatMessage, "user_id" | "author">[],
): Map<string, LiveChatAuthor> {
  const next = new Map(seen)
  for (const m of messages) {
    const author = m.author
    const id = author?.user_id || m.user_id
    if (!author || !id) continue
    const known = next.get(id)
    if (!known || author.name || author.handle) next.set(id, author)
  }
  return next
}

/** The name of a user id from the authors seen in chat, else "Viewer". */
export function nameFromAuthors(seen: ReadonlyMap<string, LiveChatAuthor>, userId: string): string {
  return chatAuthorName(seen.get(userId))
}
