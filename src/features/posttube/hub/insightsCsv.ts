import type { HubCreatorInsights, InsightsPeriod } from "./hubApi";

/*
  Download CSV for Insights, built in the browser from the numbers already
  on screen (no endpoint). Pure functions; `downloadCsv` is the only part
  that touches the DOM.

  Every cell is escaped:
    - a text cell that starts with = + - @ (or a tab / carriage return) gets a
      leading apostrophe, so a spreadsheet shows it as text instead of
      running it as a formula (a video title is creator-controlled text);
    - a cell holding a quote, comma, CR or LF is wrapped in quotes, with
      inner quotes doubled (RFC 4180).
  Numbers are written as numbers (a negative count is still a number, not
  a formula).
*/

export type CsvValue = string | number | boolean | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  let s = typeof value === "boolean" ? (value ? "true" : "false") : String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Rows → CSV text, CRLF line ends (RFC 4180). */
export function toCsv(rows: CsvValue[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/** Minutes with one decimal (watch time reads better in a sheet than milliseconds). */
function minutes(ms: number): number {
  return Math.round((Math.max(0, ms) / 60_000) * 10) / 10;
}

/**
  The Insights page as one CSV: the period totals, views by day, the 48 h
  hourly series, and top content (titled when the library has the row).
  Blocks are separated by an empty line.
*/
export function insightsCsvRows(d: HubCreatorInsights, titles?: ReadonlyMap<string, string>): CsvValue[][] {
  const rows: CsvValue[][] = [
    ["Metric", "Value"],
    ["Period", d.period],
    ["Views", d.views],
    ["Likes", d.likes],
    ["Comments", d.comments],
    ["Shares", d.shares],
    ["Watch time (minutes)", minutes(d.watch_time_ms)],
    ["Unique viewers", d.unique_viewers],
    ["Followers (net change)", d.followers_delta === null ? "not tracked yet" : d.followers_delta],
    ["Follows from your videos", d.follows_from_content],
  ];
  if (d.views_by_day.length > 0) {
    rows.push([], ["Day", "Views"]);
    for (const p of d.views_by_day) rows.push([p.day, p.views]);
  }
  if (d.realtime.series_48h.length > 0) {
    rows.push([], ["Hours ago", "Views"]);
    const n = d.realtime.series_48h.length;
    d.realtime.series_48h.forEach((v, i) => rows.push([n - 1 - i, v]));
  }
  if (d.top_content.length > 0) {
    rows.push([], ["Rank", "Video", "Video ID", "Views", "Watch time (minutes)"]);
    d.top_content.forEach((t, i) => rows.push([i + 1, titles?.get(t.content_id) ?? "", t.content_id, t.views, minutes(t.watch_time_ms)]));
  }
  return rows;
}

export function insightsCsvFilename(period: InsightsPeriod, now: Date = new Date()): string {
  return `channel-insights-${period}-${now.toISOString().slice(0, 10)}.csv`;
}

/** Saves the text as a file. A UTF-8 byte-order mark keeps non-Latin titles readable in spreadsheet apps. */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
