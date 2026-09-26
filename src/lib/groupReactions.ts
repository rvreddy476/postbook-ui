import type { GroupPostV2, GroupReaction, GroupReactionState } from '@/types/groups'

import { REACTIONS as GROUP_REACTIONS } from '@/lib/reactions'
export { REACTIONS as GROUP_REACTIONS } from '@/lib/reactions'

export function isGroupReaction(value: unknown): value is GroupReaction {
  return GROUP_REACTIONS.some(option => option.value === value)
}

export function currentGroupReaction(post: GroupPostV2): GroupReaction | null {
  if (isGroupReaction(post.viewer_reaction)) return post.viewer_reaction
  return post.viewer_sparked === true ? 'like' : null
}

export function parseGroupReactionState(body: unknown, postId: string): GroupReactionState {
  const envelope = body as { data?: GroupReactionState; error?: unknown } | null
  const state = envelope?.data
  if (envelope?.error || !state || state.post_id !== postId ||
    !(state.reaction === null || isGroupReaction(state.reaction)) ||
    !Number.isSafeInteger(state.spark_count) || state.spark_count < 0 ||
    typeof state.viewer_sparked !== 'boolean' || state.viewer_sparked !== (state.reaction !== null) ||
    !state.reaction_counts || typeof state.reaction_counts !== 'object' || Array.isArray(state.reaction_counts) ||
    Object.entries(state.reaction_counts).some(([key, count]) => !isGroupReaction(key) || !Number.isSafeInteger(count) || count < 0)) {
    throw new Error('Reaction could not be confirmed. Please retry.')
  }
  // spark_count is weighted for legacy supernovas; never sum emoji tallies.
  return state
}

export interface ReactionTransport {
  put: (url: string, body: { reaction: GroupReaction }) => Promise<{ data: unknown }>
  delete: (url: string) => Promise<{ data: unknown }>
}

export async function writeGroupReaction(transport: ReactionTransport, groupId: string, postId: string, reaction: GroupReaction | null) {
  if (reaction !== null && !isGroupReaction(reaction)) throw new Error('Invalid reaction')
  const url = `/v1/groups/${encodeURIComponent(groupId)}/posts/v2/${encodeURIComponent(postId)}/reaction`
  const response = reaction === null ? await transport.delete(url) : await transport.put(url, { reaction })
  return parseGroupReactionState(response.data, postId)
}
