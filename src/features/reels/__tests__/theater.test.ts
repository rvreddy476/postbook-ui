import { describe, expect, test } from "bun:test";

import { SPEEDS } from "../playback/playerPrefs";
import { cycleSpeed, speedLabel } from "../theater";

describe("cycleSpeed", () => {
  test("walks the preset chips in order and wraps after 2×", () => {
    expect(cycleSpeed(0.25)).toBe(1);
    expect(cycleSpeed(1)).toBe(1.25);
    expect(cycleSpeed(1.25)).toBe(1.5);
    expect(cycleSpeed(1.5)).toBe(2);
    expect(cycleSpeed(2)).toBe(0.25);
  });

  test("a slider value between presets steps up to the next preset", () => {
    expect(cycleSpeed(0.75)).toBe(1);
    expect(cycleSpeed(1.1)).toBe(1.25);
    expect(cycleSpeed(1.95)).toBe(2);
  });

  test("visits every rung exactly once round the loop", () => {
    const seen: number[] = [];
    let s: number = SPEEDS[0];
    for (let i = 0; i < SPEEDS.length; i++) {
      seen.push(s);
      s = cycleSpeed(s);
    }
    expect(seen).toEqual([...SPEEDS]);
    expect(s).toBe(SPEEDS[0]);
  });

  test("an unknown value lands on normal speed", () => {
    expect(cycleSpeed(3)).toBe(1);
    expect(cycleSpeed(Number.NaN)).toBe(1);
  });
});

describe("speedLabel", () => {
  test("reads like TikTok's button", () => {
    expect(speedLabel(1)).toBe("1.0x");
    expect(speedLabel(2)).toBe("2.0x");
    expect(speedLabel(0.75)).toBe("0.75x");
    expect(speedLabel(1.5)).toBe("1.5x");
  });
});
