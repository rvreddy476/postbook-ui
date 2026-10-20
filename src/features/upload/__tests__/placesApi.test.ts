import { afterEach, describe, expect, spyOn, test } from "bun:test";

import api from "@/lib/api";
import { parsePlaces, placeQueryReady, searchPlaces } from "../placesApi";

afterEach(() => {
  (api.get as unknown as { mockRestore?: () => void }).mockRestore?.();
});

describe("place search", () => {
  test("only text worth a billed search is searched", () => {
    expect(placeQueryReady("C", { name: "", placeId: null })).toBe(false);
    expect(placeQueryReady("Ch", { name: "", placeId: null })).toBe(true);
    // The place just picked is not searched again.
    expect(placeQueryReady("Charminar", { name: "Charminar", placeId: "p1" })).toBe(false);
    expect(placeQueryReady("x".repeat(101), { name: "", placeId: null })).toBe(false);
  });

  test("rows without an id or a name are dropped", () => {
    expect(
      parsePlaces([
        { place_id: "p1", name: " Charminar ", secondary: "Hyderabad" },
        { place_id: "", name: "No id" },
        { place_id: "p3", name: "  " },
        "junk",
      ]),
    ).toEqual([{ placeId: "p1", name: "Charminar", secondary: "Hyderabad" }]);
    expect(parsePlaces(null)).toEqual([]);
  });

  test("a 503 means no provider: the field keeps free text instead of failing", async () => {
    spyOn(api, "get").mockRejectedValue(Object.assign(new Error("x"), { response: { status: 503 } }));
    expect(await searchPlaces("Charminar", "s1")).toEqual({ kind: "unavailable" });
  });

  test("asks the post-service route with the query and the session", async () => {
    const get = spyOn(api, "get").mockResolvedValue({ data: { data: [{ place_id: "p1", name: "Charminar" }] } } as never);
    const r = await searchPlaces("  Charminar ", "s1");
    expect(r).toEqual({ kind: "ok", places: [{ placeId: "p1", name: "Charminar", secondary: "" }] });
    expect(get.mock.calls[0][0]).toBe("/v1/posts/places/autocomplete");
    expect((get.mock.calls[0][1] as { params: unknown }).params).toEqual({ q: "Charminar", session: "s1" });
  });
});
