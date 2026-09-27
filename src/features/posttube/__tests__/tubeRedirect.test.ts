import { describe, expect, test } from "bun:test";

import { tubePathnameToPosttube, tubeQueryString, tubeRedirectTarget } from "@/features/posttube/tubeRedirect";

describe("tubeRedirectTarget", () => {
  test("/tube/watch/{id} lands on /posttube/watch/{id}", () => {
    expect(tubeRedirectTarget(["watch", "abc123"])).toBe("/posttube/watch/abc123");
  });

  test("the bare alias lands on the PostTube home", () => {
    expect(tubeRedirectTarget(undefined)).toBe("/posttube");
    expect(tubeRedirectTarget([])).toBe("/posttube");
    expect(tubeRedirectTarget(null)).toBe("/posttube");
  });

  test("every /tube/* path maps segment for segment", () => {
    expect(tubeRedirectTarget(["channel", "someone"])).toBe("/posttube/channel/someone");
    expect(tubeRedirectTarget(["playlists", "p1"])).toBe("/posttube/playlists/p1");
    expect(tubeRedirectTarget(["history"])).toBe("/posttube/history");
  });

  test("the query is preserved, from a page's searchParams object", () => {
    expect(tubeRedirectTarget(["watch", "abc"], { t: "30", list: "pl1" })).toBe("/posttube/watch/abc?t=30&list=pl1");
    expect(tubeRedirectTarget(["watch", "abc"], { tag: ["a", "b"], skip: undefined })).toBe("/posttube/watch/abc?tag=a&tag=b");
    expect(tubeRedirectTarget(["watch", "abc"], {})).toBe("/posttube/watch/abc");
  });

  test("the query is preserved, from a string or URLSearchParams", () => {
    expect(tubeRedirectTarget(["watch", "abc"], "?t=30")).toBe("/posttube/watch/abc?t=30");
    expect(tubeRedirectTarget(["watch", "abc"], "t=30")).toBe("/posttube/watch/abc?t=30");
    expect(tubeRedirectTarget(["watch", "abc"], new URLSearchParams({ t: "30" }))).toBe("/posttube/watch/abc?t=30");
    expect(tubeRedirectTarget(["watch", "abc"], "")).toBe("/posttube/watch/abc");
  });

  test("empty segments are dropped and unsafe ones are encoded, without double-encoding", () => {
    expect(tubeRedirectTarget(["", "watch", " ", "abc", ""])).toBe("/posttube/watch/abc");
    expect(tubeRedirectTarget(["watch", "a b"])).toBe("/posttube/watch/a%20b");
    expect(tubeRedirectTarget(["watch", "a%20b"])).toBe("/posttube/watch/a%20b");
    expect(tubeRedirectTarget(["watch", "../x"])).toBe("/posttube/watch/..%2Fx");
  });

  test("query values are encoded", () => {
    expect(tubeRedirectTarget(["watch", "abc"], { q: "a b&c" })).toBe("/posttube/watch/abc?q=a+b%26c");
  });
});

describe("tubeQueryString", () => {
  test("empty inputs give no query", () => {
    expect(tubeQueryString(null)).toBe("");
    expect(tubeQueryString(undefined)).toBe("");
    expect(tubeQueryString("?")).toBe("");
    expect(tubeQueryString(new URLSearchParams())).toBe("");
  });
});

describe("tubePathnameToPosttube", () => {
  test("maps a full pathname and leaves other paths alone", () => {
    expect(tubePathnameToPosttube("/tube/watch/abc?t=30")).toBe("/posttube/watch/abc?t=30");
    expect(tubePathnameToPosttube("/tube")).toBe("/posttube");
    expect(tubePathnameToPosttube("/tube/")).toBe("/posttube");
    expect(tubePathnameToPosttube("/tubes/watch/abc")).toBeNull();
    expect(tubePathnameToPosttube("/posttube/watch/abc")).toBeNull();
  });
});
