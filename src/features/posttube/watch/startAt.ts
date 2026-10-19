/*
  "Copy link at current time" (the player's Settings → More, after RUTUBE):
  the watch URL with `?t=<whole seconds>`, and the route reading it back.
  Pure, so both directions are pinned by tests.
*/

/** The watch URL that starts at [seconds]; under a second is the plain URL. */
export function watchLinkAt(watchUrl: string, seconds: number): string {
  const at = Math.floor(seconds);
  if (!Number.isFinite(at) || at < 1) return watchUrl;
  const url = new URL(watchUrl);
  url.searchParams.set("t", String(at));
  return url.toString();
}

/** `?t=` back to seconds: whole, positive, at most 24 hours; anything else is null. */
export function parseStartSeconds(t: string | string[] | undefined): number | null {
  const raw = Array.isArray(t) ? t[0] : t;
  if (!raw || !/^\d{1,6}$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 && n <= 86_400 ? n : null;
}
