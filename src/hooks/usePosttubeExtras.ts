'use client'

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addPlaylistItem,
  clearWatchHistory,
  createPlaylist,
  deletePlaylist,
  deleteVideoWatchProgress,
  getContinueWatching,
  getCreatorPlaylists,
  getMySubscriptions,
  getPlaylist,
  getPlaylistItems,
  getScheduledPosts,
  getSeries,
  getWatchHistory,
  getWatchProgress,
  removePlaylistItem,
  saveVideoWatchProgress,
  updatePlaylist,
  updateSchedule,
  type MySubscriptionRow,
  type Playlist,
  type PlaylistItem,
} from '@/features/posttube/data/posttubeApi'
import type { WatchProgress } from '@/features/posttube/model'

export type { Playlist, PlaylistItem, WatchProgress, MySubscriptionRow }

/*
  PostTube's "extras": playlists, watch progress / history, my subscriptions,
  scheduled posts. The wire calls live in features/posttube/data/posttubeApi;
  this file is only the React Query binding and the cache keys.
*/

export const POSTTUBE_KEYS = {
  playlists: (creatorId?: string) => ['posttube', 'playlists', creatorId] as const,
  playlist: (id?: string) => ['posttube', 'playlist', id] as const,
  playlistItems: (id?: string) => ['posttube', 'playlist-items', id] as const,
  continueWatching: ['posttube', 'continue-watching'] as const,
  history: ['posttube', 'history'] as const,
  progress: (videoId?: string) => ['posttube', 'watch-progress', videoId] as const,
  series: (videoId?: string) => ['posttube', 'series', videoId] as const,
  subscriptions: ['posttube', 'my-subscriptions'] as const,
  scheduled: ['posttube', 'scheduled'] as const,
}

// ── Playlists ─────────────────────────────────────────────────────────

export function useCreatorPlaylists(creatorId: string | undefined) {
  return useQuery<Playlist[]>({
    queryKey: POSTTUBE_KEYS.playlists(creatorId),
    queryFn: () => getCreatorPlaylists(creatorId!),
    enabled: !!creatorId,
  })
}

export function usePlaylist(playlistId: string | undefined) {
  return useQuery<Playlist | null>({
    queryKey: POSTTUBE_KEYS.playlist(playlistId),
    queryFn: () => getPlaylist(playlistId!),
    enabled: !!playlistId,
  })
}

export function usePlaylistItems(playlistId: string | undefined) {
  return useQuery<PlaylistItem[]>({
    queryKey: POSTTUBE_KEYS.playlistItems(playlistId),
    queryFn: () => getPlaylistItems(playlistId!),
    enabled: !!playlistId,
  })
}

export function useCreatePlaylist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { title: string; description?: string; visibility: 'public' | 'private' | 'unlisted' }) =>
      createPlaylist(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['posttube', 'playlists'] }),
  })
}

export function useUpdatePlaylist(playlistId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<Pick<Playlist, 'title' | 'description' | 'visibility'>>) => updatePlaylist(playlistId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posttube', 'playlists'] })
      qc.invalidateQueries({ queryKey: POSTTUBE_KEYS.playlist(playlistId) })
    },
  })
}

export function useDeletePlaylist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (playlistId: string) => deletePlaylist(playlistId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['posttube', 'playlists'] }),
  })
}

export function useAddPlaylistItem(playlistId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, playlistId: explicitId, position }: { postId: string; playlistId?: string; position?: number }) =>
      addPlaylistItem(explicitId ?? playlistId!, postId, position),
    onSuccess: (_d, vars) => {
      const id = vars.playlistId ?? playlistId
      qc.invalidateQueries({ queryKey: POSTTUBE_KEYS.playlistItems(id) })
      qc.invalidateQueries({ queryKey: POSTTUBE_KEYS.playlist(id) })
      qc.invalidateQueries({ queryKey: ['posttube', 'playlists'] })
    },
  })
}

export function useRemovePlaylistItem(playlistId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (postId: string) => removePlaylistItem(playlistId, postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: POSTTUBE_KEYS.playlistItems(playlistId) })
      qc.invalidateQueries({ queryKey: POSTTUBE_KEYS.playlist(playlistId) })
      qc.invalidateQueries({ queryKey: ['posttube', 'playlists'] })
    },
  })
}

