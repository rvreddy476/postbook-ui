'use client'

import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { writeGroupReaction, type ReactionTransport } from '@/lib/groupReactions'
import type { GroupReaction } from '@/types/groups'
import { applyGroupFeedPatch, isGroupPostCacheKey } from '@/components/groups/patchGroupFeed'

const writes = new WeakMap<QueryClient, Set<string>>()

export async function commitGroupReaction(qc: QueryClient, transport: ReactionTransport, groupId: string, postId: string, reaction: GroupReaction | null) {
  const key = `${groupId}/${postId}`
  const active = writes.get(qc) ?? new Set<string>()
  writes.set(qc, active)
  if (active.has(key)) throw new Error('A reaction is already being saved.')
  active.add(key)
  const filters = { predicate: (query: { queryKey: readonly unknown[] }) => isGroupPostCacheKey(query.queryKey, groupId) }
  try {
    await qc.cancelQueries(filters)
    const state = await writeGroupReaction(transport, groupId, postId, reaction)
    // Also stop reads started during the write from restoring pre-write state.
    await qc.cancelQueries(filters)
    applyGroupFeedPatch(qc, groupId, postId, state)
    return state
  } finally { active.delete(key) }
}

export function useGroupReaction(groupId: string, postId: string) {
  const qc = useQueryClient()
  const mutationKey = ['group-reaction', groupId, postId]
  const busy = useIsMutating({ mutationKey }) > 0
  const mutation = useMutation({
    mutationKey,
    mutationFn: (reaction: GroupReaction | null) => commitGroupReaction(qc, api, groupId, postId, reaction),
    retry: false,
  })
  return { ...mutation, busy }
}
