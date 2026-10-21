/*
  Share links and the app they open (founder, 21 Oct 2026).

  Every link the web hands out (Copy link, the share sheets, WhatsApp) ends
  in `?ref=<short id>&utm_source=share`. The id is random, minted when the
  link is copied, and names nothing about the sharer: it is only something
  the Android Install Referrer can carry back, so a tap that installs the
  app can land on the page it was tapped for. Nothing else is appended.

  The same id rides the Play Store link (`referrer=`) and the intent:// link
  the "Open in app" banner uses, so all three agree.
*/

export const SHARE_REF_PARAM = "ref";
export const SHARE_SOURCE_PARAM = "utm_source";
export const SHARE_SOURCE = "share";

/** The production package. The dev and staging flavours add ".dev" / ".staging". */
export const DEFAULT_ANDROID_PACKAGE = "com.us.android";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const REF_LENGTH = 10;

/** A short random id (10 chars, lower-case base36). Crypto-random where the platform has it. */
export function newShareRef(random: (n: number) => Uint8Array = defaultRandom): string {
  const bytes = random(REF_LENGTH);
  let out = "";
  for (let i = 0; i < REF_LENGTH; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function defaultRandom(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

/** Whether a ref is one of ours: 4–32 chars of [a-z0-9]. Anything else is dropped. */
export function isShareRefId(ref: string | null | undefined): ref is string {
  return typeof ref === "string" && /^[a-z0-9]{4,32}$/.test(ref);
}

/**
 * `url` with `?ref=<id>&utm_source=share` appended (a fragment, if any, is
 * kept after). A url that already carries a ref keeps it; a url with other
 * query parameters keeps them too. An invalid or empty url comes back as is.
 */
export function withShareRef(url: string, ref: string = newShareRef()): string {
  if (!url || !isShareRefId(ref)) return url;
  const hashAt = url.indexOf("#");
  const base = hashAt >= 0 ? url.slice(0, hashAt) : url;
  const hash = hashAt >= 0 ? url.slice(hashAt) : "";
  const qAt = base.indexOf("?");
  const path = qAt >= 0 ? base.slice(0, qAt) : base;
  const params = new URLSearchParams(qAt >= 0 ? base.slice(qAt + 1) : "");
  if (!isShareRefId(params.get(SHARE_REF_PARAM))) params.set(SHARE_REF_PARAM, ref);
  params.set(SHARE_SOURCE_PARAM, SHARE_SOURCE);
  return `${path}?${params.toString()}${hash}`;
}

/** The ref a page was opened with, or null. */
export function shareRefOf(search: string | URLSearchParams | null | undefined): string | null {
  if (!search) return null;
  const params = typeof search === "string" ? new URLSearchParams(search.replace(/^\?/, "")) : search;
  const ref = params.get(SHARE_REF_PARAM);
  return isShareRefId(ref) ? ref : null;
}

/**
 * The Play Store page with an Install Referrer the app can read after it
 * installs: `utm_source=share&ref=<id>&link=<path>`. `link` is the page's
 * path and query (never a host, never a fragment), so the app can open the
 * same page once it is installed. Null when there is no store URL.
 */
export function playStoreHref(storeUrl: string | null | undefined, opts: { ref?: string | null; link?: string | null } = {}): string | null {
  const store = (storeUrl ?? "").trim();
  if (!/^https:\/\//i.test(store)) return null;
  const referrer = new URLSearchParams();
  referrer.set(SHARE_SOURCE_PARAM, SHARE_SOURCE);
  if (isShareRefId(opts.ref)) referrer.set(SHARE_REF_PARAM, opts.ref);
  const link = cleanLink(opts.link);
  if (link) referrer.set("link", link);
  const url = new URL(store);
  url.searchParams.set("referrer", referrer.toString());
  return url.toString();
}

/** A path and query, with no host and no fragment; null for anything else. */
function cleanLink(link: string | null | undefined): string | null {
  const l = (link ?? "").trim();
  if (!l.startsWith("/") || l.startsWith("//")) return null;
  return l.split("#")[0] || null;
}

/**
 * The Android intent:// link for a page: Chrome opens the app when it is
 * installed, else the fallback (the Play Store link when there is one, else
 * the page itself — never a blank tab). `pageUrl` is the page's absolute
 * https address, with its ref already on it.
 */
export function appIntentHref(pageUrl: string, opts: { packageName?: string | null; fallbackUrl?: string | null } = {}): string | null {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const pkg = (opts.packageName ?? "").trim() || DEFAULT_ANDROID_PACKAGE;
  if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(pkg)) return null;
  const fallback = (opts.fallbackUrl ?? "").trim() || pageUrl;
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=${pkg};S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
}
