import { afterEach, describe, expect, spyOn, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import api from "@/lib/api";
import { fetchSoundList, soundListRequest, soundSearchTerm } from "@/features/reels/data/soundsApi";
import { toSoundInfo, toSoundList } from "@/features/reels/sounds";
import { listSoundLibrary, normalizeLibrarySound, type HubLibrarySound } from "@/features/posttube/hub/hubApi";

import { SoundPickerFrame, SoundPickerList, SoundPickerRows } from "../components/SoundPickerSheet";
import { StudioSoundView } from "../components/StudioSoundSection";
import {
  createDebouncer,
  librarySoundAsInfo,
  mergeGenres,
  nextTabIndex,
  pickLibrarySound,
  rowFromLibrary,
  rowFromSound,
  rowIsChosen,
  soundDurationLabel,
  soundRowMeta,
  SOUND_PICKER_TABS,
  startPreview,
  stopPreview,
  type DebounceTimers,
  type PreviewAudio,
} from "../soundPicker";
import { studioCreateFields } from "../studioApi";
import { chosenSoundPatch, soundToAudioTrack, studioDraftSoundFields } from "../studioSound";
import { takesAddedSound } from "../steps/DetailsStep";
import { INITIAL_FORM_STATE, type StudioFormState } from "../types";

const soundRow = JSON.parse(readFileSync(resolve(import.meta.dir, "../../reels/__tests__/contracts/sounds/sound.json"), "utf8")) as Record<string, unknown>;
const sound = toSoundInfo(soundRow)!;

const LIBRARY_ID = "11111111-1111-4111-8111-111111111111";
const TRACK_ID = "22222222-2222-4222-8222-222222222222";
const library: HubLibrarySound = normalizeLibrarySound({
  id: LIBRARY_ID,
  title: "Lofi morning",
  artist: "Studio band",
  duration_ms: 42_000,
  audio_url: `/v1/audio-library/${LIBRARY_ID}/serve`,
  genre: "lofi",
  usage_count: 3,
  audio_track_id: null,
})!;

const form = (patch: Partial<StudioFormState> = {}): StudioFormState => ({ ...INITIAL_FORM_STATE, contentType: "reel", title: "t", ...patch });
const src = (rel: string) => readFileSync(resolve(import.meta.dir, rel), "utf8").split("\r\n").join("\n");
const noop = () => {};

const spies: { mockRestore: () => void }[] = [];
afterEach(() => {
  while (spies.length) spies.pop()!.mockRestore();
});

function spyGet(answer: unknown) {
  const calls: { url: string; config: { params?: Record<string, string> } }[] = [];
  const s = spyOn(api, "get").mockImplementation(((url: string, config: { params?: Record<string, string> }) => {
    calls.push({ url, config });
    return Promise.resolve({ data: { data: answer } });
  }) as never);
  spies.push(s);
  return calls;
}

function spyPost(answer: { data?: unknown; error?: unknown }) {
  const calls: { url: string; body: unknown }[] = [];
  const s = spyOn(api, "post").mockImplementation(((url: string, body?: unknown) => {
    calls.push({ url, body });
    return answer.error ? Promise.reject(answer.error) : Promise.resolve({ data: answer.data });
  }) as never);
  spies.push(s);
  return calls;
}

function refusal(status: number, code: string, message?: string) {
  return { response: { status, data: { error: { code, ...(message !== undefined ? { message } : {}) } } } };
}

/* ── the tabs and what each asks ───────────────────────────── */

describe("each tab's request", () => {
  test("three tabs in order: Trending, Search, Library", () => {
    expect(SOUND_PICKER_TABS.map((t) => t.label)).toEqual(["Trending", "Search", "Library"]);
  });

  test("Trending: GET /v1/audio/trending with a page", () => {
    expect(soundListRequest("trending")).toEqual({ url: "/v1/audio/trending", params: { limit: "20", offset: "0" } });
    expect(soundListRequest("trending", { offset: 40, limit: 500 })).toEqual({ url: "/v1/audio/trending", params: { limit: "50", offset: "40" } });
  });

  test("Search: GET /v1/audio/search?q= only from two characters, trimmed", () => {
    expect(soundListRequest("search", { q: "  lo fi  " })).toEqual({ url: "/v1/audio/search", params: { q: "lo fi", limit: "20", offset: "0" } });
    expect(soundListRequest("search", { q: "ab" })?.params.q).toBe("ab");
    expect(soundListRequest("search", { q: "a" })).toBeNull();
    expect(soundListRequest("search", { q: "  a  " })).toBeNull();
    expect(soundListRequest("search", { q: "" })).toBeNull();
    expect(soundListRequest("search")).toBeNull();
  });

  test("fetchSoundList sends exactly that, and reads {tracks}", async () => {
    const calls = spyGet({ tracks: [soundRow] });
    const trending = await fetchSoundList("trending");
    expect(calls[0].url).toBe("/v1/audio/trending");
    expect(calls[0].config.params).toEqual({ limit: "20", offset: "0" });
    expect(trending.items.map((s) => s.id)).toEqual([soundRow.id as string]);
    expect(trending.nextOffset).toBeUndefined();

    await fetchSoundList("search", { q: "kitchen", offset: 20 });
    expect(calls[1].url).toBe("/v1/audio/search");
    expect(calls[1].config.params).toEqual({ q: "kitchen", limit: "20", offset: "20" });
  });

  test("a one-character search asks nothing", async () => {
    const calls = spyGet({ tracks: [soundRow] });
    expect(await fetchSoundList("search", { q: "k" })).toEqual({ items: [] });
    expect(calls).toHaveLength(0);
  });

  test("a full page offers the next one, counted before anything is dropped", async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ ...soundRow, id: `id-${i}`, status: i === 3 ? "processing" : "ready" }));
    spyGet({ tracks: rows });
    const page = await fetchSoundList("trending", { offset: 20 });
    expect(page.items).toHaveLength(19);
    expect(page.nextOffset).toBe(40);
  });

  test("Library: GET /v1/audio-library with the chosen genre only", async () => {
    const calls = spyGet({ tracks: [], total: 0 });
    await listSoundLibrary({ genre: "lofi" });
    await listSoundLibrary({});
    expect(calls[0].url).toBe("/v1/audio-library");
    expect(calls[0].config.params).toEqual({ genre: "lofi", limit: "20", offset: "0" });
    expect(calls[1].config.params).toEqual({ limit: "20", offset: "0" });
  });

  test("a list keeps only playable sounds, each once", () => {
    const list = toSoundList({ tracks: [soundRow, soundRow, { ...soundRow, id: "p", status: "processing" }, { title: "no id" }, null] });
    expect(list.map((s) => s.id)).toEqual([soundRow.id as string]);
    expect(toSoundList([soundRow]).length).toBe(1);
    expect(toSoundList(null)).toEqual([]);
  });
});

