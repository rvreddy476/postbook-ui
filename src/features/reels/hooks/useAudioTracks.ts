"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteAudioTrack, fetchAudioTracks, generateAudioTrack, uploadAudioTrack } from "@/features/reels/data/audioTracksApi";
import type { ReelAudioTrack } from "@/features/reels/playback/audioTracks";

export const audioTracksKey = (mediaId: string) => ["reels", "audio-tracks", mediaId] as const;

/**
 * The alternate audio tracks of one reel. Polls while any track is still
 * being produced so a creator sees "ready" land without reloading.
 */
export function useAudioTracks(mediaId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: audioTracksKey(mediaId ?? ""),
    queryFn: ({ signal }) => fetchAudioTracks(mediaId!, signal),
    enabled: Boolean(mediaId) && enabled,
    staleTime: 60_000,
    refetchInterval: (query) => {
      const tracks = query.state.data as ReelAudioTrack[] | undefined;
      return tracks?.some((t) => t.status === "pending" || t.status === "processing") ? 5_000 : false;
    },
  });
}

export function useUploadAudioTrack(mediaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { file: File; language: string; label?: string }) => uploadAudioTrack(mediaId, input.file, input.language, input.label),
    onSuccess: () => void qc.invalidateQueries({ queryKey: audioTracksKey(mediaId) }),
  });
}

export function useGenerateAudioTrack(mediaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { language: string; sourceLanguage?: string }) => generateAudioTrack(mediaId, input.language, input.sourceLanguage),
    onSuccess: () => void qc.invalidateQueries({ queryKey: audioTracksKey(mediaId) }),
  });
}

export function useDeleteAudioTrack(mediaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (trackId: string) => deleteAudioTrack(mediaId, trackId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: audioTracksKey(mediaId) }),
  });
}
