import api from "@/lib/api";
import { isAxiosError } from "axios";

import { apiBase } from "@/features/reels/model";
import type { ReelAudioTrack } from "@/features/reels/playback/audioTracks";

interface Envelope<T> {
  data: T;
}

function withBase(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith("/") ? `${apiBase()}${url}` : url;
}

/** GET /v1/media/:id/audio-tracks — [] when the reel has none or the call fails. */
export async function fetchAudioTracks(mediaId: string, signal?: AbortSignal): Promise<ReelAudioTrack[]> {
  try {
    const res = await api.get<Envelope<{ tracks?: ReelAudioTrack[] | null } | null>>(`/v1/media/${mediaId}/audio-tracks`, { signal });
    return (res.data.data?.tracks ?? []).map((t) => ({ ...t, playback_url: withBase(t.playback_url) }));
  } catch (err) {
    if (isAxiosError(err) && err.code === "ERR_CANCELED") throw err;
    return [];
  }
}

/** POST /v1/media/:id/audio-tracks (multipart) — the creator's own audio for one language. */
export async function uploadAudioTrack(mediaId: string, file: File, language: string, label?: string): Promise<ReelAudioTrack> {
  const body = new FormData();
  body.append("file", file);
  body.append("language", language);
  if (label) body.append("label", label);
  const res = await api.post<Envelope<ReelAudioTrack>>(`/v1/media/${mediaId}/audio-tracks`, body, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.data;
}

/** POST /v1/media/:id/audio-tracks/generate — an AI dub; 503 when no dubbing backend is configured. */
export async function generateAudioTrack(mediaId: string, language: string, sourceLanguage?: string): Promise<ReelAudioTrack> {
  const res = await api.post<Envelope<ReelAudioTrack>>(`/v1/media/${mediaId}/audio-tracks/generate`, {
    language,
    ...(sourceLanguage ? { source_language: sourceLanguage } : {}),
  });
  return res.data.data;
}

export async function deleteAudioTrack(mediaId: string, trackId: string): Promise<void> {
  await api.delete(`/v1/media/${mediaId}/audio-tracks/${trackId}`);
}

/** The server's error code for a failed call, or null. */
export function apiErrorCode(err: unknown): string | null {
  if (!isAxiosError(err)) return null;
  const code = (err.response?.data as { error?: { code?: string } } | undefined)?.error?.code;
  return code ?? (err.response?.status ? String(err.response.status) : null);
}
