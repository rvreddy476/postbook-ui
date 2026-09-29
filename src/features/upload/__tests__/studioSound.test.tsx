import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import api from "@/lib/api";
import { createReel, updateDraft } from "@/features/reels/data/reelsApi";
import { toSoundInfo } from "@/features/reels/sounds";

import { StudioSoundView } from "../components/StudioSoundSection";
import { studioCreateFields } from "../studioApi";
import { freshStudioForm } from "../studioDefaults";
import { keepChosenSound, soundIdFromSearch, soundToAudioTrack, studioDraftSoundFields, studioSoundFields, studioSoundNotice, studioSoundStatus } from "../studioSound";
import { INITIAL_FORM_STATE, type StudioFormState } from "../types";

const soundRow = JSON.parse(readFileSync(resolve(import.meta.dir, "../../reels/__tests__/contracts/sounds/sound.json"), "utf8")) as Record<string, unknown>;
const track = soundToAudioTrack(toSoundInfo(soundRow)!);
const form = (patch: Partial<StudioFormState> = {}): StudioFormState => ({ ...INITIAL_FORM_STATE, contentType: "reel", title: "t", ...patch });
const noop = () => {};

describe("the sound's request fields", () => {
  test("with a sound chosen: audio_track_id and audio_start_ms, beside the two volumes", () => {
    const f = studioCreateFields(form({ audioTrack: track, audioStartMs: 1500, originalAudioVolume: 0, overlayAudioVolume: 0.8 }));
    expect(f.audio_track_id).toBe(soundRow.id as string);
    expect(f.audio_start_ms).toBe(1500);
    expect(f.original_audio_volume).toBe(0);
    expect(f.overlay_audio_volume).toBe(0.8);
  });

  test("a start of 0 is still sent with a sound", () => {
    const f = studioCreateFields(form({ audioTrack: track, audioStartMs: 0 }));
    expect("audio_start_ms" in f).toBe(true);
    expect(f.audio_start_ms).toBe(0);
  });

  test("with no sound: neither is sent, not even as null or empty", () => {
    const f = studioCreateFields(form({ audioTrack: null, audioStartMs: 1500 }));
    expect("audio_track_id" in f).toBe(false);
    expect("audio_start_ms" in f).toBe(false);
    expect(f.original_audio_volume).toBe(1);
    expect(f.overlay_audio_volume).toBe(1);
  });

  test("a sound with an empty id is no sound", () => {
    expect(studioSoundFields({ audioTrack: { ...track, id: "" }, audioStartMs: 200 })).toEqual({});
    expect(studioSoundFields({ audioTrack: { ...track, id: "  " }, audioStartMs: 200 })).toEqual({});
  });

  test("the start is a whole, non-negative number of milliseconds", () => {
    expect(studioSoundFields({ audioTrack: track, audioStartMs: 1500.7 }).audio_start_ms).toBe(1500);
    expect(studioSoundFields({ audioTrack: track, audioStartMs: -40 }).audio_start_ms).toBe(0);
    expect(studioSoundFields({ audioTrack: track, audioStartMs: NaN }).audio_start_ms).toBe(0);
  });
});

describe("a draft save", () => {
  test("carries the chosen sound and its start", () => {
    expect(studioDraftSoundFields({ audioTrack: track, audioStartMs: 900 })).toEqual({ audio_track_id: track.id, audio_start_ms: 900 });
  });

  test("clears a sound that was removed: an empty id, and no start", () => {
    expect(studioDraftSoundFields({ audioTrack: null, audioStartMs: 900 })).toEqual({ audio_track_id: "" });
    expect(studioDraftSoundFields({ audioTrack: { ...track, id: "  " }, audioStartMs: 0 })).toEqual({ audio_track_id: "" });
    expect(Object.keys(studioDraftSoundFields({ audioTrack: null, audioStartMs: 0 }))).toEqual(["audio_track_id"]);
  });

  test("is the only request that sends an empty id: a create never does", () => {
    expect(studioSoundFields({ audioTrack: null, audioStartMs: 0 })).toEqual({});
    const api = readFileSync(resolve(import.meta.dir, "../studioApi.ts"), "utf8");
    expect(api).toContain("...studioSoundFields(form)");
    expect(api).not.toContain("studioDraftSoundFields");
  });
});