/* ── keyboard ──────────────────────────────────────────────── */

describe("tabs by keyboard", () => {
  test("arrows move and wrap, Home and End jump, other keys do nothing", () => {
    expect(nextTabIndex(0, "ArrowRight")).toBe(1);
    expect(nextTabIndex(2, "ArrowRight")).toBe(0);
    expect(nextTabIndex(0, "ArrowLeft")).toBe(2);
    expect(nextTabIndex(1, "Home")).toBe(0);
    expect(nextTabIndex(0, "End")).toBe(2);
    expect(nextTabIndex(1, "Enter")).toBeNull();
    expect(nextTabIndex(0, "ArrowRight", 0)).toBeNull();
  });

  test("the tab row: a tablist, one selected tab in the tab order, panels labelled by their tab", () => {
    const html = renderToStaticMarkup(
      <SoundPickerFrame tab="search" onTab={noop} onClose={noop} idBase="sp">
        <p>panel</p>
      </SoundPickerFrame>,
    );
    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(3);
    expect(html).toContain('id="sp-tab-search" aria-selected="true" aria-controls="sp-panel-search" tabindex="0"');
    expect(html).toContain('id="sp-tab-trending" aria-selected="false" aria-controls="sp-panel-trending" tabindex="-1"');
    expect(html).toContain('role="tabpanel" id="sp-panel-search" aria-labelledby="sp-tab-search"');
    expect(html).toContain('id="sp-title"');
    expect(html).toContain('aria-label="Close"');
  });

  test("Esc closes, Tab stays inside, focus returns to the opening button", () => {
    const sheet = src("../components/SoundPickerSheet.tsx");
    expect(sheet).toContain('role="dialog"');
    expect(sheet).toContain('aria-modal="true"');
    expect(sheet).toContain('if (e.key === "Escape") {');
    expect(sheet).toContain('if (e.key !== "Tab" || !dialogRef.current) return;');
    const section = src("../components/StudioSoundSection.tsx");
    expect(section).toContain("requestAnimationFrame(() => pickerButtonRef.current?.focus());");
  });

  test("a full-height sheet on a phone, a dialog on wider screens", () => {
    const sheet = src("../components/SoundPickerSheet.tsx");
    expect(sheet).toContain("h-[100dvh] w-full");
    expect(sheet).toContain("sm:max-w-lg");
  });
});

