import { describe, expect, test } from "bun:test";

import { CLEAR_SCREEN_INITIAL, clearScreenReducer } from "@/features/reels/clearScreen";

describe("clearScreenReducer", () => {
  test("entering shows the hint; the hint expires on its own while the screen stays clear", () => {
    const on = clearScreenReducer(CLEAR_SCREEN_INITIAL, { type: "enter" });
    expect(on).toEqual({ on: true, hint: true });
    const settled = clearScreenReducer(on, { type: "hint-expired" });
    expect(settled).toEqual({ on: true, hint: false });
  });

  test("any key, Escape or a tap restores the controls", () => {
    const on = clearScreenReducer(CLEAR_SCREEN_INITIAL, { type: "enter" });
    expect(clearScreenReducer(on, { type: "key" })).toEqual(CLEAR_SCREEN_INITIAL);
    expect(clearScreenReducer(on, { type: "tap" })).toEqual(CLEAR_SCREEN_INITIAL);
    expect(clearScreenReducer(on, { type: "exit" })).toEqual(CLEAR_SCREEN_INITIAL);
  });

  test("toggle flips; entering twice is idempotent; a key when off is a no-op by reference", () => {
    const on = clearScreenReducer(CLEAR_SCREEN_INITIAL, { type: "toggle" });
    expect(on.on).toBe(true);
    expect(clearScreenReducer(on, { type: "toggle" })).toEqual(CLEAR_SCREEN_INITIAL);
    expect(clearScreenReducer(on, { type: "enter" })).toBe(on);
    expect(clearScreenReducer(CLEAR_SCREEN_INITIAL, { type: "key" })).toBe(CLEAR_SCREEN_INITIAL);
  });
});
