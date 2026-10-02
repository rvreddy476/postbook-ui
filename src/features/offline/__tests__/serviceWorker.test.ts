import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { OFFLINE_SW_SCOPE, OFFLINE_SW_URL, registerOfflineShell, staticResources, type ShellEnv } from "../serviceWorker";

/*
  The Offline page's service worker (public/offline-sw.js), run here against
  fake globals: what it answers, and — more important — what it leaves alone.
*/

const ROOT = join(import.meta.dir, "..", "..", "..", "..");
const SW_SOURCE = readFileSync(join(ROOT, "public", "offline-sw.js"), "utf8");
const ORIGIN = "https://app.example";

interface Rig {
  dispatch(request: { url: string; method?: string; mode?: string }): Promise<Response> | null;
  message(data: unknown): Promise<void>;
  cache: Map<string, Response>;
  network: Map<string, () => Response>;
  fetched: string[];
  online: { value: boolean };
}

function boot(): Rig {
  const listeners = new Map<string, (event: never) => void>();
  const cache = new Map<string, Response>();
  const network = new Map<string, () => Response>();
  const fetched: string[] = [];
  const online = { value: true };
  const key = (k: string | { url: string }) => (typeof k === "string" ? (k.startsWith("http") ? k : ORIGIN + k) : k.url);
  const cacheApi = {
    match: async (k: string | { url: string }) => cache.get(key(k))?.clone(),
    put: async (k: string | { url: string }, r: Response) => void cache.set(key(k), r),
    delete: async (k: string | { url: string }) => cache.delete(key(k)),
    keys: async () => Array.from(cache.keys(), (url) => ({ url })),
  };
  const fakeFetch = async (input: string | { url: string }) => {
    const url = key(input);
    fetched.push(url);
    const make = network.get(url);
    if (!online.value || !make) throw new TypeError("Failed to fetch");
    const res = make();
    Object.defineProperty(res, "type", { value: "basic" });
    return res;
  };
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: (event: never) => void) => void listeners.set(type, fn),
    skipWaiting: () => undefined,
    clients: { claim: async () => undefined },
  };
  new Function("self", "caches", "fetch", SW_SOURCE)(self, { open: async () => cacheApi }, fakeFetch);
  return {
    cache,
    network,
    fetched,
    online,
    dispatch(request) {
      let answer: Promise<Response> | null = null;
      const event = { request: { method: "GET", mode: "cors", ...request }, respondWith: (p: Promise<Response>) => void (answer = p) };
      listeners.get("fetch")!(event as never);
      return answer;
    },
    async message(data) {
      let work: Promise<unknown> = Promise.resolve();
      listeners.get("message")!({ data, waitUntil: (p: Promise<unknown>) => void (work = p) } as never);
      await work;
    },
  };
}

const html = (body = "<html>offline page</html>") => () => new Response(body, { status: 200, headers: { "content-type": "text/html" } });
const PAGE = `${ORIGIN}/posttube/offline`;
const CHUNK = `${ORIGIN}/_next/static/chunks/app-abc123.js`;

describe("the worker leaves the rest of the site alone", () => {
  test("it never answers: API calls, media, other pages, other origins, or anything that is not a GET", () => {
    const sw = boot();
    const untouched = [
      { url: `${ORIGIN}/v1/posts/offline/check`, method: "POST" },
      { url: `${ORIGIN}/v1/posts/offline?device_id=d` },
      { url: `${ORIGIN}/v1/media/m1/serve/720p` },
      { url: `${ORIGIN}/api/auth/refresh`, method: "POST" },
      { url: `${ORIGIN}/posttube`, mode: "navigate" },
      { url: `${ORIGIN}/posttube/watch/p1`, mode: "navigate" },
      { url: `${ORIGIN}/posttube/offline-other`, mode: "navigate" },
      { url: `${ORIGIN}/`, mode: "navigate" },
      { url: `${ORIGIN}/images/logo.png` },
      { url: `${ORIGIN}/posttube/offline?_rsc=abc` },
      { url: "https://cdn.other.example/_next/static/chunks/x.js" },
      { url: `${ORIGIN}/posttube/offline`, mode: "navigate", method: "POST" },
      { url: CHUNK, method: "HEAD" },
    ];
    for (const request of untouched) expect([request.url, request.method ?? "GET", sw.dispatch(request)]).toEqual([request.url, request.method ?? "GET", null]);
    expect(sw.fetched).toEqual([]);
    expect(sw.cache.size).toBe(0);
  });

  test("it is registered for the Offline page only, from a hand-written file — no service worker library, no other worker", () => {
    expect(OFFLINE_SW_URL).toBe("/offline-sw.js");
    expect(OFFLINE_SW_SCOPE).toBe("/posttube/offline");
    expect(SW_SOURCE).not.toMatch(/importScripts|workbox|precache-manifest/i);
    expect(readdirSync(join(ROOT, "public")).filter((f) => /sw|worker/i.test(f))).toEqual(["offline-sw.js"]);
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((d) => /pwa|workbox|serwist/i.test(d))).toEqual([]);
    expect(existsSync(join(ROOT, "public", "sw.js"))).toBe(false);
  });
});