// ── Watch progress / history ──────────────────────────────────────────

/** `GET /v1/videos/continue-watching` → normalised rows (ms wire, percent, completed ≥ 90%). */
export function useContinueWatching(limit = 12) {
  return useQuery<WatchProgress[]>({
    queryKey: [...POSTTUBE_KEYS.continueWatching, limit],
    queryFn: () => getContinueWatching(limit),
    staleTime: 30_000,
  })
}

/** `GET /v1/videos/history?limit&cursor` — every row, including completed ones. */
export function useWatchHistory(limit = 30) {
  return useInfiniteQuery({
    queryKey: [...POSTTUBE_KEYS.history, limit],
    queryFn: ({ pageParam }) => getWatchHistory({ cursor: pageParam || undefined, limit }),
    initialPageParam: '' as string,
    getNextPageParam: (last) => last.next_cursor || undefined,
    staleTime: 30_000,
  })
}

export function useWatchProgress(videoId: string | undefined) {
  return useQuery<WatchProgress | null>({
    queryKey: POSTTUBE_KEYS.progress(videoId),
    queryFn: () => getWatchProgress(videoId!),
    enabled: !!videoId,
    staleTime: 30_000,
  })
}

export function useDeleteWatchProgress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (videoId: string) => deleteVideoWatchProgress(videoId),
    onSuccess: (_d, videoId) => {
      qc.invalidateQueries({ queryKey: POSTTUBE_KEYS.continueWatching })
      qc.invalidateQueries({ queryKey: POSTTUBE_KEYS.history })
      qc.invalidateQueries({ queryKey: POSTTUBE_KEYS.progress(videoId) })
      qc.invalidateQueries({ queryKey: ['feed', 'continueWatching'] })
    },
  })
}

export function useClearWatchHistory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => clearWatchHistory(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: POSTTUBE_KEYS.continueWatching })
      qc.invalidateQueries({ queryKey: POSTTUBE_KEYS.history })
      qc.invalidateQueries({ queryKey: ['posttube', 'watch-progress'] })
      qc.invalidateQueries({ queryKey: ['feed', 'continueWatching'] })
    },
  })
}

export function useSaveWatchProgress() {
  return useMutation({
    mutationFn: ({
      videoId,
      positionMs,
      durationMs,
      completed,
    }: {
      videoId: string
      positionMs: number
      durationMs: number
      completed?: boolean
    }) => saveVideoWatchProgress(videoId, { positionMs, durationMs, completed }),
  })
}

// ── Series ────────────────────────────────────────────────────────────

export function useSeries(videoId: string | undefined) {
  return useQuery({
    queryKey: POSTTUBE_KEYS.series(videoId),
    queryFn: () => getSeries(videoId!),
    enabled: !!videoId,
    staleTime: 60_000,
    retry: false,
  })
}

// ── Subscriptions ─────────────────────────────────────────────────────

/** `GET /v1/channels/subscriptions` — replaces the 410'd `/v1/users/:id/subscriptions`. */
export function useMyChannelSubscriptions(limit = 30) {
  return useInfiniteQuery({
    queryKey: [...POSTTUBE_KEYS.subscriptions, limit],
    queryFn: ({ pageParam }) => getMySubscriptions({ cursor: pageParam || undefined, limit }),
    initialPageParam: '' as string,
    getNextPageParam: (last) => last.next_cursor || undefined,
    staleTime: 60_000,
  })
}

// ── Scheduled ─────────────────────────────────────────────────────────

export function useScheduledPosts(limit = 50) {
  return useQuery({
    queryKey: [...POSTTUBE_KEYS.scheduled, limit],
    queryFn: () => getScheduledPosts(limit),
    staleTime: 30_000,
  })
}

export function useUpdateSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, publishAt }: { postId: string; publishAt?: string }) => updateSchedule(postId, publishAt),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: POSTTUBE_KEYS.scheduled })
      qc.invalidateQueries({ queryKey: ['my-uploads'] })
    },
  })
}
