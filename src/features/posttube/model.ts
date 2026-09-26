import { formatCount, mediaHref } from "@/features/reels/model";
import type { PostTubeVideo } from "./types";

/*
  Pure helpers for the PostTube (long video) app. Nothing here touches the
  network or the DOM, so the wire-shape normalisers, the series walker, the
  autoplay countdown and the feed query builder are all pinned by unit tests
  rather than discovered in the browser.
*/

/* ── Watch progress ─────────────────────────────────────── */

/** The row `/v1/videos/continue-watching`, `/v1/videos/history` and `/v1/videos/:id/progress` return. */
export interface WatchProgressRow {
  user_id?: string;
  post_id: string;
  position_ms?: number | null;
  duration_ms?: number | null;
  percent_watched?: number | null;
  completed?: boolean | null;
  last_watched_at?: string | null;
  post?: HydratedPostRow | null;
}

export interface WatchProgress {
  postId: string;
  positionMs: number;
  durationMs: number;
  /** 0..100 */
  percent: number;
  completed: boolean;
  lastWatchedAt: string;
  post: HydratedPostRow | null;
}

/** A row counts as finished at 90% — the same bar the server applies. */
export const COMPLETED_PERCENT = 90;
/** Resume is skipped from 95% on: the viewer effectively finished it. */
export const RESUME_CUTOFF_PERCENT = 95;
export const PROGRESS_SAVE_INTERVAL_MS = 10_000;

export function progressPercent(positionMs: number, durationMs: number): number {
  if (!(durationMs > 0)) return 0;
  return Math.max(0, Math.min(100, (positionMs / durationMs) * 100));
}

export function normalizeProgressRow(row: WatchProgressRow): WatchProgress {
  const positionMs = Math.max(0, Math.round(row.position_ms ?? 0));
  const durationMs = Math.max(0, Math.round(row.duration_ms ?? 0));
  const percent =
    typeof row.percent_watched === "number" && Number.isFinite(row.percent_watched) && row.percent_watched > 0
      ? Math.max(0, Math.min(100, row.percent_watched))
      : progressPercent(positionMs, durationMs);
  return {
    postId: row.post_id,
    positionMs,
    durationMs,
    percent,
    completed: row.completed === true || percent >= COMPLETED_PERCENT,
    lastWatchedAt: row.last_watched_at ?? "",
    post: row.post ?? null,
  };
}

export function normalizeProgressRows(rows: WatchProgressRow[] | null | undefined): WatchProgress[] {
  return (rows ?? []).filter((r) => !!r && typeof r.post_id === "string").map(normalizeProgressRow);
}

/** Where playback starts: the saved position, unless the viewer was (nearly) done. */
export function resumePositionMs(progress: WatchProgress | null | undefined): number {
  if (!progress) return 0;
  if (progress.completed || progress.percent >= RESUME_CUTOFF_PERCENT) return 0;
  return progress.positionMs;
}

/* ── Series ─────────────────────────────────────────────── */

export interface SeriesEpisode {
  post_id: string;
  episode_num: number;
  title?: string | null;
  cover_media_id?: string | null;
  thumbnail_url?: string | null;
  duration_ms?: number | null;
}

export interface SeriesInfo {
  series: { id: string; title?: string | null; description?: string | null; episode_count?: number | null } | null;
  episodes: SeriesEpisode[];
  current: { episode_num: number } | null;
  next: { post_id: string; episode_num: number } | null;
  prev: { post_id: string; episode_num: number } | null;
}

/** The next episode after `currentNum`, tolerating gaps (`[1,2,4]` → after 2 comes 4). */
export function nextEpisode(episodes: SeriesEpisode[], currentNum: number): SeriesEpisode | null {
  let best: SeriesEpisode | null = null;
  for (const ep of episodes) {
    if (ep.episode_num <= currentNum) continue;
    if (!best || ep.episode_num < best.episode_num) best = ep;
  }
  return best;
}

export function prevEpisode(episodes: SeriesEpisode[], currentNum: number): SeriesEpisode | null {
  let best: SeriesEpisode | null = null;
  for (const ep of episodes) {
    if (ep.episode_num >= currentNum) continue;
    if (!best || ep.episode_num > best.episode_num) best = ep;
  }
  return best;
}