describe("the requests carry them", () => {
  afterEach(() => mock.restore());

  test("POST /v1/posts: both fields in the body with a sound, neither without", async () => {
    const post = spyOn(api, "post").mockResolvedValue({ data: { data: { id: "p1", author_id: "a", content_type: "flick", media: [] } } } as never);
    await createReel({ text: "c", mediaIds: ["m1"], content_type: "flick", fields: studioCreateFields(form({ audioTrack: track, audioStartMs: 1500 })) });
    const withSound = (post.mock.calls[0] as unknown as [string, Record<string, unknown>])[1];
    expect(post.mock.calls[0][0]).toBe("/v1/posts");
    expect(withSound).toMatchObject({ audio_track_id: soundRow.id, audio_start_ms: 1500, original_audio_volume: 1, overlay_audio_volume: 1 });

    await createReel({ text: "c", mediaIds: ["m1"], content_type: "flick", fields: studioCreateFields(form()) });
    const without = (post.mock.calls[1] as unknown as [string, Record<string, unknown>])[1];
    expect("audio_track_id" in without).toBe(false);
    expect("audio_start_ms" in without).toBe(false);
  });

  test("the draft save: the same two fields, the same rule", async () => {
    const patch = spyOn(api, "patch").mockResolvedValue({ data: { data: { id: "d1" } } } as never);
    await updateDraft("d1", { caption: "c", ...studioSoundFields(form({ audioTrack: track, audioStartMs: 900 })) });
    expect((patch.mock.calls[0] as unknown as [string, Record<string, unknown>])[1]).toMatchObject({ audio_track_id: soundRow.id, audio_start_ms: 900 });
    await updateDraft("d1", { caption: "c", ...studioSoundFields(form()) });
    const without = (patch.mock.calls[1] as unknown as [string, Record<string, unknown>])[1];
    expect("audio_track_id" in without).toBe(false);
    expect("audio_start_ms" in without).toBe(false);
  });

  test("the studio's draft save goes through studioDraftSoundFields and its direct create through studioSoundFields", () => {
    const hook = readFileSync(resolve(import.meta.dir, "../useUploadStudio.ts"), "utf8").split("\r\n").join("\n");
    const save = hook.slice(hook.indexOf("await updateDraft(draftId, {"), hook.indexOf("} catch { /* silently continue */ }"));
    expect(save).toContain("overlay_audio_volume: form.overlayAudioVolume,\n        ...studioDraftSoundFields(form),");
    expect(hook).toContain("fields: studioCreateFields(form),");
    const api = readFileSync(resolve(import.meta.dir, "../studioApi.ts"), "utf8").split("\r\n").join("\n");
    expect(api).toContain("overlay_audio_volume: form.overlayAudioVolume,\n    ...studioSoundFields(form),");
  });
});

