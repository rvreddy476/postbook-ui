import { describe, expect, test } from "bun:test";

import { DEFAULT_PREFS, parsePrefs, pickHlsLevel } from "@/features/reels/playback/playerPrefs";

describe("parsePrefs", () => {
  test("absent or garbage → defaults (sound off, loop, auto)", () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("not json")).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("42")).toEqual(DEFAULT_PREFS);
  });
  test("keeps valid values and repairs invalid ones field by field", () => {
    const p = parsePrefs(JSON.stringify({ sound: true, volume: 7, speed: 3, quality: "720p", captions: "yes", onEnd: "next" }));
    expect(p.sound).toBe(true);
    expect(p.volume).toBe(1); // out of range → default
    expect(p.speed).toBe(1); // not an offered speed → default
    expect(p.quality).toBe("720p");
    expect(p.captions).toBe(false);
    expect(p.onEnd).toBe("next");
  });
  test("quality must be auto or a rung label", () => {
    expect(parsePrefs(JSON.stringify({ quality: "best" })).quality).toBe("auto");
    expect(parsePrefs(JSON.stringify({ quality: "1080p" })).quality).toBe("1080p");
  });
});

describe("pickHlsLevel", () => {
  const heights = [360, 720, 1080];
  test("auto is -1", () => {
    expect(pickHlsLevel("auto", heights)).toBe(-1);
    expect(pickHlsLevel("720p", [])).toBe(-1);
  });
  test("an exact rung is chosen", () => {
    expect(pickHlsLevel("720p", heights)).toBe(1);
  });
  test("a missing rung falls to the closest one below", () => {
    expect(pickHlsLevel("900p", heights)).toBe(1);
    expect(pickHlsLevel("4000p", heights)).toBe(2);
  });
  test("a request below every rung takes the lowest", () => {
    expect(pickHlsLevel("144p", heights)).toBe(0);
  });
});
