/*
  Who a post or a message is going to: the pure half of ChatTargetPicker.

  A target is either a chat that already exists (a DM or a group, keyed by its
  conversation id) or a person found by search with whom no chat exists yet
  (keyed by user id; the chat is opened only when Send is pressed). A person
  who already has a DM with me always becomes that DM, so the same chat can
  never be picked twice under two keys.
*/

import { FORWARD_MAX_TARGETS, type InboxRow } from '@/lib/chat/contract'
import { primaryRows, rowName, withoutDating } from '@/lib/chat/inbox'
import type { User } from '@/types'

export interface ChatTarget {
  key: string
  kind: 'conversation' | 'person'
  conversationId: string | null
  userId: string | null
  name: string
  avatarUrl: string | null
  isGroup: boolean
  /** Shown as a dot on the avatar; only an explicit true. */
  isOnline?: boolean
  /** "@handle" or "Group" under the name in a list. */
  subtitle?: string | null
}

export const conversationKey = (conversationId: string) => `c:${conversationId}`
export const personKey = (userId: string) => `p:${userId}`

/** The picker's cap: the given max, kept within 1..FORWARD_MAX_TARGETS (the server's cap). */
export function pickLimit(max?: number): number {
  if (typeof max !== 'number' || !Number.isFinite(max)) return FORWARD_MAX_TARGETS
  return Math.max(1, Math.min(FORWARD_MAX_TARGETS, Math.floor(max)))
}

export function pickLimitHint(max: number): string {
  return `You can pick up to ${max}`
}

/** An inbox row as a target. */
export function targetFromRow(row: InboxRow, myId: string): ChatTarget {
  return {
    key: conversationKey(row.id),
    kind: 'conversation',
    conversationId: row.id,
    userId: row.isGroup ? null : (row.peer?.userId ?? null),
    name: rowName(row, myId),
    avatarUrl: row.isGroup ? row.avatarUrl : (row.peer?.avatarUrl ?? row.avatarUrl),
    isGroup: row.isGroup,
    isOnline: !row.isGroup && row.peer?.isOnline === true,
    subtitle: row.isGroup ? 'Group' : row.peer?.username ? `@${row.peer.username}` : null,
  }
}

/** A searched person as a target: their existing DM when there is one, else a person target. */
export function targetFromUser(user: Pick<User, 'id' | 'name' | 'username' | 'avatar' | 'isOnline'>, chats: readonly ChatTarget[]): ChatTarget {
  const dm = chats.find((c) => c.kind === 'conversation' && !c.isGroup && c.userId === user.id)
  if (dm) return dm
  return {
    key: personKey(user.id),
    kind: 'person',
    conversationId: null,
    userId: user.id,
    name: (user.name || '').trim() || (user.username ? `@${user.username}` : 'Someone'),
    avatarUrl: user.avatar || null,
    isGroup: false,
    isOnline: user.isOnline === true,
    subtitle: user.username ? `@${user.username}` : null,
  }
}

/** Two targets that would land in the same chat. */
export function sameTarget(a: ChatTarget, b: ChatTarget): boolean {
  if (a.key === b.key) return true
  return !a.isGroup && !b.isGroup && Boolean(a.userId) && a.userId === b.userId
}

export function isPicked(selected: readonly ChatTarget[], t: ChatTarget): boolean {
  return selected.some((s) => sameTarget(s, t))
}

export interface ToggleResult {
  next: ChatTarget[]
  /** True when the pick was refused because the cap is reached. */
  atLimit: boolean
}

/** Tap on a target: unpick it if picked, else pick it unless the cap is reached. */
export function toggleTarget(selected: readonly ChatTarget[], t: ChatTarget, max: number): ToggleResult {
  if (isPicked(selected, t)) return { next: selected.filter((s) => !sameTarget(s, t)), atLimit: false }
  if (selected.length >= pickLimit(max)) return { next: selected.slice(), atLimit: true }
  return { next: [...selected, t], atLimit: false }
}

export interface PickerRowOptions {
  includeGroups?: boolean
  excludeConversationIds?: readonly string[]
}

/**
 * The chats a picker offers, in inbox order: primary lane only (no incoming
 * requests, nothing archived), never dating chats, never broadcast channels
 * (only their admins can post), groups unless turned off, minus exclusions.
 */
export function pickerTargets(rows: readonly InboxRow[], myId: string, opts: PickerRowOptions = {}): ChatTarget[] {
  const exclude = new Set(opts.excludeConversationIds ?? [])
  const includeGroups = opts.includeGroups !== false
  return primaryRows(withoutDating(rows), myId)
    .filter((r) => r.type !== 'channel' && !exclude.has(r.id) && (includeGroups || !r.isGroup))
    .map((r) => targetFromRow(r, myId))
}

/** Loaded chats whose name or handle contains the query (case-insensitive). */
export function filterTargets(targets: readonly ChatTarget[], query: string): ChatTarget[] {
  const q = query.trim().toLowerCase().replace(/^@/, '')
  if (!q) return targets.slice()
  return targets.filter((t) => t.name.toLowerCase().includes(q) || (t.subtitle ?? '').toLowerCase().replace(/^@/, '').includes(q))
}

/**
 * Search results as one list: matching chats first, then people (mapped to
 * their DM when one exists), each chat once, never myself.
 */
export function searchResults(chats: readonly ChatTarget[], query: string, people: readonly Pick<User, 'id' | 'name' | 'username' | 'avatar' | 'isOnline'>[], myId: string): ChatTarget[] {
  const out: ChatTarget[] = []
  const add = (t: ChatTarget) => {
    if (!out.some((o) => sameTarget(o, t))) out.push(t)
  }
  for (const t of filterTargets(chats, query)) add(t)
  for (const u of people) {
    if (!u.id || u.id === myId) continue
    add(targetFromUser(u, chats))
  }
  return out
}
