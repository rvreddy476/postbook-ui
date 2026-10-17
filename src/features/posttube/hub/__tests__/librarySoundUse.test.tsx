import { afterEach, describe, expect, spyOn, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import api from "@/lib/api";
import { soundIdFromSearch } from "@/features/upload/studioSound";
import {
  hubErrorMessage,
  librarySoundUseFailure,
  listSoundLibrary,
  normalizeLibrarySound,
  normalizeLibrarySoundUse,
  requestLibrarySoundUse,
} from "../hubApi";
import { libraryReelsHref, libraryStudioHref, SoundList } from "../components/SoundsPage";

/* "Use this sound" for curated library sounds (POST /v1/audio-library/:id/use). */

const LIBRARY_ID = "11111111-1111-4111-8111-111111111111";
const TRACK_ID = "22222222-2222-4222-8222-222222222222";

const spies: { mockRestore: () => void }[] = [];
afterEach(() => {
  while (spies.length) spies.pop()!.mockRestore();
});

function spyPost(answer: { data?: unknown; error?: unknown }) {
  const calls: { url: string; body: unknown }[] = [];
  const s = spyOn(api, "post").mockImplementation(((url: string, body?: unknown) => {
    calls.push({ url, body });
    return answer.error ? Promise.reject(answer.error) : Promise.resolve({ data: answer.data });
  }) as never);
  spies.push(s);
  return calls;
}

/** An axios-shaped refusal with the media-service envelope. */
function refusal(status: number, code: string, message?: string) {
  return { response: { status, data: { error: { code, ...(message !== undefined ? { message } : {}) } } } };
}

describe("POST /v1/audio-library/:id/use", () => {
  test("posts to the library id's use route with no body and answers the audio_tracks id", async () => {
    const calls = spyPost({ data: { data: { audio_track_id: TRACK_ID, sound: { id: TRACK_ID, title: "Lofi morning", status: "ready" } } } });
    const use = await requestLibrarySoundUse(LIBRARY_ID);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`/v1/audio-library/${LIBRARY_ID}/use`);
    expect(calls[0].body).toBeUndefined();
    expect(use).toEqual({ audio_track_id: TRACK_ID, title: "Lofi morning" });
  });

  test("the id is path-encoded", async () => {
    const calls = spyPost({ data: { data: { audio_track_id: TRACK_ID } } });
    await requestLibrarySoundUse("a/b");
    expect(calls[0].url).toBe("/v1/audio-library/a%2Fb/use");
  });

  test("an answer naming no track is a failure, never a half-chosen sound", async () => {
    spyPost({ data: { data: { sound: {} } } });
    await expect(requestLibrarySoundUse(LIBRARY_ID)).rejects.toThrow();
    expect(normalizeLibrarySoundUse(null)).toBeNull();
    expect(normalizeLibrarySoundUse({ audio_track_id: "  " })).toBeNull();
    // sound.id is the same audio_tracks id, read when the top-level one is missing.
    expect(normalizeLibrarySoundUse({ sound: { id: TRACK_ID } })?.audio_track_id).toBe(TRACK_ID);
  });

  test("refusals reach the caller unchanged", async () => {
    const err = refusal(503, "SOUND_UNAVAILABLE", "The sound could not be prepared; retry");
    spyPost({ error: err });
    await expect(requestLibrarySoundUse(LIBRARY_ID)).rejects.toBe(err);
  });
});

describe("what a refused use shows", () => {
  test("404 / 422 / 503 show the server's own line", () => {
    expect(librarySoundUseFailure(refusal(404, "NOT_FOUND", "Sound not found"))).toEqual({ kind: "message", message: "Sound not found" });
    expect(librarySoundUseFailure(refusal(422, "NOT_STORED", "This library sound has no audio to play"))).toEqual({
      kind: "message",
      message: "This library sound has no audio to play",
    });
    expect(librarySoundUseFailure(refusal(503, "SOUND_UNAVAILABLE", "The sound could not be prepared; retry"))).toEqual({
      kind: "message",
      message: "The sound could not be prepared; retry",
    });
  });

  test("with no message in the body, the code's server words are used; a bare status still maps", () => {
    expect(librarySoundUseFailure(refusal(404, "NOT_FOUND"))).toEqual({ kind: "message", message: "Sound not found" });
    expect(librarySoundUseFailure({ response: { status: 422, data: {} } })).toEqual({ kind: "message", message: "This library sound has no audio to play" });
    expect(librarySoundUseFailure({ response: { status: 503 } })).toEqual({ kind: "message", message: "The sound could not be prepared; retry" });
  });

  test("401 sends the creator to sign in", () => {
    expect(librarySoundUseFailure(refusal(401, "UNAUTHORIZED", "Invalid user ID"))).toEqual({ kind: "signed-out" });
  });

  test("anything else is a plain retry line, never a raw message", () => {
    expect(librarySoundUseFailure(refusal(400, "BAD_REQUEST", "Invalid audio ID"))).toEqual({ kind: "message", message: "That sound could not be used. Please try again." });
    expect(librarySoundUseFailure(new Error("Network Error"))).toEqual({ kind: "message", message: "That sound could not be used. Please try again." });
    expect(hubErrorMessage(refusal(404, "NOT_FOUND", "  "))).toBeNull();
  });
});

