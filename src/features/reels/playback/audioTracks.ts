/*
  Alternate audio tracks for a reel (media-service /v1/media/:id/audio-tracks).

  The viewer keeps one preference, a language; every reel that carries a
  ready track in that language plays it, everything else plays the
  original. Pure helpers here; the hook and the player are the bindings.
*/

export type AudioTrackSource = "original" | "uploaded" | "generated";
export type AudioTrackStatus = "pending" | "processing" | "ready" | "failed";

export interface ReelAudioTrack {
  id: string;
  language: string;
  label: string;
  source: AudioTrackSource;
  status: AudioTrackStatus;
  /** Gateway-relative MP4 with this audio muxed in; ready tracks only. */
  playback_url?: string;
  rungs?: string[];
  error?: string;
  created_at?: string;
}

export const ORIGINAL_TRACK_ID = "original";

/** The menu's choices: the original first, then every READY alternate. */
export function audioTrackOptions(tracks: ReelAudioTrack[]): { id: string; label: string }[] {
  const original = tracks.find((t) => t.source === "original");
  const out = [{ id: ORIGINAL_TRACK_ID, label: original?.label || "Original" }];
  for (const t of tracks) {
    if (t.source === "original" || t.status !== "ready" || !t.playback_url) continue;
    out.push({ id: t.id, label: t.label || languageLabel(t.language) });
  }
  return out;
}

/**
 * Which track this reel should play for a viewer who prefers `language`
 * (null = the original). A preference the reel cannot satisfy falls back to
 * the original rather than to some other language.
 */
export function pickAudioTrack(tracks: ReelAudioTrack[], language: string | null): ReelAudioTrack | null {
  if (!language) return null;
  const want = language.toLowerCase();
  return tracks.find((t) => t.source !== "original" && t.status === "ready" && Boolean(t.playback_url) && t.language.toLowerCase() === want) ?? null;
}

/** The language a menu choice stands for (null = original). */
export function languageForChoice(tracks: ReelAudioTrack[], id: string): string | null {
  if (id === ORIGINAL_TRACK_ID) return null;
  return tracks.find((t) => t.id === id)?.language ?? null;
}

/** The languages a creator can pick for an upload or a generated dub. */
export const LANGUAGE_CHOICES: readonly { tag: string; label: string }[] = [
  { tag: "en", label: "English" },
  { tag: "hi", label: "Hindi" },
  { tag: "te", label: "Telugu" },
  { tag: "ta", label: "Tamil" },
  { tag: "kn", label: "Kannada" },
  { tag: "ml", label: "Malayalam" },
  { tag: "mr", label: "Marathi" },
  { tag: "bn", label: "Bengali" },
  { tag: "gu", label: "Gujarati" },
  { tag: "pa", label: "Punjabi" },
  { tag: "ur", label: "Urdu" },
  { tag: "es", label: "Spanish" },
  { tag: "fr", label: "French" },
  { tag: "de", label: "German" },
  { tag: "pt", label: "Portuguese" },
  { tag: "ar", label: "Arabic" },
  { tag: "ja", label: "Japanese" },
  { tag: "ko", label: "Korean" },
  { tag: "zh", label: "Chinese" },
];

export function languageLabel(tag: string): string {
  const hit = LANGUAGE_CHOICES.find((l) => l.tag === tag.toLowerCase());
  if (hit) return hit.label;
  try {
    const name = new Intl.DisplayNames(["en"], { type: "language" }).of(tag);
    if (name && name !== tag) return name;
  } catch {
    /* unknown tag */
  }
  return tag;
}
