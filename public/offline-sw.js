/*
  The Offline page's service worker. Hand-written, no library.

  It is registered with the scope "/posttube/offline" and nothing wider, so
  it controls ONLY a document loaded at that address. Every other page of
  the site has no service worker and is cached exactly as before.

  What it does, for that one page:
    - the page itself: network first; the last good copy when there is no
      network (never a redirect, never an error page);
    - the app's own build files under /_next/static/ (content-hashed, so a
      cached one is never stale): cache first;
    - everything else — every /v1 and /api call, media, other origins —
      is not touched at all.

  The stored videos are not served from here: the page reads them straight
  from the browser's private storage.
*/

const SHELL_CACHE = "offline-shell-v1";
const SHELL_PATH = "/posttube/offline";
const STATIC_PREFIX = "/_next/static/";
const MAX_STATIC_ENTRIES = 200;

/** "shell" | "static" | null (null = leave the request alone). */
function routeOf(request, origin) {
  if (request.method !== "GET") return null;
  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return null;
  }
  if (url.origin !== origin) return null;
  if (request.mode === "navigate") return url.pathname === SHELL_PATH || url.pathname === SHELL_PATH + "/" ? "shell" : null;
  if (url.pathname.startsWith(STATIC_PREFIX)) return "static";
  return null;
}

/** Only a plain, successful, same-origin answer is ever kept. */
function cacheable(response) {
  return !!response && response.ok && response.status === 200 && response.type === "basic" && !response.redirected;
}

async function trim(cache) {
  const keys = await cache.keys();
  const statics = keys.filter((k) => new URL(k.url).pathname.startsWith(STATIC_PREFIX));
  for (const key of statics.slice(0, Math.max(0, statics.length - MAX_STATIC_ENTRIES))) await cache.delete(key);
}

async function shell(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (cacheable(response)) await cache.put(SHELL_PATH, response.clone());
    return response;
  } catch (err) {
    const kept = await cache.match(SHELL_PATH);
    if (kept) return kept;
    throw err;
  }
}

async function staticFile(request) {
  const cache = await caches.open(SHELL_CACHE);
  const kept = await cache.match(request.url);
  if (kept) return kept;
  const response = await fetch(request);
  if (cacheable(response)) await cache.put(request.url, response.clone());
  return response;
}

/** The page asks for this once it is open with a network: keep the page and the build files it names. */
async function prime(urls, origin) {
  const cache = await caches.open(SHELL_CACHE);
  const wanted = new Set();
  const page = await fetch(SHELL_PATH, { credentials: "same-origin" });
  if (cacheable(page)) {
    const html = await page.clone().text();
    await cache.put(SHELL_PATH, page);
    for (const m of html.matchAll(/["'(](\/_next\/static\/[^"'()\s\\]+)/g)) wanted.add(m[1]);
  }
  for (const u of Array.isArray(urls) ? urls : []) {
    try {
      const url = new URL(u, origin);
      if (url.origin === origin && url.pathname.startsWith(STATIC_PREFIX)) wanted.add(url.pathname + url.search);
    } catch (e) {
      /* not a URL */
    }
  }
  for (const path of wanted) {
    if (await cache.match(origin + path)) continue;
    try {
      const response = await fetch(path, { credentials: "same-origin" });
      if (cacheable(response)) await cache.put(origin + path, response);
    } catch (e) {
      /* the next visit fills it in */
    }
  }
  await trim(cache);
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const route = routeOf(event.request, self.location.origin);
  if (route === "shell") event.respondWith(shell(event.request));
  else if (route === "static") event.respondWith(staticFile(event.request));
  // anything else: no respondWith — the browser handles it as if this worker did not exist
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "prime") event.waitUntil(prime(data.urls, self.location.origin).catch(() => undefined));
});
