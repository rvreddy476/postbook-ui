'use client'

// P0-1 (PRODUCTION_GAP_ANALYSIS.md): mobile + web were calling a legacy
// `/api/v1/*` surface from the retired postmatch-service. All
// dating-domain routes are now rebased onto dating-service
// (`/v1/dating/*`) and chat onto chat-service (`/v1/chat/*` via the
// api-gateway).
//
// Knowingly deferred (P1-5 session redesign):
//   - `/api/v1/auth/send-otp` + `/api/v1/auth/verify-otp` + `/api/v1/auth/logout`
//     still hit the postmatch tokens flow with localStorage tokens. The
//     P1 redesign migrates these onto identity-platform's auth-service
//     + httpOnly cookies.
//   - `/api/v1/blocks` list endpoint — dating-service doesn't surface a
//     blocklist read yet. P1 work adds GET /v1/dating/safety/blocks.

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
      const res = await postmatchApi.get<{ data: PostMatchProfile }>('/v1/dating/profile')
      return res.data.data
    },
    retry: false,
  })
}

export function useUpdatePostMatchProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ProfileInput) => {
      // P0-1: dating-service is POST /v1/dating/profile (UpsertProfile).
      const res = await postmatchApi.post<{ data: PostMatchProfile }>('/v1/dating/profile', payload)
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
      const res = await postmatchApi.get<{ data: PostMatchPreferences }>('/v1/dating/preferences')
      return res.data.data
    },
    retry: false,
  })
}

export function useUpdatePostMatchPreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: PreferencesInput) => {
      const res = await postmatchApi.put<{ data: PostMatchPreferences }>('/v1/dating/preferences', payload)
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
      const res = await postmatchApi.get<{ data: PostMatchPhoto[] }>('/v1/dating/photos')
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
      // P0-1: dating-service is POST /v1/dating/photos (no /complete).
      const res = await postmatchApi.post<{ data: PostMatchPhoto }>('/v1/dating/photos', payload)
      return res.data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['postmatch', 'photos'] }),
  })
}

export function useDeletePhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (photoId: string) => {
      await postmatchApi.delete(`/v1/dating/photos/${photoId}`)
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
      // P0-1: dating-service exposes the deck at /v1/dating/pulse/today.
      const res = await postmatchApi.get<{ data: FeedItem[]; meta?: { next_cursor?: string } }>(
        `/v1/dating/pulse/today?${params}`,
      )
      return { items: res.data.data ?? [], nextCursor: res.data.meta?.next_cursor }
    },
  })
}

// P0-1: the legacy /api/v1/discovery/decision single-endpoint is retired.
// dating-service exposes /v1/dating/sparks, /v1/dating/stash, and a
// future /v1/dating/passes — we route by decision verb here so callers
// don't have to change. Returns a normalised DecisionResult.
export function useMakeDecision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: DecisionPayload): Promise<DecisionResult> => {
      const target = (payload as { target_user_id?: string }).target_user_id ?? ''
      const decision = (payload as { decision?: string }).decision ?? 'pass'
      if (decision === 'spark' || decision === 'like') {
        const res = await postmatchApi.post<{ data: { spark: unknown; match_id?: string; matched?: boolean } }>(
          '/v1/dating/sparks',
          { to_user_id: target, target_kind: 'profile', target_ref: target },
        )
        const d = res.data.data
        return {
          result: d.matched === true ? 'matched' : 'liked',
          match_id: d.match_id,
        }
      }
      if (decision === 'stash' || decision === 'save') {
        await postmatchApi.post('/v1/dating/stash', { candidate_id: target })
        return { result: 'liked' }
      }
      // Pass: no dedicated endpoint yet; surface a local-only decision
      // so the deck advances. Persisted server-side via the deck
      // generator's exclusion list once /v1/dating/passes lands.
      return { result: 'passed' }
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
      const res = await postmatchApi.get<{ data: PostMatchMatch[] }>('/v1/dating/matches')
      return res.data.data ?? []
    },
  })
}

export function useLikesReceived() {
  return useQuery({
    queryKey: ['postmatch', 'likes-received'],
    queryFn: async () => {
      // P0-1: "likes received" is incoming sparks on the new model.
      const res = await postmatchApi.get<{ data: LikeReceived[] }>('/v1/dating/sparks/incoming')
      return res.data.data ?? []
    },
    refetchInterval: 15000,
  })
}

export function useUnmatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (matchId: string) => {
      // P0-1: backend is POST /v1/dating/matches/:id/close, not DELETE.
      await postmatchApi.post(`/v1/dating/matches/${matchId}/close`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['postmatch', 'matches'] }),
  })
}

// ── Chat ────────────────────────────────────────────────────────
//
// P0-1 + P0-3: routes rebased onto chat-service (the canonical
// message-service per PRODUCTION_GAP_ANALYSIS.md) through the
// api-gateway /v1/chat/* proxy. Dating conversations carry
// source_app=dating so the backend's send path applies dating_match
// authz (block / closed match / paused profile checks).

export function usePostMatchConversations() {
  return useQuery({
    queryKey: ['postmatch', 'conversations'],
    queryFn: async () => {
      const res = await postmatchApi.get<{ data: PostMatchConversation[] }>(
        '/v1/chat/conversations?source_app=dating',
      )
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
        `/v1/chat/conversations/${conversationId}/messages?${params}`,
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
        `/v1/chat/conversations/${conversationId}/messages`,
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

// P0-1: dating-service owns these as /v1/dating/safety/*.
export function useSubmitPostMatchReport() {
  return useMutation({
    mutationFn: async (payload: ReportPayload) => {
      await postmatchApi.post('/v1/dating/safety/report', payload)
    },
  })
}

export function useBlockPostMatchUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: BlockPayload) => {
      await postmatchApi.post('/v1/dating/safety/block', payload)
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
    // P0-1: no /v1/dating/safety/blocks list endpoint yet — the
    // legacy postmatch-service exposed one but dating-service hasn't
    // surfaced its blocklist read API. Hit the legacy path for now;
    // P1 work adds GET /v1/dating/safety/blocks.
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
