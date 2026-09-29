import { createHash } from "node:crypto";

import { API_GATEWAY_URL } from "@/app/api/auth/_lib/session";
import { channelFeedUrl, channelRefFromSegment, feedCategory, isFeedRef } from "@/features/posttube/feed/feedUrl";
import { buildRss, feedLastModified, FEED_ITEM_CAP, normalizeFeed, resolveFeedBases, rfc2822 } from "@/features/posttube/feed/rss";

/*
  GET|HEAD /posttube/channel/<handle or user id>/feed.xml[?category=<slug>]

  A channel's public long videos as RSS 2.0, for podcast apps and news
  readers. One document for everyone: the request's cookies and identity
  are never read or forwarded, post-service answers as the anonymous
  stranger, so a shared cache can hold it.

  Upstream: GET {API_GATEWAY_URL}/v1/channels/<ref>/feed?category=&limit=50
  (server to server; the /v1 proxy is for the browser).
    404 (no channel, hidden owner) and 400 (a category that is not ours) → 404
    anything else that is not a feed, or no answer                       → 502, no-store
*/

const CACHE_CONTROL = "public, s-maxage=600, stale-while-revalidate=3600";
const CONTENT_TYPE = "application/rss+xml; charset=utf-8";
const UPSTREAM_TIMEOUT_MS = 10_000;

type Context = { params: Promise<{ handle: string }> };

let warnedNoMediaBase = false;

function plain(status: number, message: string, head: boolean): Response {
  return new Response(head ? null : message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Weak comparison, as If-None-Match asks for: the opaque tags are compared without their W/ prefix. */
function matchesEtag(header: string | null, etag: string): boolean {
  if (!header) return false;
  const bare = (t: string) => t.trim().replace(/^W\//i, "");
  const own = bare(etag);
  return header.split(",").some((t) => t.trim() === "*" || bare(t) === own);
}

async function respond(request: Request, context: Context, head: boolean): Promise<Response> {
  const { handle } = await context.params;
  const ref = channelRefFromSegment(handle);
  if (!isFeedRef(ref)) return plain(404, "Feed not found", head);

  const category = feedCategory(new URL(request.url).searchParams.get("category"));

  const upstream = new URL(`${API_GATEWAY_URL}/v1/channels/${encodeURIComponent(ref)}/feed`);
  if (category) upstream.searchParams.set("category", category);
  upstream.searchParams.set("limit", String(FEED_ITEM_CAP));

  let body: unknown;
  try {
    const res = await fetch(upstream, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (res.status === 404 || res.status === 400) return plain(404, "Feed not found", head);
    if (!res.ok) return plain(502, "Feed unavailable", head);
    body = await res.json();
  } catch {
    return plain(502, "Feed unavailable", head);
  }

  const feed = normalizeFeed(body);
  if (!feed) return plain(502, "Feed unavailable", head);

  const { siteUrl, mediaBaseUrl } = resolveFeedBases({
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    feedMediaBaseUrl: process.env.FEED_MEDIA_BASE_URL,
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  });
  if (!mediaBaseUrl && !warnedNoMediaBase) {
    warnedNoMediaBase = true;
    console.warn("[feed] FEED_MEDIA_BASE_URL and NEXT_PUBLIC_API_BASE_URL are not set: channel feeds carry no enclosures and no artwork");
  }

  // The address is the channel's own (its handle when it has one), whatever ref the request used.
  const narrowed = feed.category || category;
  const xml = buildRss(
    { ...feed, category: narrowed },
    { siteUrl, mediaBaseUrl, feedUrl: channelFeedUrl(siteUrl, feed.channel.handle || feed.channel.userId || ref, narrowed) },
  );

  const etag = `W/"${createHash("sha1").update(xml).digest("hex")}"`;
  const headers = new Headers({ "Cache-Control": CACHE_CONTROL, ETag: etag });
  const modified = rfc2822(feedLastModified(feed));
  if (modified) headers.set("Last-Modified", modified);

  if (matchesEtag(request.headers.get("if-none-match"), etag)) {
    return new Response(null, { status: 304, headers });
  }

  headers.set("Content-Type", CONTENT_TYPE);
  if (head) {
    headers.set("Content-Length", String(Buffer.byteLength(xml, "utf8")));
    return new Response(null, { status: 200, headers });
  }
  return new Response(xml, { status: 200, headers });
}

export function GET(request: Request, context: Context): Promise<Response> {
  return respond(request, context, false);
}

export function HEAD(request: Request, context: Context): Promise<Response> {
  return respond(request, context, true);
}