/* ── the search debounce ───────────────────────────────────── */

function fakeTimers() {
  let next = 1;
  const pending = new Map<number, () => void>();
  const timers: DebounceTimers = {
    set: (fn) => {
      const id = next++;
      pending.set(id, fn);
      return id;
    },
    clear: (id) => {
      pending.delete(id as number);
    },
  };
  return {
    timers,
    get size() {
      return pending.size;
    },
    flush() {
      const due = [...pending.values()];
      pending.clear();
      due.forEach((fn) => fn());
    },
  };
}

describe("search is debounced", () => {
  test("a burst of keys asks once, with the last term", () => {
    const clock = fakeTimers();
    const seen: string[] = [];
    const d = createDebouncer<string>((q) => seen.push(q), 300, clock.timers);
    d.call("lo");
    d.call("lof");
    d.call("lofi");
    expect(seen).toEqual([]);
    expect(clock.size).toBe(1);
    expect(d.pending).toBe(true);
    clock.flush();
    expect(seen).toEqual(["lofi"]);
    expect(d.pending).toBe(false);
  });

  test("cancel drops the waiting term", () => {
    const clock = fakeTimers();
    const seen: string[] = [];
    const d = createDebouncer<string>((q) => seen.push(q), 300, clock.timers);
    d.call("lofi");
    d.cancel();
    clock.flush();
    expect(seen).toEqual([]);
  });

  test("it really waits: nothing before the delay, the last value after it", async () => {
    const seen: string[] = [];
    const d = createDebouncer<string>((q) => seen.push(q), 20);
    d.call("ab");
    d.call("abc");
    await new Promise((r) => setTimeout(r, 5));
    expect(seen).toEqual([]);
    await new Promise((r) => setTimeout(r, 40));
    expect(seen).toEqual(["abc"]);
  });

  test("the term: two characters or more, spaces collapsed", () => {
    expect(soundSearchTerm("a")).toBeNull();
    expect(soundSearchTerm(" a ")).toBeNull();
    expect(soundSearchTerm("ab")).toBe("ab");
    expect(soundSearchTerm("  lo   fi ")).toBe("lo fi");
    expect(soundSearchTerm("x".repeat(300))!.length).toBe(100);
  });

  test("the panel clears at once below two characters and asks through the debouncer otherwise", () => {
    const sheet = src("../components/SoundPickerSheet.tsx");
    expect(sheet).toContain("createDebouncer<string | null>(setTerm, SOUND_SEARCH_DEBOUNCE_MS)");
    expect(sheet).toContain('const list = useSoundList("search", term);');
    expect(sheet).toContain("Type at least 2 characters to search.");
  });
});

