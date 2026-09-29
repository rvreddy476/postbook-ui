import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import api from "@/lib/api";
import { fetchSound, fetchSoundReels, resolveReelSound } from "@/features/reels/data/soundsApi";
import { ORIGINAL_SOUND_TITLE, toReelItem, toReelSound, wireVolume, type FeedReelPost } from "@/features/reels/model";
import {
  canUseSound,
  createWithSoundHref,
  nextSoundStep,
  originalSoundLabel,
  reelStageHref,
  signInHref,
  soundDestination,
  soundFromUseResponse,
  soundPageHref,
  soundReelCount,
  soundReelTiles,
  soundRefusalMessage,
  soundServeHref,
  studioHrefForSound,
  toSoundInfo,
  toSoundReelsPage,
} from "@/features/reels/sounds";

/*
  The fixtures stand in for the backend's golden files (post-service
  internal/http/testdata/contracts/sounds/) until they are copied over, so
  every assertion on them is written against the fixture's own values, not
  against literals: replacing the files must not need these tests rewritten.
*/
const fixture = <T = Record<string, unknown>>(name: string): T =>
  JSON.parse(readFileSync(resolve(import.meta.dir, "contracts/sounds", name), "utf8")) as T;

type WireSound = { id: string; title: string; artist: string; duration_ms: number; start_ms: number; use_count: number; source_post_id: string | null; creator_user_id: string | null };
const postWithSound = fixture<FeedReelPost & { sound: WireSound }>("post_with_sound.json");
const useSound = fixture<{ sound: WireSound }>("use_sound.json");
const bySound = fixture<{ sound: WireSound; origin: FeedReelPost | null; items: FeedReelPost[] }>("by_sound.json");
const soundRow = fixture<Record<string, unknown>>("sound.json");

const flick = (over: Partial<FeedReelPost> = {}): FeedReelPost => ({
  id: "p1",
  author_id: "a1",
  content_type: "flick",
  media: [{ media_id: "m1", kind: "video", duration_ms: 20_000 }],
  ...over,
});

describe("fixtures carry exactly the contract's keys", () => {
  const POST_SOUND_KEYS = ["artist", "creator_user_id", "duration_ms", "id", "source_post_id", "start_ms", "title", "use_count"];
  test("PostSound (2.1) in every file that holds one", () => {
    for (const sound of [postWithSound.sound, useSound.sound, bySound.sound, ...bySound.items.map((i) => i.sound)]) {
      expect(Object.keys(sound as object).sort()).toEqual(POST_SOUND_KEYS);
    }
  });
  test("use_sound.json is { sound }; by_sound.json is { sound, origin, items } with two items", () => {
    expect(Object.keys(useSound)).toEqual(["sound"]);
    expect(Object.keys(bySound).sort()).toEqual(["items", "origin", "sound"]);
    expect(bySound.items.length).toBe(2);
  });
  test("sound.json is the media-service row (1.4), source_reel_id kept beside source_post_id, no storage keys", () => {
    expect(Object.keys(soundRow).sort()).toEqual(["artist", "created_at", "creator_user_id", "duration_ms", "id", "is_original", "license_type", "sample_rate", "source_media_id", "source_post_id", "source_reel_id", "status", "title", "updated_at", "usage_count"]);
    expect(soundRow.source_reel_id).toBe(soundRow.source_post_id as string);
    expect("audio_key" in soundRow).toBe(false);
    expect("waveform_key" in soundRow).toBe(false);
  });
  test("the post carries the 2.1 fields beside the three that were already on the wire", () => {
    for (const key of ["audio_track_id", "audio_start_ms", "sound", "remix_setting", "original_audio_volume", "overlay_audio_volume"]) {
      expect(key in postWithSound).toBe(true);
    }
  });
});

