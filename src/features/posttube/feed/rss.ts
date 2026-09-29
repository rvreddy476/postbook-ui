/*
  A channel's RSS 2.0 feed (with the iTunes, content and Atom namespaces),
  built from post-service `GET /v1/channels/:ref/feed`.

  Pure: no React, no axios, no `@/lib/api` (that is the browser client and
  this runs in a route handler). Everything a person typed is escaped here,
  every URL leaves absolute, and the same input always gives the same bytes,
  so the ETag the route derives from the document is stable.

  Wire shape (inside the usual `data` envelope):
    channel{user_id,name,handle,about,avatar_media_id,avatar_url,
            contact_email,language,dominant_category}
    category, updated_at
    items[{id,title,text,category,language,hashtags,published_at,media_id,
           duration_ms,cover_media_id,enclosure{variant,path,mime,size_bytes}}]

  Go sends zero values, not absences: "" and 0 fall through like null.
*/

import { channelPath } from "./feedUrl";

export const FEED_ITEM_CAP = 50;
export const DESCRIPTION_MAX = 4000;
const TITLE_MAX = 200;

// ── View shapes ─────────────────────────────────────────────────────────

export interface FeedChannel {
  userId: string;
  name: string;
  handle: string;
  about: string;
  avatarMediaId: string;
  avatarUrl: string;
  contactEmail: string;
  language: string;
  dominantCategory: string;
}

export interface FeedEnclosure {
  variant: string;
  /** Gateway-relative ("/v1/media/<id>/serve/720p") or already absolute. */
  path: string;
  mime: string;
  /** 0 when the size is not known. */
  sizeBytes: number;
}

export interface FeedItem {
  id: string;
  title: string;
  text: string;
  category: string;
  language: string;
  hashtags: string[];
  publishedAt: string;
  mediaId: string;
  durationMs: number;
  coverMediaId: string;
  enclosure: FeedEnclosure | null;
}

export interface ChannelFeed {
  channel: FeedChannel;
  /** The category the feed was narrowed to; "" for the whole channel. */
  category: string;
  updatedAt: string;
  items: FeedItem[];
}

export interface BuildRssOptions {
  /** The web origin for the channel, watch and self links. Absolute. */
  siteUrl: string;
  /** The API origin for enclosures and artwork. "" emits neither. */
  mediaBaseUrl: string;
  /** This document's own address (atom:link rel="self"). */
  feedUrl: string;
}

// ── Normalising the response ────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function normalizeEnclosure(raw: unknown): FeedEnclosure | null {
  const e = obj(raw);
  if (!e) return null;
  const path = str(e.path) || str(e.url);
  if (!path) return null;
  return {
    variant: str(e.variant),
    path,
    mime: str(e.mime) || str(e.mime_type) || "video/mp4",
    sizeBytes: num(e.size_bytes) || num(e.size) || num(e.length),
  };
}

function normalizeItem(raw: unknown): FeedItem | null {
  const i = obj(raw);
  if (!i) return null;
  const id = str(i.id);
  if (!id) return null;
  return {
    id,
    title: str(i.title),
    text: str(i.text),
    category: str(i.category),
    language: str(i.language),
    hashtags: Array.isArray(i.hashtags) ? i.hashtags.map(str).filter(Boolean) : [],
    publishedAt: str(i.published_at) || str(i.created_at),
    mediaId: str(i.media_id),
    durationMs: num(i.duration_ms),
    coverMediaId: str(i.cover_media_id),
    enclosure: normalizeEnclosure(i.enclosure),
  };
}

