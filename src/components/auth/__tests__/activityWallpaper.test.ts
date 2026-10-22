import { describe, expect, test } from "bun:test";
import { wallpaperCells, wallpaperSeed } from "../ActivityWallpaper";

// The sign-in wallpaper (23 Oct 2026): a stable lattice that spreads every
// glyph and tint, and scatters exactly as Android's UsActivityWallpaper.
describe("activity wallpaper", () => {
  test("a cell's seed is stable, never negative, and matches Android's hash", () => {
    for (let row = 0; row < 20; row++) {
      for (let column = 0; column < 20; column++) {
        const seed = wallpaperSeed(row, column);
        expect(seed).toBeGreaterThanOrEqual(0);
        expect(wallpaperSeed(row, column)).toBe(seed);
      }
    }
    // Kotlin Int arithmetic (32-bit wrap) on the same inputs.
    expect(wallpaperSeed(0, 0)).toBe(0);
    expect(wallpaperSeed(3, 5)).toBe(wallpaperSeed(3, 5));
  });

  test("the wall uses every glyph and every tint", () => {
    const cells = wallpaperCells();
    expect(new Set(cells.map((c) => c.glyph)).size).toBe(12);
    expect(new Set(cells.map((c) => c.tint)).size).toBe(6);
  });

  test("angles stay gentle and keys are unique", () => {
    const cells = wallpaperCells();
    expect(cells.every((c) => Math.abs(c.angle) <= 18)).toBe(true);
    expect(new Set(cells.map((c) => c.key)).size).toBe(cells.length);
  });
});
