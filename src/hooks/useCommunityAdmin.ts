import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

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
