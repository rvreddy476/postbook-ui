import { beforeEach, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import * as api from "../searchApi";

/*
  What actually goes over the wire, with the HTTP client injected as a
  recorder (no module mocks, so nothing leaks into other test files). The bugs this pins: removing one recent used to send
  DELETE /v1/search/history with a body (which clears everything), and the
  page used to POST every typed query to /v1/search/saved.
*/

type Call = { method: string; url: string; config?: unknown; body?: unknown };
const calls: Call[] = [];
let answer: unknown = { data: {} };

const fake = {
  get: async (url: string, config?: unknown) => {
    calls.push({ method: "GET", url, config });
    return { data: answer };
  },
  delete: async (url: string, config?: unknown) => {
    calls.push({ method: "DELETE", url, config });
    return { data: { data: { status: "deleted" } } };
  },
};
const batch = async (ids: string[]) => {
  calls.push({ method: "POST", url: "/v1/posts/batch", body: { ids } });
  return {};
};

const clearRecents = () => api.clearRecents(fake);
const deleteRecent = (id: string) => api.deleteRecent(id, fake);
const fetchPopular = () => api.fetchPopular(fake);
const fetchRecents = () => api.fetchRecents(fake);
const fetchTabResults = (tab: Parameters<typeof api.fetchTabResults>[0], q: string) =>
  api.fetchTabResults(tab, q, undefined, { http: fake, batch });

beforeEach(() => {
  calls.length = 0;
  answer = { data: {} };
});

describe("recents", () => {
  test("removing one recent deletes that entry by id, with no body", async () => {
    await deleteRecent("h-42");
    expect(calls).toEqual([{ method: "DELETE", url: "/v1/search/history/h-42", config: undefined }]);
  });

  test("clear all is the bare history path", async () => {
    await clearRecents();
    expect(calls).toEqual([{ method: "DELETE", url: "/v1/search/history", config: undefined }]);
  });

  test("recents are read from the history route", async () => {
    answer = { data: { items: [{ id: "h1", query: "cats" }] } };
    expect(await fetchRecents()).toEqual([{ id: "h1", query: "cats" }]);
    expect(calls[0]).toMatchObject({ method: "GET", url: "/v1/search/history" });
  });

  test("popular searches", async () => {
    answer = { data: { items: [{ query: "cricket" }] } };
    expect(await fetchPopular()).toEqual(["cricket"]);
    expect(calls[0]).toMatchObject({ method: "GET", url: "/v1/search/popular", config: { params: { limit: 10 } } });
  });
});

describe("tab requests", () => {
  test("people and hashtags ask the server to record; top, videos and sounds do not", async () => {
    await fetchTabResults("people", "asha");
    await fetchTabResults("hashtags", "food");
    await fetchTabResults("top", "asha");
    await fetchTabResults("videos", "trip");
    await fetchTabResults("sounds", "rain");
    expect(calls.map((c) => [c.url, (c.config as { params: Record<string, unknown> }).params])).toEqual([
      ["/v1/search/users", { q: "asha", limit: 20, record: 1 }],
      ["/v1/search/hashtags", { q: "food", limit: 30, record: 1 }],
      ["/v1/search", { q: "asha", types: "users,posts,hashtags", limit: 10 }],
      ["/v1/search/posts", { q: "trip", type: "videos", limit: 30 }],
      ["/v1/audio/search", { q: "rain", limit: 30, offset: 0 }],
    ]);
  });

  test("reels: search for ids, then the batch for covers; no batch when nothing matched", async () => {
    answer = { data: { items: [] } };
    expect(await fetchTabResults("reels", "dance")).toEqual({ tab: "reels", reels: [] });
    expect(calls.map((c) => c.url)).toEqual(["/v1/search/posts"]);

    calls.length = 0;
    answer = { data: { items: [{ id: "r1", content_type: "flick" }, { id: "v1", content_type: "long_video" }] } };
    await fetchTabResults("reels", "dance");
    expect(calls.map((c) => [c.method, c.url])).toEqual([["GET", "/v1/search/posts"], ["POST", "/v1/posts/batch"]]);
    expect(calls[1].body).toEqual({ ids: ["r1"] });
  });

  test("no tab ever saves a search", async () => {
    for (const tab of ["top", "people", "videos", "sounds", "hashtags"] as const) await fetchTabResults(tab, "q");
    expect(calls.some((c) => c.url.includes("/v1/search/saved"))).toBe(false);
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });
});

describe("source guards", () => {
  const root = resolve(import.meta.dir, "../../..");

  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) return name === "__tests__" || name === "node_modules" ? [] : files(p);
      return /\.(ts|tsx)$/.test(name) ? [p] : [];
    });
  }

  test("the search page never writes saved searches", () => {
    for (const f of files(resolve(root, "app/search"))) {
      expect(readFileSync(f, "utf8"), f).not.toContain("/v1/search/saved");
    }
  });

  test("record=1 is sent from the search page only, never from pickers or typeahead elsewhere", () => {
    const offenders = files(root)
      .filter((f) => !f.replace(/\\/g, "/").includes("/app/search/"))
      .filter((f) => /record\s*[:=]\s*["'`]?1|record=1/.test(readFileSync(f, "utf8")) && /\/v1\/search/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