describe("toReelItem — a post with a sound", () => {
  test("the fixture post becomes a reel with its sound", () => {
    const item = toReelItem(postWithSound)!;
    const wire = postWithSound.sound;
    expect(item).not.toBeNull();
    expect(item.sound).toEqual({
      id: wire.id,
      title: wire.title,
      artist: wire.artist,
      startMs: wire.start_ms || postWithSound.audio_start_ms || 0,
      durationMs: wire.duration_ms,
      useCount: wire.use_count,
      sourcePostId: wire.source_post_id || null,
    });
    expect(item.originalVolume).toBe(wireVolume(postWithSound.original_audio_volume));
    expect(item.overlayVolume).toBe(wireVolume(postWithSound.overlay_audio_volume));
    expect(item.soundReuseAllowed).toBe(postWithSound.remix_setting !== "disallow");
  });

  test("a post without the fields is unchanged: no sound, both levels 1, reuse allowed", () => {
    const item = toReelItem(flick())!;
    expect(item.sound).toBeNull();
    expect(item.originalVolume).toBe(1);
    expect(item.overlayVolume).toBe(1);
    expect(item.soundReuseAllowed).toBe(true);
  });

  test("audio_track_id alone is not a sound: the viewer may not hear it, the reel plays its own audio", () => {
    const item = toReelItem(flick({ audio_track_id: "s1", audio_start_ms: 1200 }))!;
    expect(item.sound).toBeNull();
  });

  test("remix_setting: only disallow turns reuse off; an empty or unknown value does not", () => {
    expect(toReelItem(flick({ remix_setting: "disallow" }))!.soundReuseAllowed).toBe(false);
    expect(toReelItem(flick({ remix_setting: "DISALLOW" }))!.soundReuseAllowed).toBe(false);
    expect(toReelItem(flick({ remix_setting: "allow" }))!.soundReuseAllowed).toBe(true);
    expect(toReelItem(flick({ remix_setting: "allow_audio_only" }))!.soundReuseAllowed).toBe(true);
    expect(toReelItem(flick({ remix_setting: "" }))!.soundReuseAllowed).toBe(true);
    expect(toReelItem(flick({ remix_setting: null }))!.soundReuseAllowed).toBe(true);
  });
});

describe("toReelSound — empty values fall through like absent ones (Go zero values)", () => {
  test("an empty id is no sound; so is a blank one, a missing one, and anything that is not an object", () => {
    expect(toReelSound({ id: "", title: "x" })).toBeNull();
    expect(toReelSound({ id: "   ", title: "x" })).toBeNull();
    expect(toReelSound({ title: "x" })).toBeNull();
    expect(toReelSound({ id: 7 })).toBeNull();
    expect(toReelSound(null)).toBeNull();
    expect(toReelSound(undefined)).toBeNull();
    expect(toReelSound("s1")).toBeNull();
    expect(toReelSound([])).toBeNull();
    expect(toReelSound({})).toBeNull();
  });

  test("an empty title reads Original sound; empty artist and source are empty and null", () => {
    expect(toReelSound({ id: "s1", title: "", artist: "", source_post_id: "" })).toEqual({
      id: "s1",
      title: ORIGINAL_SOUND_TITLE,
      artist: "",
      startMs: 0,
      durationMs: 0,
      useCount: 0,
      sourcePostId: null,
    });
    expect(ORIGINAL_SOUND_TITLE).toBe("Original sound");
    expect(toReelSound({ id: "s1", source_post_id: null })!.sourcePostId).toBeNull();
  });

  test("a start of 0 falls back to the post's audio_start_ms; a set start wins", () => {
    expect(toReelSound({ id: "s1", start_ms: 0 }, 1500)!.startMs).toBe(1500);
    expect(toReelSound({ id: "s1" }, 1500)!.startMs).toBe(1500);
    expect(toReelSound({ id: "s1", start_ms: 800 }, 1500)!.startMs).toBe(800);
    expect(toReelSound({ id: "s1", start_ms: 0 }, 0)!.startMs).toBe(0);
    expect(toReelSound({ id: "s1", start_ms: -5 }, undefined)!.startMs).toBe(0);
    expect(toReelSound({ id: "s1", start_ms: "900" })!.startMs).toBe(0);
  });

  test("media-service's spelling of the same row is read: usage_count, source_reel_id", () => {
    const s = toReelSound({ id: "s1", usage_count: 4, source_reel_id: "p9" })!;
    expect(s.useCount).toBe(4);
    expect(s.sourcePostId).toBe("p9");
    expect(toReelSound({ id: "s1", use_count: 2, usage_count: 9 })!.useCount).toBe(2);
    expect(toReelSound({ id: "s1", source_post_id: "p1", source_reel_id: "p9" })!.sourcePostId).toBe("p1");
  });
});