/* ── using a library sound ─────────────────────────────────── */

describe("Use on a library sound", () => {
  test("calls /use first, then chooses the audio_tracks id it answers — never the library id", async () => {
    const calls = spyPost({ data: { data: { audio_track_id: TRACK_ID, sound: { id: TRACK_ID, title: "Lofi morning" } } } });
    const pick = await pickLibrarySound(library);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`/v1/audio-library/${LIBRARY_ID}/use`);
    expect(pick.kind).toBe("chosen");
    if (pick.kind !== "chosen") return;
    expect(pick.sound.id).toBe(TRACK_ID);

    const fields = studioCreateFields(form(chosenSoundPatch(pick.sound)));
    expect(fields.audio_track_id).toBe(TRACK_ID);
    expect(fields.audio_start_ms).toBe(0);
    expect(JSON.stringify(fields)).not.toContain(LIBRARY_ID);
    expect(JSON.stringify(studioDraftSoundFields(form(chosenSoundPatch(pick.sound))))).not.toContain(LIBRARY_ID);
    // It plays from the track's own serve route, not the library's.
    expect(soundToAudioTrack(pick.sound).audio_url).toBe(`/v1/audio/${TRACK_ID}/serve`);
  });

  test("a row already used once still goes through /use", async () => {
    const calls = spyPost({ data: { data: { audio_track_id: TRACK_ID } } });
    const pick = await pickLibrarySound({ ...library, audio_track_id: TRACK_ID });
    expect(calls).toHaveLength(1);
    expect(pick).toMatchObject({ kind: "chosen", sound: { id: TRACK_ID } });
  });

  test("the sound keeps the row's name, artist and length", () => {
    const info = librarySoundAsInfo(library, { audio_track_id: TRACK_ID, title: "" });
    expect(info).toMatchObject({ id: TRACK_ID, title: "Lofi morning", artist: "Studio band", durationMs: 42_000, startMs: 0 });
    expect(librarySoundAsInfo(library, { audio_track_id: TRACK_ID, title: "Server title" }).title).toBe("Server title");
  });

  test("a regular sound is chosen as it is, from its start", () => {
    const patch = chosenSoundPatch(sound);
    expect(patch.audioTrack?.id).toBe(soundRow.id as string);
    expect(patch.audioStartMs).toBe(0);
    expect(rowFromSound(sound).previewSrc).toBe(`/v1/audio/${soundRow.id}/serve`);
  });

  test("the studio writes a picked sound the way ?sound= does, and a pick wins over a slow lookup", () => {
    const hook = src("../useUploadStudio.ts");
    expect(hook).toContain("patch(chosenSoundPatch(sound));");
    expect(hook).toContain("appliedSoundRef.current = soundId;\n    patch(chosenSoundPatch(sound));");
    expect(src("../UploadStudio.tsx")).toContain("onChooseSound={studio.chooseSound}");
  });

  test("only short-form studios offer the picker", () => {
    expect(takesAddedSound("reel")).toBe(true);
    expect(takesAddedSound("short")).toBe(true);
    expect(takesAddedSound("long")).toBe(false);
    expect(takesAddedSound("podcast")).toBe(false);
    expect(src("../steps/DetailsStep.tsx")).toContain("onChoose={takesAddedSound(contentType) ? onChooseSound : undefined}");
  });
});

