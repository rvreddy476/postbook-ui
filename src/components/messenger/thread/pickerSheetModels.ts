/*
  Pure helpers for the thread's Reactions, Seen by and Report sheets.
*/

import type { ReactionGroup, ReactionUser } from '@/lib/chat/contract'
import { shortAgo } from '@/lib/chat/inbox'
import type { MessageReportReason } from '@/services/chatParityApi'

/* ---- Reactions --------------------------------------------------- */

/**
 * The message's own reaction list as groups, for when the reactions route is
 * not there yet: names from the thread's member list, biggest first, empty
 * emoji and duplicate users dropped.
 */
export function fallbackReactionGroups(
  fallback: readonly { emoji: string; user_ids: readonly string[] }[],
  nameOf: (userId: string) => string,
  avatarOf?: (userId: string) => string | null,
): ReactionGroup[] {
  const out: ReactionGroup[] = []
  for (const r of fallback) {
    const emoji = (r.emoji ?? '').trim()
    if (!emoji) continue
    const ids = Array.from(new Set((r.user_ids ?? []).filter(Boolean)))
    if (ids.length === 0) continue
    const users: ReactionUser[] = ids.map((id) => ({ userId: id, displayName: nameOf(id), avatarUrl: avatarOf?.(id) ?? null }))
    const existing = out.find((g) => g.emoji === emoji)
    if (existing) {
      for (const u of users) if (!existing.users.some((x) => x.userId === u.userId)) existing.users.push(u)
      existing.count = existing.users.length
    } else {
      out.push({ emoji, count: users.length, users })
    }
  }
  return out.sort((a, b) => b.count - a.count)
}

export interface ReactionTab {
  /** 'all' or the emoji itself. */
  key: string
  label: string
  count: number
}

/** "All" first, then one tab per emoji with its count. */
export function reactionTabs(groups: readonly ReactionGroup[]): ReactionTab[] {
  const total = groups.reduce((n, g) => n + g.count, 0)
  return [{ key: 'all', label: 'All', count: total }, ...groups.map((g) => ({ key: g.emoji, label: g.emoji, count: g.count }))]
}

export interface Reactor {
  user: ReactionUser
  emojis: string[]
}

/** Who reacted under a tab; under "All" each person once, with every emoji they used. */
export function reactorsFor(groups: readonly ReactionGroup[], tab: string): Reactor[] {
  const out: Reactor[] = []
  for (const g of groups) {
    if (tab !== 'all' && g.emoji !== tab) continue
    for (const u of g.users) {
      const r = out.find((x) => x.user.userId === u.userId)
      if (r) {
        if (!r.emojis.includes(g.emoji)) r.emojis.push(g.emoji)
      } else {
        out.push({ user: u, emojis: [g.emoji] })
      }
    }
  }
  return out
}

/* ---- Seen by ----------------------------------------------------- */

export function seenByTitle(count: number): string {
  return count > 0 ? `Seen by ${count}` : 'Seen by'
}

/** "Just now", "5m ago", "3h ago"; empty when the time is unknown. */
export function seenAtLabel(iso: string | null | undefined, now = Date.now()): string {
  const s = shortAgo(iso, now)
  if (!s) return ''
  return s === 'now' ? 'Just now' : `${s} ago`
}

/* ---- Report ------------------------------------------------------ */

export const REPORT_REASON_LABELS: Record<MessageReportReason, string> = {
  spam: 'Spam',
  harassment: 'Harassment or bullying',
  hate: 'Hate speech',
  sexual: 'Nudity or sexual content',
  violence: 'Violence or threats',
  scam: 'Scam or fraud',
  other: 'Something else',
}

export const REPORT_NOTE_MAX = 500

/** The note as sent: trimmed, at most 500 characters, undefined when empty. */
export function reportNote(note: string): string | undefined {
  const t = note.trim().slice(0, REPORT_NOTE_MAX).trim()
  return t || undefined
}
