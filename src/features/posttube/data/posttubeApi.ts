import api from "@/lib/api";
import type { PostDetail } from "@/types/profile";
import type { MediaSubtitleTrack, PostTubeVideo, VideoMetadataDTO, FeedPage } from "../types";
import {
  buildVideoFeedQuery,
  embeddedAuthor,
  fallbackAvatar,
  mapRelatedRows,
  mapTrendingRows,
  mediaServeUrl,
  normalizeCategories,
  normalizeProgressRow,
  normalizeProgressRows,
  normalizeSeries,
  progressToVideo,
  rowToVideo,
  type AuthorInfo,
  type HydratedPostRow,
  type SeriesInfo,
  type VideoCategory,
  type WatchProgress,
  type WatchProgressRow,
} from "../model";

/* ── Envelope ───────────────────────────────────────────── */

interface ApiResponse<T> {
  data: T;
  meta?: { next_cursor?: string | null };
}

function isNotFound(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 404;
}

/* ── Channel / author ───────────────────────────────────── */

/** `GET /v1/channels/:ref` — `ref` is a handle or a user id. */
export interface ChannelInfo {
  id?: string;
  user_id?: string;
  owner_id?: string;
  handle?: string;
  name: string;
  description?: string | null;
  avatar_url?: string | null;
  avatar_media_id?: string | null;
  banner_media_id?: string | null;
  banner_url?: string | null;
  subscriber_count: number;
  video_count?: number;
  is_subscribed?: boolean;
  notify_on?: "all" | "none" | string | null;
  is_verified?: boolean;
  created_at?: string;
}

export function channelUserId(c: ChannelInfo | null | undefined): string | undefined {
  return c?.user_id || c?.owner_id || c?.id || undefined;
}

export function channelAvatarUrl(c: ChannelInfo | null | undefined): string | undefined {
  if (!c) return undefined;
  if (c.avatar_url) return /^https?:\/\//i.test(c.avatar_url) ? c.avatar_url : `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}${c.avatar_url}`;
  if (c.avatar_media_id) return mediaServeUrl(c.avatar_media_id);
  return undefined;
}

export function channelBannerUrl(c: ChannelInfo | null | undefined): string | undefined {
  if (!c) return undefined;
  if (c.banner_url) return /^https?:\/\//i.test(c.banner_url) ? c.banner_url : `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}${c.banner_url}`;
  if (c.banner_media_id) return mediaServeUrl(c.banner_media_id);
  return undefined;
}

