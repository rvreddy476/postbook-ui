import api from "@/lib/api";
import { isAxiosError } from "axios";

import type { ReelSound } from "@/features/reels/model";
import { soundFromUseResponse, toSoundInfo, toSoundReelsPage, type SoundInfo, type SoundReelsPage } from "@/features/reels/sounds";

interface Envelope<T> {
  data: T;
  meta?: { next_cursor?: string } | null;
}

export const SOUND_REELS_PAGE_SIZE = 24;

/** GET /v1/audio/:id → the sound, or null when it is missing or this viewer may not hear it (both are 404). */
export async function fetchSound(soundId: string, signal?: AbortSignal): Promise<SoundInfo | null> {
  try {
    const res = await api.get<Envelope<unknown>>(`/v1/audio/${encodeURIComponent(soundId)}`, { signal });
    return toSoundInfo(res.data?.data);
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

/**
 * POST /v1/posts/:postId/sound — "use this sound". Returns the sound the
 * reel plays, creating it from the reel's own audio on first use. Throws
 * on a refusal (403 SOUND_REUSE_NOT_ALLOWED, 422 NOT_READY…); the caller
 * reads the code with apiErrorCode.
 */
export async function resolveReelSound(postId: string): Promise<ReelSound> {
  const res = await api.post<Envelope<unknown>>(`/v1/posts/${encodeURIComponent(postId)}/sound`, {});
  const sound = soundFromUseResponse(res.data?.data);
  if (!sound) throw new Error("The sound came back without an id.");
  return sound;
}

/**
 * GET /v1/posts/by-sound/:soundId — the reels that play a sound, newest
 * first. null when the sound is missing or may not be heard (404).
 */
export async function fetchSoundReels(params: {
  soundId: string;
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<SoundReelsPage | null> {
  const query: Record<string, string> = { limit: String(params.limit ?? SOUND_REELS_PAGE_SIZE) };
  if (params.cursor) query.cursor = params.cursor;
  try {
    const res = await api.get<Envelope<unknown>>(`/v1/posts/by-sound/${encodeURIComponent(params.soundId)}`, {
      params: query,
      signal: params.signal,
    });
    return toSoundReelsPage(res.data?.data, res.data?.meta);
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}
