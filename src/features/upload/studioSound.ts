import { soundServeHref, type SoundInfo } from "@/features/reels/sounds";
import type { AudioTrack } from "@/features/reels/types";

import type { StudioFormState } from "./types";

/*
  The studio's chosen sound — an original sound taken from another reel,
  preselected by /reels/create?sound=<id>. Pure: what is sent, what
  survives a new file, and what the Audio section says.

  The sound is never mixed into the video: the reel is created with the
  sound's id and a start offset, and the player plays both in step. So
  the create request and the draft save carry `audio_track_id` and
  `audio_start_ms` beside the two volumes — and neither when no sound is
  chosen.
*/

/** "none": no sound asked for. "missing": it is gone, or not this creator's to hear (404). "failed": the lookup itself failed. */
export type StudioSoundStatus = "none" | "loading" | "ready" | "missing" | "failed";

/** The `?sound=` value, or null when it holds nothing usable. */
export function soundIdFromSearch(value: string | null | undefined): string | null {
  const id = (value ?? "").trim();
  if (!id || id.length > 64 || !/^[A-Za-z0-9-]+$/.test(id)) return null;
  return id;
}

/** A sound as the form holds it (the form's AudioTrack is the older, wider shape). */
export function soundToAudioTrack(sound: SoundInfo): AudioTrack {
  return {
    id: sound.id,
    title: sound.title,
    artist: sound.artist || undefined,
    duration_ms: sound.durationMs,
    audio_url: soundServeHref(sound.id),
    usage_count: sound.useCount,
    is_original: sound.isOriginal,
    is_licensed: false,
    status: "active",
    source_reel_id: sound.sourcePostId ?? undefined,
  };
}

type SoundChoice = Pick<StudioFormState, "audioTrack" | "audioStartMs">;

/**
 * The sound's two request fields: both with a sound chosen, neither
 * without. Spread into the create fields and the draft save.
 */
export function studioSoundFields(form: SoundChoice): { audio_track_id?: string; audio_start_ms?: number } {
  const id = form.audioTrack?.id?.trim();
  if (!id) return {};
  const start = Number.isFinite(form.audioStartMs) && form.audioStartMs > 0 ? Math.floor(form.audioStartMs) : 0;
  return { audio_track_id: id, audio_start_ms: start };
}

/**
 * The same two fields for a DRAFT SAVE. A draft is patched, so leaving the
 * sound out would keep whatever an earlier save stored: a sound chosen,
 * saved, then removed would still be published. With no sound chosen the
 * save sends an empty `audio_track_id`, which post-service reads as "clear
 * it" (PATCH /v1/reels/drafts/:id). The create request never does this: it
 * has nothing to clear.
 */
export function studioDraftSoundFields(form: SoundChoice): { audio_track_id: string; audio_start_ms?: number } {
  const chosen = studioSoundFields(form);
  return chosen.audio_track_id ? { audio_track_id: chosen.audio_track_id, audio_start_ms: chosen.audio_start_ms } : { audio_track_id: "" };
}

/**
 * What a fresh form keeps from the one it replaces: the chosen sound, its
 * start and its level. Choosing or clearing a video file starts the form
 * again, but the sound was chosen before the file and belongs to the
 * visit, not to the file. A removed sound stays removed.
 */
export function keepChosenSound(prev: SoundChoice & Pick<StudioFormState, "overlayAudioVolume">): Partial<StudioFormState> {
  if (!prev.audioTrack) return {};
  return { audioTrack: prev.audioTrack, audioStartMs: prev.audioStartMs, overlayAudioVolume: prev.overlayAudioVolume };
}

/** The one line the Audio section shows when the asked-for sound cannot be used; null otherwise. */
export function studioSoundNotice(status: StudioSoundStatus): string | null {
  if (status === "missing") return "That sound is no longer available. Your reel will use its own audio.";
  if (status === "failed") return "That sound could not be loaded. Your reel will use its own audio.";
  return null;
}

/** What the lookup's state means for the studio. */
export function studioSoundStatus(input: { soundId: string | null; isPending: boolean; isError: boolean; found: boolean }): StudioSoundStatus {
  if (!input.soundId) return "none";
  if (input.isError) return "failed";
  if (input.isPending) return "loading";
  return input.found ? "ready" : "missing";
}
