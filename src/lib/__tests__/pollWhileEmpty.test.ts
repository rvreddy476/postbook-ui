import { describe, expect, test } from "bun:test";

import { EMPTY_FEED_POLL_MS, pollWhileEmpty } from "@/lib/pollWhileEmpty";

const q = (status: string, pages?: { items?: unknown[] | null }[]) => ({ state: { status, data: pages ? { pages } : undefined } });

describe("pollWhileEmpty", () => {
  test("a loaded, empty feed checks again every 30 s", () => {
    expect(pollWhileEmpty(q("success", [{ items: [] }]))).toBe(EMPTY_FEED_POLL_MS);
    expect(pollWhileEmpty(q("success", [{ items: null }, { items: [] }]))).toBe(EMPTY_FEED_POLL_MS);
  });

  test("stops as soon as one item exists, and never polls before the first load or on error", () => {
    expect(pollWhileEmpty(q("success", [{ items: [] }, { items: [{ id: "r1" }] }]))).toBe(false);
    expect(pollWhileEmpty(q("pending"))).toBe(false);
    expect(pollWhileEmpty(q("error", [{ items: [] }]))).toBe(false);
  });
});
