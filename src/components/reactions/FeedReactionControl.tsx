'use client'
import type { PostDetail } from '@/types/profile'
import { normalizeReaction } from '@/lib/reactions'
import { useFeedReaction } from '@/hooks/useFeedReaction'
import ReactionControl from './ReactionControl'
export default function FeedReactionControl({post,align='start'}: {post:PostDetail;align?:'start'|'end'}) {
  const mutation=useFeedReaction(post.id)
  const current=normalizeReaction(post.viewer_reaction)
  return <ReactionControl align={align} current={current} count={post.counts?.likes ?? 0} disabled={mutation.busy}
    onChange={next=>mutation.mutateAsync({next,current})}/>
}