describe("the studio receives the audio_tracks id", () => {
  test("Use opens /reels/create?sound=<audio_track_id>, never the library id", async () => {
    spyPost({ data: { data: { audio_track_id: TRACK_ID, sound: { id: TRACK_ID } } } });
    const href = libraryStudioHref(await requestLibrarySoundUse(LIBRARY_ID));
    expect(href).toBe(`/reels/create?sound=${TRACK_ID}`);
    expect(href).not.toContain(LIBRARY_ID);
    // The studio route reads it back unchanged (src/app/reels/create/page.tsx).
    expect(soundIdFromSearch(new URL(href, "https://momentum.test").searchParams.get("sound"))).toBe(TRACK_ID);
  });
});

describe("library rows and See reels", () => {
  test("the list reads audio_track_id (null until first use) and the playable serve path", async () => {
    const calls = spyOn(api, "get").mockImplementation((() =>
      Promise.resolve({
        data: {
          data: {
            tracks: [
              { id: LIBRARY_ID, title: "Used", audio_url: `/v1/audio-library/${LIBRARY_ID}/serve`, audio_track_id: TRACK_ID, is_active: true },
              { id: "33333333-3333-4333-8333-333333333333", title: "Unused", audio_url: "/v1/audio-library/33333333-3333-4333-8333-333333333333/serve", audio_track_id: null },
            ],
            total: 2,
          },
        },
      })) as never);
    spies.push(calls);
    const page = await listSoundLibrary();
    expect(page.items.map((s) => s.audio_track_id)).toEqual([TRACK_ID, null]);
    expect(page.items[0].audio_url.endsWith(`/v1/audio-library/${LIBRARY_ID}/serve`)).toBe(true);
    expect(normalizeLibrarySound({ id: "x", audio_track_id: "" })?.audio_track_id).toBeNull();
  });

  test("See reels links to /reels/sound/<audio_track_id> only when the row has one", () => {
    const used = normalizeLibrarySound({ id: LIBRARY_ID, title: "Used", audio_url: "https://cdn.example.test/a.mp3", audio_track_id: TRACK_ID })!;
    const unused = normalizeLibrarySound({ id: "33333333-3333-4333-8333-333333333333", title: "Unused", audio_url: "https://cdn.example.test/b.mp3" })!;
    expect(libraryReelsHref(used)).toBe(`/reels/sound/${TRACK_ID}`);
    expect(libraryReelsHref(unused)).toBeNull();

    const html = renderToStaticMarkup(<SoundList rows={[used, unused]} playingId={null} onToggle={() => {}} onUse={() => {}} />);
    expect(html.match(/data-sound-reels/g)?.length).toBe(1);
    expect(html).toContain('aria-label="See reels with Used"');
    expect(html).not.toContain("See reels with Unused");
    expect(html).toContain(`href="/reels/sound/${TRACK_ID}"`);
    expect(html).not.toContain(`/reels/sound/${LIBRARY_ID}`);
    expect(html.match(/data-action="use-sound"/g)?.length).toBe(2);
  });

  test("while one use is in flight every Use button waits and that row says Opening", () => {
    const rows = [
      normalizeLibrarySound({ id: "a", title: "A", audio_url: "https://cdn.example.test/a.mp3" })!,
      normalizeLibrarySound({ id: "b", title: "B", audio_url: "https://cdn.example.test/b.mp3" })!,
    ];
    const html = renderToStaticMarkup(<SoundList rows={rows} playingId={null} onToggle={() => {}} onUse={() => {}} usingId="a" />);
    expect(html).toContain("Opening…");
    expect(html.match(/data-action="use-sound"/g)?.length).toBe(2);
    expect(html.match(/disabled="" data-action="use-sound"/g)?.length).toBe(2);
  });

  test("without onUse there is no Use button (the list stays usable read-only)", () => {
    const rows = [normalizeLibrarySound({ id: "a", title: "A", audio_url: "https://cdn.example.test/a.mp3" })!];
    expect(renderToStaticMarkup(<SoundList rows={rows} playingId={null} onToggle={() => {}} />)).not.toContain("Use this sound");
  });
});
