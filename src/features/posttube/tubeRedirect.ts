/*
  `/tube/*` → `/posttube/*`.

  The notification deep link stays `/tube/watch/{id}` because Android parses
  it; on the web the whole `/tube` prefix is an alias of `/posttube`, query
  included, so a push opens the watch page and any older `/tube/…` link a
  viewer kept still lands. Pure, so the mapping is unit-tested; the page at
  app/tube/[[...path]] only calls redirect() with the result.
*/

export const TUBE_ALIAS_PREFIX = "/tube";
export const TUBE_TARGET_PREFIX = "/posttube";

/** What Next hands an optional catch-all page: `undefined` for the bare route. */
export type TubePathSegments = readonly string[] | undefined | null;

/** What Next hands a page as `searchParams`, or an already-built query string. */
export type TubeSearch =
  | string
  | URLSearchParams
  | Readonly<Record<string, string | readonly string[] | undefined>>
  | null
  | undefined;

/** Encodes one path segment; a segment that is already encoded is left as is. */
function cleanSegment(segment: string): string {
  const trimmed = segment.trim();
  if (!trimmed) return "";
  try {
    return encodeURIComponent(decodeURIComponent(trimmed));
  } catch {
    return encodeURIComponent(trimmed);
  }
}

/** The query string with its "?", or "" when there is nothing to carry. */
export function tubeQueryString(search: TubeSearch): string {
  if (!search) return "";
  if (typeof search === "string") {
    const bare = search.startsWith("?") ? search.slice(1) : search;
    return bare ? `?${bare}` : "";
  }
  const params = new URLSearchParams();
  if (search instanceof URLSearchParams) {
    search.forEach((value, key) => params.append(key, value));
  } else {
    for (const [key, value] of Object.entries(search)) {
      if (value === undefined) continue;
      if (typeof value === "string") params.append(key, value);
      else for (const v of value) params.append(key, v);
    }
  }
  const out = params.toString();
  return out ? `?${out}` : "";
}

/**
 * `/tube/watch/abc?t=30` → `/posttube/watch/abc?t=30`; `/tube` → `/posttube`.
 * Empty segments are dropped, so `/tube//watch/` still maps cleanly.
 */
export function tubeRedirectTarget(path: TubePathSegments, search?: TubeSearch): string {
  const segments = (path ?? []).map(cleanSegment).filter(Boolean);
  const pathname = segments.length ? `${TUBE_TARGET_PREFIX}/${segments.join("/")}` : TUBE_TARGET_PREFIX;
  return `${pathname}${tubeQueryString(search)}`;
}

/** The same mapping from a full pathname, for a middleware or a link rewrite. */
export function tubePathnameToPosttube(pathname: string): string | null {
  if (pathname !== TUBE_ALIAS_PREFIX && !pathname.startsWith(`${TUBE_ALIAS_PREFIX}/`)) return null;
  const [rawPath, query] = pathname.split("?");
  const rest = rawPath.slice(TUBE_ALIAS_PREFIX.length);
  return tubeRedirectTarget(rest.split("/"), query);
}
