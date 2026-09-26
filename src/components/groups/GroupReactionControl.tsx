'use client'
import { currentGroupReaction, GROUP_REACTIONS } from '@/lib/groupReactions'
import { useGroupReaction } from '@/hooks/useGroupReaction'
import type { GroupPostV2 } from '@/types/groups'
import ReactionControl from '@/components/reactions/ReactionControl'

export function GroupReactionSummary({ post }: { post: GroupPostV2 }) {
  const counts = GROUP_REACTIONS.filter(option => (post.reaction_counts?.[option.value] ?? 0) > 0)
  if (!counts.length) return null
  return <div className="reaction-summary" aria-label="Reaction counts">{counts.map(option =>
    <span key={option.value} aria-label={`${option.label}: ${post.reaction_counts![option.value]}`} title={option.label}>
      <span aria-hidden="true">{option.emoji}</span> {post.reaction_counts![option.value]}
    </span>)}</div>
}
export default function GroupReactionControl({ post, groupId }: { post: GroupPostV2; groupId: string }) {
  const mutation = useGroupReaction(groupId, post.id)
  return <ReactionControl current={currentGroupReaction(post)} count={post.spark_count} disabled={mutation.busy}
    onChange={reaction => mutation.mutateAsync(reaction)} />
}
