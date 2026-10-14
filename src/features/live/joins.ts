import type { LiveChatAuthor, LiveChatMessage } from "./model"
import { str } from "./model"
import { VIEWER_NAME, chatAuthorName } from "./author"

// Join notices ("<name> joined") as client-side system rows (parity audit
// T-29). live-service-v2 publishes `viewer.joined` (features/live/realtime.ts)
// at most once per viewer per stream per minute; there is no HTTP read of
// joins, so they are never persisted, never merged into the HTTP chat
// history (ChatState.messages) and a missed frame is simply not shown.
//
// Rules kept here so they are testable without React:
//   - a join is stored once per person per burst window and the store is capped;
//   - the reader's own join is never shown;
//   - joins that land together (no chat message between them, within
//     JOIN_BURST_MS of the first) collapse into one row:
//     "Asha joined", "Asha and Ravi joined", "Asha, Ravi and Mei joined",
//     "Asha, Ravi and 3 others joined";
//   - the name is chatAuthorName (name, else @handle, else "Viewer"), never
//     a piece of a user id.

export interface LiveJoin {
  user_id: string
  author: LiveChatAuthor | null
  /** Epoch ms, from the frame's joined_at. */
  at: number
}

/** Raw joins kept per stream (oldest dropped first). */
export const MAX_JOINS = 40
/** Join rows shown at most (oldest dropped first). */
export const MAX_JOIN_ROWS = 12
/** Joins within this window of a row's first join collapse into that row. */
export const JOIN_BURST_MS = 5_000
/** Names written out before "and N others". */
export const JOIN_NAMES_SHOWN = 2

/** The join's time in ms; `fallback` when joined_at does not parse. */
export function joinTime(joinedAt: string, fallback: number): number {
  const t = Date.parse(str(joinedAt))
  return Number.isFinite(t) ? t : fallback
}

/**
 * Store one join: a second join by the same person within the burst window
 * is the same arrival (redelivery), and the store keeps the newest MAX_JOINS.
 */
export function addJoin(joins: readonly LiveJoin[], join: LiveJoin, max = MAX_JOINS): LiveJoin[] {
  if (!join.user_id) return joins as LiveJoin[]
  if (joins.some((j) => j.user_id === join.user_id && Math.abs(j.at - join.at) < JOIN_BURST_MS)) return joins as LiveJoin[]
  return [...joins, join].sort((a, b) => a.at - b.at).slice(-Math.max(0, max))
}

/** "Asha joined" · "Asha and Ravi joined" · "Asha, Ravi and Mei joined" · "Asha, Ravi and 3 others joined" · "4 viewers joined". */
export function joinLabel(authors: readonly (Pick<LiveChatAuthor, "name" | "handle"> | null)[]): string {
  const total = authors.length
  if (total === 0) return ""
  const names = authors.map((a) => chatAuthorName(a))
  const named = names.filter((n) => n !== VIEWER_NAME)
  if (named.length === 0) return total === 1 ? `${VIEWER_NAME} joined` : `${total} viewers joined`
  const shown = total <= JOIN_NAMES_SHOWN + 1 && named.length === total ? named : named.slice(0, JOIN_NAMES_SHOWN)
  const others = total - shown.length
  if (others === 0) {
    if (shown.length === 1) return `${shown[0]} joined`
    return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]} joined`
  }
  return `${shown.join(", ")} and ${others} ${others === 1 ? "other" : "others"} joined`
}

export type ChatTimelineItem =
  | { kind: "message"; message: LiveChatMessage }
  | { kind: "joins"; key: string; at: number; user_ids: string[]; label: string }

/**
 * Chat messages and join rows in one time-ordered list. Messages keep their
 * order; a join is placed before the first message that is newer than it.
 * Consecutive joins within JOIN_BURST_MS of the row's first join collapse,
 * and only the newest MAX_JOIN_ROWS rows are kept.
 */
export function chatTimeline(
  messages: readonly LiveChatMessage[],
  joins: readonly LiveJoin[],
  meId: string | null | undefined,
  opts: { burstMs?: number; maxRows?: number } = {},
): ChatTimelineItem[] {
  const burstMs = opts.burstMs ?? JOIN_BURST_MS
  const maxRows = opts.maxRows ?? MAX_JOIN_ROWS
  const me = str(meId)
  const pending = joins.filter((j) => j.user_id && j.user_id !== me).sort((a, b) => a.at - b.at)

  type Group = { at: number; members: LiveJoin[] }
  const out: (ChatTimelineItem | Group)[] = []
  let group: Group | null = null
  const pushJoin = (j: LiveJoin) => {
    if (group && j.at - group.at <= burstMs) {
      if (!group.members.some((m) => m.user_id === j.user_id)) group.members.push(j)
      return
    }
    group = { at: j.at, members: [j] }
    out.push(group)
  }

  let i = 0
  for (const message of messages) {
    const t = Date.parse(message.created_at)
    const msgAt = Number.isFinite(t) ? t : Number.POSITIVE_INFINITY
    while (i < pending.length && pending[i].at < msgAt) pushJoin(pending[i++])
    group = null // a message ends a burst
    out.push({ kind: "message", message })
  }
  while (i < pending.length) pushJoin(pending[i++])

  const rows = out.filter((x): x is Group => !("kind" in x))
  const dropped = new Set(rows.slice(0, Math.max(0, rows.length - Math.max(0, maxRows))))
  const items: ChatTimelineItem[] = []
  for (const x of out) {
    if ("kind" in x) { items.push(x); continue }
    if (dropped.has(x)) continue
    items.push({
      kind: "joins",
      key: `join-${x.members[0].user_id}-${x.at}`,
      at: x.at,
      user_ids: x.members.map((m) => m.user_id),
      label: joinLabel(x.members.map((m) => m.author)),
    })
  }
  return items
}
