import { describe, expect, test } from "bun:test";

import { playerKeyAction, playerKeyPreventsDefault, SEEK_LARGE_S, SEEK_SMALL_S } from "@/features/posttube/playerKeys";

describe("playerKeyAction", () => {
  test("Space and K toggle play; K no longer skips forward", () => {
    expect(playerKeyAction(" ")).toEqual({ type: "toggle-play" });
    expect(playerKeyAction("Spacebar")).toEqual({ type: "toggle-play" });
    expect(playerKeyAction("k")).toEqual({ type: "toggle-play" });
    expect(playerKeyAction("K")).toEqual({ type: "toggle-play" });
    expect(playerKeyAction("k")).not.toEqual(playerKeyAction("l"));
  });

  test("J and L jump ten seconds, the arrows five", () => {
    expect(playerKeyAction("j")).toEqual({ type: "seek-by", seconds: -SEEK_LARGE_S });
    expect(playerKeyAction("J")).toEqual({ type: "seek-by", seconds: -10 });
    expect(playerKeyAction("l")).toEqual({ type: "seek-by", seconds: SEEK_LARGE_S });
    expect(playerKeyAction("L")).toEqual({ type: "seek-by", seconds: 10 });
    expect(playerKeyAction("ArrowLeft")).toEqual({ type: "seek-by", seconds: -SEEK_SMALL_S });
    expect(playerKeyAction("ArrowRight")).toEqual({ type: "seek-by", seconds: 5 });
  });

  test("M, F, C toggle mute, fullscreen, captions", () => {
    expect(playerKeyAction("m")).toEqual({ type: "toggle-mute" });
    expect(playerKeyAction("M")).toEqual({ type: "toggle-mute" });
    expect(playerKeyAction("f")).toEqual({ type: "toggle-fullscreen" });
    expect(playerKeyAction("F")).toEqual({ type: "toggle-fullscreen" });
    expect(playerKeyAction("c")).toEqual({ type: "toggle-captions" });
    expect(playerKeyAction("C")).toEqual({ type: "toggle-captions" });
  });

  test("T asks for theater and N for next; Shift+N is next too", () => {
    expect(playerKeyAction("t")).toEqual({ type: "toggle-theater" });
    expect(playerKeyAction("T", { shift: true })).toEqual({ type: "toggle-theater" });
    expect(playerKeyAction("n")).toEqual({ type: "next" });
    expect(playerKeyAction("N", { shift: true })).toEqual({ type: "next" });
  });

  test("0–9 seek to that tenth; Home and End to the ends", () => {
    expect(playerKeyAction("0")).toEqual({ type: "seek-percent", percent: 0 });
    expect(playerKeyAction("1")).toEqual({ type: "seek-percent", percent: 10 });
    expect(playerKeyAction("5")).toEqual({ type: "seek-percent", percent: 50 });
    expect(playerKeyAction("9")).toEqual({ type: "seek-percent", percent: 90 });
    expect(playerKeyAction("Home")).toEqual({ type: "seek-percent", percent: 0 });
    expect(playerKeyAction("End")).toEqual({ type: "seek-percent", percent: 100 });
  });

  test("Ctrl, Alt and Meta chords are never ours", () => {
    expect(playerKeyAction("k", { ctrl: true })).toBeNull();
    expect(playerKeyAction(" ", { alt: true })).toBeNull();
    expect(playerKeyAction("f", { meta: true })).toBeNull();
    expect(playerKeyAction("ArrowRight", { ctrl: true })).toBeNull();
    expect(playerKeyAction("1", { meta: true })).toBeNull();
  });

  test("Shift on a non-letter is ignored; unknown keys are null", () => {
    expect(playerKeyAction("ArrowLeft", { shift: true })).toEqual({ type: "seek-by", seconds: -5 });
    expect(playerKeyAction("a")).toBeNull();
    expect(playerKeyAction("Escape")).toBeNull();
    expect(playerKeyAction("Enter")).toBeNull();
    expect(playerKeyAction("")).toBeNull();
    expect(playerKeyAction("10")).toBeNull();
    expect(playerKeyAction("kk")).toBeNull();
  });
});

describe("playerKeyPreventsDefault", () => {
  test("only the keys that would scroll the page", () => {
    for (const k of [" ", "Spacebar", "ArrowLeft", "ArrowRight", "Home", "End"]) expect(playerKeyPreventsDefault(k)).toBe(true);
    for (const k of ["k", "j", "l", "m", "f", "c", "t", "n", "5"]) expect(playerKeyPreventsDefault(k)).toBe(false);
  });
});
