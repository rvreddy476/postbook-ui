/*
  Dating chats stay out of Messages (founder decision, 18 Oct 2026).

  A Pulse match's chat is a chat-service conversation with
  source_app "dating"; it belongs to the dating product and is read there.
  The messenger's conversation list, and every unread count derived from
  it, leave those conversations out. Nothing here touches the dating screens.
*/

export const DATING_SOURCE_APP = 'dating'

/** True for a conversation owned by the dating product. */
export function isDatingConversation(conv: { source_app?: unknown } | null | undefined): boolean {
  return typeof conv?.source_app === 'string' && conv.source_app.trim().toLowerCase() === DATING_SOURCE_APP
}

/** The messenger's conversations: everything but dating chats. */
export function messengerConversations<T extends { source_app?: unknown }>(list: readonly T[] | null | undefined): T[] {
  return (list ?? []).filter((c) => !isDatingConversation(c))
}

/** The ids of the dating chats in a conversation list (id or conversation_id). */
export function datingConversationIds(list: readonly { id?: unknown; conversation_id?: unknown; source_app?: unknown }[] | null | undefined): string[] {
  const out: string[] = []
  for (const c of list ?? []) {
    if (!isDatingConversation(c)) continue
    const id = typeof c.conversation_id === 'string' && c.conversation_id ? c.conversation_id : typeof c.id === 'string' ? c.id : ''
    if (id) out.push(id)
  }
  return out
}

/** Total unread across the messenger, without any dating chat. */
export function messengerUnreadTotal(counts: Readonly<Record<string, number>>, datingIds: ReadonlySet<string>): number {
  let total = 0
  for (const [convId, n] of Object.entries(counts)) {
    if (datingIds.has(convId)) continue
    if (typeof n === 'number' && Number.isFinite(n) && n > 0) total += n
  }
  return total
}

/** Unread for one person's thread; 0 when the thread mapped to them is a dating chat. */
export function messengerUnreadForUser(
  userId: string,
  userConvMap: Readonly<Record<string, string>>,
  counts: Readonly<Record<string, number>>,
  datingIds: ReadonlySet<string>,
): number {
  const convId = userConvMap[userId]
  if (!convId || datingIds.has(convId)) return 0
  return counts[convId] || 0
}

/**
 * The unread state with the dating chats taken out: their counts dropped and
 * any person mapped to one unmapped, so a stored count from before this rule
 * (or from a live message that arrived before its chat was known to be a
 * dating one) stops counting. Returns the same object when nothing changes.
 */
export function withoutDatingUnread<S extends { counts: Record<string, number>; userConvMap: Record<string, string> }>(
  state: S,
  datingIds: ReadonlySet<string>,
): S {
  if (datingIds.size === 0) return state
  const countKeys = Object.keys(state.counts).filter((id) => datingIds.has(id))
  const userKeys = Object.keys(state.userConvMap).filter((u) => datingIds.has(state.userConvMap[u]))
  if (countKeys.length === 0 && userKeys.length === 0) return state
  const counts = { ...state.counts }
  for (const id of countKeys) delete counts[id]
  const userConvMap = { ...state.userConvMap }
  for (const u of userKeys) delete userConvMap[u]
  return { ...state, counts, userConvMap }
}
