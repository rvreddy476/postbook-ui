/*
  The seek-preview storyboard: media-service serves `storyboard_vtt` (cues
  that point at `storyboard.jpg#xywh=x,y,160,90`, RELATIVE — the sibling
  image is unsigned) and `storyboard_jpg` (one 1600×900 sheet of 10×10
  tiles). The VTT is parsed here and every cue's image is rewritten to the
  signed `storyboard_jpg` route before the xywh is used. Pure.
*/

export interface StoryboardCue {
  /** ms */
  start: number;
  /** ms */
  end: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** The sheet this tile lives on, already rewritten to the served route. */
  image: string;
}

const TIMESTAMP = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/;

/** "00:01:02.500" or "01:02.500" → ms; null for anything else. */
export function parseVttTimestamp(text: string): number | null {
  const m = TIMESTAMP.exec(text.trim());
  if (!m) return null;
  const h = m[1] ? Number(m[1]) : 0;
  const min = Number(m[2]);
  const s = Number(m[3]);
  const frac = m[4] ? Number(m[4].padEnd(3, "0")) : 0;
  if (![h, min, s, frac].every(Number.isFinite)) return null;
  return ((h * 60 + min) * 60 + s) * 1000 + frac;
}

/**
 * VTT text → cues. `resolveImage` maps the cue's image reference (as
 * written, e.g. `storyboard.jpg`) to the URL to draw from; the default
 * keeps it as is. Cues with no `xywh`, a bad range or a bad timestamp are
 * skipped rather than failing the whole sheet.
 */
export function parseStoryboardVtt(text: string, resolveImage: (ref: string) => string = (ref) => ref): StoryboardCue[] {
  if (typeof text !== "string" || !text.trim().startsWith("WEBVTT")) return [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const cues: StoryboardCue[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.includes("-->")) continue;
    const [from, to] = line.split("-->").map((p) => p.trim().split(/\s+/)[0] ?? "");
    const start = parseVttTimestamp(from);
    const end = parseVttTimestamp(to);
    if (start === null || end === null || end <= start) continue;
    // The payload is the next non-empty line.
    let payload = "";
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j].trim() === "") break;
      payload = lines[j].trim();
      i = j;
      break;
    }
    const hash = payload.indexOf("#xywh=");
    if (hash === -1) continue;
    const ref = payload.slice(0, hash);
    const parts = payload.slice(hash + 6).split(",").map((n) => Number(n));
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0) || parts[2] <= 0 || parts[3] <= 0) continue;
    cues.push({ start, end, x: parts[0], y: parts[1], w: parts[2], h: parts[3], image: resolveImage(ref) });
  }
  return cues.sort((a, b) => a.start - b.start);
}

/** The cue covering `ms` (the last one whose start ≤ ms, if ms is inside it), or null. */
export function storyboardCueAt(cues: StoryboardCue[], ms: number): StoryboardCue | null {
  if (!Number.isFinite(ms) || cues.length === 0) return null;
  let lo = 0;
  let hi = cues.length - 1;
  let hit = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= ms) {
      hit = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (hit === -1) return null;
  const cue = cues[hit];
  return ms < cue.end ? cue : null;
}
