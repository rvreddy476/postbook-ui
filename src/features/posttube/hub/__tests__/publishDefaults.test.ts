import { describe, expect, test } from "bun:test";

import { PUBLISH_DEFAULTS, PUBLISH_DEFAULTS_KEY, getPublishDefaults, parsePublishDefaults, serializePublishDefaults } from "../publishDefaults";

describe("publish defaults", () => {
  test("the storage key is the one the studio reads", () => {
    expect(PUBLISH_DEFAULTS_KEY).toBe("posttube_publish_defaults_v1");
  });

  test("empty or malformed storage yields the defaults, never null", () => {
    expect(parsePublishDefaults(null)).toEqual(PUBLISH_DEFAULTS);
    expect(parsePublishDefaults("")).toEqual(PUBLISH_DEFAULTS);
    expect(parsePublishDefaults("{not json")).toEqual(PUBLISH_DEFAULTS);
    expect(parsePublishDefaults("[]")).toEqual(PUBLISH_DEFAULTS);
    expect(parsePublishDefaults("null")).toEqual(PUBLISH_DEFAULTS);
  });

  test("each key is validated on its own", () => {
    expect(parsePublishDefaults(JSON.stringify({ visibility: "unlisted", topic: " howto-style ", license: "cc-by", comments: false, language: "hi" }))).toEqual({
      visibility: "unlisted",
      topic: "howto-style",
      license: "cc-by",
      comments: false,
      language: "hi",
    });
    expect(parsePublishDefaults(JSON.stringify({ visibility: "scheduled", license: "gpl", comments: "yes", topic: 4 }))).toEqual(PUBLISH_DEFAULTS);
  });

  test("serialize round-trips through parse", () => {
    const d = { ...PUBLISH_DEFAULTS, visibility: "private" as const, language: "te" };
    expect(parsePublishDefaults(serializePublishDefaults(d))).toEqual(d);
  });

  test("getPublishDefaults is safe without a window (server render)", () => {
    expect(getPublishDefaults()).toEqual(PUBLISH_DEFAULTS);
  });
});