describe("wireVolume — the one field where 0 is a real value", () => {
  test("absent is 1", () => {
    expect(wireVolume(undefined)).toBe(1);
    expect(wireVolume(null)).toBe(1);
  });
  test("a present 0 is 0: the creator muted that side", () => {
    expect(wireVolume(0)).toBe(0);
    expect(toReelItem(flick({ original_audio_volume: 0 }))!.originalVolume).toBe(0);
    expect(toReelItem(flick({ overlay_audio_volume: 0 }))!.overlayVolume).toBe(0);
  });
  test("kept inside 0..1; not a number is 1", () => {
    expect(wireVolume(0.35)).toBe(0.35);
    expect(wireVolume(1.7)).toBe(1);
    expect(wireVolume(-0.2)).toBe(0);
    expect(wireVolume(NaN)).toBe(1);
    expect(wireVolume("0.5")).toBe(1);
  });
});

describe("hrefs", () => {
  test("the sound's bytes come from the serve route, through mediaHref", () => {
    expect(soundServeHref("s-1")).toBe("/v1/audio/s-1/serve");
    const before = process.env.NEXT_PUBLIC_API_BASE_URL;
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.test";
    try {
      expect(soundServeHref("s-1")).toBe("https://api.example.test/v1/audio/s-1/serve");
    } finally {
      if (before === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
      else process.env.NEXT_PUBLIC_API_BASE_URL = before;
    }
  });

  test("the sound page, the studio with a sound, the stage on a reel", () => {
    expect(soundPageHref("s-1")).toBe("/reels/sound/s-1");
    expect(createWithSoundHref("s-1")).toBe("/reels/create?sound=s-1");
    expect(reelStageHref("p-1")).toBe("/reels?reelId=p-1");
    expect(soundDestination("create", "s-1")).toBe("/reels/create?sound=s-1");
    expect(soundDestination("page", "s-1")).toBe("/reels/sound/s-1");
  });

  test("an id cannot break out of its place in the address", () => {
    expect(soundServeHref("a/b?c")).toBe("/v1/audio/a%2Fb%3Fc/serve");
    expect(soundPageHref("a/b")).toBe("/reels/sound/a%2Fb");
    expect(createWithSoundHref("a&next=/x")).toBe("/reels/create?sound=a%26next%3D%2Fx");
  });

  test("sign-in carries the way back under both spellings the app reads", () => {
    expect(signInHref("/reels/create?sound=s-1")).toBe("/login?next=%2Freels%2Fcreate%3Fsound%3Ds-1&redirect=%2Freels%2Fcreate%3Fsound%3Ds-1");
  });
});

describe("words", () => {
  test("Original sound - <author>, with a plain hyphen", () => {
    expect(originalSoundLabel("Asha")).toBe("Original sound - Asha");
    expect(originalSoundLabel("  ")).toBe("Original sound");
  });
  test("reel counts", () => {
    expect(soundReelCount(0)).toBe("No reels yet");
    expect(soundReelCount(1)).toBe("1 reel");
    expect(soundReelCount(12)).toBe("12 reels");
    expect(soundReelCount(1200)).toBe("1,200 reels");
    expect(soundReelCount(NaN)).toBe("No reels yet");
  });
  test("a refusal is explained by its code", () => {
    expect(soundRefusalMessage("SOUND_REUSE_NOT_ALLOWED")).toContain("turned off reuse");
    expect(soundRefusalMessage("NOT_READY")).toContain("still processing");
    expect(soundRefusalMessage("TOO_LONG")).toContain("5 minutes");
    expect(soundRefusalMessage("NO_AUDIO")).toContain("no sound");
    expect(soundRefusalMessage("RATE_LIMITED")).toContain("Try again later");
    expect(soundRefusalMessage("SOUND_UNAVAILABLE")).toBe("Please try again.");
    expect(soundRefusalMessage(null)).toBe("Please try again.");
  });
});

describe("canUseSound — who is offered Use this sound", () => {
  const base = { sound: null, soundReuseAllowed: true, isProcessing: false };
  const added = toReelSound({ id: "s1" })!;
  test("reuse allowed: anyone", () => {
    expect(canUseSound(base, false)).toBe(true);
  });
  test("reuse disallowed: nobody but the author", () => {
    expect(canUseSound({ ...base, soundReuseAllowed: false }, false)).toBe(false);
    expect(canUseSound({ ...base, soundReuseAllowed: false }, true)).toBe(true);
  });
  test("a reel that plays an added sound offers that sound, whatever its own setting", () => {
    expect(canUseSound({ ...base, sound: added, soundReuseAllowed: false }, false)).toBe(true);
  });
  test("a reel still processing has nothing to take yet", () => {
    expect(canUseSound({ ...base, isProcessing: true }, false)).toBe(false);
    expect(canUseSound({ ...base, isProcessing: true }, true)).toBe(false);
  });
  test("a reel that says nothing about reuse (an older cached row) is not offered to others", () => {
    expect(canUseSound({ sound: null, isProcessing: false } as never, false)).toBe(false);
  });
});

describe("nextSoundStep — a signed-out viewer is sent to sign in", () => {
  const plain = { id: "p-1", sound: null };
  const withSound = { id: "p-2", sound: toReelSound({ id: "s-1" })! };

  test("signed out, the reel's own audio: sign in, and come back to the reel", () => {
    for (const intent of ["create", "page"] as const) {
      expect(nextSoundStep({ reel: plain, signedIn: false, intent })).toEqual({ kind: "sign-in", href: signInHref("/reels?reelId=p-1") });
    }
  });

  test("signed out never reaches the server: there is no resolve step without an account", () => {
    for (const reel of [plain, withSound]) {
      for (const intent of ["create", "page"] as const) {
        expect(nextSoundStep({ reel, signedIn: false, intent }).kind).not.toBe("resolve");
      }
    }
  });

  test("signed out, a known sound, making a reel: sign in, and come back to the studio with the sound", () => {
    expect(nextSoundStep({ reel: withSound, signedIn: false, intent: "create" })).toEqual({ kind: "sign-in", href: signInHref("/reels/create?sound=s-1") });
  });

  test("signed in, the reel's own audio: ask the server for its sound", () => {
    expect(nextSoundStep({ reel: plain, signedIn: true, intent: "create" })).toEqual({ kind: "resolve", postId: "p-1" });
    expect(nextSoundStep({ reel: plain, signedIn: true, intent: "page" })).toEqual({ kind: "resolve", postId: "p-1" });
  });

  test("signed in, a known sound: straight there, no request", () => {
    expect(nextSoundStep({ reel: withSound, signedIn: true, intent: "create" })).toEqual({ kind: "open", href: "/reels/create?sound=s-1" });
    expect(nextSoundStep({ reel: withSound, signedIn: true, intent: "page" })).toEqual({ kind: "open", href: "/reels/sound/s-1" });
  });

  test("the page of a sound the reel already plays is a plain link for anyone", () => {
    expect(nextSoundStep({ reel: withSound, signedIn: false, intent: "page" })).toEqual({ kind: "open", href: "/reels/sound/s-1" });
  });

  test("from the sound's page: the studio when signed in, sign-in first when not", () => {
    expect(studioHrefForSound("s-1", true)).toBe("/reels/create?sound=s-1");
    expect(studioHrefForSound("s-1", false)).toBe(signInHref("/reels/create?sound=s-1"));
  });
});

describe("the three answers", () => {
  test("use_sound.json → the sound", () => {
    const sound = soundFromUseResponse(useSound)!;
    expect(sound.id).toBe(useSound.sound.id);
    expect(sound.title).toBe(useSound.sound.title);
    expect(sound.durationMs).toBe(useSound.sound.duration_ms);
    expect(soundFromUseResponse({})).toBeNull();
    expect(soundFromUseResponse({ sound: { id: "" } })).toBeNull();
    expect(soundFromUseResponse(null)).toBeNull();
  });

  test("sound.json → the studio's sound", () => {
    const info = toSoundInfo(soundRow)!;
    expect(info.id).toBe(soundRow.id as string);
    expect(info.title).toBe(soundRow.title as string);
    expect(info.artist).toBe(soundRow.artist as string);
    expect(info.durationMs).toBe(soundRow.duration_ms as number);
    expect(info.useCount).toBe(soundRow.usage_count as number);
    expect(info.sourcePostId).toBe((soundRow.source_post_id as string) || null);
    expect(info.isOriginal).toBe(soundRow.is_original === true);
    expect(info.creatorUserId).toBe((soundRow.creator_user_id as string) || null);
    expect(info.startMs).toBe(0);
  });

  test("a sound that is not ready is not offered; an absent or empty status is taken as ready", () => {
    expect(toSoundInfo({ id: "s1", status: "processing" })).toBeNull();
    expect(toSoundInfo({ id: "s1", status: "disabled" })).toBeNull();
    expect(toSoundInfo({ id: "s1", status: "" })).not.toBeNull();
    expect(toSoundInfo({ id: "s1" })).not.toBeNull();
    expect(toSoundInfo({ id: "s1", status: "ready" })).not.toBeNull();
    expect(toSoundInfo({ id: "", status: "ready" })).toBeNull();
    expect(toSoundInfo(null)).toBeNull();
    expect(toSoundInfo({ id: "s1", creator_user_id: "", source_post_id: null })!.creatorUserId).toBeNull();
  });

  test("by_sound.json → the sound, the origin, the reels, and no cursor", () => {
    const page = toSoundReelsPage(bySound, { next_cursor: "" });
    expect(page.sound!.id).toBe(bySound.sound.id);
    expect(page.origin!.id).toBe(bySound.origin!.id);
    expect(page.items.map((i) => i.id)).toEqual(bySound.items.map((i) => i.id));
    expect(page.items.every((i) => i.sound?.id === bySound.sound.id)).toBe(true);
    expect(page.nextCursor).toBeUndefined();
    expect(toSoundReelsPage(bySound, { next_cursor: "c2" }).nextCursor).toBe("c2");
    expect(toSoundReelsPage(bySound, null).nextCursor).toBeUndefined();
    expect(toSoundReelsPage(bySound).nextCursor).toBeUndefined();
  });

  test("a later page has no origin; an origin the viewer may not read is null; both are fine", () => {
    expect(toSoundReelsPage({ sound: bySound.sound, origin: null, items: bySound.items }).origin).toBeNull();
    expect(toSoundReelsPage({ sound: bySound.sound, items: bySound.items }).origin).toBeNull();
    expect(toSoundReelsPage({ sound: bySound.sound, origin: {}, items: [] }).origin).toBeNull();
    expect(toSoundReelsPage({ sound: bySound.sound, origin: { id: "" }, items: [] }).origin).toBeNull();
  });

  test("empty and malformed answers are an empty page, not a crash", () => {
    for (const raw of [null, undefined, {}, { items: null }, { items: "x" }, { sound: { id: "" }, items: [null, 3, {}] }]) {
      const page = toSoundReelsPage(raw);
      expect(page.items).toEqual([]);
      expect(page.origin).toBeNull();
      expect(page.sound).toBeNull();
    }
  });

  test("long video and feed posts never reach the grid; the origin is never repeated among the items", () => {
    const origin = bySound.origin!;
    const page = toSoundReelsPage({
      sound: bySound.sound,
      origin,
      items: [origin, ...bySound.items, { ...bySound.items[0], id: "long", content_type: "long_video" }],
    });
    expect(page.items.map((i) => i.id)).toEqual(bySound.items.map((i) => i.id));
  });

  test("tiles: the origin first and marked, then every page in order, nothing twice", () => {
    const first = toSoundReelsPage(bySound, { next_cursor: "c2" });
    const second = toSoundReelsPage({ sound: bySound.sound, origin: null, items: [bySound.items[1], flick({ id: "later" })] });
    const tiles = soundReelTiles([first, second]);
    expect(tiles.map((t) => t.reel.id)).toEqual([bySound.origin!.id, ...bySound.items.map((i) => i.id), "later"]);
    expect(tiles.map((t) => t.isOrigin)).toEqual([true, false, false, false]);
    expect(soundReelTiles([])).toEqual([]);
    expect(soundReelTiles(null)).toEqual([]);
  });
});

describe("the requests", () => {
  afterEach(() => mock.restore());
  const notFound = () => Object.assign(new Error("404"), { isAxiosError: true, response: { status: 404, data: { error: { code: "NOT_FOUND" } } } });
  const refused = () => Object.assign(new Error("403"), { isAxiosError: true, response: { status: 403, data: { error: { code: "SOUND_REUSE_NOT_ALLOWED" } } } });

  test("GET /v1/audio/:id answers the sound; a 404 is null, anything else is thrown", async () => {
    const get = spyOn(api, "get").mockResolvedValue({ data: { data: soundRow } } as never);
    const found = await fetchSound("s-1");
    expect(get.mock.calls[0][0]).toBe("/v1/audio/s-1");
    expect(found!.id).toBe(soundRow.id as string);
    get.mockRejectedValue(notFound() as never);
    expect(await fetchSound("s-1")).toBeNull();
    get.mockRejectedValue(new Error("network") as never);
    await expect(fetchSound("s-1")).rejects.toThrow("network");
  });

  test("POST /v1/posts/:id/sound answers the sound; a refusal is thrown for the caller to explain", async () => {
    const post = spyOn(api, "post").mockResolvedValue({ data: { data: useSound } } as never);
    const sound = await resolveReelSound("p-1");
    expect(post.mock.calls[0][0]).toBe("/v1/posts/p-1/sound");
    expect(sound.id).toBe(useSound.sound.id);
    post.mockRejectedValue(refused() as never);
    await expect(resolveReelSound("p-1")).rejects.toThrow();
    post.mockResolvedValue({ data: { data: { sound: { id: "" } } } } as never);
    await expect(resolveReelSound("p-1")).rejects.toThrow();
  });

  test("GET /v1/posts/by-sound/:id sends limit and cursor; a 404 is null", async () => {
    const get = spyOn(api, "get").mockResolvedValue({ data: { data: bySound, meta: { next_cursor: "c2" } } } as never);
    const page = await fetchSoundReels({ soundId: "s-1", cursor: "c1" });
    const [url, config] = get.mock.calls[0] as unknown as [string, { params: Record<string, string> }];
    expect(url).toBe("/v1/posts/by-sound/s-1");
    expect(config.params).toEqual({ limit: "24", cursor: "c1" });
    expect(page!.nextCursor).toBe("c2");
    expect(page!.items.length).toBe(bySound.items.length);
    await fetchSoundReels({ soundId: "s-1" });
    expect((get.mock.calls[1] as unknown as [string, { params: Record<string, string> }])[1].params).toEqual({ limit: "24" });
    get.mockRejectedValue(notFound() as never);
    expect(await fetchSoundReels({ soundId: "s-1" })).toBeNull();
  });
});
