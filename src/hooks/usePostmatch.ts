'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import postmatchApi, { savePostMatchTokens, savePostMatchSession, clearPostMatchAuth } from '@/lib/postmatchApi'
import type {
  AuthTokens, SendOTPPayload, VerifyOTPPayload,
  PostMatchProfile, ProfileInput,
  PostMatchPreferences, PreferencesInput,
  PostMatchPhoto, InitUploadResponse,
  FeedItem, DecisionPayload, DecisionResult,
  PostMatchMatch,
  PostMatchConversation, PostMatchMessage, SendMessagePayload,
  ReportPayload, BlockPayload, LikeReceived,
} from '@/types/postmatch'

// ── Auth ────────────────────────────────────────────────────────

export function useSendOTP() {
  return useMutation({
    mutationFn: async (payload: SendOTPPayload) => {
      const res = await postmatchApi.post('/api/v1/auth/send-otp', payload)
      return res.data
    },
  })
}

export function useVerifyOTP() {
  return useMutation({
    mutationFn: async (payload: VerifyOTPPayload) => {
      const res = await postmatchApi.post<{ data: AuthTokens }>('/api/v1/auth/verify-otp', payload)
      const data = res.data.data
      savePostMatchTokens(data.access_token, data.refresh_token)
      savePostMatchSession({ id: data.user.id, onboarding_status: data.user.onboarding_status })
      return data
    },
  })
}

export function usePostMatchLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await postmatchApi.post('/api/v1/auth/logout')
    },
    onSettled: () => {
      clearPostMatchAuth()
      qc.clear()
    },
  })
}

// ── Profile ─────────────────────────────────────────────────────

export function usePostMatchProfile() {
  return useQuery({
    queryKey: ['postmatch', 'profile'],
    queryFn: async () => {
      const res = await postmatchApi.get<{ data: PostMatchProfile }>('/api/v1/me/profile')
      return res.data.data
    },
    retry: false,
  })
}

export function useUpdatePostMatchProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ProfileInput) => {
      const res = await postmatchApi.put<{ data: PostMatchProfile }>('/api/v1/me/profile', payload)
      return res.data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['postmatch', 'profile'] }),
  })
}

// ── Preferences ─────────────────────────────────────────────────

export function usePostMatchPreferences() {
  return useQuery({
    queryKey: ['postmatch', 'preferences'],
    queryFn: async () => {
      const res = await postmatchApi.get<{ data: PostMatchPreferences }>('/api/v1/me/preferences')
      return res.data.data
    },
    retry: false,
  })
}

export function useUpdatePostMatchPreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: PreferencesInput) => {
      const res = await postmatchApi.put<{ data: PostMatchPreferences }>('/api/v1/me/preferences', payload)
      return res.data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['postmatch', 'preferences'] }),
  })
}

// ── Photos ──────────────────────────────────────────────────────

export function usePostMatchPhotos() {
  return useQuery({
    queryKey: ['postmatch', 'photos'],
    queryFn: async () => {
      const res = await postmatchApi.get<{ data: PostMatchPhoto[] }>('/api/v1/me/profile/photos')
      return res.data.data ?? []
    },
  })
}

export function useInitPhotoUpload() {
  return useMutation({
    mutationFn: async (payload: { content_type: string; file_name: string; file_size: number }) => {
      const res = await postmatchApi.post<{ data: InitUploadResponse }>('/api/v1/media/init', {
        purpose: 'profile_photo',
        ...payload,
      })
      return res.data.data
    },
  })
}

export function useCompletePhotoUpload() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { media_id: string; media_key: string; is_primary: boolean }) => {
      const res = await postmatchApi.post<{ data: PostMatchPhoto }>('/api/v1/me/profile/photos/complete', payload)
      return res.data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['postmatch', 'photos'] }),
  })
}