/** Fills `next`/`prev` from the episode list when the server left them out. */
export function normalizeSeries(raw: Partial<SeriesInfo> | null | undefined): SeriesInfo | null {
  if (!raw) return null;
  const episodes = (raw.episodes ?? [])
    .filter((e): e is SeriesEpisode => !!e && typeof e.post_id === "string" && typeof e.episode_num === "number")
    .slice()
    .sort((a, b) => a.episode_num - b.episode_num);
  if (episodes.length === 0 && !raw.series) return null;
  const currentNum = raw.current?.episode_num;
  const next =
    raw.next ??
    (typeof currentNum === "number"
      ? (() => {
          const ep = nextEpisode(episodes, currentNum);
          return ep ? { post_id: ep.post_id, episode_num: ep.episode_num } : null;
        })()
      : null);
  const prev =
    raw.prev ??
    (typeof currentNum === "number"
      ? (() => {
          const ep = prevEpisode(episodes, currentNum);
          return ep ? { post_id: ep.post_id, episode_num: ep.episode_num } : null;
        })()
      : null);
  return {
    series: raw.series ?? null,
    episodes,
    current: raw.current ?? null,
    next: next ?? null,
    prev: prev ?? null,
  };
}

/* ── Autoplay-next countdown ────────────────────────────── */

export const AUTOPLAY_NEXT_KEY = "posttube_autoplay_next_v1";
export const AUTOPLAY_COUNTDOWN_SECONDS = 10;

export interface AutoplayState {
  status: "idle" | "counting" | "cancelled" | "fired";
  remaining: number;
}

export type AutoplayAction =
  | { type: "start"; seconds?: number }
  | { type: "tick" }
  | { type: "cancel" }
  | { type: "playNow" }
  | { type: "reset" };

export const AUTOPLAY_IDLE: AutoplayState = { status: "idle", remaining: AUTOPLAY_COUNTDOWN_SECONDS };

/**
  10 → 0 then fires. Cancel is sticky: once the viewer says no, a later
  `start` (a second `ended` event, a re-render) does not restart the clock —
  only `reset`, which the watch page sends when the video changes.
*/
export function autoplayReducer(state: AutoplayState, action: AutoplayAction): AutoplayState {
  switch (action.type) {
    case "start": {
      if (state.status === "cancelled" || state.status === "fired") return state;
      if (state.status === "counting") return state;
      return { status: "counting", remaining: action.seconds ?? AUTOPLAY_COUNTDOWN_SECONDS };
    }
    case "tick": {
      if (state.status !== "counting") return state;
      const remaining = state.remaining - 1;
      if (remaining <= 0) return { status: "fired", remaining: 0 };
      return { status: "counting", remaining };
    }
    case "cancel":
      return { status: "cancelled", remaining: state.remaining };
    case "playNow":
      return { status: "fired", remaining: 0 };
    case "reset":
      return { ...AUTOPLAY_IDLE };
    default:
      return state;
  }
}

export function readAutoplayNextPref(storage: Pick<Storage, "getItem"> | null | undefined): boolean {
  if (!storage) return true;
  try {
    const raw = storage.getItem(AUTOPLAY_NEXT_KEY);
    if (raw === null || raw === undefined) return true;
    return raw !== "0" && raw !== "false";
  } catch {
    return true;
  }
}

export function writeAutoplayNextPref(storage: Pick<Storage, "setItem"> | null | undefined, on: boolean): void {
  if (!storage) return;
  try {
    storage.setItem(AUTOPLAY_NEXT_KEY, on ? "1" : "0");
  } catch {
    /* private mode / quota */
  }
}

/* ── Player prefs (quality, speed, captions) ────────────── */

export const TUBE_PREFS_KEY = "posttube_player_prefs_v1";
export const TUBE_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type TubeSpeed = (typeof TUBE_SPEEDS)[number];

export interface TubePlayerPrefs {
  speed: TubeSpeed;
  /** "auto" | "360p" | "720p" | … */
  quality: string;
  captions: boolean;
  volume: number;
  muted: boolean;
}

export const DEFAULT_TUBE_PREFS: TubePlayerPrefs = {
  speed: 1,
  quality: "auto",
  captions: false,
  volume: 1,
  muted: false,
};

export function parseTubePrefs(raw: string | null | undefined): TubePlayerPrefs {
  if (!raw) return { ...DEFAULT_TUBE_PREFS };
  try {
    const obj = JSON.parse(raw) as Partial<TubePlayerPrefs> | null;
    if (!obj || typeof obj !== "object") return { ...DEFAULT_TUBE_PREFS };
    return {
      speed: (TUBE_SPEEDS as readonly number[]).includes(obj.speed as number) ? (obj.speed as TubeSpeed) : 1,
      quality: typeof obj.quality === "string" && /^(auto|\d{3,4}p)$/.test(obj.quality) ? obj.quality : "auto",
      captions: typeof obj.captions === "boolean" ? obj.captions : false,
      volume: typeof obj.volume === "number" && obj.volume >= 0 && obj.volume <= 1 ? obj.volume : 1,
      muted: typeof obj.muted === "boolean" ? obj.muted : false,
    };
  } catch {
    return { ...DEFAULT_TUBE_PREFS };
  }
}

