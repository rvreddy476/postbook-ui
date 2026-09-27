/*
  The description behind "More": URLs become links, #hashtags go to
  /hashtag/<tag>, and timestamps (0:45, 12:30, 1:02:03) seek the player.
  Pure: text → segments; the component draws them.
*/

export type DescriptionSegment =
  | { kind: "text"; text: string }
  | { kind: "url"; text: string; href: string }
  | { kind: "hashtag"; text: string; tag: string }
  | { kind: "timestamp"; text: string; ms: number };

const TOKEN = /(https?:\/\/[^\s<>"']+)|(#[\p{L}\p{N}_]{1,64})|(?<![\d:])((?:\d{1,2}:)?\d{1,2}:\d{2})(?![\d:])/gu;

export function timestampToMs(text: string): number | null {
  const parts = text.split(":").map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 3) return ((parts[0] * 60 + parts[1]) * 60 + parts[2]) * 1000;
  return null;
}

export function descriptionSegments(text: string | null | undefined): DescriptionSegment[] {
  const src = text ?? "";
  const out: DescriptionSegment[] = [];
  let last = 0;
  for (const m of src.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: "text", text: src.slice(last, at) });
    const [whole, url, hashtag, ts] = m;
    if (url) {
      // Trailing punctuation is prose, not the link.
      const trimmed = url.replace(/[.,;:!?)]+$/, "");
      out.push({ kind: "url", text: trimmed, href: trimmed });
      const rest = url.slice(trimmed.length);
      if (rest) out.push({ kind: "text", text: rest });
    } else if (hashtag) {
      out.push({ kind: "hashtag", text: hashtag, tag: hashtag.slice(1) });
    } else if (ts) {
      const ms = timestampToMs(ts);
      if (ms === null) out.push({ kind: "text", text: whole });
      else out.push({ kind: "timestamp", text: ts, ms });
    }
    last = at + whole.length;
  }
  if (last < src.length) out.push({ kind: "text", text: src.slice(last) });
  return out;
}

/** "More" is offered when the text runs past three lines or 220 characters. */
export function descriptionNeedsMore(text: string | null | undefined): boolean {
  const t = text ?? "";
  return t.split(/\r?\n/).length > 3 || t.length > 220;
}
