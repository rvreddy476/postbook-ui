import { describe, expect, test } from "bun:test";

import { APP_BRANDS, resolveAppBrand, resolveAppNavigation } from "@/lib/appBrand";

test('app navigation changes with the route and keeps Messenger', () => {
  const reels=resolveAppNavigation('/reels')!;
  const tube=resolveAppNavigation('/posttube/watch/123')!;
  const groups=resolveAppNavigation('/groups/123')!;
  expect(reels.map(item=>item.label)).toEqual(['Reels','Explore','Create','Saved','Messenger','All apps']);
  expect(tube.some(item=>item.href==='/posttube/upload')).toBe(true);
  expect(groups.some(item=>item.href==='/groups/create')).toBe(true);
  for(const items of [reels,tube,groups]) expect(items.some(item=>item.href==='/messenger')).toBe(true);
  expect(resolveAppNavigation('/')).toBeNull();
});

describe("resolveAppBrand", () => {
  test("names the app the route is inside", () => {
    expect(resolveAppBrand("/reels").name).toBe("Reels");
    expect(resolveAppBrand("/reels/3f860f61").key).toBe("reels");
    expect(resolveAppBrand("/posttube/watch/abc").name).toBe("PostTube");
    expect(resolveAppBrand("/groups/9c80/settings").name).toBe("Groups");
    expect(resolveAppBrand("/commerce").name).toBe("Shop");
  });

  test("the root and unknown routes fall back to the product name", () => {
    expect(resolveAppBrand("/").name).toBe("VChat");
    expect(resolveAppBrand("/u/someone").name).toBe("VChat");
    expect(resolveAppBrand(null).name).toBe("VChat");
    expect(resolveAppBrand(undefined).name).toBe("VChat");
  });

  test("a prefix only matches a whole path segment", () => {
    // "/reelsomething" is not the reels app.
    expect(resolveAppBrand("/reelsomething").key).toBe("home");
    expect(resolveAppBrand("/groupsy").key).toBe("home");
  });

  test("every brand has a link, an icon and a search hint", () => {
    for (const b of APP_BRANDS) {
      expect(b.href.startsWith("/")).toBe(true);
      expect(typeof b.icon).not.toBe("undefined");
      expect(b.searchPlaceholder.length).toBeGreaterThan(0);
    }
    expect(new Set(APP_BRANDS.map((b) => b.key)).size).toBe(APP_BRANDS.length);
  });
});
