import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cardsBody, endScreensBody, normalizeCards, normalizeEndScreens } from "../hubApi";
import { normalizeViewerCards, normalizeViewerEndScreens } from "../../watch/watchApi";

/*
  End screens and cards read against post-service's golden fixtures
  (internal/http/testdata/contracts/mtube/{end_screens,cards}_*.json,
  copied verbatim into ./contracts).
*/

const load = (name: string): unknown => JSON.parse(readFileSync(resolve(import.meta.dir, "contracts", name), "utf8"));
const arr = (name: string): Record<string, unknown>[] => {
  const j = load(name) as Record<string, unknown>[] | { screens?: unknown; cards?: unknown };
  return (Array.isArray(j) ? j : ((j.screens ?? j.cards ?? []) as Record<string, unknown>[]));
};

describe("end screens from post-service", () => {
  test("the viewer copy keeps every resolved element with its place and target", () => {
    const raw = arr("end_screens_viewer.json");
    const els = normalizeViewerEndScreens(raw);
    expect(els.length).toBe(raw.length);
    for (const e of els) {
      expect(e.position.x).toBeGreaterThanOrEqual(0);
      expect(e.position.w).toBeGreaterThan(0);
      expect(e.endMs).toBeGreaterThan(e.startMs);
    }
  });

  test("the owner copy carries stats as a fraction and round-trips into the save body with ids", () => {
    const owner = normalizeEndScreens(load("end_screens_owner.json"));
    expect(owner.length).toBe(4);
    for (const s of owner) if (s.stats) expect(s.stats.click_rate).toBeLessThanOrEqual(1);
    const body = endScreensBody(owner);
    expect(body.screens.every((s) => typeof s.id === "string")).toBe(true);
    const reqRaw = load("end_screens_request.json") as { screens?: Record<string, unknown>[] } | Record<string, unknown>[];
    const request = Array.isArray(reqRaw) ? reqRaw : (reqRaw.screens ?? []);
    const allowed = new Set(request.flatMap((r) => Object.keys(r)).concat("id"));
    for (const s of body.screens) for (const k of Object.keys(s)) expect(allowed.has(k), k).toBe(true);
  });

  test("a new element (no server id) is sent without one", () => {
    const [first] = normalizeEndScreens(load("end_screens_owner.json"));
    const body = endScreensBody([{ ...first, id: "draft-1" }]);
    expect("id" in body.screens[0]).toBe(false);
  });
});

describe("cards from post-service", () => {
  test("the viewer never gets a poll card; the rest resolve", () => {
    const raw = arr("cards_viewer.json");
    const cards = normalizeViewerCards(raw);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.some((c) => (c as { type: string }).type === "poll")).toBe(false);
  });

  test("the owner copy saves back with ids", () => {
    const owner = normalizeCards(load("cards_owner.json"));
    expect(owner.length).toBe(4);
    const body = cardsBody(owner);
    expect(body.cards.every((c) => typeof c.id === "string")).toBe(true);
  });
});
