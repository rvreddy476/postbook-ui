import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface CommunityPostV2 {
  id: string; community_id: string; space_id: string; author_id: string;
  content_type: string; title?: string; body?: string;
  type_payload?: Record<string, unknown>; attachments?: unknown[];
  tags?: string[]; parent_post_id?: string; thread_depth: number; reply_count: number;
  is_pinned: boolean; is_announcement: boolean; is_featured: boolean;
  is_answered: boolean; accepted_answer_id?: string; is_expert_answer: boolean;
  status: string; spark_count: number; comment_count: number; echo_count: number; view_count: number;
  created_at: string; updated_at: string;
}

export function useCommunityPosts(communityId: string, spaceId?: string) {
  return useQuery({
    queryKey: ['community-posts', communityId, spaceId],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '20' })
      if (spaceId) params.set('space_id', spaceId)
      const res = await api.get<{ data: { items: CommunityPostV2[] } }>(`/v1/communities/${communityId}/posts?${params}`)
      return res.data.data?.items ?? []
    },
    enabled: !!communityId,
  })
}

export function useCreateCommunityPost(communityId: string, spaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { body: string; content_type?: string; title?: string; parent_post_id?: string }) => {
      const res = await api.post(`/v1/communities/${communityId}/spaces/${spaceId}/posts`, payload)
      return res.data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community-posts', communityId] }),
  })
}

export function useSparkCommunityPost(communityId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (postId: string) => { await api.post(`/v1/communities/${communityId}/posts/${postId}/spark`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community-posts', communityId] }),
  })
}

export function useFeaturedPosts(communityId: string) {
  return useQuery({
    queryKey: ['community-featured', communityId],
    queryFn: async () => {
      const res = await api.get<{ data: { items: CommunityPostV2[] } }>(`/v1/communities/${communityId}/featured`)
      return res.data.data?.items ?? []
    },
    enabled: !!communityId,
  })
}