describe("a refused use", () => {
  test("404, 422 and 503 show the server's own line; nothing is chosen", async () => {
    spyPost({ error: refusal(404, "NOT_FOUND", "Sound not found") });
    expect(await pickLibrarySound(library)).toEqual({ kind: "message", message: "Sound not found" });
    spies.pop()!.mockRestore();

    spyPost({ error: refusal(422, "NOT_STORED", "This library sound has no audio to play") });
    expect(await pickLibrarySound(library)).toEqual({ kind: "message", message: "This library sound has no audio to play" });
    spies.pop()!.mockRestore();

    spyPost({ error: refusal(503, "SOUND_UNAVAILABLE", "The sound could not be prepared; retry") });
    expect(await pickLibrarySound(library)).toEqual({ kind: "message", message: "The sound could not be prepared; retry" });
  });

  test("with no body, the same lines by status", async () => {
    expect(await pickLibrarySound(library, () => Promise.reject({ response: { status: 404 } }))).toEqual({ kind: "message", message: "Sound not found" });
    expect(await pickLibrarySound(library, () => Promise.reject({ response: { status: 422 } }))).toEqual({
      kind: "message",
      message: "This library sound has no audio to play",
    });
    expect(await pickLibrarySound(library, () => Promise.reject({ response: { status: 503 } }))).toEqual({
      kind: "message",
      message: "The sound could not be prepared; retry",
    });
  });

  test("401 sends the creator to sign in, back to the studio", async () => {
    expect(await pickLibrarySound(library, () => Promise.reject(refusal(401, "UNAUTHORIZED")))).toEqual({ kind: "signed-out" });
    const sheet = src("../components/SoundPickerSheet.tsx");
    expect(sheet).toContain('if (pick.kind === "signed-out") {');
    expect(sheet).toContain("router.push(signInHref(`${window.location.pathname}${window.location.search}`));");
    expect(sheet).toContain("setMessage(pick.message);");
  });

  test("anything else is a plain retry line", async () => {
    expect(await pickLibrarySound(library, () => Promise.reject(new Error("network")))).toEqual({
      kind: "message",
      message: "That sound could not be used. Please try again.",
    });
  });
});

/* ── remove, add, change ───────────────────────────────────── */

