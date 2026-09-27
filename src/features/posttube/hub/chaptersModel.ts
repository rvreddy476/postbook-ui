import { formatMs, parseClock } from "./hubModel";

/*
  Chapter rows as the editor holds them (a typed clock, a title), shared
  by the Creator Hub edit sheet and the upload studio. Pure: the tests pin
  every rule here.
*/

export interface ChapterDraft {
  key: number;
  clock: string;
  title: string;
}

/** A new row: the first one starts at 0:00, later ones start blank. */
export function newChapterRow(rows: readonly ChapterDraft[], key: number): ChapterDraft {
  return { key, clock: rows.length ? "" : "0:00", title: "" };
}

/** Saved chapters → editor rows. */
export function chapterRowsFrom(chapters: readonly { start_ms: number; title: string }[]): ChapterDraft[] {
  return chapters.map((c, i) => ({ key: i, clock: formatMs(c.start_ms), title: c.title }));
}

/** Every row has a time and a title (the hub's rule; the hub sorts on save). */
export function chapterRowsComplete(rows: readonly ChapterDraft[]): boolean {
  return rows.every((r) => parseClock(r.clock) !== null && r.title.trim() !== "");
}

/** Rows → the `{title, start_ms}` list the adapter posts, in the rows' order. */
export function chapterRowsToWire(rows: readonly ChapterDraft[]): { title: string; start_ms: number }[] {
  return rows.map((r) => ({ title: r.title.trim(), start_ms: parseClock(r.clock) ?? 0 }));
}

export interface ChapterIssue {
  /** The row's key, or null for a list-level issue. */
  key: number | null;
  message: string;
}

/**
 * The stricter rule for chapters written at upload: every row has a time
 * and a title, the first starts at 0:00, and each starts after the one
 * before it (strictly ascending, as typed — no silent re-sorting). When
 * the video's length is known, every start is inside it. An empty list is
 * valid (no chapters).
 */
export function validateChapterRows(rows: readonly ChapterDraft[], durationMs?: number | null): ChapterIssue[] {
  const issues: ChapterIssue[] = [];
  let prev = -1;
  rows.forEach((r, i) => {
    const n = i + 1;
    const start = parseClock(r.clock);
    if (start === null) {
      issues.push({ key: r.key, message: `Chapter ${n}: enter a start time like 1:30.` });
    } else {
      if (i === 0 && start !== 0) issues.push({ key: r.key, message: "The first chapter starts at 0:00." });
      if (i > 0 && prev >= 0 && start <= prev) issues.push({ key: r.key, message: `Chapter ${n} must start after chapter ${n - 1}.` });
      if (typeof durationMs === "number" && durationMs > 0 && start >= durationMs) issues.push({ key: r.key, message: `Chapter ${n} starts after the video ends.` });
      prev = start;
    }
    if (!r.title.trim()) issues.push({ key: r.key, message: `Chapter ${n} needs a title.` });
  });
  return issues;
}
