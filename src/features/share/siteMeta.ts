/*
  Link previews for everything people share (founder, 21 Oct 2026: a shared
  link must "show some good response on the mobile as well"). One place for
  the OpenGraph + Twitter card every shareable route sends:

    /post/<id>                 a post, a reel        og:type video.other / article
    /posttube/watch/<id>       a long video          og:type video.other
    /u/<handle>                a profile             og:type profile
    /posttube/channel/<ref>    a channel             og:type profile
    /channel/<handle>          the older channel page, same preview
    /reels/sound/<id>          a sound               og:type music.song
    /hashtag/<tag>             a tag                 og:type website
    (/shop/products/<id> keeps its own builder in features/shop/model/productMeta.)

  Pure functions over the public API's wire shapes, so they are unit-tested
  without a server. The route's generateMetadata fetches the body signed out
  (what a stranger — and a crawler — may see), then hands it here. Anything
  the public may not see (404, redacted, age-restricted, private) gets
  NEUTRAL_METADATA: a title that names the site and nothing else, so a link
  pasted into a chat leaks neither the caption nor the picture.
*/

import type { Metadata } from "next";

/** The name a preview card names as its site. */
export const SHARE_SITE_NAME = "VChat";

/** What a preview says when the content is not for the public (or not there). */
export const NEUTRAL_TITLE = `Content on ${SHARE_SITE_NAME}`;
const NEUTRAL_DESCRIPTION = `Open the link to see it on ${SHARE_SITE_NAME}.`;

/** The generic card image: a route handler that draws one (src/app/api/share/image). */
export const FALLBACK_IMAGE_PATH = "/api/share/image";
export const FALLBACK_IMAGE_WIDTH = 1200;
export const FALLBACK_IMAGE_HEIGHT = 630;

/** How long a description may run before it is cut at a word. */
const DESCRIPTION_MAX = 200;
const TITLE_MAX = 90;

/** The public MP4 rendition a preview may point a player at. */
export const OG_VIDEO_VARIANT = "720p";

export interface ShareBases {
  /** The public web origin, no trailing slash ("https://cleestudio.com"). */
  siteUrl: string;
  /**
   * The API origin crawlers fetch media from, "" when unknown. Images then
   * go through the site's own /v1 proxy; a video needs the API host itself
   * (the proxy streams the file through Next), so without it there is none.
   */
  mediaBaseUrl: string;
}

export interface ShareEnv {
  siteUrl?: string;
  feedMediaBaseUrl?: string;
  apiBaseUrl?: string;
}

const strip = (s: string | undefined) => (s ?? "").trim().replace(/\/+$/, "");

/** The bases from the environment, the same rule the channel RSS feed uses. */
export function resolveShareBases(env: ShareEnv): ShareBases {
  return {
    siteUrl: strip(env.siteUrl) || "http://localhost:3000",
    mediaBaseUrl: strip(env.feedMediaBaseUrl) || strip(env.apiBaseUrl) || "",
  };
}

/** The bases from process.env (server only). */
export function shareBasesFromProcess(): ShareBases {
  return resolveShareBases({
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    feedMediaBaseUrl: process.env.FEED_MEDIA_BASE_URL,
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  });
}

// ── Text ────────────────────────────────────────────────────────────────

