import type { HubFlag, HubLibraryRow, HubVisibility } from "./hubApi";

/*
  Pure helpers for the Creator Hub: the SVG path builders behind the
  sparklines, the day chart and the retention curve; the library table's
  filter and sort; the small formatters. No network, no DOM — the tests
  pin every one of them.
*/

/* ── SVG path builders ──────────────────────────────────── */

export interface PathBox {
  width: number;
  height: number;
  /** Inner padding, in px, kept clear at the top and bottom. */
  pad?: number;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
  A polyline through `values` spread evenly across `width`, scaled to
  `height`. Empty → "". One point → a flat line across. `max` can be
  pinned (the retention curve is always 0..100) or derived.
*/
export function sparklinePath(values: number[], box: PathBox, max?: number): string {
  const n = values.length;
  if (n === 0) return "";
  const pad = box.pad ?? 1;
  const top = Math.max(max ?? Math.max(...values), 0);
  const innerH = Math.max(box.height - pad * 2, 0);
  const y = (v: number) => round(box.height - pad - (top > 0 ? (Math.max(0, v) / top) * innerH : 0));
  if (n === 1) return `M0 ${y(values[0])} L${round(box.width)} ${y(values[0])}`;
  const step = box.width / (n - 1);
  return values.map((v, i) => `${i === 0 ? "M" : "L"}${round(i * step)} ${y(v)}`).join(" ");
}

/** The same line closed along the baseline, for a soft fill under it. */
export function sparklineArea(values: number[], box: PathBox, max?: number): string {
  const line = sparklinePath(values, box, max);
  if (!line) return "";
  const baseline = round(box.height - (box.pad ?? 1));
  return `${line} L${round(box.width)} ${baseline} L0 ${baseline} Z`;
}

/** Bar rects for the 48 h counter: `[x, y, w, h]` per value, gap `gap` px. */
export function barRects(values: number[], box: PathBox, gap = 1): [number, number, number, number][] {
  const n = values.length;
  if (n === 0) return [];
  const pad = box.pad ?? 0;
  const top = Math.max(...values, 0);
  const innerH = Math.max(box.height - pad * 2, 0);
  const w = Math.max((box.width - gap * (n - 1)) / n, 0.5);
  return values.map((v, i) => {
    const h = top > 0 ? (Math.max(0, v) / top) * innerH : 0;
    // A zero still gets a 1px tick so the axis reads as 48 slots.
    const drawn = Math.max(h, v > 0 ? 1 : 0.5);
    return [round(i * (w + gap)), round(box.height - pad - drawn), round(w), round(drawn)];
  });
}

/** Retention: 100 points on a 0..100 scale, always plotted against a fixed 100 max. */
export function retentionPath(points: number[], box: PathBox): string {
  const clamped = points.map((p) => Math.max(0, Math.min(100, p)));
  return sparklinePath(clamped, box, 100);
}

/** Evenly spaced x-axis label indexes: first, last and up to `count - 2` in between. */
export function axisTicks(length: number, count = 4): number[] {
  if (length <= 0) return [];
  if (length === 1 || count <= 1) return [0];
  const c = Math.min(count, length);
  const out = new Set<number>();
  for (let i = 0; i < c; i++) out.add(Math.round((i * (length - 1)) / (c - 1)));
  return [...out].sort((a, b) => a - b);
}

/* ── Library table: filter and sort ─────────────────────── */

export type LibrarySortKey = "published" | "views" | "comments" | "title";
export type SortDir = "asc" | "desc";

export interface LibraryFilter {
  visibility: HubVisibility | "all";
  title: string;
  flag?: HubFlag | "all";
}

export const LIBRARY_FILTER_DEFAULT: LibraryFilter = { visibility: "all", title: "", flag: "all" };

/** Case-insensitive title contains + visibility + optional flag; pure over the loaded pages. */
export function filterLibraryRows(rows: HubLibraryRow[], filter: LibraryFilter): HubLibraryRow[] {
  const needle = filter.title.trim().toLowerCase();
  return rows.filter((r) => {
    if (filter.visibility !== "all" && r.visibility !== filter.visibility) return false;
    if (filter.flag && filter.flag !== "all" && !r.flags.includes(filter.flag)) return false;
    if (needle && !r.title.toLowerCase().includes(needle) && !r.text.toLowerCase().includes(needle)) return false;
    return true;
  });
}

export function rowDate(r: HubLibraryRow): string {
  return r.published_at || r.scheduled_at || r.created_at || "";
}

function dateMs(s: string): number {
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

/** Stable sort; ties fall back to the row id so two renders agree. */
export function sortLibraryRows(rows: HubLibraryRow[], key: LibrarySortKey, dir: SortDir): HubLibraryRow[] {
  const sign = dir === "asc" ? 1 : -1;
  const cmp = (a: HubLibraryRow, b: HubLibraryRow): number => {
    switch (key) {
      case "views":
        return a.view_count - b.view_count;
      case "comments":
        return a.comment_count - b.comment_count;
      case "title":
        return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      case "published":
      default:
        return dateMs(rowDate(a)) - dateMs(rowDate(b));
    }
  };
  return rows
    .map((r, i) => ({ r, i }))
    .sort((x, y) => sign * cmp(x.r, y.r) || x.r.id.localeCompare(y.r.id) || x.i - y.i)
    .map((x) => x.r);
}

/** Dedupe across pages (a row can move between cursors) keeping first sight. */
export function dedupeRows(rows: HubLibraryRow[]): HubLibraryRow[] {
  const seen = new Set<string>();
  const out: HubLibraryRow[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

/** Live recordings: rows that say `source === "live"`. `null` when no loaded row carries `source` at all. */
export function liveRows(rows: HubLibraryRow[]): HubLibraryRow[] | null {
  if (!rows.some((r) => r.source !== null)) return null;
  return rows.filter((r) => r.source === "live");
}

/** Multi-select toggle that keeps the set immutable for React. */
export function toggleSelection(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/* ── Labels ─────────────────────────────────────────────── */

export const VISIBILITY_LABEL: Record<HubVisibility, string> = {
  public: "Public",
  unlisted: "Unlisted",
  private: "Private",
  scheduled: "Scheduled",
};

export const FLAG_LABEL: Record<HubFlag, string> = {
  processing_failed: "Processing failed",
  review_hold: "On hold",
  made_for_kids: "For kids",
  scheduled: "Scheduled",
};

/** Tone tokens the CSS maps to colours; never a hex here. */
export const FLAG_TONE: Record<HubFlag, "danger" | "warning" | "info" | "muted"> = {
  processing_failed: "danger",
  review_hold: "warning",
  made_for_kids: "info",
  scheduled: "muted",
};

export const PERIOD_LABEL: Record<"7d" | "28d" | "90d" | "365d", string> = {
  "7d": "7 days",
  "28d": "28 days",
  "90d": "90 days",
  "365d": "Year",
};

export const SURFACE_LABEL: Record<string, string> = {
  home: "Watch",
  feed: "Watch",
  watch: "Watch",
  related: "Up next",
  search: "Search",
  channel: "Channel",
  subscriptions: "Subscriptions",
  following: "Subscriptions",
  trending: "Trending",
  topic: "Topics",
  category: "Topics",
  external: "Outside links",
  notification: "Notifications",
  playlist: "Collections",
  reels: "Reels",
  other: "Other",
};

export function surfaceLabel(surface: string): string {
  return SURFACE_LABEL[surface.toLowerCase()] ?? surface.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/* ── Formatters ─────────────────────────────────────────── */

/** `1:02:03` / `4:05` from ms; the chapter editor and cards read and write this. */
export function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** `"1:02:03"`, `"4:05"`, `"65"` (seconds) → ms; null when it is not a time. */
export function parseClock(input: string): number | null {
  const t = input.trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(parseFloat(t) * 1000);
  const parts = t.split(":").map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d{1,2}(\.\d+)?$/.test(p))) return null;
  const nums = parts.map(parseFloat);
  const [h, m, s] = parts.length === 3 ? nums : [0, nums[0], nums[1]];
  if (m >= 60 || s >= 60) return null;
  return Math.round((h * 3600 + m * 60 + s) * 1000);
}

/** Watch time: `12h 5m`, `48m`, `30s`. */
export function formatWatchTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${total}s`;
}

/** `+12`, `-3`, `0`; null (not tracked) → an em dash. */
export function formatDelta(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (n > 0) return `+${n}`;
  return String(n);
}

export function formatDay(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** `datetime-local` value (local time, no seconds) from an ISO string, and back. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

/** Comma or space separated tags → unique, trimmed, without a leading `#`. */
export function splitTags(input: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input.split(/[,\n]+/)) {
    const t = raw.trim().replace(/^#/, "");
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Only the keys whose value differs from `base` — what the owner patch sends. */
export function diffPatch<T extends Record<string, unknown>>(base: T, next: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(next) as (keyof T)[]) {
    const a = base[key];
    const b = next[key];
    const same = Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((v, i) => v === b[i]) : a === b;
    if (!same) out[key] = b;
  }
  return out;
}
