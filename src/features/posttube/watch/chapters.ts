/*
  Chapters on the watch page: the post detail's `chapters: [{start_ms, title}]`
  (saved by the creator or derived by the server from description
  timestamps). Pure: the strip, the seek-bar ticks and the current-chapter
  highlight all read these.
*/

export interface Chapter {
  startMs: number;
  title: string;
}

/** `chapters[]` from the post detail → sorted, de-duplicated, never negative. Anything unshaped is dropped. */
export function normalizeChapters(raw: unknown): Chapter[] {
  if (!Array.isArray(raw)) return [];
  const out: Chapter[] = [];
  const seen = new Set<number>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const start = typeof o.start_ms === "number" ? o.start_ms : typeof o.startMs === "number" ? o.startMs : NaN;
    if (!Number.isFinite(start) || start < 0) continue;
    const ms = Math.round(start);
    if (seen.has(ms)) continue;
    seen.add(ms);
    const title = typeof o.title === "string" ? o.title.trim() : "";
    out.push({ startMs: ms, title: title || formatChapterClock(ms) });
  }
  return out.sort((a, b) => a.startMs - b.startMs);
}

/** The index of the chapter playing at `ms`: -1 before the first one. */
export function chapterIndexAt(chapters: Chapter[], ms: number): number {
  if (!Number.isFinite(ms)) return -1;
  let at = -1;
  for (let i = 0; i < chapters.length; i += 1) {
    if (chapters[i].startMs <= ms) at = i;
    else break;
  }
  return at;
}

/** The chapter playing at `ms`, or null before the first one / with no chapters. */
export function chapterAt(chapters: Chapter[], ms: number): Chapter | null {
  const i = chapterIndexAt(chapters, ms);
  return i === -1 ? null : chapters[i];
}

/** Where each chapter starts on the seek bar (0–100), skipping the one at 0 and anything past the end. */
export function chapterTicks(chapters: Chapter[], durationMs: number): { pct: number; title: string; startMs: number }[] {
  if (!(durationMs > 0)) return [];
  return chapters
    .filter((c) => c.startMs > 0 && c.startMs < durationMs)
    .map((c) => ({ pct: (c.startMs / durationMs) * 100, title: c.title, startMs: c.startMs }));
}

export function formatChapterClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
