import { describe, expect, test } from "bun:test";
import { parseStartSeconds, watchLinkAt } from "../startAt";

describe("copy link at current time", () => {
  test("the link carries whole seconds, and none under a second", () => {
    expect(watchLinkAt("https://cleestudio.com/posttube/watch/abc", 83.9)).toBe("https://cleestudio.com/posttube/watch/abc?t=83");
    expect(watchLinkAt("https://cleestudio.com/posttube/watch/abc", 0.4)).toBe("https://cleestudio.com/posttube/watch/abc");
  });
  test("?t= reads back as seconds, and junk is ignored", () => {
    expect(parseStartSeconds("83")).toBe(83);
    expect(parseStartSeconds(["120", "5"])).toBe(120);
    for (const bad of [undefined, "", "0", "-5", "1e3", "abc", "999999"]) expect(parseStartSeconds(bad)).toBeNull();
  });
});