describe("the chosen sound survives a new file", () => {
  test("freshStudioForm resets everything but the sound, its start and its level", () => {
    const before = form({ audioTrack: track, audioStartMs: 1500, overlayAudioVolume: 0.6, originalAudioVolume: 0.2, title: "old", caption: "old", mediaId: "m1", currentStep: "details" });
    const fresh = freshStudioForm("reel", "details", null, before);
    expect(fresh.audioTrack).toEqual(track);
    expect(fresh.audioStartMs).toBe(1500);
    expect(fresh.overlayAudioVolume).toBe(0.6);
    expect(fresh.title).toBe("");
    expect(fresh.caption).toBe("");
    expect(fresh.mediaId).toBeNull();
    expect(fresh.originalAudioVolume).toBe(1);
    expect(fresh.currentStep).toBe("details");
  });

  test("selecting a file and clearing it both pass the form being replaced", () => {
    const hook = readFileSync(resolve(import.meta.dir, "../useUploadStudio.ts"), "utf8");
    expect(hook).toContain("return freshStudioForm(contentType, prev.currentStep, getPublishDefaults(), prev);");
    expect(hook).toContain('return freshStudioForm(contentType, "video", getPublishDefaults(), prev);');
    expect(hook).not.toContain("getPublishDefaults());");
  });

  test("a removed sound stays removed; with no previous form nothing is carried", () => {
    const removed = form({ audioTrack: null, audioStartMs: 0, overlayAudioVolume: 0.6 });
    expect(keepChosenSound(removed)).toEqual({});
    expect(freshStudioForm("reel", "video", null, removed).audioTrack).toBeNull();
    expect(freshStudioForm("reel", "video", null, removed).overlayAudioVolume).toBe(1);
    expect(freshStudioForm("reel", "video", null).audioTrack).toBeNull();
    expect(freshStudioForm("reel", "video", null, null).audioTrack).toBeNull();
  });

  test("the sound is applied once per id, so removing it is not undone by a refetch", () => {
    const hook = readFileSync(resolve(import.meta.dir, "../useUploadStudio.ts"), "utf8");
    expect(hook).toContain("if (!soundId || !found || appliedSoundRef.current === soundId) return;");
    expect(hook).toContain("patch({ audioTrack: null, audioStartMs: 0, overlayAudioVolume: INITIAL_FORM_STATE.overlayAudioVolume });");
  });
});

describe("the sound asked for in the address", () => {
  test("?sound= is read as an id, or as nothing", () => {
    expect(soundIdFromSearch("5b1f6c52-0c5e-4a7e-9d56-7a1d5f0c9a11")).toBe("5b1f6c52-0c5e-4a7e-9d56-7a1d5f0c9a11");
    expect(soundIdFromSearch("  abc-1  ")).toBe("abc-1");
    expect(soundIdFromSearch("")).toBeNull();
    expect(soundIdFromSearch("   ")).toBeNull();
    expect(soundIdFromSearch(null)).toBeNull();
    expect(soundIdFromSearch(undefined)).toBeNull();
    expect(soundIdFromSearch("../../v1/admin")).toBeNull();
    expect(soundIdFromSearch("a b")).toBeNull();
    expect(soundIdFromSearch("x".repeat(65))).toBeNull();
  });

  test("the lookup's state", () => {
    expect(studioSoundStatus({ soundId: null, isPending: true, isError: false, found: false })).toBe("none");
    expect(studioSoundStatus({ soundId: "s", isPending: true, isError: false, found: false })).toBe("loading");
    expect(studioSoundStatus({ soundId: "s", isPending: false, isError: false, found: true })).toBe("ready");
    expect(studioSoundStatus({ soundId: "s", isPending: false, isError: false, found: false })).toBe("missing");
    expect(studioSoundStatus({ soundId: "s", isPending: false, isError: true, found: false })).toBe("failed");
  });

  test("a sound that cannot be used is one plain line; otherwise nothing is said", () => {
    expect(studioSoundNotice("missing")).toBe("That sound is no longer available. Your reel will use its own audio.");
    expect(studioSoundNotice("failed")).toBe("That sound could not be loaded. Your reel will use its own audio.");
    for (const quiet of ["none", "loading", "ready"] as const) expect(studioSoundNotice(quiet)).toBeNull();
    for (const status of ["missing", "failed"] as const) expect(studioSoundNotice(status)!.includes("\n")).toBe(false);
  });

  test("a sound that could not be loaded leaves the form as if none was chosen", () => {
    const f = studioCreateFields(form());
    expect("audio_track_id" in f).toBe(false);
    const hook = readFileSync(resolve(import.meta.dir, "../useUploadStudio.ts"), "utf8");
    // The only place the lookup writes to the form is on a found sound.
    expect(hook.split("soundToAudioTrack(").length - 1).toBe(1);
  });

  test("the media-service row becomes the form's track, played from the serve route", () => {
    expect(track.id).toBe(soundRow.id as string);
    expect(track.title).toBe(soundRow.title as string);
    expect(track.artist).toBe(soundRow.artist as string);
    expect(track.duration_ms).toBe(soundRow.duration_ms as number);
    expect(track.audio_url).toBe(`/v1/audio/${soundRow.id}/serve`);
    expect(track.usage_count).toBe(soundRow.usage_count as number);
    expect(track.status).toBe("active");
  });

  test("the page reads the address inside Suspense, as the posttube upload page does", () => {
    const page = readFileSync(resolve(import.meta.dir, "../../../app/reels/create/page.tsx"), "utf8");
    expect(page).toContain("useSearchParams()");
    expect(page).toContain('soundId={soundIdFromSearch(searchParams.get("sound"))}');
    expect(page.indexOf("<Suspense")).toBeGreaterThan(-1);
    expect(page.indexOf("<CreateReelContent />")).toBeGreaterThan(page.indexOf("<Suspense"));
    expect(page.indexOf("</Suspense>")).toBeGreaterThan(page.indexOf("<CreateReelContent />"));
  });
});

