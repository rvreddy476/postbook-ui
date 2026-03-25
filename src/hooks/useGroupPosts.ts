import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { GroupPostV2 } from '@/types/groups'

// Re-export for backward compat
export type { GroupPostV2 }

export function useGroupPosts(groupId: string, channelId?: string) {
  return useQuery({
    queryKey: ['group-posts', groupId, channelId],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '20' })
      if (channelId) params.set('channel_id', channelId)
      const res = await api.get<{ data: { items: GroupPostV2[] } }>(`/v1/groups/${groupId}/posts?${params}`)
      return res.data.data?.items ?? []
    },
    enabled: !!groupId,
  })
}

export function useCreateGroupPost(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { body: string; channel_id?: string; content_type?: string; title?: string }) => {
      const res = await api.post(`/v1/groups/${groupId}/posts`, payload)
      return res.data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group-posts', groupId] }),
  })
}

export function useSparkGroupPost(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (postId: string) => { await api.post(`/v1/groups/${groupId}/posts/${postId}/spark`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group-posts', groupId] }),
  })
}

export function useStashGroupPost(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (postId: string) => { await api.post(`/v1/groups/${groupId}/posts/${postId}/stash`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group-posts', groupId] }),
  })
}
