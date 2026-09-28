import { describe, expect, test } from "bun:test";

import {
  boxOf,
  boxStyle,
  boxesOverlapTooMuch,
  clampPosition,
  fitFrame,
  heightFraction,
  overlapShare,
  positionInBounds,
  slotPosition,
  snapPosition,
  snapToGrid,
} from "../endScreenGeometry";

describe("end-screen geometry (frame fractions of 16:9)", () => {
  test("a 16:9 tile of width w is w tall; a circle of diameter w is w × 16/9 tall", () => {
    expect(heightFraction("video", 0.3)).toBe(0.3);
    expect(heightFraction("playlist", 0.4)).toBe(0.4);
    expect(heightFraction("external_link", 0.25)).toBe(0.25);
    expect(heightFraction("channel_subscribe", 0.18)).toBeCloseTo(0.32, 6);
    expect(heightFraction("channel", 0.27)).toBeCloseTo(0.48, 6);
  });

  test("old slots sit in the four corners (0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right) and inside the frame", () => {
    const tl = slotPosition(0, "video");
    const tr = slotPosition(1, "video");
    const bl = slotPosition(2, "video");
    const br = slotPosition(3, "video");
    expect(tl).toEqual({ x: 0.05, y: 0.1, w: 0.3 });
    expect(tr).toEqual({ x: 0.65, y: 0.1, w: 0.3 });
    expect(bl).toEqual({ x: 0.05, y: 0.6, w: 0.3 });
    expect(br).toEqual({ x: 0.65, y: 0.6, w: 0.3 });
    for (const kind of ["video", "channel_subscribe"] as const) {
      for (let s = 0; s < 4; s += 1) expect(positionInBounds(kind, slotPosition(s, kind))).toBe(true);
    }
    expect(slotPosition(6, "video")).toEqual(bl); // mod 4
    expect(slotPosition(-1, "video")).toEqual(br);
  });

  test("bounds: 0..1, 12–50 % wide, the kind's height inside the frame", () => {
    expect(positionInBounds("video", { x: 0.5, y: 0.5, w: 0.5 })).toBe(true);
    expect(positionInBounds("video", { x: 0.6, y: 0, w: 0.5 })).toBe(false); // runs off the right
    expect(positionInBounds("video", { x: 0, y: 0.7, w: 0.4 })).toBe(false); // runs off the bottom
    expect(positionInBounds("video", { x: 0, y: 0, w: 0.1 })).toBe(false); // too narrow
    expect(positionInBounds("video", { x: 0, y: 0, w: 0.55 })).toBe(false); // too wide
    expect(positionInBounds("channel", { x: 0, y: 0.5, w: 0.3 })).toBe(false); // circle 0.533 tall
    expect(positionInBounds("channel", { x: 0, y: 0.4, w: 0.3 })).toBe(true);
    expect(positionInBounds("video", { x: -0.1, y: 0, w: 0.3 })).toBe(false);
    expect(positionInBounds("video", { x: Number.NaN, y: 0, w: 0.3 })).toBe(false);
  });

  test("clamp keeps the box inside and the width in range; snap lands on the 5 % grid", () => {
    expect(clampPosition("video", { x: 0.9, y: 0.95, w: 0.7 })).toEqual({ x: 0.5, y: 0.5, w: 0.5 });
    expect(clampPosition("video", { x: -1, y: -1, w: 0.01 })).toEqual({ x: 0, y: 0, w: 0.12 });
    expect(snapToGrid(0.33)).toBe(0.35);
    expect(snapToGrid(0.12)).toBe(0.1);
    expect(snapPosition("video", { x: 0.33, y: 0.71, w: 0.3 })).toEqual({ x: 0.35, y: 0.7, w: 0.3 });
    expect(snapPosition("video", { x: 0.93, y: 0.2, w: 0.3 })).toEqual({ x: 0.7, y: 0.2, w: 0.3 }); // snapped then kept inside
  });

  test("overlap is measured against the smaller box; more than 10 % is too much", () => {
    const a = boxOf("video", { x: 0, y: 0, w: 0.4 });
    const b = boxOf("video", { x: 0.35, y: 0, w: 0.4 }); // 0.05 × 0.4 of a 0.4 × 0.4 box = 12.5 %
    const c = boxOf("video", { x: 0.37, y: 0, w: 0.4 }); // 7.5 %
    expect(overlapShare(a, b)).toBeCloseTo(0.125, 6);
    expect(boxesOverlapTooMuch(a, b)).toBe(true);
    expect(boxesOverlapTooMuch(a, c)).toBe(false);
    expect(boxesOverlapTooMuch(a, boxOf("video", { x: 0.5, y: 0.5, w: 0.3 }))).toBe(false);
  });

  test("the 16:9 layer fits the frame (letterboxed in a tall fullscreen) and elements are percentages of it", () => {
    expect(fitFrame(1280, 720)).toEqual({ left: 0, top: 0, width: 1280, height: 720 });
    const tall = fitFrame(1000, 1000);
    expect(tall.width).toBe(1000);
    expect(tall.height).toBe(562.5);
    expect(tall.top).toBe(218.75);
    const wide = fitFrame(2000, 720);
    expect(wide.width).toBe(1280);
    expect(wide.left).toBe(360);
    expect(fitFrame(0, 100)).toEqual({ left: 0, top: 0, width: 0, height: 0 });
    expect(boxStyle(boxOf("channel_subscribe", { x: 0.4, y: 0.55, w: 0.2 }))).toEqual({ left: "40%", top: "55%", width: "20%", height: "35.5556%" });
  });
});