export async function getChannel(ref: string): Promise<ChannelInfo | null> {
  try {
    const res = await api.get<ApiResponse<ChannelInfo>>(`/v1/channels/${encodeURIComponent(ref)}`);
    return res.data.data ?? null;
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

/** `GET /v1/channels/me` — 404 NO_CHANNEL → null. */
export async function getMyChannel(): Promise<ChannelInfo | null> {
  try {
    const res = await api.get<ApiResponse<ChannelInfo>>("/v1/channels/me");
    return res.data.data ?? null;
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function updateMyChannel(
  patch: Partial<Pick<ChannelInfo, "name" | "handle" | "description" | "avatar_media_id" | "banner_media_id">>,
): Promise<ChannelInfo> {
  const res = await api.patch<ApiResponse<ChannelInfo>>("/v1/channels/me", patch);
  return res.data.data;
}

export interface ChannelSubscriptionState {
  subscribed: boolean;
  notify_on?: "all" | "none" | string | null;
  subscription?: { channel_id?: string; user_id?: string; notify_on?: string; subscribed_at?: string } | null;
}

export async function getChannelSubscription(ref: string): Promise<ChannelSubscriptionState> {
  try {
    const res = await api.get<ApiResponse<ChannelSubscriptionState & { is_subscribed?: boolean }>>(
      `/v1/channels/${encodeURIComponent(ref)}/subscription`,
    );
    const d = res.data.data ?? ({} as ChannelSubscriptionState & { is_subscribed?: boolean });
    return {
      subscribed: d.subscribed === true || d.is_subscribed === true,
      notify_on: d.notify_on ?? d.subscription?.notify_on ?? null,
      subscription: d.subscription ?? null,
    };
  } catch (err) {
    if (isNotFound(err)) return { subscribed: false, notify_on: null, subscription: null };
    throw err;
  }
}

export async function subscribeChannel(ref: string, notifyOn: "all" | "none" = "all"): Promise<void> {
  await api.post(`/v1/channels/${encodeURIComponent(ref)}/subscribe`, { notify_on: notifyOn });
}

export async function unsubscribeChannel(ref: string): Promise<void> {
  await api.delete(`/v1/channels/${encodeURIComponent(ref)}/subscribe`);
}

/** The bell. */
export async function setChannelNotify(ref: string, notifyOn: "all" | "none"): Promise<void> {
  await api.patch(`/v1/channels/${encodeURIComponent(ref)}/subscription`, { notify_on: notifyOn });
}

/** `GET /v1/channels/subscriptions` — the viewer's channels, hydrated. */
export interface MySubscriptionRow {
  channel: ChannelInfo;
  notify_on?: string | null;
  subscribed_at?: string | null;
}

export async function getMySubscriptions(params?: {
  limit?: number;
  cursor?: string;
}): Promise<{ items: MySubscriptionRow[]; next_cursor?: string }> {
  const res = await api.get<ApiResponse<MySubscriptionRow[]>>("/v1/channels/subscriptions", {
    params: { limit: String(params?.limit ?? 30), ...(params?.cursor ? { cursor: params.cursor } : {}) },
  });
  const rows = Array.isArray(res.data.data) ? res.data.data : [];
  return {
    items: rows.filter((r) => !!r && !!r.channel),
    next_cursor: res.data.meta?.next_cursor || undefined,
  };
}

// In-memory author cache so a page of cards resolves each author once.
const authorCache = new Map<string, AuthorInfo>();

/** Channel-first author lookup for rows the feed did not hydrate. */
export async function resolveAuthor(authorId: string): Promise<AuthorInfo> {
  const cached = authorCache.get(authorId);
  if (cached) return cached;
  const fallback: AuthorInfo = {
    channelId: authorId,
    name: authorId.slice(0, 8),
    avatarUrl: fallbackAvatar(authorId),
    subscriberCount: 0,
  };
  try {
    const channel = await getChannel(authorId).catch(() => null);
    if (channel) {
      const result: AuthorInfo = {
        channelId: channelUserId(channel) ?? authorId,
        channelHandle: channel.handle || undefined,
        name: channel.name || fallback.name,
        avatarUrl: channelAvatarUrl(channel) || fallback.avatarUrl,
        subscriberCount: channel.subscriber_count ?? 0,
        isSubscribed: channel.is_subscribed,
      };
      authorCache.set(authorId, result);
      return result;
    }
    const userRes = await api
      .get<ApiResponse<{ display_name?: string; avatar_media_id?: string; username?: string }>>(`/v1/users/${authorId}`)
      .catch(() => null);
    const user = userRes?.data?.data;
    const result: AuthorInfo = {
      channelId: authorId,
      channelHandle: user?.username || undefined,
      name: user?.display_name || user?.username || fallback.name,
      avatarUrl: user?.avatar_media_id ? mediaServeUrl(user.avatar_media_id) : fallback.avatarUrl,
      subscriberCount: 0,
    };
    authorCache.set(authorId, result);
    return result;
  } catch {
    return fallback;
  }
}

export function invalidateAuthorCache(authorId?: string): void {
  if (authorId) authorCache.delete(authorId);
  else authorCache.clear();
}

/** Kept for callers that still hold a PostDetail. */
export function postDetailToVideo(post: PostDetail, authorInfo?: AuthorInfo): PostTubeVideo {
  return rowToVideo(post as unknown as HydratedPostRow, authorInfo);
}

/** Rows with embedded author/channel are mapped directly; the rest resolve once per author. */
export async function hydrateRows(rows: HydratedPostRow[]): Promise<PostTubeVideo[]> {
  const missing = [...new Set(rows.filter((r) => !embeddedAuthor(r)).map((r) => r.author_id))];
  const resolved = new Map<string, AuthorInfo>();
  await Promise.all(
    missing.map(async (id) => {
      resolved.set(id, await resolveAuthor(id));
    }),
  );
  return rows.map((r) => rowToVideo(r, resolved.get(r.author_id) ?? null));
}

/* ── Posts ──────────────────────────────────────────────── */

export async function getPostDetail(postId: string): Promise<HydratedPostRow | null> {
  try {
    const res = await api.get<ApiResponse<HydratedPostRow>>(`/v1/posts/${postId}`);
    return res.data.data ?? null;
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function getVideoPost(postId: string): Promise<PostTubeVideo | null> {
  const row = await getPostDetail(postId);
  if (!row) return null;
  const [video] = await hydrateRows([row]);
  return video ?? null;
}

export async function getCategories(): Promise<VideoCategory[]> {
  try {
    const res = await api.get<ApiResponse<unknown>>("/v1/posts/categories");
    return normalizeCategories(res.data.data ?? res.data);
  } catch {
    return [];
  }
}

/* ── Feeds ──────────────────────────────────────────────── */

/** `GET /v1/feed/videos` with the chip translated to `category` / `subscribed_only`. */
export async function getLongVideosFeed(params?: { cursor?: string; limit?: number; chip?: string | null }): Promise<FeedPage> {
  try {
    const res = await api.get<ApiResponse<HydratedPostRow[]>>("/v1/feed/videos", {
      params: buildVideoFeedQuery({ chip: params?.chip, cursor: params?.cursor, limit: params?.limit ?? 20 }),
    });
    const rows = Array.isArray(res.data.data) ? res.data.data : [];
    return { items: await hydrateRows(rows), next_cursor: res.data.meta?.next_cursor || undefined };
  } catch {
    return { items: [] };
  }
}

/** `GET /v1/feed/watch` — the ranked watch feed (same rows). */
export async function getWatchFeed(params?: { cursor?: string; limit?: number }): Promise<FeedPage> {
  try {
    const res = await api.get<ApiResponse<HydratedPostRow[]>>("/v1/feed/watch", {
      params: { limit: String(params?.limit ?? 20), ...(params?.cursor ? { cursor: params.cursor } : {}) },
    });
    const rows = Array.isArray(res.data.data) ? res.data.data : [];
    return { items: await hydrateRows(rows), next_cursor: res.data.meta?.next_cursor || undefined };
  } catch {
    return { items: [] };
  }
}

/** `GET /v1/feed/flicks` — the reels shelf on the home page. */
export async function getFlicksFeed(params?: { cursor?: string; limit?: number }): Promise<FeedPage> {
  try {
    const res = await api.get<ApiResponse<HydratedPostRow[]>>("/v1/feed/flicks", {
      params: { limit: String(params?.limit ?? 20), ...(params?.cursor ? { cursor: params.cursor } : {}) },
    });
    const rows = Array.isArray(res.data.data) ? res.data.data : [];
    return { items: await hydrateRows(rows), next_cursor: res.data.meta?.next_cursor || undefined };
  } catch {
    return { items: [] };
  }
}

/** `GET /v1/feed/videos/:postId/related`. */
export async function getRelatedVideos(postId: string, params?: { cursor?: string; limit?: number }): Promise<FeedPage> {
  try {
    const res = await api.get<ApiResponse<HydratedPostRow[]>>(`/v1/feed/videos/${postId}/related`, {
      params: { limit: String(params?.limit ?? 16), ...(params?.cursor ? { cursor: params.cursor } : {}) },
    });
    return { items: mapRelatedRows(res.data.data, postId), next_cursor: res.data.meta?.next_cursor || undefined };
  } catch {
    return { items: [] };
  }
}

/** `GET /v1/posts/trending?content_type=long_video`. */
export async function getTrendingVideos(limit = 12): Promise<PostTubeVideo[]> {
  try {
    const res = await api.get<ApiResponse<{ items?: HydratedPostRow[]; next_cursor?: string | null }>>("/v1/posts/trending", {
      params: { content_type: "long_video", limit: String(limit) },
    });
    return mapTrendingRows(res.data.data);
  } catch {
    return [];
  }
}

/** `GET /v1/posts/by-author/:id?type=long_video` — `type` is an exact match. */
export async function getVideosByAuthor(
  authorId: string,
  params?: { cursor?: string; limit?: number; type?: string },
): Promise<FeedPage> {
  try {
    const res = await api.get<ApiResponse<HydratedPostRow[]>>(`/v1/posts/by-author/${authorId}`, {
      params: {
        type: params?.type ?? "long_video",
        limit: String(params?.limit ?? 20),
        ...(params?.cursor ? { cursor: params.cursor } : {}),
      },
    });
    const rows = Array.isArray(res.data.data) ? res.data.data : [];
    return { items: await hydrateRows(rows), next_cursor: res.data.meta?.next_cursor || undefined };
  } catch {
    return { items: [] };
  }
}

/* ── Legacy category feed (components/RightPanel reads "trending") ── */

export type FeedCategory = "trending" | "live" | "recommended" | "recent" | "subscriptions" | "popular";

/** Kept for `components/RightPanel`; everything under PostTube uses the dedicated calls above. */
export async function getCategoryFeed(category: FeedCategory, params?: { cursor?: string; limit?: number }): Promise<FeedPage> {
  if (category === "trending" || category === "popular") {
    return { items: await getTrendingVideos(params?.limit ?? 12) };
  }
  if (category === "subscriptions") {
    return getLongVideosFeed({ cursor: params?.cursor, limit: params?.limit, chip: "subscriptions" });
  }
  return getLongVideosFeed({ cursor: params?.cursor, limit: params?.limit });
}

/* ── Watch progress / history ───────────────────────────── */

export async function getContinueWatching(limit = 12): Promise<WatchProgress[]> {
  try {
    const res = await api.get<ApiResponse<WatchProgressRow[]>>("/v1/videos/continue-watching", { params: { limit: String(limit) } });
    return normalizeProgressRows(res.data.data);
  } catch {
    return [];
  }
}

/** Continue-watching rows that carry their post → cards with resume state. */
export async function getContinueWatchingVideos(limit = 12): Promise<PostTubeVideo[]> {
  const rows = await getContinueWatching(limit);
  const active = rows.filter((r) => !r.completed && r.positionMs > 0);
  const withPost = active.map(progressToVideo).filter((v): v is PostTubeVideo => v !== null);
  const missing = active.filter((r) => !r.post);
  const fetched =
    missing.length === 0
      ? []
      : await Promise.all(
          missing.map(async (p) => {
            const post = await getPostDetail(p.postId).catch(() => null);
            return post ? progressToVideo({ ...p, post }) : null;
          }),
        );
  const byId = new Map<string, PostTubeVideo>();
  for (const v of [...withPost, ...fetched]) if (v) byId.set(v.id, v);
  return active.map((p) => byId.get(p.postId)).filter((v): v is PostTubeVideo => !!v);
}

export async function getWatchHistory(params?: { cursor?: string; limit?: number }): Promise<{ items: WatchProgress[]; next_cursor?: string }> {
  const res = await api.get<ApiResponse<WatchProgressRow[]>>("/v1/videos/history", {
    params: { limit: String(params?.limit ?? 30), ...(params?.cursor ? { cursor: params.cursor } : {}) },
  });
  return { items: normalizeProgressRows(res.data.data), next_cursor: res.data.meta?.next_cursor || undefined };
}

export async function clearWatchHistory(): Promise<void> {
  await api.delete("/v1/videos/history");
}

export async function getWatchProgress(videoId: string): Promise<WatchProgress | null> {
  try {
    const res = await api.get<ApiResponse<WatchProgressRow | null>>(`/v1/videos/${videoId}/progress`);
    const row = res.data.data;
    if (!row || typeof row.post_id !== "string") return null;
    return normalizeProgressRow(row);
  } catch {
    return null;
  }
}

export async function saveVideoWatchProgress(
  videoId: string,
  params: { positionMs: number; durationMs: number; completed?: boolean },
): Promise<void> {
  await api.post(`/v1/videos/${videoId}/progress`, {
    position_ms: Math.max(0, Math.round(params.positionMs)),
    duration_ms: Math.max(0, Math.round(params.durationMs)),
    ...(typeof params.completed === "boolean" ? { completed: params.completed } : {}),
  });
}

export async function deleteVideoWatchProgress(videoId: string): Promise<void> {
  await api.delete(`/v1/videos/${videoId}/progress`);
}

/* ── Series ─────────────────────────────────────────────── */

/** `GET /v1/posts/:id/series` — 404 = not in a series. */
export async function getSeries(postId: string): Promise<SeriesInfo | null> {
  try {
    const res = await api.get<ApiResponse<Partial<SeriesInfo>>>(`/v1/posts/${postId}/series`);
    return normalizeSeries(res.data.data);
  } catch {
    return null;
  }
}

/* ── Engagement ─────────────────────────────────────────── */

export async function sharePost(postId: string): Promise<void> {
  await api.post(`/v1/posts/${postId}/share`, { share_type: "external" });
}

export async function sendFeedFeedback(body: { post_id?: string; author_id?: string; signal: "not_interested" | "interested" }): Promise<void> {
  await api.post("/v1/feed/feedback", body);
}

export async function blockUser(userId: string): Promise<void> {
  await api.post("/v1/graph/block", { user_id: userId });
}

/* ── Scheduled ──────────────────────────────────────────── */

export interface ScheduledPost extends HydratedPostRow {
  publish_at?: string | null;
  scheduled_at?: string | null;
  status?: string | null;
}

export async function getScheduledPosts(limit = 50): Promise<ScheduledPost[]> {
  const res = await api.get<ApiResponse<ScheduledPost[]>>("/v1/posts/me/scheduled", { params: { limit: String(limit) } });
  return Array.isArray(res.data.data) ? res.data.data : [];
}

/** No `publish_at` = publish now. */
export async function updateSchedule(postId: string, publishAt?: string): Promise<void> {
  await api.patch(`/v1/posts/${postId}/schedule`, publishAt ? { publish_at: publishAt } : {});
}

/* ── Playlists ──────────────────────────────────────────── */

export interface Playlist {
  id: string;
  creator_id: string;
  title: string;
  description?: string | null;
  visibility?: "public" | "private" | "unlisted" | string;
  is_public?: boolean;
  item_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PlaylistItem {
  playlist_id: string;
  post_id: string;
  position: number;
  added_at?: string;
  post?: HydratedPostRow | null;
}

export function playlistIsPublic(p: Playlist): boolean {
  if (p.visibility) return p.visibility === "public";
  return p.is_public !== false;
}

export async function getCreatorPlaylists(creatorId: string, params?: { limit?: number; offset?: number }): Promise<Playlist[]> {
  const res = await api.get<ApiResponse<Playlist[]>>(`/v1/creators/${creatorId}/playlists`, {
    params: { limit: String(params?.limit ?? 50), offset: String(params?.offset ?? 0) },
  });
  return Array.isArray(res.data.data) ? res.data.data : [];
}

export async function createPlaylist(input: {
  title: string;
  description?: string;
  visibility: "public" | "private" | "unlisted";
}): Promise<Playlist> {
  const res = await api.post<ApiResponse<Playlist>>("/v1/playlists", input);
  return res.data.data;
}

export async function getPlaylist(id: string): Promise<Playlist | null> {
  try {
    const res = await api.get<ApiResponse<Playlist>>(`/v1/playlists/${id}`);
    return res.data.data ?? null;
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function updatePlaylist(id: string, patch: Partial<Pick<Playlist, "title" | "description" | "visibility">>): Promise<Playlist> {
  const res = await api.patch<ApiResponse<Playlist>>(`/v1/playlists/${id}`, patch);
  return res.data.data;
}

export async function deletePlaylist(id: string): Promise<void> {
  await api.delete(`/v1/playlists/${id}`);
}

export async function getPlaylistItems(id: string): Promise<PlaylistItem[]> {
  const res = await api.get<ApiResponse<PlaylistItem[]>>(`/v1/playlists/${id}/items`);
  const rows = Array.isArray(res.data.data) ? res.data.data : [];
  return rows.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

export async function addPlaylistItem(id: string, postId: string, position?: number): Promise<void> {
  let pos = position;
  if (typeof pos !== "number") {
    const items = await getPlaylistItems(id).catch(() => [] as PlaylistItem[]);
    pos = items.length;
  }
  await api.post(`/v1/playlists/${id}/items`, { post_id: postId, position: pos });
}

export async function removePlaylistItem(id: string, postId: string): Promise<void> {
  await api.delete(`/v1/playlists/${id}/items/${postId}`);
}

/* ── Player: subtitles, renditions ──────────────────────── */

export async function getSubtitleTracks(mediaId: string): Promise<MediaSubtitleTrack[]> {
  try {
    const res = await api.get<ApiResponse<{ subtitles: MediaSubtitleTrack[] }>>(`/v1/subtitles/${mediaId}`);
    return res.data.data?.subtitles ?? [];
  } catch {
    return [];
  }
}

export interface MediaRendition {
  label?: string;
  height?: number;
  width?: number;
  bitrate?: number;
  url?: string;
  status?: string;
}

export async function getRenditions(mediaId: string): Promise<MediaRendition[]> {
  try {
    const res = await api.get<ApiResponse<MediaRendition[] | { renditions?: MediaRendition[] }>>(`/v1/media/${mediaId}/renditions`);
    const d = res.data.data;
    if (Array.isArray(d)) return d;
    return d?.renditions ?? [];
  } catch {
    return [];
  }
}

/* ── Creator tools (used by features/upload) ────────────── */

function convertSrtToVtt(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "WEBVTT\n\n";
  if (normalized.startsWith("WEBVTT")) return `${normalized}\n`;
  const body = normalized.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return `WEBVTT\n\n${body}\n`;
}

export async function updateVideoTrim(videoId: string, trimStartMs: number, trimEndMs?: number): Promise<void> {
  await api.patch(`/v1/videos/${videoId}/trim`, { trim_start_ms: trimStartMs, trim_end_ms: trimEndMs ?? null });
}

export async function overrideVideoCategory(videoId: string, category: "flick" | "long_video"): Promise<void> {
  await api.patch(`/v1/videos/${videoId}/category`, { category });
}

export async function setCoverFrame(
  videoId: string,
  params: { cover_media_id?: string; thumbnail_url?: string; timestamp_ms?: number },
): Promise<void> {
  await api.post(`/v1/videos/${videoId}/cover-frame`, params);
}

export async function publishVideo(videoId: string): Promise<void> {
  await api.post(`/v1/videos/${videoId}/publish`);
}

export async function getVideoDetail(videoId: string): Promise<VideoMetadataDTO> {
  const res = await api.get<ApiResponse<VideoMetadataDTO>>(`/v1/videos/${videoId}`);
  return res.data.data;
}

export async function createSubtitleTrack(
  mediaId: string,
  params: { language: string; file: File; source?: string },
): Promise<MediaSubtitleTrack> {
  const fileName = params.file.name.toLowerCase();
  const rawContent = await params.file.text();
  const vttContent = fileName.endsWith(".srt") ? convertSrtToVtt(rawContent) : rawContent;
  const contentUrl = `data:text/vtt;charset=utf-8,${encodeURIComponent(vttContent)}`;
  const res = await api.post<ApiResponse<MediaSubtitleTrack>>(`/v1/subtitles/${mediaId}`, {
    language: params.language,
    source: params.source ?? "manual_upload",
    format: "vtt",
    content_url: contentUrl,
  });
  return res.data.data;
}

export type { WatchProgress, SeriesInfo, VideoCategory, AuthorInfo, HydratedPostRow };
