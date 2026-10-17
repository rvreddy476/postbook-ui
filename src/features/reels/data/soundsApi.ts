import api from "@/lib/api";
import { isAxiosError } from "axios";

import type { ReelSound } from "@/features/reels/model";
import { soundFromUseResponse, soundListLength, toSoundInfo, toSoundList, toSoundReelsPage, type SoundInfo, type SoundReelsPage } from "@/features/reels/sounds";

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

/* ── sound lists (the studio's sound picker) ───────────────── */

export const SOUND_LIST_PAGE_SIZE = 20;
/** Search runs from this many characters; below it nothing is asked. */
export const SOUND_SEARCH_MIN_CHARS = 2;

export type SoundListKind = "trending" | "search";

/** The search term to send: trimmed, and null when it is too short to ask about. */
export function soundSearchTerm(raw: string | null | undefined): string | null {
  const q = (raw ?? "").trim().replace(/\s+/g, " ");
  return q.length >= SOUND_SEARCH_MIN_CHARS ? q.slice(0, 100) : null;
}

/**
 * The request for a page of sounds. Trending: GET /v1/audio/trending.
 * Search: GET /v1/audio/search?q=, or null (no request at all) while the
 * term is under two characters. `limit` 1..50, `offset` >= 0.
 */
export function soundListRequest(
  kind: SoundListKind,
  params: { q?: string | null; limit?: number; offset?: number } = {},
): { url: string; params: Record<string, string> } | null {
  const limit = Math.min(50, Math.max(1, Math.floor(params.limit ?? SOUND_LIST_PAGE_SIZE)));
  const offset = Math.max(0, Math.floor(params.offset ?? 0));
  const page = { limit: String(limit), offset: String(offset) };
  if (kind === "trending") return { url: "/v1/audio/trending", params: page };
  const q = soundSearchTerm(params.q);
  if (!q) return null;
  return { url: "/v1/audio/search", params: { q, ...page } };
}

export interface SoundListPage {
  items: SoundInfo[];
  /** The offset of the next page, or undefined when this page was short. */
  nextOffset?: number;
}

/** A page of trending or searched sounds; an empty page, and no request, when there is nothing to ask. */
export async function fetchSoundList(
  kind: SoundListKind,
  params: { q?: string | null; limit?: number; offset?: number; signal?: AbortSignal } = {},
): Promise<SoundListPage> {
  const request = soundListRequest(kind, params);
  if (!request) return { items: [] };
  const res = await api.get<Envelope<unknown>>(request.url, { params: request.params, signal: params.signal });
  const data = res.data?.data ?? res.data;
  const limit = Number(request.params.limit);
  const offset = Number(request.params.offset);
  const length = soundListLength(data);
  return { items: toSoundList(data), nextOffset: length >= limit ? offset + length : undefined };
}
