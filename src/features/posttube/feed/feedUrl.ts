/*
  Where a channel's RSS feed lives, in one place. Pure strings: the route
  handler, the channel page's autodiscovery link, the channel More menu and
  Branding all build the address from here.

    /posttube/channel/<handle or user id>/feed.xml[?category=<slug>]
*/

/** A category slug as post-service spells it. Anything else is not forwarded. */
export const FEED_CATEGORY_RE = /^[a-z0-9-]{0,32}$/;

/** A handle (letters, digits, "." and "_") or a user id. Nothing that could walk a path. */
const FEED_REF_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/** The narrowed feed Branding offers beside the full one. */
export const PODCASTS_CATEGORY = "podcasts";

/** The category to ask for, or "" when the value is missing or not a slug. */
export function feedCategory(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "";
  return FEED_CATEGORY_RE.test(raw) ? raw : "";
}

/** The [handle] segment as a channel ref: decoded, without a leading "@". */
export function channelRefFromSegment(segment: string): string {
  let ref = segment;
  try {
    ref = decodeURIComponent(segment);
  } catch {
    // a malformed escape: use the segment as it came
  }
  return ref.replace(/^@/, "");
}

/** Whether a ref may be placed in an upstream path. */
export function isFeedRef(ref: string): boolean {
  return FEED_REF_RE.test(ref) && !ref.includes("..");
}

export function channelPath(ref: string): string {
  return `/posttube/channel/${encodeURIComponent(ref)}`;
}

export function channelFeedPath(ref: string, category = ""): string {
  const c = feedCategory(category);
  return `${channelPath(ref)}/feed.xml${c ? `?category=${c}` : ""}`;
}

/** `origin` without a path ("https://cleestudio.com"); "" gives the bare path. */
export function channelFeedUrl(origin: string, ref: string, category = ""): string {
  return `${origin.replace(/\/+$/, "")}${channelFeedPath(ref, category)}`;
}