export function useDeletePhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (photoId: string) => {
      await postmatchApi.delete(`/api/v1/me/profile/photos/${photoId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['postmatch', 'photos'] }),
  })
}

// ── Discovery Feed ──────────────────────────────────────────────

export function useDiscoveryFeed(cursor?: string) {
  return useQuery({
    queryKey: ['postmatch', 'feed', cursor],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '20' })
      if (cursor) params.set('cursor', cursor)
      const res = await postmatchApi.get<{ data: FeedItem[]; meta?: { next_cursor?: string } }>(
        `/api/v1/discovery/feed?${params}`,
      )
      return { items: res.data.data ?? [], nextCursor: res.data.meta?.next_cursor }
    },
  })
}

export function useMakeDecision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: DecisionPayload) => {
      const res = await postmatchApi.post<{ data: DecisionResult }>('/api/v1/discovery/decision', payload)
      return res.data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['postmatch', 'feed'] })
      qc.invalidateQueries({ queryKey: ['postmatch', 'matches'] })
      qc.invalidateQueries({ queryKey: ['postmatch', 'likes-received'] })
    },
  })
}

// ── Matches ─────────────────────────────────────────────────────

export function usePostMatchMatches() {
  return useQuery({
    queryKey: ['postmatch', 'matches'],
    queryFn: async () => {
      const res = await postmatchApi.get<{ data: PostMatchMatch[] }>('/api/v1/matches')
      return res.data.data ?? []
    },
  })
}

export function useLikesReceived() {
  return useQuery({
    queryKey: ['postmatch', 'likes-received'],
    queryFn: async () => {
      const res = await postmatchApi.get<{ data: LikeReceived[] }>('/api/v1/matches/likes-received')
      return res.data.data ?? []
    },
    refetchInterval: 15000,
  })
}

export function useUnmatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (matchId: string) => {
      await postmatchApi.delete(`/api/v1/matches/${matchId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['postmatch', 'matches'] }),
  })
}

// ── Chat ────────────────────────────────────────────────────────

export function usePostMatchConversations() {
  return useQuery({
    queryKey: ['postmatch', 'conversations'],
    queryFn: async () => {
      const res = await postmatchApi.get<{ data: PostMatchConversation[] }>('/api/v1/conversations')
      return res.data.data ?? []
    },
  })
}

export function usePostMatchMessages(conversationId: string | undefined, cursor?: string) {
  return useQuery({
    queryKey: ['postmatch', 'messages', conversationId, cursor],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' })
      if (cursor) params.set('cursor', cursor)
      const res = await postmatchApi.get<{ data: PostMatchMessage[]; meta?: { next_cursor?: string } }>(
        `/api/v1/conversations/${conversationId}/messages?${params}`,
      )
      return { messages: res.data.data ?? [], nextCursor: res.data.meta?.next_cursor }
    },
    enabled: !!conversationId,
    refetchInterval: 5000,
  })
}

export function useSendPostMatchMessage(conversationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: SendMessagePayload) => {
      const res = await postmatchApi.post<{ data: PostMatchMessage }>(
        `/api/v1/conversations/${conversationId}/messages`,
        payload,
      )
      return res.data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['postmatch', 'messages', conversationId] })
      qc.invalidateQueries({ queryKey: ['postmatch', 'conversations'] })
    },
  })
}

// ── Moderation ──────────────────────────────────────────────────

export function useSubmitPostMatchReport() {
  return useMutation({
    mutationFn: async (payload: ReportPayload) => {
      await postmatchApi.post('/api/v1/reports', payload)
    },
  })
}

export function useBlockPostMatchUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: BlockPayload) => {
      await postmatchApi.post('/api/v1/blocks', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['postmatch', 'feed'] })
      qc.invalidateQueries({ queryKey: ['postmatch', 'matches'] })
      qc.invalidateQueries({ queryKey: ['postmatch', 'blocks'] })
    },
  })
}

// ── Block list ────────────────────────────────────────────────────────

export type PostMatchBlock = {
  blocked_user_id: string
  reason?: string | null
  created_at: string
  blocked_user?: {
    id: string
    first_name?: string | null
    display_name?: string | null
    avatar_url?: string | null
  }
}

export function usePostMatchBlocks() {
  return useQuery<PostMatchBlock[]>({
    queryKey: ['postmatch', 'blocks'],
    queryFn: async () => (await postmatchApi.get('/api/v1/blocks')).data.data ?? [],
  })
}

export function useUnblockPostMatchUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (blockedUserId: string) => {
      await postmatchApi.delete(`/api/v1/blocks/${blockedUserId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['postmatch', 'blocks'] })
      qc.invalidateQueries({ queryKey: ['postmatch', 'feed'] })
    },
  })
}
