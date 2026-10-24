'use client'

import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthUser } from '@/store/auth'
import {
  loadFollowRequests,
  removeFollowRequest,
  respondToFollowRequest,
  type FollowRequestDecision,
  type FollowRequestHttp,
  type FollowRequestLoad,
} from '@/lib/followRequests'

const http: FollowRequestHttp = {
  get: async (path) => (await api.get<unknown>(path)).data,
  post: async (path, body) => (await api.post<unknown>(path, body)).data,
}

export const followRequestsKey = (userId: string | undefined) => ['follow-requests', 'incoming', userId] as const

/** The viewer's pending incoming follow requests, newest first, paged. */
export function useIncomingFollowRequests() {
  const user = useAuthUser()
  return useInfiniteQuery({
    queryKey: followRequestsKey(user?.id),
    enabled: !!user?.id,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }): Promise<FollowRequestLoad> => loadFollowRequests(http, pageParam),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    refetchInterval: (query) => ((query.state.data?.pages.length ?? 0) <= 1 ? 60_000 : false),
  })
}

/**
 * Accept or decline. The answered row leaves the list at once; a refusal
 * puts the list back. A 404 means it was already answered (or withdrawn),
 * so the row stays gone either way.
 */
export function useRespondToFollowRequest() {
  const qc = useQueryClient()
  const user = useAuthUser()
  const key = followRequestsKey(user?.id)
  return useMutation({
    mutationFn: async ({ requesterId, decision }: { requesterId: string; decision: FollowRequestDecision }) => {
      await respondToFollowRequest(http, requesterId, decision)
      return { requesterId, decision }
    },
    onMutate: async ({ requesterId }) => {
      await qc.cancelQueries({ queryKey: key })
      const before = qc.getQueryData<InfiniteData<FollowRequestLoad>>(key)
      if (before) qc.setQueryData<InfiniteData<FollowRequestLoad>>(key, { ...before, pages: removeFollowRequest(before.pages, requesterId) })
      return { before }
    },
    onError: (err, _vars, ctx) => {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status !== 404 && ctx?.before) qc.setQueryData(key, ctx.before)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['follow-requests'] })
      // An accept adds a follower: the counts and lists that show them.
      qc.invalidateQueries({ queryKey: ['connections'] })
      qc.invalidateQueries({ queryKey: ['relationship'] })
      qc.invalidateQueries({ queryKey: ['relationships', 'batch'] })
      qc.invalidateQueries({ queryKey: ['aggregated-profile'] })
    },
  })
}
