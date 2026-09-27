import type { CommentItem, CommentReaction } from '@/types/profile'

/** The six quick reactions in the hover bar, in display order. */
export const QUICK_REACTIONS: readonly { emoji: string; label: string }[] = [
  { emoji: '👍', label: 'Like' },
  { emoji: '👎', label: 'Dislike' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '😂', label: 'Haha' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '😮', label: 'Wow' },
]

/** Human label for an emoji; quick reactions get their name, anything else the emoji itself. */
export function reactionLabel(emoji: string): string {
  return QUICK_REACTIONS.find(option => option.emoji === emoji)?.label ?? emoji
}

/** Highest counts first, ties by first appearance, zero counts dropped, at most `limit` entries. */
export function topReactions(list: readonly CommentReaction[] | undefined | null, limit = 3): CommentReaction[] {
  if (!Array.isArray(list)) return []
  return list
    .filter(entry => entry && typeof entry.emoji === 'string' && entry.emoji.length > 0 && Number.isFinite(entry.count) && entry.count > 0)
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.count - a.entry.count || a.index - b.index)
    .slice(0, Math.max(0, limit))
    .map(({ entry }) => ({ emoji: entry.emoji, count: entry.count }))
}

/** The total the server would report; reaction_count wins, like_count is the legacy mirror. */
export function reactionTotal(item: Pick<CommentItem, 'reaction_count' | 'like_count'>): number {
  const total = typeof item.reaction_count === 'number' ? item.reaction_count : item.like_count
  return Number.isFinite(total) && total > 0 ? total : 0
}

/**
 * The optimistic result of the viewer choosing `nextEmoji` (or null to remove).
 * Moves the viewer's single vote between tallies, keeps the total honest and the
 * top-three ordering intact. Pure: returns a new item, never mutates.
 */
export function applyReaction<T extends CommentItem>(item: T, nextEmoji: string | null): T {
  const previous = item.viewer_reaction ?? null
  const next = nextEmoji && nextEmoji.length > 0 ? nextEmoji : null
  if (previous === next) return { ...item, viewer_reaction: next, reactions: topReactions(item.reactions), reaction_count: reactionTotal(item), like_count: reactionTotal(item) }

  const tallies = new Map<string, number>()
  for (const entry of item.reactions ?? []) {
    if (entry && typeof entry.emoji === 'string' && entry.emoji) tallies.set(entry.emoji, Math.max(0, entry.count ?? 0))
  }
  if (previous) tallies.set(previous, Math.max(0, (tallies.get(previous) ?? 0) - 1))
  if (next) tallies.set(next, (tallies.get(next) ?? 0) + 1)

  const total = Math.max(0, reactionTotal(item) - (previous ? 1 : 0) + (next ? 1 : 0))
  const reactions = topReactions([...tallies.entries()].map(([emoji, count]) => ({ emoji, count })))
  return { ...item, viewer_reaction: next, reactions, reaction_count: total, like_count: total }
}

/** Replace the comment `id` wherever it appears in a comment list, including first-reply previews. */
export function patchCommentInList<T extends CommentItem>(list: readonly T[], id: string, patch: (item: T) => T): T[] {
  let changed = false
  const next = list.map(item => {
    let current = item
    if (current.id === id) { current = patch(current); changed = true }
    if (current.reply && current.reply.id === id) {
      current = { ...current, reply: patch(current.reply as T) }
      changed = true
    }
    return current
  })
  return changed ? next : (list as T[])
}
