'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────

export type Playlist = {
  id: string
  creator_id: string
  title: string
  description?: string | null
  is_public: boolean
  item_count: number
  created_at: string
  updated_at: string
}

export type PlaylistItem = {
  playlist_id: string
  post_id: string
  position: number
  added_at: string
  post?: {
    id: string
    title?: string
    thumbnail_url?: string
    duration_sec?: number
  }
}

export type ContinueWatchingEntry = {
  post_id: string
  watched_sec: number
  duration_sec: number
  last_watched_at: string
  post?: {
    id: string
    title?: string
    thumbnail_url?: string
  }
}

// ── Playlists ─────────────────────────────────────────────────────────

export function useCreatorPlaylists(creatorId: string | undefined) {
  return useQuery<Playlist[]>({
    queryKey: ['posttube', 'playlists', creatorId],
    queryFn: async () => (await api.get(`/v1/creators/${creatorId}/playlists`)).data.data ?? [],
    enabled: !!creatorId,
  })
}

export function usePlaylist(playlistId: string | undefined) {
  return useQuery<Playlist>({
    queryKey: ['posttube', 'playlist', playlistId],
    queryFn: async () => (await api.get(`/v1/playlists/${playlistId}`)).data.data,
    enabled: !!playlistId,
  })
}

export function usePlaylistItems(playlistId: string | undefined) {
  return useQuery<PlaylistItem[]>({
    queryKey: ['posttube', 'playlist-items', playlistId],
    queryFn: async () => (await api.get(`/v1/playlists/${playlistId}/items`)).data.data ?? [],
    enabled: !!playlistId,
  })
}

export function useCreatePlaylist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { title: string; description?: string; is_public?: boolean }) =>
      (await api.post('/v1/playlists', input)).data.data as Playlist,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['posttube', 'playlists'] }),
  })
}

export function useDeletePlaylist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (playlistId: string) => api.delete(`/v1/playlists/${playlistId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['posttube', 'playlists'] }),
  })
}

export function useAddPlaylistItem(playlistId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (postId: string) =>
      (await api.post(`/v1/playlists/${playlistId}/items`, { post_id: postId })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posttube', 'playlist-items', playlistId] })
      qc.invalidateQueries({ queryKey: ['posttube', 'playlist', playlistId] })
    },
  })
}

export function useRemovePlaylistItem(playlistId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (postId: string) =>
      api.delete(`/v1/playlists/${playlistId}/items/${postId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posttube', 'playlist-items', playlistId] })
      qc.invalidateQueries({ queryKey: ['posttube', 'playlist', playlistId] })
    },
  })
}

// ── Watch history / Continue watching ─────────────────────────────────

export function useContinueWatching() {
  return useQuery<ContinueWatchingEntry[]>({
    queryKey: ['posttube', 'continue-watching'],
    queryFn: async () => (await api.get('/v1/videos/continue-watching')).data.data ?? [],
  })
}

export function useDeleteWatchProgress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (videoId: string) => api.delete(`/v1/videos/${videoId}/progress`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['posttube', 'continue-watching'] }),
  })
}

export function useSaveWatchProgress() {
  return useMutation({
    mutationFn: async ({ videoId, watchedSec, durationSec }: {
      videoId: string
      watchedSec: number
      durationSec: number
    }) =>
      api.post(`/v1/videos/${videoId}/progress`, {
        watched_sec: watchedSec,
        duration_sec: durationSec,
      }),
  })
}

// ── Subscriptions ─────────────────────────────────────────────────────

export type ChannelSubscription = {
  id: string
  user_id: string
  channel_id: string
  created_at: string
  channel?: {
    id: string
    handle?: string
    name: string
    avatar_media_id?: string
    subscriber_count?: number
  }
}

export function useMyChannelSubscriptions(userId: string | undefined) {
  return useQuery<ChannelSubscription[]>({
    queryKey: ['posttube', 'subscriptions', userId],
    queryFn: async () => (await api.get(`/v1/users/${userId}/subscriptions`)).data.data ?? [],
    enabled: !!userId,
  })
}