describe("the Audio section", () => {
  const base = { patch: noop, onRemove: noop, preview: "idle" as const, onTogglePreview: noop };

  test("a sound chosen: its name and creator, a preview, Remove, and the two levels", () => {
    const html = renderToStaticMarkup(<StudioSoundView {...base} form={form({ audioTrack: track, originalAudioVolume: 0.25, overlayAudioVolume: 0.8 })} />);
    expect(html).toContain('data-studio-sound="chosen"');
    expect(html).toContain(`>${soundRow.title}</p>`);
    expect(html).toContain(`>Sound · ${soundRow.artist}</p>`);
    expect(html).toContain('data-preview="idle"');
    expect(html).toContain("Preview</button>");
    expect(html).toContain('data-action="remove-sound"');
    expect(html).toContain("Remove</button>");
    expect(html).toContain('aria-label="Original audio volume"');
    expect(html).toContain('aria-label="Sound volume"');
    expect(html).toContain(">25%<");
    expect(html).toContain(">80%<");
    expect(html).not.toContain("Overlay Audio");
    expect(html).not.toContain("Original audio will be used");
  });

  test("none chosen: the reel uses its own audio, one level, nothing to remove or preview", () => {
    const html = renderToStaticMarkup(<StudioSoundView {...base} form={form()} />);
    expect(html).toContain('data-studio-sound="none"');
    expect(html).toContain("Original audio will be used");
    expect(html).toContain('aria-label="Original audio volume"');
    expect(html).not.toContain('aria-label="Sound volume"');
    expect(html).not.toContain("Remove");
    expect(html).not.toContain("data-preview");
    expect(html).not.toContain("data-studio-sound-notice");
  });

  test("a sound that could not be loaded: one line, and the section as if none was chosen", () => {
    const html = renderToStaticMarkup(<StudioSoundView {...base} form={form()} notice={studioSoundNotice("missing")} />);
    expect(html).toContain('<p role="status" class="text-[12px] text-brand-text/60" data-studio-sound-notice="true">That sound is no longer available. Your reel will use its own audio.</p>');
    expect(html).toContain('data-studio-sound="none"');
    expect(html).toContain("Original audio will be used");
    expect(html).not.toContain("Remove");
  });

  test("it opens by itself when there is a sound or a word about one, and removing the sound does not fold it", () => {
    const step = readFileSync(resolve(import.meta.dir, "../steps/DetailsStep.tsx"), "utf8");
    expect(step).toContain("const audioWorthOpening = Boolean(form.audioTrack) || Boolean(soundNotice);");
    expect(step).toContain("if (audioWorthOpening) setAudioOpened(true);");
    expect(step).toContain('<Collapsible key={audioOpened ? "audio-open" : "audio"} title="Audio" defaultOpen={audioOpened}>');
    expect(step).toContain("<StudioSoundSection");
  });

  test("small type, the theme's classes, no colour of its own", () => {
    const src = readFileSync(resolve(import.meta.dir, "../components/StudioSoundSection.tsx"), "utf8");
    expect(src.match(/#[0-9a-f]{3,8}\b/gi)).toBeNull();
    expect(src).not.toContain("rgb(");
    expect(src).not.toContain("style=");
    const sizes = [...src.matchAll(/text-\[(\d+)px\]/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(4);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(13);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11);
  });
});
