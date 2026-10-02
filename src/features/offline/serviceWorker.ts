/*
  Registers the Offline page's service worker (public/offline-sw.js) so
  /posttube/offline opens with no network.

  Scope: "/posttube/offline" and nothing wider — the worker controls only a
  document loaded at that address; no other page of the site gets a
  service worker or any change in caching.

  Only in a production build (in development the build files are not
  content-hashed, and a cache-first worker would serve stale code), only
  once somebody has a copy to watch, and only when the browser has service
  workers at all. A failure here never matters to the page: the stored
  copies play without it whenever the page itself can load.
*/

export const OFFLINE_SW_URL = "/offline-sw.js";
export const OFFLINE_SW_SCOPE = "/posttube/offline";

export interface ShellEnv {
  production: boolean;
  online: boolean;
  serviceWorker?: {
    register(url: string, opts: { scope: string }): Promise<{ active: Postable | null; installing: Postable | null; waiting: Postable | null }>;
    ready?: Promise<unknown>;
  };
  /** The build files this page has loaded (performance resource entries). */
  resources: () => string[];
}

interface Postable {
  postMessage(message: unknown): void;
  addEventListener?(type: "statechange", listener: () => void): void;
  state?: string;
}

/** Same-origin build files only. */
export function staticResources(urls: readonly string[], origin: string): string[] {
  const out = new Set<string>();
  for (const u of urls) {
    try {
      const url = new URL(u, origin);
      if (url.origin === origin && url.pathname.startsWith("/_next/static/")) out.add(url.pathname + url.search);
    } catch {
      /* not a URL */
    }
  }
  return Array.from(out);
}

/** Registers and primes the worker. Resolves true when a registration was made. Never throws. */
export async function registerOfflineShell(env: ShellEnv): Promise<boolean> {
  if (!env.production || !env.online || !env.serviceWorker) return false;
  try {
    const registration = await env.serviceWorker.register(OFFLINE_SW_URL, { scope: OFFLINE_SW_SCOPE });
    const prime = (worker: Postable) => worker.postMessage({ type: "prime", urls: env.resources() });
    const worker = registration.active ?? registration.waiting ?? registration.installing;
    if (!worker) return true;
    if (worker === registration.active || worker.state === "activated") prime(worker);
    else worker.addEventListener?.("statechange", () => worker.state === "activated" && prime(worker));
    return true;
  } catch {
    return false;
  }
}

let asked = false;

/** The browser call: at most once per page load. */
export function registerOfflineShellInBrowser(): void {
  if (asked || typeof window === "undefined" || typeof navigator === "undefined") return;
  asked = true;
  const origin = window.location.origin;
  void registerOfflineShell({
    production: process.env.NODE_ENV === "production",
    online: navigator.onLine,
    serviceWorker: "serviceWorker" in navigator ? (navigator.serviceWorker as unknown as ShellEnv["serviceWorker"]) : undefined,
    resources: () =>
      staticResources(
        (performance.getEntriesByType?.("resource") ?? []).map((e) => e.name),
        origin,
      ),
  });
}
