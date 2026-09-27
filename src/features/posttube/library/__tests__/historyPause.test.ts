import { describe, expect, test } from "bun:test";

import { HISTORY_PAUSE_KEY, isHistoryPaused, setHistoryPaused } from "../historyPause";
import { filterRecent } from "../recentSearch";

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
}

describe("history pause", () => {
  test("the key is the pinned one and the default is not paused", () => {
    expect(HISTORY_PAUSE_KEY).toBe("posttube_history_paused_v1");
    expect(isHistoryPaused(memoryStorage())).toBe(false);
  });
  test("set / read round trip; off removes the key rather than writing 0", () => {
    const s = memoryStorage();
    expect(setHistoryPaused(true, s)).toBe(true);
    expect(s.map.get(HISTORY_PAUSE_KEY)).toBe("1");
    expect(isHistoryPaused(s)).toBe(true);
    setHistoryPaused(false, s);
    expect(s.map.has(HISTORY_PAUSE_KEY)).toBe(false);
    expect(isHistoryPaused(s)).toBe(false);
  });
  test("only the exact value 1 counts as paused", () => {
    expect(isHistoryPaused(memoryStorage({ [HISTORY_PAUSE_KEY]: "true" }))).toBe(false);
    expect(isHistoryPaused(memoryStorage({ [HISTORY_PAUSE_KEY]: "1" }))).toBe(true);
  });
  test("no storage (server, blocked) reads as not paused and the write reports failure", () => {
    expect(isHistoryPaused(null)).toBe(false);
    expect(setHistoryPaused(true, null)).toBe(false);
    const throwing = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => undefined };
    expect(isHistoryPaused(throwing)).toBe(false);
    expect(setHistoryPaused(true, throwing)).toBe(false);
  });
});

describe("filterRecent", () => {
  const rows = [
    { postId: "1", post: { id: "1", author_id: "a", title: "Cooking Pasta", channel: { name: "Nonna" } } },
    { postId: "2", post: { id: "2", author_id: "b", title: "Bike repair", author: { display_name: "Garage Guy" } } },
    { postId: "3", post: null },
  ];
  test("empty query keeps every row, matches are case-insensitive on title and channel", () => {
    expect(filterRecent(rows, "  ")).toHaveLength(3);
    expect(filterRecent(rows, "pasta").map((r) => r.postId)).toEqual(["1"]);
    expect(filterRecent(rows, "NONNA").map((r) => r.postId)).toEqual(["1"]);
    expect(filterRecent(rows, "garage").map((r) => r.postId)).toEqual(["2"]);
    expect(filterRecent(rows, "zzz")).toEqual([]);
  });
});
