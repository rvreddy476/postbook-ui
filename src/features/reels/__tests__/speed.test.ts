import { describe, expect, test } from "bun:test";

import { clampSpeed, parsePrefs, SPEED_MAX, SPEED_MIN, SPEED_STEP, SPEEDS, speedChipLabel } from "../playback/playerPrefs";

describe("speed model (YouTube's slider)", () => {
  test("the range is 0.25–2 in 0.05 steps with five preset chips", () => {
    expect([SPEED_MIN, SPEED_MAX, SPEED_STEP]).toEqual([0.25, 2, 0.05]);
    expect([...SPEEDS]).toEqual([0.25, 1, 1.25, 1.5, 2]);
  });
  test("clampSpeed snaps to the grid, bounds the range and repairs garbage", () => {
    expect(clampSpeed(1.07)).toBe(1.05);
    expect(clampSpeed(1.08)).toBe(1.1);
    expect(clampSpeed(0.1)).toBe(0.25);
    expect(clampSpeed(9)).toBe(2);
    expect(clampSpeed(1.15 + 0.05)).toBe(1.2); // float noise never leaks
    expect(clampSpeed(Number.NaN)).toBe(1);
    expect(clampSpeed("2")).toBe(1);
  });
  test("labels: presets as 1.0 / 2.0, slider values as 1.05", () => {
    expect(speedChipLabel(1)).toBe("1.0");
    expect(speedChipLabel(2)).toBe("2.0");
    expect(speedChipLabel(1.05)).toBe("1.05");
    expect(speedChipLabel(0.25)).toBe("0.25");
  });
  test("a stored slider value survives a reload; out of range falls back to 1", () => {
    expect(parsePrefs(JSON.stringify({ speed: 1.35 })).speed).toBe(1.35);
    expect(parsePrefs(JSON.stringify({ speed: 0.2 })).speed).toBe(1);
    expect(parsePrefs(JSON.stringify({ speed: 2.5 })).speed).toBe(1);
  });
  test("the preferred audio language is kept only as a language tag", () => {
    expect(parsePrefs(JSON.stringify({ audioLanguage: "HI" })).audioLanguage).toBe("hi");
    expect(parsePrefs(JSON.stringify({ audioLanguage: "pt-BR" })).audioLanguage).toBe("pt-br");
    expect(parsePrefs(JSON.stringify({ audioLanguage: "<script>" })).audioLanguage).toBeNull();
    expect(parsePrefs(JSON.stringify({})).audioLanguage).toBeNull();
  });
});
