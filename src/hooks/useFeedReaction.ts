'use client'
import { useIsMutating, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { normalizeReaction, postReactionName, type Reaction } from '@/lib/reactions'
import type { PostDetail } from '@/types/profile'

export function parsePostReaction(body: unknown) {
  const data = (body as {data?: {reaction_type?:string; is_set?:boolean; counts?:Record<string,number>}})?.data
  if (!data || typeof data.is_set !== 'boolean' || (data.is_set && !normalizeReaction(data.reaction_type))) throw new Error('Reaction not confirmed')
  if (data.counts && (!Number.isSafeInteger(data.counts.total) || Object.values(data.counts).some(value => !Number.isSafeInteger(value) || value < 0))) throw new Error('Invalid reaction counts')
  return { reaction: data.is_set ? normalizeReaction(data.reaction_type) : null, counts: data.counts ?? null }
}
type State = ReturnType<typeof parsePostReaction>
const prefixes = ['home-feed', 'profile-posts', 'post-detail', 'saved-posts']
export function patchPostReactions(qc: QueryClient, postId: string, state: State) {
  const replace = (post: PostDetail): PostDetail => post.id !== postId ? post : {
    ...post, viewer_reaction: state.reaction ? postReactionName(state.reaction) : null,
    ...(state.counts ? {counts: {...post.counts, comments:post.counts?.comments ?? 0, likes:state.counts.total}} : {}),
  }
  for (const [key] of qc.getQueriesData({predicate:query=>prefixes.includes(String(query.queryKey[0]))})) {
    qc.setQueryData(key, (old: any) => !old ? old : Array.isArray(old) ? old.map(replace) : old.pages ? {...old,pages:old.pages.map((page:any)=>({...page,data:page.data.map(replace)}))} : old.id ? replace(old) : old)
  }
  if (state.counts) qc.setQueryData(['reaction-counts',postId],state.counts)
}
const active = new WeakMap<QueryClient, Set<string>>()
export function useFeedReaction(postId: string) {
  const qc = useQueryClient()
  const mutationKey = ['feed-reaction',postId]
  const busy = useIsMutating({mutationKey}) > 0
  const mutation = useMutation({mutationKey, retry:false, mutationFn:async ({next,current}:{next:Reaction|null;current:Reaction|null})=>{
    const locks = active.get(qc) ?? new Set<string>(); active.set(qc,locks)
    if (locks.has(postId)) throw new Error('Reaction pending')
    locks.add(postId)
    const filters={predicate:(query:{queryKey:readonly unknown[]})=>prefixes.includes(String(query.queryKey[0]))}
    try {
      await qc.cancelQueries(filters)
      // This service is a TOGGLE, not the group's idempotent PUT. Never retry it automatically.
      const res = await api.post(`/v1/posts/${postId}/react`,{reaction_type:postReactionName(next ?? current ?? 'like')})
      const state=parsePostReaction(res.data)
      await qc.cancelQueries(filters)
      patchPostReactions(qc,postId,state)
      if (!state.counts) void qc.invalidateQueries(filters)
      return state
    } catch (error) {
      // Recover ambiguous toggle outcomes from reads before another user action.
      await qc.invalidateQueries(filters)
      throw error
    } finally {locks.delete(postId)}
  }})
  return {...mutation,busy}
}
