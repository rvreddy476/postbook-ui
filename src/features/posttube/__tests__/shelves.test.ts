import { describe, expect, test } from "bun:test";

import { chunkSize, gridColumnsFor, interleaveShelves } from "@/features/posttube/shelves";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `v${i + 1}`);
const all = { reels: true, trending: true, continue: true };

describe("interleaveShelves", () => {
  test("two rows of videos, then a shelf, rotating reels → trending → continue", () => {
    const blocks = interleaveShelves(ids(20), 3, all);
    expect(blocks.map((b) => (b.type === "videos" ? `videos:${b.items.length}` : `shelf:${b.shelf}`))).toEqual([
      "videos:6",
      "shelf:reels",
      "videos:6",
      "shelf:trending",
      "videos:6",
      "shelf:continue",
      "videos:2",
    ]);
  });

  test("a trailing partial chunk gets no shelf after it", () => {
    const blocks = interleaveShelves(ids(7), 3, all);
    expect(blocks.at(-1)?.type).toBe("videos");
    expect(blocks.filter((b) => b.type === "shelf")).toHaveLength(1);
  });

  test("shelves with nothing in them are skipped in the rotation", () => {
    const blocks = interleaveShelves(ids(24), 2, { reels: false, trending: true, continue: false });
    const shelves = blocks.filter((b) => b.type === "shelf").map((b) => (b.type === "shelf" ? b.shelf : ""));
    expect(shelves).toEqual(["trending", "trending", "trending", "trending", "trending", "trending"]);
  });

  test("no shelves at all leaves one plain chunk sequence", () => {
    const blocks = interleaveShelves(ids(9), 4, { reels: false, trending: false, continue: false });
    expect(blocks.every((b) => b.type === "videos")).toBe(true);
    expect(blocks.flatMap((b) => (b.type === "videos" ? b.items : []))).toEqual(ids(9));
  });

  test("every video is rendered exactly once, in feed order", () => {
    const blocks = interleaveShelves(ids(31), 4, all);
    expect(blocks.flatMap((b) => (b.type === "videos" ? b.items : []))).toEqual(ids(31));
    expect(new Set(blocks.map((b) => b.key)).size).toBe(blocks.length);
  });

  test("chunk size is two rows of the current column count", () => {
    expect(chunkSize(1)).toBe(2);
    expect(chunkSize(3)).toBe(6);
    expect(chunkSize(0)).toBe(2);
  });

  test("columns follow the grid's breakpoints", () => {
    expect(gridColumnsFor(375)).toBe(1);
    expect(gridColumnsFor(800)).toBe(2);
    expect(gridColumnsFor(1300)).toBe(3);
    expect(gridColumnsFor(1600)).toBe(4);
  });
});
