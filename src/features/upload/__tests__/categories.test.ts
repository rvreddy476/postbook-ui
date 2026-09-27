import { describe, expect, test } from "bun:test";

import { normalizeCategories } from "@/features/posttube/model";
import { categoryKindsFor, categoryLabel, categoryOptions } from "@/features/upload/categories";

/** The merged taxonomy the plan pins (§3): flick entries tagged all/short, long-video entries tagged long. */
const merged = normalizeCategories([
  { slug: "comedy", label: "Comedy", kind: "all" },
  { slug: "dance", label: "Dance", kind: "short" },
  { slug: "film-animation", label: "Film & Animation", kind: "long" },
  { slug: "documentary", label: "Documentary", kind: "long" },
  { slug: "other", label: "Other", kind: "all" },
]);

/** What the API answers today: the flick list, `{id,label}`, no kind. */
const flickOnly = normalizeCategories([
  { id: "comedy", label: "Comedy" },
  { id: "music", label: "Music" },
  { id: "other", label: "Other" },
]);

describe("categoryKindsFor", () => {
  test("long and podcast studios take all + long; reel and short take all + short", () => {
    expect(categoryKindsFor("long")).toEqual(["all", "long"]);
    expect(categoryKindsFor("podcast")).toEqual(["all", "long"]);
    expect(categoryKindsFor("reel")).toEqual(["all", "short"]);
    expect(categoryKindsFor("short")).toEqual(["all", "short"]);
  });
});

describe("categoryOptions", () => {
  test("stores the slug, shows the label, filters the merged list by the studio's kind, keeps API order", () => {
    expect(categoryOptions(merged, "long")).toEqual([
      { value: "comedy", label: "Comedy" },
      { value: "film-animation", label: "Film & Animation" },
      { value: "documentary", label: "Documentary" },
      { value: "other", label: "Other" },
    ]);
    expect(categoryOptions(merged, "reel")).toEqual([
      { value: "comedy", label: "Comedy" },
      { value: "dance", label: "Dance" },
      { value: "other", label: "Other" },
    ]);
  });

  test("the current flick-only shape keeps working in every studio", () => {
    const expected = [
      { value: "comedy", label: "Comedy" },
      { value: "music", label: "Music" },
      { value: "other", label: "Other" },
    ];
    expect(categoryOptions(flickOnly, "long")).toEqual(expected);
    expect(categoryOptions(flickOnly, "reel")).toEqual(expected);
  });

  test("a stored value the list does not offer stays selectable, shown as typed", () => {
    expect(categoryOptions(merged, "long", "Film & Animation").at(-1)).toEqual({ value: "Film & Animation", label: "Film & Animation" });
    expect(categoryOptions(merged, "long", "dance").at(-1)).toEqual({ value: "dance", label: "Dance" });
    expect(categoryOptions(merged, "long", "comedy")).toHaveLength(4);
    expect(categoryOptions(merged, "long", "")).toHaveLength(4);
    expect(categoryOptions(merged, "long", "  ")).toHaveLength(4);
  });

  test("no list yet gives no options — the select waits on the API rather than inventing a list", () => {
    expect(categoryOptions(undefined, "long")).toEqual([]);
    expect(categoryOptions(null, "long")).toEqual([]);
    expect(categoryOptions([], "long", "comedy")).toEqual([{ value: "comedy", label: "comedy" }]);
  });

  test("duplicates and blank slugs are dropped", () => {
    expect(categoryOptions([{ slug: "a", label: "A" }, { slug: "a", label: "A again" }, { slug: "", label: "x" }], "long")).toEqual([{ value: "a", label: "A" }]);
  });
});

describe("categoryLabel", () => {
  test("label for a known slug, the raw value otherwise", () => {
    expect(categoryLabel(merged, "documentary")).toBe("Documentary");
    expect(categoryLabel(merged, "unknown")).toBe("unknown");
    expect(categoryLabel(undefined, "x")).toBe("x");
  });
});
