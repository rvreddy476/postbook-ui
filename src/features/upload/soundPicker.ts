import { soundServeHref, type SoundInfo } from "@/features/reels/sounds";
import { librarySoundUseFailure, requestLibrarySoundUse, type HubLibrarySound, type HubLibrarySoundUse } from "@/features/posttube/hub/hubApi";

/*
  The studio's sound picker, the parts that need no screen: its tabs, the
  rows it lists, how a library sound becomes a sound the reel can carry,
  the search debounce, and the one preview element.

    Trending  GET /v1/audio/trending              (sounds this viewer may hear)
    Search    GET /v1/audio/search?q=             (2+ characters)
    Library   GET /v1/audio-library?genre=        (curated; audio_url plays)

  A regular sound is used as it is: its id is an audio_tracks id. A library
  row is NOT: POST /v1/audio-library/:id/use answers the audio_tracks id it
  plays as, and only that id reaches the form. The library id never leaves
  the picker.

  Previews: nothing plays until the creator presses play. The one <audio>
  element is muted with preload="none" until then, is muted again whenever
  it stops, and stops when the picker closes.
*/

/* ── tabs ──────────────────────────────────────────────────── */

export const SOUND_PICKER_TABS = [
  { id: "trending", label: "Trending" },
  { id: "search", label: "Search" },
  { id: "library", label: "Library" },
] as const;

export type SoundPickerTab = (typeof SOUND_PICKER_TABS)[number]["id"];

/** The tab an arrow, Home or End key moves to (wrapping); null for any other key. */
export function nextTabIndex(current: number, key: string, count: number = SOUND_PICKER_TABS.length): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
      return (current + 1) % count;
    case "ArrowLeft":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/* ── rows ──────────────────────────────────────────────────── */

/** One row of any tab. `key` is unique across tabs, so one preview state serves them all. */
export type SoundPickerRow =
  | { key: string; kind: "sound"; title: string; artist: string; durationMs: number; previewSrc: string; sound: SoundInfo }
  | { key: string; kind: "library"; title: string; artist: string; durationMs: number; previewSrc: string; library: HubLibrarySound };

export function rowFromSound(sound: SoundInfo): SoundPickerRow {
  return {
    key: `sound:${sound.id}`,
    kind: "sound",
    title: sound.title,
    artist: sound.artist,
    durationMs: sound.durationMs,
    previewSrc: soundServeHref(sound.id),
    sound,
  };
}

export function rowFromLibrary(library: HubLibrarySound): SoundPickerRow {
  return {
    key: `library:${library.id}`,
    kind: "library",
    title: library.title,
    artist: library.artist,
    durationMs: library.duration_ms,
    // normalizeLibrarySound already dropped any URL the browser should not load.
    previewSrc: library.audio_url,
    library,
  };
}

/** Whether a row is the sound the studio already has: by audio_tracks id, never by library id. */
export function rowIsChosen(row: SoundPickerRow, chosenTrackId: string | null | undefined): boolean {
  if (!chosenTrackId) return false;
  return row.kind === "sound" ? row.sound.id === chosenTrackId : row.library.audio_track_id === chosenTrackId;
}

/** "Artist · 0:42": what is known, joined; "" when nothing is. */
export function soundRowMeta(row: Pick<SoundPickerRow, "artist" | "durationMs">): string {
  return [row.artist.trim(), soundDurationLabel(row.durationMs)].filter(Boolean).join(" · ");
}

/** "0:42", "12:05"; "" for no length. */
export function soundDurationLabel(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const total = Math.floor(ms / 1000);
  if (total <= 0) return "";
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** The library's genres seen so far, sorted, so the pills keep their options once one is chosen. */
export function mergeGenres(prev: readonly string[], rows: readonly Pick<HubLibrarySound, "genre">[]): string[] {
  const found = rows.map((r) => r.genre.trim()).filter(Boolean);
  if (found.length === 0) return prev as string[];
  const next = [...new Set([...prev, ...found])].sort((a, b) => a.localeCompare(b));
  return next.length === prev.length ? (prev as string[]) : next;
}

export function genreLabel(genre: string): string {
  return genre ? genre.charAt(0).toUpperCase() + genre.slice(1) : "All";
}

/* ── using a library sound ─────────────────────────────────── */

/**
 * The sound a used library row is, as the studio holds it. The id is the
 * use answer's audio_tracks id; the row adds what the answer leaves out.
 */
export function librarySoundAsInfo(row: HubLibrarySound, use: HubLibrarySoundUse): SoundInfo {
  return {
    id: use.audio_track_id,
    title: use.title || row.title,
    artist: row.artist,
    startMs: 0,
    durationMs: row.duration_ms,
    useCount: row.usage_count,
    sourcePostId: null,
    isOriginal: false,
    creatorUserId: null,
  };
}

export type LibraryPick =
  /** Use it: the sound, carrying the audio_tracks id. */
  | { kind: "chosen"; sound: SoundInfo }
  /** 401: go and sign in. */
  | { kind: "signed-out" }
  /** Refused or failed: the line to show (the server's own for 404 / 422 / 503). */
  | { kind: "message"; message: string };

/** "Use" on a library row: ask its use route for the audio_tracks id first, and only then choose it. */
export async function pickLibrarySound(
  row: HubLibrarySound,
  request: (libraryId: string) => Promise<HubLibrarySoundUse> = requestLibrarySoundUse,
): Promise<LibraryPick> {
  try {
    const use = await request(row.id);
    return { kind: "chosen", sound: librarySoundAsInfo(row, use) };
  } catch (err) {
    const failure = librarySoundUseFailure(err);
    return failure.kind === "signed-out" ? { kind: "signed-out" } : { kind: "message", message: failure.message };
  }
}

/* ── the search debounce ───────────────────────────────────── */

export const SOUND_SEARCH_DEBOUNCE_MS = 300;

export interface DebounceTimers {
  set: (fn: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

const realTimers: DebounceTimers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Calls `fn` with the last value once `ms` pass without another call. */
export function createDebouncer<T>(fn: (value: T) => void, ms: number = SOUND_SEARCH_DEBOUNCE_MS, timers: DebounceTimers = realTimers) {
  let handle: unknown = null;
  return {
    call(value: T) {
      if (handle !== null) timers.clear(handle);
      handle = timers.set(() => {
        handle = null;
        fn(value);
      }, ms);
    },
    cancel() {
      if (handle !== null) timers.clear(handle);
      handle = null;
    },
    get pending() {
      return handle !== null;
    },
  };
}

/* ── the preview element ───────────────────────────────────── */

/** The parts of an <audio> element the preview touches (a fake one in the tests). */
export interface PreviewAudio {
  src: string;
  muted: boolean;
  currentTime: number;
  play(): Promise<void> | void;
  pause(): void;
}

/**
 * Play one preview from its start, unmuted: only ever called from a press.
 * Resolves true once it plays, false when a later press interrupted it;
 * rejects (and mutes again) when it cannot play.
 */
export async function startPreview(audio: PreviewAudio, src: string): Promise<boolean> {
  audio.pause();
  audio.src = src;
  audio.currentTime = 0;
  audio.muted = false;
  try {
    await audio.play();
    return true;
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") return false;
    audio.muted = true;
    throw err;
  }
}

/** Stop the preview and mute the element again. */
export function stopPreview(audio: PreviewAudio | null | undefined): void {
  if (!audio) return;
  audio.pause();
  audio.muted = true;
}
