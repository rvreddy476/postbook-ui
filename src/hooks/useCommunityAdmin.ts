import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { CommunityJoinRequest, CommunityModlogEntry } from '@/types/communities'

export interface CommunitySpaceV2 {
  id: string; community_id: string; name: string; description: string;
  space_type: string; icon?: string; visibility: string; who_can_post: string;
  is_default: boolean; is_archived: boolean; sort_order: number;
  post_count: number; member_count: number;
}

export interface WikiPageV2 {
  id: string; community_id: string; title: string; slug: string;
  content: string; content_html?: string; category?: string;
  is_pinned: boolean; created_by: string; updated_by?: string;
  version: number; created_at: string; updated_at: string;
}

export function useCommunitySpacesAdmin(communityId: string) {
  return useQuery({
    queryKey: ['community-spaces', communityId],
    queryFn: async () => {
      const res = await api.get<{ data: { items: CommunitySpaceV2[] } }>(`/v1/communities/${communityId}/spaces`)
      return res.data.data?.items ?? []
    },
    enabled: !!communityId,
  })
}

export function useCreateSpace(communityId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; space_type: string; description?: string; icon?: string }) => {
      const res = await api.post(`/v1/communities/${communityId}/spaces`, payload)
      return res.data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community-spaces', communityId] }),
  })
}

export function useWikiPages(communityId: string) {
  return useQuery({
    queryKey: ['community-wiki', communityId],
    queryFn: async () => {
      const res = await api.get<{ data: { items: WikiPageV2[] } }>(`/v1/communities/${communityId}/wiki`)
      return res.data.data?.items ?? []
    },
    enabled: !!communityId,
  })
}

export function useCreateWikiPage(communityId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { title: string; slug: string; content: string; category?: string }) => {
      const res = await api.post(`/v1/communities/${communityId}/wiki`, payload)
      return res.data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community-wiki', communityId] }),
  })
}

export function useCommunityBans(communityId: string) {
  return useQuery({
    queryKey: ['community-bans', communityId],
    queryFn: async () => {
      const res = await api.get(`/v1/communities/${communityId}/bans`)
      return res.data.data?.items ?? []
    },
    enabled: !!communityId,
  })
}

export function useCommunityJoinRequests(communityId: string) {
  return useQuery({
    queryKey: ['community-join-requests', communityId],
    queryFn: async () => {
      const res = await api.get<{ data: { items: CommunityJoinRequest[] } }>(`/v1/communities/${communityId}/join-requests`)
      return res.data.data?.items ?? []
    },
    enabled: !!communityId,
  })
}

export function useApproveJoinRequest(communityId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (requestId: string) => {
      await api.post(`/v1/communities/${communityId}/join-requests/${requestId}/approve`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community-join-requests', communityId] })
      qc.invalidateQueries({ queryKey: ['community-members', communityId] })
      qc.invalidateQueries({ queryKey: ['community', communityId] })
    },
  })
}

export function useRejectJoinRequest(communityId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (requestId: string) => {
      await api.post(`/v1/communities/${communityId}/join-requests/${requestId}/reject`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community-join-requests', communityId] })
    },
  })
}

export function useChangeMemberRole(communityId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await api.put(`/v1/communities/${communityId}/members/${userId}/role`, { role })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community-members', communityId] })
    },
  })
}

export function useBanMember(communityId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason?: string }) => {
      await api.post(`/v1/communities/${communityId}/members/${userId}/ban`, { reason })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community-members', communityId] })
      qc.invalidateQueries({ queryKey: ['community-bans', communityId] })
      qc.invalidateQueries({ queryKey: ['community', communityId] })
    },
  })
}

export function useUnbanMember(communityId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/v1/communities/${communityId}/members/${userId}/ban`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community-bans', communityId] })
    },
  })
}

export function useCommunityModlog(communityId: string) {
  return useQuery({
    queryKey: ['community-modlog', communityId],
    queryFn: async () => {
      const res = await api.get<{ data: { items: CommunityModlogEntry[] } }>(`/v1/communities/${communityId}/modlog`)
      return res.data.data?.items ?? []
    },
    enabled: !!communityId,
  })
}

export function useUpdateWikiPage(communityId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ slug, ...payload }: { slug: string; title?: string; content?: string; category?: string }) => {
      const res = await api.put(`/v1/communities/${communityId}/wiki/${slug}`, payload)
      return res.data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community-wiki', communityId] }),
  })
}