/* ── Feed query ─────────────────────────────────────────── */

export const CHIP_ALL = "all";
export const CHIP_SUBSCRIPTIONS = "subscriptions";

export interface VideoFeedQueryInput {
  /** "all" | "subscriptions" | a category slug */
  chip?: string | null;
  cursor?: string | null;
  limit?: number;
}

/**
  Query for `/v1/feed/videos`. "Subscriptions" is `subscribed_only=true`
  and nothing else; a category chip is `category=<slug>`. The two never
  combine, and `following_only` (the social feed's flag) is never sent.
*/
export function buildVideoFeedQuery(input: VideoFeedQueryInput): Record<string, string> {
  const params: Record<string, string> = { limit: String(input.limit ?? 20) };
  if (input.cursor) params.cursor = input.cursor;
  const chip = (input.chip ?? CHIP_ALL).trim();
  if (chip === CHIP_SUBSCRIPTIONS) {
    params.subscribed_only = "true";
  } else if (chip && chip !== CHIP_ALL) {
    params.category = chip;
  }
  return params;
}

/* ── Categories ─────────────────────────────────────────── */

export interface VideoCategory {
  slug: string;
  label: string;
}

/** `/v1/posts/categories` → chips. Accepts strings or objects; drops what has no slug. */
export function normalizeCategories(raw: unknown): VideoCategory[] {
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { categories?: unknown[] }).categories)
      ? ((raw as { categories: unknown[] }).categories)
      : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown[] }).items)
        ? ((raw as { items: unknown[] }).items)
        : [];
  const out: VideoCategory[] = [];
  const seen = new Set<string>();
  for (const entry of list) {
    let slug = "";
    let label = "";
    if (typeof entry === "string") {
      slug = entry;
    } else if (entry && typeof entry === "object") {
      const o = entry as Record<string, unknown>;
      slug = String(o.slug ?? o.key ?? o.id ?? o.value ?? "");
      label = String(o.name ?? o.label ?? o.title ?? o.display_name ?? "");
    }
    slug = slug.trim();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, label: label.trim() || titleCase(slug) });
  }
  return out;
}