describe("the Offline page with no network", () => {
  test("online: the network's page, kept for later; offline: the kept page", async () => {
    const sw = boot();
    sw.network.set(PAGE, html("<html>v1</html>"));
    expect(await (await sw.dispatch({ url: PAGE, mode: "navigate" })!).text()).toBe("<html>v1</html>");
    sw.network.set(PAGE, html("<html>v2</html>"));
    expect(await (await sw.dispatch({ url: PAGE, mode: "navigate" })!).text()).toBe("<html>v2</html>");
    sw.online.value = false;
    expect(await (await sw.dispatch({ url: PAGE, mode: "navigate" })!).text()).toBe("<html>v2</html>");
  });

  test("offline with nothing kept: the navigation fails as it would without a worker", async () => {
    const sw = boot();
    sw.online.value = false;
    expect(await sw.dispatch({ url: PAGE, mode: "navigate" })!.then(() => "answered", () => "failed")).toBe("failed");
  });

  test("a redirect (to sign-in) or an error page is passed through and never kept", async () => {
    const sw = boot();
    sw.network.set(PAGE, () => {
      const res = new Response("<html>login</html>", { status: 200 });
      Object.defineProperty(res, "redirected", { value: true });
      return res;
    });
    expect(await (await sw.dispatch({ url: PAGE, mode: "navigate" })!).text()).toBe("<html>login</html>");
    sw.network.set(PAGE, () => new Response("boom", { status: 500 }));
    expect((await sw.dispatch({ url: PAGE, mode: "navigate" })!).status).toBe(500);
    expect(sw.cache.size).toBe(0);
  });

  test("build files: fetched once, then served from the cache, network or not", async () => {
    const sw = boot();
    sw.network.set(CHUNK, () => new Response("code", { status: 200 }));
    expect(await (await sw.dispatch({ url: CHUNK })!).text()).toBe("code");
    sw.online.value = false;
    expect(await (await sw.dispatch({ url: CHUNK })!).text()).toBe("code");
    expect(sw.fetched).toEqual([CHUNK]);
  });

  test("priming keeps the page and the build files it names — and only same-origin build files", async () => {
    const sw = boot();
    sw.network.set(PAGE, html(`<script src="/_next/static/chunks/page-1.js"></script><link href="/_next/static/css/a.css" rel="stylesheet">`));
    for (const f of ["chunks/page-1.js", "css/a.css", "chunks/extra-2.js"]) sw.network.set(`${ORIGIN}/_next/static/${f}`, () => new Response(f, { status: 200 }));
    // Reachable, so only the worker's own rule keeps them out.
    for (const path of ["/v1/media/m1/serve/720p", "/_next/static/x.js", "/posttube"]) sw.network.set(ORIGIN + path, () => new Response("not for the shell", { status: 200 }));
    await sw.message({ type: "prime", urls: ["/_next/static/chunks/extra-2.js", "https://evil.example/_next/static/x.js", "/v1/media/m1/serve/720p", "/posttube"] });
    expect(Array.from(sw.cache.keys()).sort()).toEqual([`${ORIGIN}/_next/static/chunks/extra-2.js`, `${ORIGIN}/_next/static/chunks/page-1.js`, `${ORIGIN}/_next/static/css/a.css`, PAGE]);
    await sw.message({ type: "something-else" });
    expect(sw.cache.size).toBe(4);
  });
});

describe("registration", () => {
  const env = (over: Partial<ShellEnv> = {}) => {
    const calls: { url: string; scope: string }[] = [];
    const posted: unknown[] = [];
    const worker = { postMessage: (m: unknown) => void posted.push(m) };
    const e: ShellEnv = {
      production: true,
      online: true,
      serviceWorker: { register: async (url, opts) => (calls.push({ url, scope: opts.scope }), { active: worker, installing: null, waiting: null }) },
      resources: () => ["/_next/static/chunks/a.js"],
      ...over,
    };
    return { e, calls, posted };
  };

  test("production, online, supported: registered at the Offline page's scope and primed", async () => {
    const { e, calls, posted } = env();
    expect(await registerOfflineShell(e)).toBe(true);
    expect(calls).toEqual([{ url: "/offline-sw.js", scope: "/posttube/offline" }]);
    expect(posted).toEqual([{ type: "prime", urls: ["/_next/static/chunks/a.js"] }]);
  });

  test("not in development, not while offline, not where the browser has no service workers; a failure is swallowed", async () => {
    for (const over of [{ production: false }, { online: false }, { serviceWorker: undefined }] as Partial<ShellEnv>[]) {
      const { e, calls } = env(over);
      expect(await registerOfflineShell(e)).toBe(false);
      expect(calls).toEqual([]);
    }
    expect(await registerOfflineShell(env({ serviceWorker: { register: async () => Promise.reject(new Error("no")) } }).e)).toBe(false);
  });

  test("only same-origin build files are offered for priming", () => {
    expect(staticResources([`${ORIGIN}/_next/static/chunks/a.js`, `${ORIGIN}/_next/static/chunks/a.js`, `${ORIGIN}/v1/media/m1/serve`, "https://x.example/_next/static/b.js", "::bad"], ORIGIN)).toEqual(["/_next/static/chunks/a.js"]);
  });
});
