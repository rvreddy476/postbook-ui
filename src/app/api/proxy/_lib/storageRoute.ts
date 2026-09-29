/*
  Where the /v1 proxy goes when the gateway answers a media request with a
  redirect to storage (2026-09-29).

  media-service answers /v1/media/:id/serve with a 307 to a signed storage
  link written for BROWSERS: on dev https://media-dev.cleestudio.com, which
  is this machine's own MinIO published through a tunnel. Followed from
  inside the web container, every byte left the machine and came back, and
  each seek opened a new connection over that busy link, which failed.

  When a storage route is configured, a redirect to the public storage
  origin is fetched from the internal origin instead, with the Host the link
  was signed for, so the signature still verifies. Storage checks the
  signature, not the road taken: a link that would be refused outside is
  refused inside.

  Unset (production with S3 or CloudFront), redirects are followed as before.
*/

export interface StorageRoute {
  /** The origin signed links are written for, e.g. https://media-dev.cleestudio.com */
  publicOrigin: string;
  /** Where the same storage answers on the private network, e.g. http://minio:9000 */
  internal: URL;
}

export interface StorageTarget {
  protocol: "http:" | "https:";
  hostname: string;
  port: number;
  /** Path and query of the signed link, untouched. */
  path: string;
  /** The Host header the link was signed for. */
  hostHeader: string;
}

type Env = Record<string, string | undefined>;

function origin(raw: string | undefined): URL | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if ((url.pathname !== "/" && url.pathname !== "") || url.search || url.hash || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

/** The configured route, or null when either side is missing or is not a bare http(s) origin. */
export function readStorageRoute(env: Env = process.env): StorageRoute | null {
  const pub = origin(env.MEDIA_STORAGE_PUBLIC_ORIGIN);
  const internal = origin(env.MEDIA_STORAGE_INTERNAL_ORIGIN);
  if (!pub || !internal) return null;
  if (pub.origin === internal.origin) return null;
  return { publicOrigin: pub.origin, internal };
}

/** The internal request for a redirect target, or null when the target is not the public storage origin. */
export function internalTarget(location: URL, route: StorageRoute | null): StorageTarget | null {
  if (!route || location.origin !== route.publicOrigin) return null;
  const protocol = route.internal.protocol === "https:" ? "https:" : "http:";
  return {
    protocol,
    hostname: route.internal.hostname,
    port: route.internal.port ? Number(route.internal.port) : protocol === "https:" ? 443 : 80,
    path: `${location.pathname}${location.search}`,
    hostHeader: location.host,
  };
}

export function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

/** A chain longer than this is answered as a failure, not followed. */
export const MAX_REDIRECTS = 3;

/*
  What a request that has LEFT the gateway may carry. Never the session:
  the cookie, the bearer token and the CSRF token belong to the gateway and
  are not sent to storage or to any other origin a redirect names.
*/
const STORAGE_HEADERS = ["range", "if-range", "accept"] as const;

export function storageRequestHeaders(forwarded: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of STORAGE_HEADERS) {
    const value = forwarded.get(name);
    if (value) out[name] = value;
  }
  return out;
}

const HOP_BY_HOP = new Set(["transfer-encoding", "connection", "keep-alive"]);

/** Response headers as the browser gets them: everything but the hop-by-hop ones. */
export function responseHeaders(entries: Iterable<[string, string | string[] | undefined]>): Headers {
  const out = new Headers();
  for (const [name, value] of entries) {
    if (value === undefined || HOP_BY_HOP.has(name.toLowerCase())) continue;
    // Set-Cookie is the one header that legitimately repeats: every cookie is kept.
    if (Array.isArray(value)) for (const v of value) out.append(name, v);
    else if (name.toLowerCase() === "set-cookie") out.append(name, value);
    else out.set(name, value);
  }
  return out;
}

/** A link without its query, for logs: the query of a signed link is its credential. */
export function withoutQuery(url: URL | string): string {
  try {
    const u = typeof url === "string" ? new URL(url) : url;
    return `${u.origin}${u.pathname}`;
  } catch {
    return "(unparseable url)";
  }
}
