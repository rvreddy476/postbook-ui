/*
  Which media requests carry the session cookie (reels-2).

  Our HLS graph has two kinds of URL:
  - API routes (`/v1/media/<id>/hls`, `/v1/media/<id>/hls/<rung>.m3u8`,
    `/v1/media/<id>/serve`): the access check runs there and reads the
    access_token cookie scoped to /v1/media. They live on the API base
    (NEXT_PUBLIC_API_BASE_URL) or, when that is empty, on this origin through
    the /v1 proxy. These need credentials, and the gateway answers CORS with
    Allow-Credentials: true.
  - Segment URLs listed in a child playlist: absolute signed URLs on the CDN
    (production) or the object store (dev). They authorise themselves by
    their signature, and the CDN answers CORS with allow-credentials=false,
    so a credentialed request there is blocked by the browser. They are
    fetched without credentials.

  The rule is by host, never by path: anything on the API origin or this
  page's origin is an API route; anything else is the CDN.
*/

/** Same as features/reels/model `apiBase()`, read here so this file has no app imports. */
function configuredApiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "";
}

function currentPageOrigin(): string | null {
  try {
    return typeof location !== "undefined" && location.origin && location.origin !== "null" ? location.origin : null;
  } catch {
    return null;
  }
}

function originOf(url: string, base?: string): string | null {
  try {
    return new URL(url, base).origin;
  } catch {
    return null;
  }
}

export interface HostEnv {
  /** NEXT_PUBLIC_API_BASE_URL; "" = the same-origin /v1 proxy. */
  apiBase?: string;
  /** This page's origin; null when there is no page (tests, server). */
  pageOrigin?: string | null;
}

/** True when `url` is one of our API routes (the API origin, or this origin), which needs the session cookie. */
export function isApiUrl(url: string, env: HostEnv = {}): boolean {
  const apiBase = env.apiBase ?? configuredApiBase();
  const page = env.pageOrigin === undefined ? currentPageOrigin() : env.pageOrigin;
  if (!url) return false;
  // A path on this origin ("/v1/…"): the same-origin proxy.
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith("//")) return true; // "v1/…" relative
  const target = originOf(url, page ?? "https://invalid.local");
  if (!target || target === "null") return false;
  if (apiBase) {
    const api = originOf(apiBase);
    if (api && api === target) return true;
  }
  return page !== null && target === page;
}

/**
  hls.js `xhrSetup`: credentials only for API routes. hls.js 1.7 passes the
  request URL as the second argument, for playlists and fragments alike.
*/
export function hlsXhrSetup(xhr: XMLHttpRequest, url: string): void {
  xhr.withCredentials = isApiUrl(url);
}

/**
  The `crossorigin` a <video> needs before it loads `src` itself (native
  HLS on Safari, the progressive file, an alternate-audio MP4). null =
  remove the attribute.

  - hls.js feeds the element a blob: URL, so the attribute only affects the
    caption <track>s and canvas reads: "anonymous".
  - A cross-origin API route (`/v1/media/<id>/serve` on the API host, or
    the native HLS playlist there) needs the cookie AND is redirected to the
    CDN. "use-credentials" fails at the CDN (no Allow-Credentials) and
    "anonymous" drops the cookie, so the attribute is removed: the element
    then loads in no-cors mode, sends the cookie and follows the redirect.
  - Anything else (this origin, a CDN URL, a blob): "anonymous".
*/
export function elementCrossOrigin(src: string | null | undefined, env: HostEnv = {}): "anonymous" | null {
  if (!src || src.startsWith("blob:") || src.startsWith("data:")) return "anonymous";
  const page = env.pageOrigin === undefined ? currentPageOrigin() : env.pageOrigin;
  const target = originOf(src, page ?? "https://invalid.local");
  const sameOrigin = page !== null && target === page;
  if (!sameOrigin && isApiUrl(src, env)) return null;
  return "anonymous";
}

/** Points the element at a source it loads itself, with the crossorigin that source needs. */
export function setElementSource(video: HTMLVideoElement, src: string): void {
  const mode = elementCrossOrigin(src);
  if (mode) video.crossOrigin = mode;
  else video.removeAttribute("crossorigin");
  video.src = src;
  video.load();
}
