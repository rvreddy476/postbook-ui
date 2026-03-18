import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface GroupChannelV2 {
  id: string; group_id: string; name: string; type: string; description: string;
  who_can_post: string; is_default: boolean; is_archived: boolean; sort_order: number; post_count: number;
}

export function useGroupChannels(groupId: string) {
  return useQuery({
    queryKey: ['group-channels', groupId],
    queryFn: async () => {
      const res = await api.get<{ data: { items: GroupChannelV2[] } }>(`/v1/groups/${groupId}/channels`)
      return res.data.data?.items ?? []
    },
    enabled: !!groupId,
  })
}

export function useCreateGroupChannel(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; type: string; description?: string; who_can_post?: string }) => {
      const res = await api.post(`/v1/groups/${groupId}/channels`, payload)
      return res.data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group-channels', groupId] }),
  })
}

export function usePendingGroupPosts(groupId: string) {
  return useQuery({
    queryKey: ['group-pending-posts', groupId],
    queryFn: async () => {
      const res = await api.get(`/v1/groups/${groupId}/posts?status=pending_approval`)
      return res.data.data?.items ?? []
    },
    enabled: !!groupId,
  })
}

export function useApproveGroupPost(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (postId: string) => { await api.post(`/v1/groups/${groupId}/posts/${postId}/approve`) },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-pending-posts', groupId] })
      qc.invalidateQueries({ queryKey: ['group-posts', groupId] })
    },
  })
}

export function useRejectGroupPost(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (postId: string) => { await api.post(`/v1/groups/${groupId}/posts/${postId}/reject`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group-pending-posts', groupId] }),
  })
}

export function useGroupBans(groupId: string) {
  return useQuery({
    queryKey: ['group-bans', groupId],
    queryFn: async () => {
      const res = await api.get(`/v1/groups/${groupId}/bans`)
      return res.data.data?.items ?? []
    },
    enabled: !!groupId,
  })
}

export function useBanGroupUser(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { user_id: string; reason?: string }) => {
      await api.post(`/v1/groups/${groupId}/bans`, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-bans', groupId] })
      qc.invalidateQueries({ queryKey: ['group-members', groupId] })
    },
  })
}

export function useGroupJoinRequests(groupId: string) {
  return useQuery({
    queryKey: ['group-join-requests', groupId],
    queryFn: async () => {
      const res = await api.get(`/v1/groups/${groupId}/join-requests`)
      return res.data.data?.items ?? []
    },
    enabled: !!groupId,
  })
}

export function useApproveJoinRequest(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (requestId: string) => { await api.post(`/v1/groups/${groupId}/join-requests/${requestId}/approve`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group-join-requests', groupId] }),
  })
}
