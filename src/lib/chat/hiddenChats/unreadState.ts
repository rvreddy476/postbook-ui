/*
  The browser-wide unread state (contexts/NotificationContext, persisted in
  localStorage as `postbook_unread_state`) keys counts, last-seen times and
  person → conversation by conversation id. A hidden chat must leave no
  trace there: no count in the badge and no id on disk. This removes every
  mention of the given conversations.
*/

export interface UnreadStateLike {
  counts: Record<string, number>
  lastSeenTimestamps: Record<string, string>
  userConvMap: Record<string, string>
}

/** The state without these conversations; the same object when none of them appear. */
export function withoutConversations<T extends UnreadStateLike>(state: T, ids: Iterable<string>): T {
  const drop = new Set<string>()
  for (const id of ids) if (id) drop.add(id)
  if (drop.size === 0) return state
  const mentioned =
    Object.keys(state.counts).some((k) => drop.has(k)) ||
    Object.keys(state.lastSeenTimestamps).some((k) => drop.has(k)) ||
    Object.values(state.userConvMap).some((v) => drop.has(v))
  if (!mentioned) return state
  const keep = <V,>(rec: Record<string, V>) => Object.fromEntries(Object.entries(rec).filter(([k]) => !drop.has(k))) as Record<string, V>
  return {
    ...state,
    counts: keep(state.counts),
    lastSeenTimestamps: keep(state.lastSeenTimestamps),
    userConvMap: Object.fromEntries(Object.entries(state.userConvMap).filter(([, v]) => !drop.has(v))),
  }
}
