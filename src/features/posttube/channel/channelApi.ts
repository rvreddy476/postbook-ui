import api from "@/lib/api";

import { fetchCreatorCollections, type Collection } from "../library/libraryApi";
import { channelAvatarUrl, channelBannerUrl, getVideoPost, hydrateRows, type ChannelInfo } from "../data/posttubeApi";
import { mediaServeUrl, type HydratedPostRow } from "../model";
import type { PostTubeVideo } from "../types";

/*
  The channel page's one adapter: every request the page makes and every
  response shape it reads, normalised here so the components only ever see
  the view types below.

    GET  /v1/channels/:ref                    public channel (ref = handle or user id)
    GET  /v1/channels/me                      own channel (404 NO_CHANNEL → "missing")
    GET  /v1/posts/by-author/:id?type=&limit=&cursor=
                                              long_video (Videos, Live), flick (Shorts), post (Posts)
    GET  /v1/posts/:id                        the featured video
    GET  /v1/creators/:id/playlists           Collections (via the library lane's fetcher)
    POST /v1/reports                          Report channel (entity_type "user")

  The channel JSON follows post-service ChannelView (fixture
  testdata/contracts/mtube/channel.json). Older rows spell the text
  `description` instead of `about`, carry no links or counts, and the plan
  once named the collections tally `playlist_count`; all of that is read.
*/

// ── Wire shapes ─────────────────────────────────────────────────────────

export interface ChannelLinkWire {
  title?: string | null;
  url?: string | null;
}

/** `GET /v1/channels/:ref` / `GET /v1/channels/me` as post-service sends it (every field optional for older rows). */
export interface ChannelWire {
  user_id?: string | null;
  owner_id?: string | null;
  id?: string | null;
  name?: string | null;
  handle?: string | null;
  about?: string | null;
  description?: string | null;
  avatar_media_id?: string | null;
  avatar_url?: string | null;
  banner_media_id?: string | null;
  banner_url?: string | null;
  links?: ChannelLinkWire[] | null;
  contact_email?: string | null;
  featured_post_id?: string | null;
  subscriber_count?: number | null;
  video_count?: number | null;
  short_count?: number | null;
  live_count?: number | null;
  collection_count?: number | null;
  playlist_count?: number | null;
  is_subscribed?: boolean | null;
  notify_on?: string | null;
}

/** A by-author row: the hydrated post plus the two fields the Live tab reads. */
export interface AuthorPostWire extends HydratedPostRow {
  source?: string | null;
  visibility?: string | null;
  live_stream_id?: string | null;
}

interface Envelope<T> {
  data: T;
  meta?: { next_cursor?: string | null };
}

// ── View shapes ─────────────────────────────────────────────────────────

export interface ChannelLinkView {
  /** What the pill says: the creator's title, else the host name. */
  label: string;
  href: string;
  /** false for the contact mailto, which opens in place. */
  external: boolean;
}

/** Tab counts; `undefined` means the response did not say (older rows), which is not the same as zero. */
export interface ChannelCounts {
  videos?: number;
  shorts?: number;
  live?: number;
  collections?: number;
}

export interface ChannelView {
  userId: string;
  name: string;
  handle: string;
  about: string;
  avatarUrl?: string;
  bannerUrl?: string;
  links: ChannelLinkView[];
  contactEmail: string;
  featuredPostId: string | null;
  followerCount: number;
  counts: ChannelCounts;
  isFollowing: boolean;
  notifyOn: "all" | "none" | null;
  /** True when the page is drawn from a user id that has no channel row. */
  thin?: boolean;
}

/** A long video or a short, with the fields the tabs read beyond the tile. */
export interface ChannelVideo extends PostTubeVideo {
  source?: string;
  visibility?: string;
}

export interface ChannelPostCard {
  id: string;
  text: string;
  createdAt: string;
  loves: number;
  comments: number;
  imageUrl?: string;
}

export interface ChannelPage<T> {
  items: T[];
  nextCursor?: string;
}