/** The feed as the builder reads it, or null when the body is not a channel feed. */
export function normalizeFeed(raw: unknown): ChannelFeed | null {
  const body = obj(raw);
  if (!body) return null;
  const data = obj(body.data) ?? body;
  const c = obj(data.channel);
  if (!c) return null;
  const userId = str(c.user_id) || str(c.owner_id) || str(c.id);
  const handle = str(c.handle).replace(/^@/, "");
  if (!userId && !handle) return null;
  return {
    channel: {
      userId,
      name: str(c.name),
      handle,
      about: str(c.about) || str(c.description),
      avatarMediaId: str(c.avatar_media_id),
      avatarUrl: str(c.avatar_url),
      contactEmail: str(c.contact_email),
      language: str(c.language),
      dominantCategory: str(c.dominant_category),
    },
    category: str(data.category),
    updatedAt: str(data.updated_at),
    items: (Array.isArray(data.items) ? data.items : []).map(normalizeItem).filter((i): i is FeedItem => i !== null),
  };
}

// ── Origins ─────────────────────────────────────────────────────────────

/** An http(s) origin (a path prefix is kept) without a trailing slash, or "". */
export function absoluteBase(raw: string | null | undefined): string {
  const s = str(raw);
  if (!/^https?:\/\//i.test(s)) return "";
  try {
    const u = new URL(s);
    if ((u.protocol !== "https:" && u.protocol !== "http:") || !u.hostname) return "";
    return `${u.origin}${u.pathname}`.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export interface FeedEnv {
  siteUrl?: string;
  feedMediaBaseUrl?: string;
  apiBaseUrl?: string;
}

/**
 * The two origins a feed needs. Media: FEED_MEDIA_BASE_URL, else
 * NEXT_PUBLIC_API_BASE_URL, else "" (the feed then carries no enclosures
 * and no artwork; a relative URL is never written).
 */
export function resolveFeedBases(env: FeedEnv): { siteUrl: string; mediaBaseUrl: string } {
  return {
    siteUrl: absoluteBase(env.siteUrl) || "http://localhost:3000",
    mediaBaseUrl: absoluteBase(env.feedMediaBaseUrl) || absoluteBase(env.apiBaseUrl),
  };
}

// ── Text helpers ────────────────────────────────────────────────────────

// Not allowed in XML 1.0: C0 controls other than tab, LF and CR, the two
// non-characters, and a surrogate without its pair.
const XML_ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export function stripControl(s: string): string {
  return s.replace(XML_ILLEGAL, "");
}

/** Text for an element body or an attribute value. */
export function esc(s: string): string {
  return stripControl(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** A CDATA section; a "]]>" in the text is split across two sections. */
export function cdata(s: string): string {
  return `<![CDATA[${stripControl(s).replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const two = (n: number) => String(n).padStart(2, "0");

/** "Tue, 29 Sep 2026 10:05:09 GMT" from an ISO time or a Date; "" when it is not a time. */
export function rfc2822(when: string | Date | null | undefined): string {
  if (when === null || when === undefined || when === "") return "";
  const d = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(d.getTime())) return "";
  return `${DAYS[d.getUTCDay()]}, ${two(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())} GMT`;
}

/** Milliseconds as H:MM:SS; "" when there is no duration. */
export function itunesDuration(ms: number | null | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return "";
  const total = Math.max(1, Math.round(ms / 1000));
  return `${Math.floor(total / 3600)}:${two(Math.floor((total % 3600) / 60))}:${two(total % 60)}`;
}

function clip(s: string, max: number): string {
  const chars = Array.from(s);
  return chars.length <= max ? s : `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}

/** Plain text as paragraphs; the result is markup and goes inside CDATA. */
export function textToHtml(text: string): string {
  return stripControl(text)
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

// ── Categories ──────────────────────────────────────────────────────────

export const DEFAULT_APPLE_CATEGORY = "TV & Film";

/** Our topic slugs (post-service service/categories.go) to Apple's top-level categories. */
const APPLE_CATEGORY: Record<string, string> = {
  art: "Arts",
  autos: "Leisure",
  beauty: "Arts",
  business: "Business",
  comedy: "Comedy",
  dance: "Arts",
  documentary: "Society & Culture",
  education: "Education",
  entertainment: "TV & Film",
  fashion: "Arts",
  "film-animation": "TV & Film",
  fitness: "Health & Fitness",
  food: "Arts",
  gaming: "Leisure",
  "howto-style": "Education",
  kids: "Kids & Family",
  lifestyle: "Society & Culture",
  music: "Music",
  news: "News",
  "people-blogs": "Society & Culture",
  pets: "Kids & Family",
  podcasts: "Society & Culture",
  "science-tech": "Technology",
  sports: "Sports",
  tech: "Technology",
  travel: "Society & Culture",
};

export function appleCategory(slug: string | null | undefined): string {
  const key = str(slug).toLowerCase();
  return Object.prototype.hasOwnProperty.call(APPLE_CATEGORY, key) ? APPLE_CATEGORY[key] : DEFAULT_APPLE_CATEGORY;
}

const CATEGORY_LABEL: Record<string, string> = {
  autos: "Autos & vehicles",
  "film-animation": "Film & animation",
  "howto-style": "How-to & style",
  "people-blogs": "People & blogs",
  "science-tech": "Science & tech",
};

/** What a narrowed feed is called after the channel's name: "podcasts" → "Podcasts". */
export function categoryLabel(slug: string): string {
  const key = str(slug).toLowerCase();
  if (!key) return "";
  if (Object.prototype.hasOwnProperty.call(CATEGORY_LABEL, key)) return CATEGORY_LABEL[key];
  const words = key.replace(/-+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "";
}

// ── URLs ────────────────────────────────────────────────────────────────

const MEDIA_ID_RE = /^[A-Za-z0-9-]{1,64}$/;

/** A gateway-relative path or an absolute http(s) URL as an absolute URL; "" otherwise. */
export function absolutize(base: string, path: string): string {
  const p = str(path);
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) {
    try {
      const u = new URL(p);
      return u.hostname ? u.toString() : "";
    } catch {
      return "";
    }
  }
  if (!base || !p.startsWith("/") || p.startsWith("//") || /[\s\\]/.test(p)) return "";
  return `${base}${p}`;
}

/** The original file of a media id, `/v1/media/<id>/serve` on the API origin. */
function mediaOriginalUrl(base: string, mediaId: string): string {
  if (!base || !MEDIA_ID_RE.test(mediaId)) return "";
  return `${base}/v1/media/${mediaId}/serve`;
}

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const LANGUAGE_RE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

// ── Dates ───────────────────────────────────────────────────────────────

function time(iso: string): number {
  if (!iso) return NaN;
  return new Date(iso).getTime();
}

/** When the feed last changed: `updated_at`, else the newest item; null when neither is a time. */
export function feedLastModified(feed: ChannelFeed): Date | null {
  const own = time(feed.updatedAt);
  if (!Number.isNaN(own)) return new Date(own);
  let newest = NaN;
  for (const item of feed.items.slice(0, FEED_ITEM_CAP)) {
    const t = time(item.publishedAt);
    if (!Number.isNaN(t) && (Number.isNaN(newest) || t > newest)) newest = t;
  }
  return Number.isNaN(newest) ? null : new Date(newest);
}

// ── The document ────────────────────────────────────────────────────────

function tag(name: string, value: string, indent: string): string {
  return `${indent}<${name}>${esc(value)}</${name}>`;
}

function itemTitle(item: FeedItem): string {
  if (item.title) return clip(item.title, TITLE_MAX);
  const firstLine = item.text.split(/\r?\n/).find((l) => l.trim())?.trim() ?? "";
  return firstLine ? clip(firstLine, 100) : "Untitled";
}

function buildItem(item: FeedItem, o: BuildRssOptions): string | null {
  const enclosureUrl = item.enclosure ? absolutize(o.mediaBaseUrl, item.enclosure.path) : "";
  // With a media origin, an entry that has nothing to play is left out.
  // Without one, the entries stay as plain links and carry no enclosure.
  if (o.mediaBaseUrl && !enclosureUrl) return null;

  const title = itemTitle(item);
  const plain = clip(item.text || title, DESCRIPTION_MAX);
  const html = textToHtml(item.text);
  const pubDate = rfc2822(item.publishedAt);
  const duration = itunesDuration(item.durationMs);
  const cover = mediaOriginalUrl(o.mediaBaseUrl, item.coverMediaId);

  const lines: string[] = ["    <item>"];
  lines.push(`      <guid isPermaLink="false">${esc(item.id)}</guid>`);
  lines.push(tag("title", title, "      "));
  lines.push(tag("link", `${o.siteUrl}/posttube/watch/${encodeURIComponent(item.id)}`, "      "));
  if (pubDate) lines.push(tag("pubDate", pubDate, "      "));
  lines.push(tag("description", plain, "      "));
  if (html) lines.push(`      <content:encoded>${cdata(html)}</content:encoded>`);
  if (enclosureUrl && item.enclosure) {
    lines.push(`      <enclosure url="${esc(enclosureUrl)}" length="${item.enclosure.sizeBytes}" type="${esc(item.enclosure.mime)}"/>`);
  }
  if (duration) lines.push(tag("itunes:duration", duration, "      "));
  if (cover) lines.push(`      <itunes:image href="${esc(cover)}"/>`);
  lines.push(tag("itunes:episodeType", "full", "      "));
  lines.push("    </item>");
  return lines.join("\n");
}

export function buildRss(feed: ChannelFeed, o: BuildRssOptions): string {
  const c = feed.channel;
  const name = c.name || (c.handle ? `@${c.handle}` : "Channel");
  const narrowed = categoryLabel(feed.category);
  const title = narrowed ? `${name} · ${narrowed}` : name;
  const channelUrl = `${o.siteUrl}${channelPath(c.handle || c.userId)}`;
  const description = clip(c.about || `Videos from ${name} on PostTube`, DESCRIPTION_MAX);
  const language = LANGUAGE_RE.test(c.language) ? c.language : "en";
  const built = rfc2822(feedLastModified(feed));
  const artwork = mediaOriginalUrl(o.mediaBaseUrl, c.avatarMediaId) || absolutize(o.mediaBaseUrl, c.avatarUrl);
  const category = appleCategory(feed.category || c.dominantCategory);

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    tag("title", title, "    "),
    tag("link", channelUrl, "    "),
    `    <atom:link href="${esc(o.feedUrl)}" rel="self" type="application/rss+xml"/>`,
    tag("description", description, "    "),
    tag("language", language, "    "),
  ];
  if (built) lines.push(tag("lastBuildDate", built, "    "));
  lines.push(tag("generator", "PostTube", "    "));
  if (artwork) {
    lines.push("    <image>");
    lines.push(tag("url", artwork, "      "));
    lines.push(tag("title", title, "      "));
    lines.push(tag("link", channelUrl, "      "));
    lines.push("    </image>");
    lines.push(`    <itunes:image href="${esc(artwork)}"/>`);
  }
  lines.push(tag("itunes:author", name, "    "));
  if (EMAIL_RE.test(c.contactEmail)) {
    lines.push("    <itunes:owner>");
    lines.push(tag("itunes:name", name, "      "));
    lines.push(tag("itunes:email", c.contactEmail, "      "));
    lines.push("    </itunes:owner>");
  }
  lines.push(tag("itunes:explicit", "false", "    "));
  lines.push(`    <itunes:category text="${esc(category)}"/>`);
  lines.push(tag("itunes:type", "episodic", "    "));

  let kept = 0;
  for (const item of feed.items) {
    if (kept >= FEED_ITEM_CAP) break;
    const xml = buildItem(item, o);
    if (!xml) continue;
    lines.push(xml);
    kept += 1;
  }

  lines.push("  </channel>");
  lines.push("</rss>");
  return `${lines.join("\n")}\n`;
}