describe("the Audio section's buttons", () => {
  const base = { patch: noop, onRemove: noop, preview: "idle" as const, onTogglePreview: noop };

  test("no sound: Add sound opens the picker as a dialog", () => {
    const html = renderToStaticMarkup(<StudioSoundView {...base} form={form()} onOpenPicker={noop} />);
    expect(html).toContain('data-action="add-sound"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Add sound</button>");
    expect(html).not.toContain("Change sound");
    expect(html).not.toContain("Remove");
  });

  test("a sound chosen: Change sound and Remove sound", () => {
    const html = renderToStaticMarkup(<StudioSoundView {...base} form={form({ audioTrack: soundToAudioTrack(sound) })} onOpenPicker={noop} pickerOpen />);
    expect(html).toContain('data-action="change-sound"');
    expect(html).toContain("Change sound</button>");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('data-action="remove-sound" aria-label="Remove sound"');
    expect(html).not.toContain("Add sound");
  });

  test("without a picker (long video) there is no Add or Change", () => {
    const html = renderToStaticMarkup(<StudioSoundView {...base} form={form({ audioTrack: soundToAudioTrack(sound) })} />);
    expect(html).not.toContain("Change sound");
    expect(html).not.toContain("Add sound");
  });

  test("Remove clears the sound and its start; the draft save then clears it on the server", () => {
    const hook = src("../useUploadStudio.ts");
    expect(hook).toContain("patch({ audioTrack: null, audioStartMs: 0, overlayAudioVolume: INITIAL_FORM_STATE.overlayAudioVolume });");
    const removed = form({ audioTrack: null, audioStartMs: 0 });
    expect("audio_track_id" in studioCreateFields(removed)).toBe(false);
    expect(studioDraftSoundFields(removed)).toEqual({ audio_track_id: "" });
  });
});

/* ── rows ──────────────────────────────────────────────────── */

describe("a row", () => {
  test("title, artist and length, a preview, and Use", () => {
    const html = renderToStaticMarkup(<SoundPickerRows rows={[rowFromLibrary(library)]} playingKey={null} onTogglePreview={noop} onUse={noop} />);
    expect(html).toContain(">Lofi morning</p>");
    expect(html).toContain(">Studio band · 0:42</p>");
    expect(html).toContain('aria-label="Play preview of Lofi morning"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-label="Use Lofi morning"');
    expect(html).toContain(">Use</button>");
  });

  test("the playing row says Pause; a use in flight holds every Use", () => {
    const rows = [rowFromLibrary(library), rowFromSound(sound)];
    const html = renderToStaticMarkup(<SoundPickerRows rows={rows} playingKey={rows[0].key} usingKey={rows[0].key} onTogglePreview={noop} onUse={noop} />);
    expect(html).toContain('aria-label="Pause preview of Lofi morning"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Adding…");
    expect(html.match(/data-action="use-sound"[^>]*disabled=""|disabled=""[^>]*data-action="use-sound"/g)).toHaveLength(2);
  });

  test("the sound already on the reel says In use, by audio_tracks id", () => {
    expect(rowIsChosen(rowFromSound(sound), soundRow.id as string)).toBe(true);
    expect(rowIsChosen(rowFromLibrary(library), LIBRARY_ID)).toBe(false);
    expect(rowIsChosen(rowFromLibrary({ ...library, audio_track_id: TRACK_ID }), TRACK_ID)).toBe(true);
    expect(rowIsChosen(rowFromSound(sound), null)).toBe(false);
    const html = renderToStaticMarkup(<SoundPickerRows rows={[rowFromSound(sound)]} playingKey={null} chosenTrackId={soundRow.id as string} onTogglePreview={noop} onUse={noop} />);
    expect(html).toContain("In use");
    expect(html).not.toContain('data-action="use-sound"');
  });

  test("a library row with no playable URL has its preview disabled", () => {
    const html = renderToStaticMarkup(<SoundPickerRows rows={[rowFromLibrary({ ...library, audio_url: "" })]} playingKey={null} onTogglePreview={noop} onUse={noop} />);
    expect(html).toContain('title="No preview for this sound"');
    expect(html).toMatch(/aria-label="Play preview of Lofi morning"[^>]*disabled=""|disabled=""[^>]*aria-label="Play preview of Lofi morning"/);
  });

  test("meta and length", () => {
    expect(soundDurationLabel(0)).toBe("");
    expect(soundDurationLabel(999)).toBe("");
    expect(soundDurationLabel(61_000)).toBe("1:01");
    expect(soundRowMeta({ artist: "", durationMs: 0 })).toBe("");
    expect(soundRowMeta({ artist: "Asha", durationMs: 0 })).toBe("Asha");
  });

  test("genre pills keep what they have seen", () => {
    expect(mergeGenres([], [{ genre: "pop" }, { genre: "lofi" }, { genre: "" }])).toEqual(["lofi", "pop"]);
    const prev = ["lofi", "pop"];
    expect(mergeGenres(prev, [{ genre: "pop" }])).toBe(prev);
    expect(mergeGenres(prev, [])).toBe(prev);
    expect(src("../components/SoundPickerSheet.tsx")).toContain('role="group" aria-label="Genre"');
  });
});

describe("list states", () => {
  test("loading, empty and error each say so", () => {
    expect(renderToStaticMarkup(<SoundPickerList status="loading" emptyText="e" errorText="x" />)).toContain("Loading sounds…");
    const empty = renderToStaticMarkup(<SoundPickerList status="empty" emptyText="No trending sounds yet." errorText="x" />);
    expect(empty).toContain('data-sound-picker-state="empty"');
    expect(empty).toContain("No trending sounds yet.");
    const error = renderToStaticMarkup(<SoundPickerList status="error" emptyText="e" errorText="Sounds are not available right now." onRetry={noop} />);
    expect(error).toContain('role="alert"');
    expect(error).toContain("Try again</button>");
  });

  test("a full page offers Load more", () => {
    const html = renderToStaticMarkup(
      <SoundPickerList status="ready" emptyText="e" errorText="x" hasMore onMore={noop}>
        <p>rows</p>
      </SoundPickerList>,
    );
    expect(html).toContain("Load more</button>");
  });
});

/* ── previews: muted until play ────────────────────────────── */

function fakeAudio(play: () => Promise<void> = () => Promise.resolve()) {
  const log: string[] = [];
  const audio: PreviewAudio & { log: string[] } = {
    src: "",
    muted: true,
    currentTime: 12,
    log,
    play: () => {
      log.push(`play muted=${audio.muted}`);
      return play();
    },
    pause: () => {
      log.push("pause");
    },
  };
  return audio;
}

describe("previews", () => {
  test("the element starts muted, preloads nothing and has no source", () => {
    const sheet = src("../components/SoundPickerSheet.tsx");
    const at = sheet.indexOf("<audio\n");
    expect(at).toBeGreaterThan(-1);
    const tag = sheet.slice(at, sheet.indexOf("/>", at));
    expect(tag).toContain('preload="none"');
    expect(tag).toContain("muted");
    expect(tag).not.toContain("src=");
    expect(tag).not.toContain("autoPlay");
  });

  test("a play press unmutes it and plays that sound from its start", async () => {
    const audio = fakeAudio();
    expect(audio.muted).toBe(true);
    expect(await startPreview(audio, "/v1/audio/s1/serve")).toBe(true);
    expect(audio.src).toBe("/v1/audio/s1/serve");
    expect(audio.currentTime).toBe(0);
    expect(audio.log).toEqual(["pause", "play muted=false"]);
  });

  test("stopping pauses and mutes again", () => {
    const audio = fakeAudio();
    audio.muted = false;
    stopPreview(audio);
    expect(audio.muted).toBe(true);
    expect(audio.log).toEqual(["pause"]);
    expect(() => stopPreview(null)).not.toThrow();
  });

  test("a preview that cannot play is muted again and reported", async () => {
    const audio = fakeAudio(() => Promise.reject(Object.assign(new Error("no"), { name: "NotSupportedError" })));
    await expect(startPreview(audio, "/x")).rejects.toThrow("no");
    expect(audio.muted).toBe(true);
  });

  test("a later press that interrupts the start is not a failure", async () => {
    const audio = fakeAudio(() => Promise.reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    expect(await startPreview(audio, "/x")).toBe(false);
  });

  test("only a press starts one; closing, a tab change and a genre change stop it", () => {
    const sheet = src("../components/SoundPickerSheet.tsx");
    expect(sheet.split("startPreview(").length - 1).toBe(1);
    expect(sheet).toContain("startPreview(audio, row.previewSrc)");
    expect(sheet).toContain("stopPreview(audio);\n      body.style.overflow = overflow;");
    expect(sheet).toContain("const changeTab = useCallback(\n    (next: SoundPickerTab, focus = false) => {\n      stop();");
    expect(sheet).toContain("onGenre={(g) => {\n                stop();");
  });

  test("opening the picker pauses the chosen sound's own preview", () => {
    expect(src("../components/StudioSoundSection.tsx")).toContain('if (preview.state === "playing") preview.toggle();');
  });
});

describe("Momentum only", () => {
  test("no colour of its own and no other app's words in the new files", () => {
    for (const file of ["../components/SoundPickerSheet.tsx", "../soundPicker.ts", "../components/StudioSoundSection.tsx"]) {
      const text = src(file);
      expect(text.match(/#[0-9a-f]{3,8}\b/gi)).toBeNull();
      expect(text).not.toContain("rgb(0");
      expect(text.toLowerCase()).not.toContain("tiktok");
    }
  });
});
