import { describe, expect, test } from "bun:test";

import { ALL_APP_LAUNCHER, APP_LAUNCHER, filterAppLauncher } from "@/lib/appBrand";

describe("APP_LAUNCHER", () => {
  test("every live tile links to a route and keys are unique", () => {
    for (const tile of ALL_APP_LAUNCHER) {
      expect(typeof tile.icon).not.toBe("undefined");
      expect(tile.name.length).toBeGreaterThan(0);
      expect(tile.description.length).toBeGreaterThan(0);
      if (!tile.soon) expect(tile.href.startsWith("/")).toBe(true);
    }
    expect(new Set(ALL_APP_LAUNCHER.map((t) => t.key)).size).toBe(ALL_APP_LAUNCHER.length);
  });

  test("the registry lists every unified service, with Feast live and Ride marked soon", () => {
    const byKey = new Map(ALL_APP_LAUNCHER.map((t) => [t.key, t]));
    for (const [key, href] of [
      ["home", "/"], ["reels", "/reels"], ["tube", "/posttube"], ["groups", "/groups"],
      ["communities", "/communities"], ["messenger", "/messenger"],
      ["live", "/live"], ["ask", "/qa"], ["pages", "/pages"], ["shop", "/shop"], ["match", "/dating"],
      ["trending", "/trending"], ["memories", "/memories"], ["saved", "/saved"], ["notifications", "/notifications"], ["feast", "/feast"],
    ] as const) {
      expect(byKey.get(key)?.href).toBe(href);
      expect(byKey.get(key)?.soon).toBeFalsy();
    }
    expect(byKey.get("ride")?.soon).toBe(true);
    // Connections went with Connect (founder, 24 Oct 2026).
    expect(byKey.has("connections")).toBe(false);
  });
});

describe("filterAppLauncher", () => {
  test("filtering by 'shop' returns the Shop tile", () => {
    const hits = filterAppLauncher("shop");
    expect(hits.some((t) => t.key === "shop" && t.name === "MStore")).toBe(true);
    expect(hits.every((t) => t.key !== "reels")).toBe(true);
  });

  test("is case-insensitive, trims, and matches descriptions", () => {
    expect(filterAppLauncher("  SHOP ").map((t) => t.key)).toContain("shop");
    expect(filterAppLauncher("food", ALL_APP_LAUNCHER).map((t) => t.key)).toEqual(["feast"]);
    expect(filterAppLauncher("mopedu").map((t) => t.key)).toEqual(["ride"]);
    // Feast is parked: the launcher's own search does not find it.
    expect(filterAppLauncher("food")).toEqual([]);
  });

  test("an empty query returns the whole registry in order", () => {
    expect(filterAppLauncher("").map((t) => t.key)).toEqual(APP_LAUNCHER.map((t) => t.key));
    expect(filterAppLauncher("zzz-nothing")).toEqual([]);
  });
});
