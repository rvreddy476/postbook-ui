import { describe, expect, test } from "bun:test";

import { audioTrackOptions, languageForChoice, languageLabel, pickAudioTrack, type ReelAudioTrack } from "../playback/audioTracks";

const tracks: ReelAudioTrack[] = [
  { id: "original", language: "und", label: "Original", source: "original", status: "ready" },
  { id: "t-hi", language: "hi", label: "Hindi", source: "uploaded", status: "ready", playback_url: "/v1/media/m/serve/dub_hi_720p" },
  { id: "t-ta", language: "ta", label: "Tamil", source: "generated", status: "processing" },
  { id: "t-te", language: "te", label: "", source: "uploaded", status: "failed", error: "boom" },
];

describe("audio tracks", () => {
  test("the menu offers the original and every READY track, in order", () => {
    expect(audioTrackOptions(tracks)).toEqual([{ id: "original", label: "Original" }, { id: "t-hi", label: "Hindi" }]);
    expect(audioTrackOptions([])).toEqual([{ id: "original", label: "Original" }]);
  });
  test("a preferred language plays only when this reel has it ready; otherwise the original", () => {
    expect(pickAudioTrack(tracks, "hi")?.id).toBe("t-hi");
    expect(pickAudioTrack(tracks, "HI")?.id).toBe("t-hi");
    expect(pickAudioTrack(tracks, "ta")).toBeNull(); // still processing
    expect(pickAudioTrack(tracks, "fr")).toBeNull();
    expect(pickAudioTrack(tracks, null)).toBeNull();
  });
  test("a menu choice maps back to a language; the original clears the preference", () => {
    expect(languageForChoice(tracks, "t-hi")).toBe("hi");
    expect(languageForChoice(tracks, "original")).toBeNull();
    expect(languageForChoice(tracks, "nope")).toBeNull();
  });
  test("language labels come from our list first", () => {
    expect(languageLabel("te")).toBe("Telugu");
    expect(languageLabel("xx-zz")).toBe("xx-zz".replace("zz", "ZZ")); // Intl canonicalises the region
  });
});