function titleCase(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/* ── Row mappers ────────────────────────────────────────── */

/** The subset of a feed-service HydratedPost / posts-service PostDetail that the app reads. */
export interface HydratedPostRow {
  id: string;
  author_id: string;
  text?: string | null;
  title?: string | null;
  content_type?: string | null;
  created_at?: string | null;
  cover_media_id?: string | null;
  media?: { media_id: string; kind: string; duration_ms?: number | null; hls_url?: string | null; playback_url?: string | null; playback_kind?: string | null }[] | null;
  counts?: { likes?: number; comments?: number; shares?: number } | null;
  view_count?: number | null;
  viewer_reaction?: string | null;
  has_reacted?: boolean;
  is_bookmarked?: boolean;
  hashtags?: string[] | null;
  author?: { id?: string; display_name?: string; username?: string; avatar_media_id?: string | null; avatar_url?: string | null } | null;
  channel?: { user_id?: string; name?: string; handle?: string; avatar_url?: string | null; subscriber_count?: number; is_subscribed?: boolean } | null;
  video_metadata?: {
    duration_seconds?: number;
    effective_duration_seconds?: number;
    width?: number;
    height?: number;
    orientation?: string;
    thumbnail_url?: string;
    playback_url?: string;
    upload_status?: string;
    final_category?: string;
    computed_category?: string;
    media_asset_id?: string;
  } | null;
}

export interface AuthorInfo {
  channelId?: string;
  channelHandle?: string;
  name: string;
  avatarUrl: string;
  subscriberCount: number;
  isSubscribed?: boolean;
}

export function fallbackAvatar(seed: string): string {
  return `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(seed)}`;
}

/** Author/channel info embedded in a hydrated row, or null when the row has none. */
export function embeddedAuthor(row: HydratedPostRow): AuthorInfo | null {
  const a = row.author;
  const c = row.channel;
  if (!a && !c) return null;
  const name = c?.name?.trim() || a?.display_name?.trim() || a?.username?.trim() || "";
  if (!name) return null;
  const avatar = c?.avatar_url
    ? mediaHref(c.avatar_url)
    : a?.avatar_url
      ? mediaHref(a.avatar_url)
      : a?.avatar_media_id
        ? mediaHref(`/v1/media/${a.avatar_media_id}/serve`)
        : fallbackAvatar(row.author_id);
  return {
    channelId: c?.user_id || a?.id || row.author_id,
    channelHandle: c?.handle || a?.username || undefined,
    name,
    avatarUrl: avatar,
    subscriberCount: c?.subscriber_count ?? 0,
    isSubscribed: c?.is_subscribed,
  };
}

export function firstLine(text: string | null | undefined): string {
  return (text ?? "").split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? "";
}

/** HydratedPost / PostDetail → the card model. Pure; author enrichment is optional. */
export function rowToVideo(row: HydratedPostRow, author?: AuthorInfo | null): PostTubeVideo {
  const media = row.media ?? [];
  const videoMedia = media.find((m) => m && m.kind === "video");
  const imageMedia = media.find((m) => m && m.kind === "image");
  const thumbnailId = row.cover_media_id || imageMedia?.media_id;
  const vm = row.video_metadata ?? undefined;
  const durationSeconds = vm?.duration_seconds ?? (videoMedia?.duration_ms ? videoMedia.duration_ms / 1000 : 0);
  const effectiveDuration = vm?.effective_duration_seconds ?? durationSeconds;
  const info = author ?? embeddedAuthor(row);
  const title = row.title?.trim() || firstLine(row.text) || "Untitled";
  return {
    id: row.id,
    author_id: row.author_id,
    title,
    description: row.text ?? "",
    video_url: vm?.playback_url || (videoMedia ? mediaHref(`/v1/media/${videoMedia.media_id}/serve`) : ""),
    thumbnail_url: vm?.thumbnail_url || (thumbnailId ? mediaHref(`/v1/media/${thumbnailId}/serve`) : ""),
    content_type: vm?.final_category || vm?.computed_category || row.content_type || undefined,
    channel_id: info?.channelId || row.author_id,
    subscription_channel_id: info?.channelId || row.author_id,
    channel_handle: info?.channelHandle,
    channel_name: info?.name || row.author_id.slice(0, 8),
    channel_avatar_url: info?.avatarUrl || fallbackAvatar(row.author_id),
    channel_subscriber_count: info?.subscriberCount ?? 0,
    view_count: row.view_count ?? 0,
    like_count: row.counts?.likes ?? 0,
    dislike_count: 0,
    comment_count: row.counts?.comments ?? 0,
    share_count: row.counts?.shares ?? 0,
    hashtags: row.hashtags ?? [],
    published_at: row.created_at ?? "",
    duration_seconds: effectiveDuration || durationSeconds || 0,
    viewer_has_liked: row.has_reacted === true || !!row.viewer_reaction,
    viewer_has_disliked: false,
    viewer_has_saved: row.is_bookmarked === true,
    viewer_has_subscribed: info?.isSubscribed === true,
  };
}

/** `/v1/feed/videos/:id/related` rows → cards, dropping the video itself and duplicates. */
export function mapRelatedRows(rows: HydratedPostRow[] | null | undefined, currentId: string): PostTubeVideo[] {
  const out: PostTubeVideo[] = [];
  const seen = new Set<string>([currentId]);
  for (const row of rows ?? []) {
    if (!row || typeof row.id !== "string" || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(rowToVideo(row));
  }
  return out;
}

/** `/v1/posts/trending?content_type=long_video` → `{ data: { items, next_cursor } }`. */
export interface TrendingEnvelope {
  items?: HydratedPostRow[] | null;
  next_cursor?: string | null;
}

export function mapTrendingRows(data: TrendingEnvelope | HydratedPostRow[] | null | undefined): PostTubeVideo[] {
  const rows = Array.isArray(data) ? data : data?.items ?? [];
  const out: PostTubeVideo[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row.id !== "string" || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(rowToVideo(row));
  }
  return out;
}

/** Continue-watching rows carry the post; those without one are dropped. */
export function progressToVideo(progress: WatchProgress): PostTubeVideo | null {
  if (!progress.post) return null;
  return {
    ...rowToVideo(progress.post),
    resume_position_ms: progress.positionMs,
    resume_duration_ms: progress.durationMs,
    resume_percent_watched: progress.percent,
    last_watched_at: progress.lastWatchedAt,
  };
}

/* ── Display helpers ────────────────────────────────────── */

export { formatCount };

export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "";
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatClockMs(ms: number): string {
  return formatDuration(ms / 1000) || "0:00";
}

export function timeAgo(dateStr: string | null | undefined, now = Date.now()): string {
  if (!dateStr) return "";
  const then = new Date(dateStr).getTime();
  if (!Number.isFinite(then)) return "";
  const s = Math.max(0, Math.floor((now - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function hlsMasterUrl(mediaId: string): string {
  return mediaHref(`/v1/media/${mediaId}/hls/master.m3u8`);
}

export function subtitleTrackUrl(mediaId: string, lang: string): string {
  return mediaHref(`/v1/subtitles/${mediaId}/track/${encodeURIComponent(lang)}.vtt`);
}

export function mediaServeUrl(mediaId: string): string {
  return mediaHref(`/v1/media/${mediaId}/serve`);
}