/** Whitespace folded, cut at a word under `max`, with an ellipsis when cut. */
export function clip(text: string | null | undefined, max = DESCRIPTION_MAX): string {
  const folded = (text ?? "").replace(/\s+/g, " ").trim();
  if (folded.length <= max) return folded;
  const cut = folded.slice(0, max - 1);
  const atWord = cut.lastIndexOf(" ");
  return `${(atWord > max / 2 ? cut.slice(0, atWord) : cut).trimEnd()}…`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether an id may be placed in an upstream path (post, media and sound ids are UUIDs). */
export function isShareId(id: string | null | undefined): id is string {
  return typeof id === "string" && UUID_RE.test(id);
}

/** A handle or a user id: letters, digits, "." "_" "-", nothing that could walk a path. */
export function isShareRef(ref: string | null | undefined): ref is string {
  return typeof ref === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(ref) && !ref.includes("..");
}

// ── Media URLs ──────────────────────────────────────────────────────────

/** `/v1/media/<id>/serve` (an image, or a video's original) on the host crawlers fetch from. */
export function mediaImageUrl(bases: ShareBases, mediaId: string | null | undefined): string | null {
  if (!isShareId(mediaId)) return null;
  const base = bases.mediaBaseUrl || bases.siteUrl;
  return `${base}/v1/media/${mediaId}/serve`;
}

/**
 * The public MP4 of a video media id, or null when the API host is unknown
 * (the preview then carries no og:video rather than a proxied 40 MB stream).
 */
export function mediaVideoUrl(bases: ShareBases, mediaId: string | null | undefined): string | null {
  if (!isShareId(mediaId) || !bases.mediaBaseUrl) return null;
  return `${bases.mediaBaseUrl}/v1/media/${mediaId}/serve/${OG_VIDEO_VARIANT}`;
}

/** An avatar_url / banner_url as the API sends it (absolute, or gateway-relative) made absolute. */
export function apiRelativeUrl(bases: ShareBases, url: string | null | undefined): string | null {
  const u = (url ?? "").trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (!u.startsWith("/")) return null;
  return `${bases.mediaBaseUrl || bases.siteUrl}${u}`;
}

export function fallbackImageUrl(bases: ShareBases): string {
  return `${bases.siteUrl}${FALLBACK_IMAGE_PATH}`;
}

// ── The card ────────────────────────────────────────────────────────────

export interface ShareImage {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
}

export interface ShareVideo {
  url: string;
  width?: number;
  height?: number;
}

type OgType = "website" | "article" | "profile" | "video.other" | "music.song";

export interface ShareCard {
  title: string;
  description: string;
  /** The canonical path, "/post/<id>". */
  path: string;
  type: OgType;
  image: ShareImage | null;
  video?: ShareVideo | null;
  /** og:profile:username, for a profile card. */
  username?: string | null;
}

/**
 * The Next metadata for a card. The root layout's "%s | VChat" template is
 * bypassed on purpose: a share card carries its own full title.
 */
export function cardMetadata(card: ShareCard, bases: ShareBases): Metadata {
  const canonical = `${bases.siteUrl}${card.path}`;
  const image: ShareImage = card.image ?? {
    url: fallbackImageUrl(bases),
    width: FALLBACK_IMAGE_WIDTH,
    height: FALLBACK_IMAGE_HEIGHT,
    alt: SHARE_SITE_NAME,
  };
  const title = clip(card.title, TITLE_MAX) || NEUTRAL_TITLE;
  const description = clip(card.description) || NEUTRAL_DESCRIPTION;

  const openGraph: NonNullable<Metadata["openGraph"]> = {
    title,
    description,
    url: canonical,
    siteName: SHARE_SITE_NAME,
    locale: "en_US",
    images: [image],
    ...(card.type === "profile"
      ? { type: "profile", username: card.username ?? undefined }
      : card.type === "video.other"
        ? {
            type: "video.other",
            videos: card.video ? [{ url: card.video.url, type: "video/mp4", width: card.video.width, height: card.video.height }] : undefined,
          }
        : card.type === "music.song"
          ? { type: "music.song" }
          : card.type === "article"
            ? { type: "article" }
            : { type: "website" }),
  };

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph,
    // A "player" card needs an HTML player page, not a file, so videos keep
    // the large-image card and the og:video above does the playing.
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

/** The preview for content the public may not see, or that is not there. Nothing about it is named. */
export function neutralMetadata(bases: ShareBases, path?: string): Metadata {
  const image = { url: fallbackImageUrl(bases), width: FALLBACK_IMAGE_WIDTH, height: FALLBACK_IMAGE_HEIGHT, alt: SHARE_SITE_NAME };
  return {
    title: { absolute: NEUTRAL_TITLE },
    description: NEUTRAL_DESCRIPTION,
    ...(path ? { alternates: { canonical: `${bases.siteUrl}${path}` } } : {}),
    openGraph: {
      type: "website",
      siteName: SHARE_SITE_NAME,
      title: NEUTRAL_TITLE,
      description: NEUTRAL_DESCRIPTION,
      ...(path ? { url: `${bases.siteUrl}${path}` } : {}),
      images: [image],
    },
    twitter: { card: "summary", title: NEUTRAL_TITLE, description: NEUTRAL_DESCRIPTION, images: [image.url] },
    robots: { index: false },
  };
}

// ── Wire shapes (the public API, every field optional) ──────────────────

export interface WirePostMedia {
  media_id?: string | null;
  kind?: string | null;
  position?: number | null;
  processing_status?: string | null;
  status?: string | null;
  width?: number | null;
  height?: number | null;
  playback_url?: string | null;
}

export interface WirePost {
  id?: string | null;
  text?: string | null;
  title?: string | null;
  visibility?: string | null;
  content_type?: string | null;
  cover_media_id?: string | null;
  media?: WirePostMedia[] | null;
  body_redacted?: boolean | null;
  tier_required_id?: string | null;
  age_restricted?: boolean | null;
  is_processing?: boolean | null;
  author?: { display_name?: string | null; username?: string | null } | null;
  video_metadata?: { width?: number | null; height?: number | null; thumbnail_url?: string | null } | null;
}

export interface WireProfile {
  user_id?: string | null;
  id?: string | null;
  username?: string | null;
  display_name?: string | null;
  bio?: string | null;
  avatar_media_id?: string | null;
  avatar_url?: string | null;
  is_private?: boolean | null;
  follower_count?: number | null;
}

export interface WireChannel {
  user_id?: string | null;
  name?: string | null;
  handle?: string | null;
  about?: string | null;
  description?: string | null;
  avatar_media_id?: string | null;
  avatar_url?: string | null;
  banner_media_id?: string | null;
  banner_url?: string | null;
  subscriber_count?: number | null;
  video_count?: number | null;
}

export interface WireSound {
  id?: string | null;
  title?: string | null;
  artist?: string | null;
  usage_count?: number | null;
  use_count?: number | null;
  source_post_id?: string | null;
  status?: string | null;
}

// ── Builders ────────────────────────────────────────────────────────────

const READY = new Set(["", "ready", "active", "completed"]);

/** Whether a post body is one the public may see in full. */
export function postIsPublic(post: WirePost | null | undefined): post is WirePost {
  if (!post || !isShareId(post.id)) return false;
  if (post.body_redacted || post.tier_required_id) return false;
  if (post.age_restricted) return false;
  const vis = (post.visibility ?? "public").trim().toLowerCase();
  return vis === "" || vis === "public";
}

/** The first ready video of a post, by position. */
export function primaryVideoMedia(post: WirePost): WirePostMedia | null {
  const videos = (post.media ?? []).filter((m) => m && m.kind === "video" && isShareId(m.media_id));
  if (videos.length === 0) return null;
  videos.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const first = videos[0];
  const status = (first.processing_status ?? first.status ?? "").trim().toLowerCase();
  return READY.has(status) ? first : null;
}

function firstImageMedia(post: WirePost): WirePostMedia | null {
  const images = (post.media ?? []).filter((m) => m && (m.kind === "image" || m.kind === "photo") && isShareId(m.media_id));
  images.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return images[0] ?? null;
}

function byline(post: WirePost): string {
  const a = post.author;
  const name = (a?.display_name ?? "").trim() || ((a?.username ?? "").trim() ? `@${a!.username!.trim()}` : "");
  return name;
}

function countLabel(n: number | null | undefined, noun: string): string {
  const v = typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  const text = v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M` : v >= 1_000 ? `${(v / 1_000).toFixed(1).replace(/\.0$/, "")}K` : String(v);
  return `${text} ${noun}${v === 1 ? "" : "s"}`;
}

/**
 * A post or reel at /post/<id>, or a long video at /posttube/watch/<id>.
 * null when the public may not see it (the route then sends the neutral card).
 */
export function postCard(post: WirePost | null | undefined, bases: ShareBases, path: string): ShareCard | null {
  if (!postIsPublic(post)) return null;
  const video = primaryVideoMedia(post);
  const kind = post.content_type === "long_video" ? "video" : post.content_type === "flick" ? "reel" : video ? "video" : "post";
  const who = byline(post);
  const text = clip(post.text, DESCRIPTION_MAX);
  const title = clip(post.title, TITLE_MAX) || (text ? clip(text, TITLE_MAX) : "") || (who ? `${kind === "post" ? "Post" : kind === "reel" ? "Reel" : "Video"} by ${who}` : NEUTRAL_TITLE);
  const description = (post.title ? text : "") || (who ? `${kind === "post" ? "A post" : kind === "reel" ? "A reel" : "A video"} by ${who} on ${SHARE_SITE_NAME}` : `On ${SHARE_SITE_NAME}`);

  let image: ShareImage | null = null;
  const coverUrl = mediaImageUrl(bases, post.cover_media_id);
  if (coverUrl) image = { url: coverUrl, alt: title };
  if (!image) {
    const photo = firstImageMedia(post);
    const url = mediaImageUrl(bases, photo?.media_id);
    if (url) image = { url, width: photo?.width ?? undefined, height: photo?.height ?? undefined, alt: title };
  }
  if (!image) {
    const thumb = apiRelativeUrl(bases, post.video_metadata?.thumbnail_url);
    if (thumb) image = { url: thumb, alt: title };
  }

  const mp4 = video ? mediaVideoUrl(bases, video.media_id) : null;
  const videoOut: ShareVideo | null = mp4 ? { url: mp4, width: video?.width ?? post.video_metadata?.width ?? undefined, height: video?.height ?? post.video_metadata?.height ?? undefined } : null;

  return { title, description, path, type: video ? "video.other" : "article", image, video: videoOut };
}

/** A profile at /u/<handle>. A private account gets a card with only its name (no bio, no picture). */
export function profileCard(profile: WireProfile | null | undefined, bases: ShareBases): ShareCard | null {
  if (!profile) return null;
  const username = (profile.username ?? "").trim();
  const id = (profile.user_id ?? profile.id ?? "").trim();
  const ref = username || id;
  if (!isShareRef(ref)) return null;
  const name = (profile.display_name ?? "").trim() || (username ? `@${username}` : SHARE_SITE_NAME);
  const title = username ? `${name} (@${username})` : name;
  const isPrivate = profile.is_private === true;
  const bio = isPrivate ? "" : clip(profile.bio);
  const followers = countLabel(profile.follower_count, "follower");
  const description = bio || `${followers} · ${name} on ${SHARE_SITE_NAME}`;
  const avatar = isPrivate ? null : mediaImageUrl(bases, profile.avatar_media_id) ?? apiRelativeUrl(bases, profile.avatar_url);
  return {
    title,
    description,
    path: `/u/${encodeURIComponent(ref)}`,
    type: "profile",
    image: avatar ? { url: avatar, alt: name } : null,
    username: username || null,
  };
}

/** A channel at /posttube/channel/<ref> (or the older /channel/<handle>). */
export function channelCard(channel: WireChannel | null | undefined, bases: ShareBases, pathFor: (ref: string) => string): ShareCard | null {
  if (!channel) return null;
  const handle = (channel.handle ?? "").trim();
  const ref = handle || (channel.user_id ?? "").trim();
  if (!isShareRef(ref)) return null;
  const name = (channel.name ?? "").trim() || (handle ? `@${handle}` : "Channel");
  const about = clip(channel.about ?? channel.description);
  const description = about || `${countLabel(channel.subscriber_count, "subscriber")} · ${countLabel(channel.video_count, "video")} on ${SHARE_SITE_NAME}`;
  const avatar = mediaImageUrl(bases, channel.avatar_media_id) ?? apiRelativeUrl(bases, channel.avatar_url);
  const banner = mediaImageUrl(bases, channel.banner_media_id) ?? apiRelativeUrl(bases, channel.banner_url);
  const image = banner ?? avatar;
  return {
    title: handle ? `${name} (@${handle})` : name,
    description,
    path: pathFor(ref),
    type: "profile",
    image: image ? { url: image, alt: name } : null,
    username: handle || null,
  };
}

/** A sound at /reels/sound/<id>. The cover of the reel it came from is its picture when that reel is public. */
export function soundCard(sound: WireSound | null | undefined, origin: WirePost | null | undefined, bases: ShareBases): ShareCard | null {
  if (!sound || !isShareId(sound.id)) return null;
  const status = (sound.status ?? "").trim().toLowerCase();
  if (!READY.has(status)) return null;
  const title = (sound.title ?? "").trim() || "Original sound";
  const artist = (sound.artist ?? "").trim();
  const uses = countLabel(sound.usage_count ?? sound.use_count, "reel");
  const description = `${artist ? `${artist} · ` : ""}${uses} use this sound on ${SHARE_SITE_NAME}`;
  const cover = postIsPublic(origin) ? mediaImageUrl(bases, origin.cover_media_id) : null;
  return {
    title: artist ? `${title} · ${artist}` : title,
    description,
    path: `/reels/sound/${encodeURIComponent(sound.id)}`,
    type: "music.song",
    image: cover ? { url: cover, alt: title } : null,
  };
}

/** A tag at /hashtag/<tag>: its name, how many posts, the first public post's cover as the picture. */
export function hashtagCard(tag: string, total: number | null | undefined, first: WirePost | null | undefined, bases: ShareBases): ShareCard | null {
  const clean = tag.replace(/^#/, "").trim();
  if (!clean || clean.length > 100 || /[\s/?#]/.test(clean)) return null;
  const cover = postIsPublic(first) ? mediaImageUrl(bases, first.cover_media_id) : null;
  const count = typeof total === "number" && total > 0 ? `${countLabel(total, "post")} tagged #${clean}` : `Posts tagged #${clean}`;
  return {
    title: `#${clean}`,
    description: `${count} on ${SHARE_SITE_NAME}`,
    path: `/hashtag/${encodeURIComponent(clean)}`,
    type: "website",
    image: cover ? { url: cover, alt: `#${clean}` } : null,
  };
}