export type ChannelLookup = { kind: "ok"; channel: ChannelView } | { kind: "missing" };

// ── Normalisers (pure) ──────────────────────────────────────────────────

function count(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : undefined;
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Only http(s) links reach an href; anything else (javascript:, data:, bare words) is dropped. */
export function safeExternalUrl(raw: unknown): string | null {
  const s = text(raw);
  if (!/^https?:\/\//i.test(s)) return null;
  try {
    const u = new URL(s);
    if ((u.protocol !== "https:" && u.protocol !== "http:") || !u.hostname) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function hostLabel(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./i, "");
  } catch {
    return href;
  }
}

export function normalizeLinks(raw: unknown, contactEmail = ""): ChannelLinkView[] {
  const out: ChannelLinkView[] = [];
  const seen = new Set<string>();
  for (const l of Array.isArray(raw) ? (raw as ChannelLinkWire[]) : []) {
    if (!l || typeof l !== "object") continue;
    const href = safeExternalUrl(l.url);
    if (!href || seen.has(href)) continue;
    seen.add(href);
    out.push({ label: text(l.title) || hostLabel(href), href, external: true });
  }
  if (/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(contactEmail)) {
    out.push({ label: "Email", href: `mailto:${contactEmail}`, external: false });
  }
  return out;
}

export function normalizeChannel(raw: unknown): ChannelView | null {
  if (!raw || typeof raw !== "object") return null;
  const w = raw as ChannelWire;
  const userId = text(w.user_id) || text(w.owner_id) || text(w.id);
  if (!userId) return null;
  const handle = text(w.handle).replace(/^@/, "");
  const contactEmail = text(w.contact_email);
  // The URL helpers take the older ChannelInfo; the fields they read are the same names.
  const info = w as unknown as ChannelInfo;
  return {
    userId,
    name: text(w.name) || (handle ? `@${handle}` : "Channel"),
    handle,
    about: text(w.about) || text(w.description),
    avatarUrl: channelAvatarUrl(info),
    bannerUrl: channelBannerUrl(info),
    links: normalizeLinks(w.links, contactEmail),
    contactEmail,
    featuredPostId: text(w.featured_post_id) || null,
    followerCount: count(w.subscriber_count) ?? 0,
    counts: {
      videos: count(w.video_count),
      shorts: count(w.short_count),
      live: count(w.live_count),
      collections: count(w.collection_count) ?? count(w.playlist_count),
    },
    isFollowing: w.is_subscribed === true,
    notifyOn: w.notify_on === "none" ? "none" : w.notify_on ? "all" : null,
  };
}

/** A user id with no channel row still has videos: a minimal masthead with no counts. */
export function thinChannel(userId: string, name?: string, avatarUrl?: string): ChannelView {
  return {
    userId,
    name: name?.trim() || "Channel",
    handle: "",
    about: "",
    avatarUrl,
    links: [],
    contactEmail: "",
    featuredPostId: null,
    followerCount: 0,
    counts: {},
    isFollowing: false,
    notifyOn: null,
    thin: true,
  };
}

export function toChannelVideo(video: PostTubeVideo, row: AuthorPostWire | undefined): ChannelVideo {
  return {
    ...video,
    source: text(row?.source) || undefined,
    visibility: text(row?.visibility) || undefined,
  };
}

export function toPostCard(row: AuthorPostWire): ChannelPostCard | null {
  if (!row || typeof row.id !== "string" || !row.id) return null;
  const image = (row.media ?? []).find((m) => m && m.kind === "image");
  return {
    id: row.id,
    text: text(row.text) || text(row.title),
    createdAt: row.created_at ?? "",
    loves: count(row.counts?.likes) ?? 0,
    comments: count(row.counts?.comments) ?? 0,
    imageUrl: image?.media_id ? mediaServeUrl(image.media_id) : undefined,
  };
}

/** Visitors see public user collections only; the owner sees every user collection. System lists (Queue, Loved) never show. */
export function channelCollections(all: readonly Collection[], isOwner: boolean): Collection[] {
  return all.filter((c) => c.kind === "user" && (isOwner || c.visibility === "public"));
}

// ── Requests ────────────────────────────────────────────────────────────

function status(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status;
}

/** `GET /v1/channels/:ref`; 404 → missing, anything else throws. */
export async function fetchChannel(ref: string): Promise<ChannelLookup> {
  try {
    const res = await api.get<Envelope<ChannelWire>>(`/v1/channels/${encodeURIComponent(ref)}`);
    const channel = normalizeChannel(res.data?.data);
    return channel ? { kind: "ok", channel } : { kind: "missing" };
  } catch (err) {
    if (status(err) === 404) return { kind: "missing" };
    throw err;
  }
}

/** `GET /v1/channels/me`; 404 NO_CHANNEL → missing. */
export async function fetchMyChannel(): Promise<ChannelLookup> {
  try {
    const res = await api.get<Envelope<ChannelWire>>("/v1/channels/me");
    const channel = normalizeChannel(res.data?.data);
    return channel ? { kind: "ok", channel } : { kind: "missing" };
  } catch (err) {
    if (status(err) === 404) return { kind: "missing" };
    throw err;
  }
}

export type AuthorPostType = "long_video" | "flick" | "post";

/**
 * `GET /v1/posts/by-author/:id?type=` — `type` is an exact content_type
 * match (post-service store); `flick` is the canonical short. The route
 * has no sort parameter: it is newest first (pinned rows on top).
 */
async function fetchAuthorRows(ownerId: string, type: AuthorPostType, cursor?: string, limit = 24): Promise<ChannelPage<AuthorPostWire>> {
  const res = await api.get<Envelope<AuthorPostWire[]>>(`/v1/posts/by-author/${encodeURIComponent(ownerId)}`, {
    params: { type, limit: String(limit), ...(cursor ? { cursor } : {}) },
  });
  const rows = Array.isArray(res.data?.data) ? res.data.data.filter((r) => r && typeof r.id === "string") : [];
  return { items: rows, nextCursor: res.data?.meta?.next_cursor || undefined };
}

export async function fetchChannelVideos(ownerId: string, type: "long_video" | "flick", cursor?: string): Promise<ChannelPage<ChannelVideo>> {
  const page = await fetchAuthorRows(ownerId, type, cursor);
  const videos = await hydrateRows(page.items);
  const byId = new Map(page.items.map((r) => [r.id, r]));
  return { items: videos.map((v) => toChannelVideo(v, byId.get(v.id))), nextCursor: page.nextCursor };
}

export async function fetchChannelPosts(ownerId: string, cursor?: string): Promise<ChannelPage<ChannelPostCard>> {
  const page = await fetchAuthorRows(ownerId, "post", cursor);
  return { items: page.items.map(toPostCard).filter((p): p is ChannelPostCard => !!p), nextCursor: page.nextCursor };
}

export async function fetchChannelCollections(ownerId: string, isOwner: boolean): Promise<Collection[]> {
  return channelCollections(await fetchCreatorCollections(ownerId, { limit: 50 }), isOwner);
}

/** The featured video; a deleted or hidden one is null and the slot is not drawn. */
export async function fetchFeaturedVideo(postId: string): Promise<PostTubeVideo | null> {
  return getVideoPost(postId);
}

export type ChannelReportReason = "spam" | "harassment" | "hate_speech" | "violence" | "nudity" | "misinformation" | "other";

/**
 * `POST /v1/reports` against the channel's owner. The shared useSubmitReport
 * hook types its target as post/comment/reel/video only, while
 * trust-safety-service takes `entity_type: "user"` for an account; the
 * body here is the same one that hook sends.
 */
export async function reportChannel(ownerId: string, reason: ChannelReportReason, details = ""): Promise<void> {
  await api.post("/v1/reports", { entity_type: "user", entity_id: ownerId, reason, details });
}
