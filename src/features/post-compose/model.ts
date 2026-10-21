/*
  The feed post composer's details step (post screens parity, 2026-10-19).

  One model for both web composers — the modal (components/CreatePortal.tsx)
  and the full page (app/create/post) — and for the server drafts that open
  back into them. Pure: every rule here is a table test, and the wire bodies
  are compared key for key with post-service's goldens
  (Architecture/services/post-service/internal/http/testdata/contracts/posts).

  What the server takes, and where each field comes from:

    visibility        public | followers | friends | private. "Friends" is
                      mutual follows; "Only you" is private. unlisted exists
                      on the wire but no composer offers it.
    cover_index /     the cover of a photo post (post_type=image) with more
    cover_media_id    than one photo: its 0-based position in media_ids and
                      the id there. Both are sent, and they always agree.
    comment_access    everyone | followers | nobody, with no_comments beside
                      it for older readers. The screen has one switch, so a
                      loaded "followers" is kept until the switch is moved.
    remix_setting     allow | allow_audio_only | disallow, the "Allow reuse"
                      switch — the same keep-until-moved rule.
    link_url          https only, at most 500 characters, a host and no user
                      info (post-service NormalizeLinkURL). Blank sends none.
    hashtags /        what the caption says (#tag, @name), plus any a draft
    mentions          carried that its text does not, capped as the server
                      caps them (30 tags of 50, 20 names of 30).
    location_*        location_name, location_lat/lng, location_place_id.
                      There is no `location` key; the composers used to send
                      one and the server dropped it.
    language          a BCP-47 code; people only ever see its name.
    alt texts         per photo. The create route has no field for them —
                      they are written onto each uploaded asset first — and
                      a draft carries them as alt_texts {media_id: text}.
*/

import type { PostRichText } from "@/components/studio/postStyle"

/* ─── Audience ─────────────────────────────────────────────────────── */

export type PostAudience = "public" | "followers" | "friends" | "private"

export interface AudienceOption {
  value: PostAudience
  label: string
  detail: string
}

/**
 * The "Who can view" sheet. Followers stays because both web composers
 * already offered it and post-service accepts it; Friends is new.
 */
export const AUDIENCE_OPTIONS: readonly AudienceOption[] = [
  { value: "public", label: "Everyone", detail: "Anyone can see it" },
  { value: "followers", label: "Followers", detail: "People who follow you" },
  { value: "friends", label: "Friends", detail: "Followers you follow back" },
  { value: "private", label: "Only you", detail: "Nobody else can see it" },
]

const AUDIENCE_VALUES = new Set<string>(AUDIENCE_OPTIONS.map((o) => o.value))

export function isAudience(value: unknown): value is PostAudience {
  return typeof value === "string" && AUDIENCE_VALUES.has(value)
}

/** What the audience row says. */
export function audienceRowLabel(visibility: PostAudience): string {
  switch (visibility) {
    case "followers":
      return "Followers can view this post"
    case "friends":
      return "Friends can view this post"
    case "private":
      return "Only you can view this post"
    default:
      return "Everyone can view this post"
  }
}

/* ─── Comments and reuse ───────────────────────────────────────────── */

export type CommentAccess = "everyone" | "followers" | "nobody"
export type RemixSetting = "allow" | "allow_audio_only" | "disallow"

const COMMENT_ACCESS = new Set<string>(["everyone", "followers", "nobody"])
const REMIX_SETTINGS = new Set<string>(["allow", "allow_audio_only", "disallow"])

export const commentsAllowed = (access: CommentAccess) => access !== "nobody"
export const reuseAllowed = (remix: RemixSetting) => remix !== "disallow"

/** The Allow comments switch moved: off is nobody, on is everyone. */
export const commentAccessFor = (on: boolean): CommentAccess => (on ? "everyone" : "nobody")
/** The Allow reuse switch moved: off is disallow, on is allow. */
export const remixSettingFor = (on: boolean): RemixSetting => (on ? "allow" : "disallow")

/* ─── Language ─────────────────────────────────────────────────────── */

export interface PostLanguage {
  code: string
  name: string
  /** The language's own name, shown as a hint. */
  native?: string
}

/** Indian languages first (the pilot is in India), then widely used others. */
export const POST_LANGUAGES: readonly PostLanguage[] = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "te", name: "Telugu", native: "తెలుగు" },
  { code: "ta", name: "Tamil", native: "தமிழ்" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", name: "Malayalam", native: "മലയാളം" },
  { code: "mr", name: "Marathi", native: "मराठी" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "or", name: "Odia", native: "ଓଡ଼ିଆ" },
  { code: "as", name: "Assamese", native: "অসমীয়া" },
  { code: "ur", name: "Urdu", native: "اردو" },
  { code: "ar", name: "Arabic", native: "العربية" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "fr", name: "French", native: "Français" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "zh", name: "Chinese", native: "中文" },
]

/** "en-IN" → "en". */
export function baseLanguage(code: string): string {
  return code.trim().split(/[-_]/)[0]?.toLowerCase() ?? ""
}

/** The composer's starting language: the browser's, when it is one we list, else English. */
export function defaultLanguage(browserLanguage?: string | null): string {
  const raw = browserLanguage ?? (typeof navigator !== "undefined" ? navigator.language : "")
  const base = baseLanguage(raw || "")
  return POST_LANGUAGES.some((l) => l.code === base) ? base : "en"
}

/**
 * The name shown for a language code — never the code itself when anything
 * recognises it. A code outside the list (from a draft another app saved)
 * falls back to the platform's English name for it.
 */
export function languageName(code: string): string {
  const tag = code.trim()
  if (!tag) return "Not set"
  const base = baseLanguage(tag)
  const listed = POST_LANGUAGES.find((l) => l.code === base)
  if (listed) return listed.name
  try {
    const named = new Intl.DisplayNames(["en"], { type: "language" }).of(tag)
    if (named && named.toLowerCase() !== tag.toLowerCase()) return named
  } catch {
    // An invalid tag: fall through.
  }
  return "Other language"
}

/* ─── Link ─────────────────────────────────────────────────────────── */

export const MAX_LINK_LENGTH = 500

/**
 * The link as it will be sent, or null when it is not one we may send. The
 * server's own rule (NormalizeLinkURL), so the author hears it here rather
 * than as a failed post. Blank is no link, and also null.
 */
export function normalizeLink(raw: string): string | null {
  const value = raw.trim()
  if (!value || [...value].length > MAX_LINK_LENGTH) return null
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f-\u009f]/.test(value)) return null
  if (!value.toLowerCase().startsWith("https://")) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname) return null
  return value
}

/** What the link field says under a link it will not send; null when it is fine or empty. */
export function linkProblem(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  if ([...value].length > MAX_LINK_LENGTH) return `A link can be at most ${MAX_LINK_LENGTH} characters.`
  return normalizeLink(value) ? null : "Use a full https:// link."
}

/* ─── Hashtags and mentions ────────────────────────────────────────── */

export const MAX_HASHTAGS = 30
export const MAX_HASHTAG_LENGTH = 50
export const MAX_MENTIONS = 20
export const MAX_MENTION_LENGTH = 30
export const MAX_TITLE_LENGTH = 100
export const MAX_ALT_TEXT_LENGTH = 1000
export const MAX_PHOTOS = 10

const HASHTAG_TOKEN = /(?<![\p{L}\p{M}\p{N}_])#([\p{L}\p{M}\p{N}_]+)/gu
// A username is [A-Za-z0-9_.]; "a@b.com" is not a mention (the lookbehind).
const MENTION_TOKEN = /(?<![\p{L}\p{N}_.@])@([A-Za-z0-9_.]+)/gu

/** "#Food" → "food", or null when the server would refuse it. */
export function normalizeHashtag(raw: string): string | null {
  const tag = raw.trim().replace(/^#+/, "").toLowerCase()
  if (!tag || [...tag].length > MAX_HASHTAG_LENGTH || !/^[\p{L}\p{M}\p{N}_]+$/u.test(tag)) return null
  return tag
}

/** "@call.b." → "call.b", or null when the server would refuse it. Case is kept. */
export function normalizeMention(raw: string): string | null {
  const name = raw.trim().replace(/^@+/, "").replace(/\.+$/, "")
  if (!name || name.length > MAX_MENTION_LENGTH || !/^[A-Za-z0-9_.]+$/.test(name)) return null
  return name
}

function mergeUnique(lists: readonly (readonly string[])[], cap: number, norm: (s: string) => string | null): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const list of lists) {
    for (const raw of list) {
      const value = norm(raw)
      if (!value) continue
      const key = value.toLowerCase()
      if (seen.has(key)) continue
      if (out.length >= cap) return out
      seen.add(key)
      out.push(value)
    }
  }
  return out
}

/** The #tags and @names a caption carries, in order, each once, capped as the server caps them. */
export function captionTags(text: string): { hashtags: string[]; mentions: string[] } {
  const tags = [...text.matchAll(HASHTAG_TOKEN)].map((m) => m[1])
  const names = [...text.matchAll(MENTION_TOKEN)].map((m) => m[1])
  return {
    hashtags: mergeUnique([tags], MAX_HASHTAGS, normalizeHashtag),
    mentions: mergeUnique([names], MAX_MENTIONS, normalizeMention),
  }
}

/** The caption's tags and names plus the extras a draft carried, deduped and capped. */
export function requestTags(text: string, details: Pick<PostDetailsForm, "extraHashtags" | "extraMentions">) {
  const own = captionTags(text)
  return {
    hashtags: mergeUnique([own.hashtags, details.extraHashtags], MAX_HASHTAGS, normalizeHashtag),
    mentions: mergeUnique([own.mentions, details.extraMentions], MAX_MENTIONS, normalizeMention),
  }
}

export interface CaretEdit {
  text: string
  /** Where the caret goes after the edit. */
  caret: number
}

/**
 * The caption after the "# Hashtags" chip: a `#` at the caret, on a word
 * boundary, so the next letters typed are a tag.
 */
export function insertHashMark(text: string, caret: number = text.length): CaretEdit {
  const at = Math.max(0, Math.min(caret, text.length))
  const before = text.slice(0, at)
  const after = text.slice(at)
  const pad = before.length === 0 || /\s$/.test(before) ? "" : " "
  const next = `${before}${pad}#${after}`
  return { text: next, caret: before.length + pad.length + 1 }
}

/**
 * The caption after a person was picked from "@ Mention": `@username ` at the
 * caret, replacing a bare `@` (or a half-typed `@na`) the author had already
 * typed there.
 */
export function insertMention(text: string, username: string, caret: number = text.length): CaretEdit {
  const name = normalizeMention(username)
  const at = Math.max(0, Math.min(caret, text.length))
  if (!name) return { text, caret: at }
  let before = text.slice(0, at)
  const after = text.slice(at)
  const partial = before.match(/(^|\s)@[A-Za-z0-9_.]*$/)
  if (partial) before = before.slice(0, before.length - partial[0].length + partial[1].length)
  const pad = before.length === 0 || /\s$/.test(before) ? "" : " "
  const token = `@${name} `
  return { text: `${before}${pad}${token}${after.replace(/^ /, "")}`, caret: before.length + pad.length + token.length }
}

/* ─── The form ─────────────────────────────────────────────────────── */

/** A photo or video on the post: picked from disk, or already uploaded (a draft's, or a retry's). */
export interface ComposeMedia {
  /** Stable local id, for React keys and per-item updates. */
  key: string
  kind: "image" | "video"
  /** Not yet uploaded. */
  file?: File
  /** Uploaded. Set once, so a retry or a later publish re-uploads nothing. */
  mediaId?: string
  /** blob: for a picked file, the serve route for an uploaded one. */
  previewUrl: string
  altText: string
}

export interface PostDetailsForm {
  title: string
  visibility: PostAudience
  commentAccess: CommentAccess
  remixSetting: RemixSetting
  paidPromotion: boolean
  isBranded: boolean
  aiGenerated: boolean
  /** What is typed in the link field; validated by linkProblem. */
  link: string
  locationName: string
  locationPlaceId: string | null
  locationLat: number | null
  locationLng: number | null
  /** Which photo is the cover, 0-based in the media list. */
  coverIndex: number
  language: string
  /** Tags a draft carried that its caption does not; shown as chips and sent. */
  extraHashtags: string[]
  /** Names a draft carried that its caption does not. */
  extraMentions: string[]
}

export function emptyDetails(language: string = defaultLanguage()): PostDetailsForm {
  return {
    title: "",
    visibility: "public",
    commentAccess: "everyone",
    remixSetting: "allow",
    paidPromotion: false,
    isBranded: false,
    aiGenerated: false,
    link: "",
    locationName: "",
    locationPlaceId: null,
    locationLat: null,
    locationLng: null,
    coverIndex: 0,
    language,
    extraHashtags: [],
    extraMentions: [],
  }
}

/** Nothing typed is wrong: the Post and Drafts buttons may go. */
export function detailsProblem(details: PostDetailsForm): string | null {
  const link = linkProblem(details.link)
  if (link) return link
  if (details.title.trim().length > MAX_TITLE_LENGTH) return `A title can be at most ${MAX_TITLE_LENGTH} characters.`
  return null
}

/** The cover after the media changed: kept on its photo when it can be, else the first. */
export function clampCover(coverIndex: number, mediaCount: number): number {
  return coverIndex >= 0 && coverIndex < Math.max(1, mediaCount) ? coverIndex : 0
}

/** The cover after removing the item at `removed`: it follows its photo, or falls to the first. */
export function coverAfterRemove(coverIndex: number, removed: number): number {
  if (removed === coverIndex) return 0
  return removed < coverIndex ? coverIndex - 1 : coverIndex
}

/** A photo post: media, every one an image. Only then is there a cover to choose. */
export function isPhotoPost(media: readonly Pick<ComposeMedia, "kind">[]): boolean {
  return media.length > 0 && media.every((m) => m.kind === "image")
}

/* ─── Wire bodies ──────────────────────────────────────────────────── */

export interface PollBody {
  question: string
  options: string[]
  allows_multiple?: boolean
  duration_hours?: number
}

/** What the composer adds beside the details: the kind, and the modal's extras. */
export interface ComposeExtras {
  contentType: "post" | "poll"
  feeling?: string | null
  activity?: string | null
  activityDetail?: string | null
  poll?: PollBody | null
  richText?: PostRichText | null
}

/** Uploaded media, in post order. */
export interface UploadedMedia {
  mediaId: string
  kind: "image" | "video"
  altText?: string
}

/** POST /v1/posts — only keys of post-service's CreatePostRequest. */
export interface CreatePostBody {
  text: string
  visibility: PostAudience
  content_type: string
  media_ids?: string[]
  feeling: string | null
  activity: string | null
  activity_detail: string | null
  rich_text: PostRichText | null
  poll: PollBody | null
  no_comments: boolean
  location_name: string | null
  location_lat: number | null
  location_lng: number | null
  location_place_id?: string
  post_type?: "image"
  title?: string
  language: string
  paid_promotion: boolean
  remix_setting: RemixSetting
  comment_access: CommentAccess
  cover_media_id?: string
  cover_index?: number
  hashtags?: string[]
  mentions?: string[]
  is_branded: boolean
  ai_generated: boolean
  link_url?: string
}

export interface ComposeInput {
  text: string
  details: PostDetailsForm
  media: readonly UploadedMedia[]
  extras: ComposeExtras
}

function locationOf(details: PostDetailsForm) {
  const name = details.locationName.trim()
  if (!name) return { name: null, lat: null, lng: null, placeId: undefined }
  const placeId = details.locationPlaceId?.trim()
  return {
    name,
    lat: typeof details.locationLat === "number" && Number.isFinite(details.locationLat) ? details.locationLat : null,
    lng: typeof details.locationLng === "number" && Number.isFinite(details.locationLng) ? details.locationLng : null,
    placeId: placeId || undefined,
  }
}

/** The cover of a photo carousel; a single photo is its own cover and sends none. */
function coverOf(details: PostDetailsForm, media: readonly UploadedMedia[]) {
  if (!isPhotoPost(media) || media.length < 2) return null
  const index = clampCover(details.coverIndex, media.length)
  return { index, mediaId: media[index].mediaId }
}

/** The create request for a filled form. Unset details stay off the wire. */
export function buildCreateRequest({ text, details, media, extras }: ComposeInput): CreatePostBody {
  const tags = requestTags(text, details)
  const location = locationOf(details)
  const cover = coverOf(details, media)
  const link = normalizeLink(details.link)
  const title = details.title.trim()
  const body: CreatePostBody = {
    text,
    visibility: details.visibility,
    content_type: extras.contentType,
    feeling: extras.feeling ?? null,
    activity: extras.activity ?? null,
    activity_detail: extras.activityDetail ?? null,
    rich_text: extras.richText ?? null,
    poll: extras.poll ?? null,
    no_comments: details.commentAccess === "nobody",
    location_name: location.name,
    location_lat: location.lat,
    location_lng: location.lng,
    language: details.language || "en",
    paid_promotion: details.paidPromotion,
    remix_setting: details.remixSetting,
    comment_access: details.commentAccess,
    is_branded: details.isBranded,
    ai_generated: details.aiGenerated,
  }
  if (media.length > 0) body.media_ids = media.map((m) => m.mediaId)
  if (isPhotoPost(media)) body.post_type = "image"
  if (location.placeId) body.location_place_id = location.placeId
  if (title) body.title = title
  if (cover) {
    body.cover_media_id = cover.mediaId
    body.cover_index = cover.index
  }
  if (tags.hashtags.length > 0) body.hashtags = tags.hashtags
  if (tags.mentions.length > 0) body.mentions = tags.mentions
  if (link) body.link_url = link
  return body
}

/** The keys of post-service's PostDraftPayload (DisallowUnknownFields: anything else is a 400). */
export interface PostDraftPayload {
  text: string
  visibility?: PostAudience | string
  content_type?: string
  post_type?: "image" | "text"
  media_ids?: string[]
  alt_texts?: Record<string, string>
  poll?: PollBody
  rich_text?: PostRichText
  no_comments?: boolean
  feeling?: string
  activity?: string
  activity_detail?: string
  language?: string
  title?: string
  cover_media_id?: string
  cover_index?: number
  hashtags?: string[]
  mentions?: string[]
  remix_setting?: string
  comment_access?: string
  link_url?: string
  ai_generated?: boolean
  is_branded?: boolean
  paid_promotion?: boolean
  location_name?: string
  location_place_id?: string
  location_lat?: number
  location_lng?: number
}

/** POST / PATCH /v1/posts/drafts. */
export interface PostDraftRequest {
  post_type: "post" | "poll"
  payload: PostDraftPayload
  schedule_at: string | null
}

/**
 * Why this post cannot be a draft, or null. A draft publishes as a text or
 * photo post (its payload's post_type is text | image), so a video would be
 * refused at publish; a Journal entry's document cannot be edited where a
 * draft reopens.
 */
export function draftBlockReason(media: readonly Pick<ComposeMedia, "kind">[], opts?: { journal?: boolean }): string | null {
  if (media.some((m) => m.kind === "video")) return "Drafts can hold photos and text. Remove the video to save one."
  if (opts?.journal) return "Journal entries can't be saved as drafts yet."
  return null
}

/** The draft for a filled form: the same details as the create, plus the alt texts. */
export function buildDraftRequest({ text, details, media, extras }: ComposeInput): PostDraftRequest {
  const create = buildCreateRequest({ text, details, media, extras })
  const payload: PostDraftPayload = { text: create.text, visibility: create.visibility }
  if (create.post_type) payload.post_type = create.post_type
  if (create.media_ids) payload.media_ids = create.media_ids
  const alts: Record<string, string> = {}
  for (const m of media) {
    const alt = (m.altText ?? "").trim()
    if (alt) alts[m.mediaId] = alt.slice(0, MAX_ALT_TEXT_LENGTH)
  }
  if (Object.keys(alts).length > 0) payload.alt_texts = alts
  if (create.title) payload.title = create.title
  if (create.cover_media_id) payload.cover_media_id = create.cover_media_id
  if (typeof create.cover_index === "number") payload.cover_index = create.cover_index
  if (create.hashtags) payload.hashtags = create.hashtags
  if (create.mentions) payload.mentions = create.mentions
  payload.remix_setting = create.remix_setting
  payload.comment_access = create.comment_access
  if (create.link_url) payload.link_url = create.link_url
  payload.ai_generated = create.ai_generated
  payload.is_branded = create.is_branded
  payload.paid_promotion = create.paid_promotion
  if (create.location_name) payload.location_name = create.location_name
  if (create.location_place_id) payload.location_place_id = create.location_place_id
  if (create.location_lat !== null) payload.location_lat = create.location_lat
  if (create.location_lng !== null) payload.location_lng = create.location_lng
  payload.content_type = create.content_type
  payload.language = create.language
  if (create.no_comments) payload.no_comments = true
  if (create.poll) payload.poll = create.poll
  if (create.rich_text) payload.rich_text = create.rich_text
  if (create.feeling) payload.feeling = create.feeling
  if (create.activity) payload.activity = create.activity
  if (create.activity_detail) payload.activity_detail = create.activity_detail
  return { post_type: create.poll ? "poll" : "post", payload, schedule_at: null }
}

/* ─── Reading drafts back ──────────────────────────────────────────── */

export interface PostDraftRow {
  id: string
  postType: string
  status: string
  scheduleAt: string | null
  createdAt: string
  updatedAt: string
  payload: PostDraftPayload
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
const asString = (v: unknown): string => (typeof v === "string" ? v : "")
const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [])
const asNumber = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)

/** A draft's payload as stored, read defensively (another app may have written it). */
export function toDraftPayload(raw: unknown): PostDraftPayload {
  const p = asRecord(raw)
  const out: PostDraftPayload = { text: asString(p.text) }
  if (asString(p.visibility)) out.visibility = asString(p.visibility)
  if (asString(p.content_type)) out.content_type = asString(p.content_type)
  const pt = asString(p.post_type)
  if (pt === "image" || pt === "text") out.post_type = pt
  const ids = asStrings(p.media_ids)
  if (ids.length) out.media_ids = ids
  const alts = asRecord(p.alt_texts)
  const altEntries = Object.entries(alts).filter((e): e is [string, string] => typeof e[1] === "string")
  if (altEntries.length) out.alt_texts = Object.fromEntries(altEntries)
  const poll = asRecord(p.poll)
  if (p.poll && asString(poll.question)) {
    out.poll = { question: asString(poll.question), options: asStrings(poll.options) }
    if (typeof poll.allows_multiple === "boolean") out.poll.allows_multiple = poll.allows_multiple
    const hours = asNumber(poll.duration_hours)
    if (hours !== null) out.poll.duration_hours = hours
  }
  if (p.rich_text && typeof p.rich_text === "object") out.rich_text = p.rich_text as PostRichText
  if (typeof p.no_comments === "boolean") out.no_comments = p.no_comments
  for (const key of ["feeling", "activity", "activity_detail", "language", "title", "cover_media_id", "remix_setting", "comment_access", "link_url", "location_name", "location_place_id"] as const) {
    const v = asString(p[key])
    if (v) out[key] = v
  }
  const coverIndex = asNumber(p.cover_index)
  if (coverIndex !== null) out.cover_index = coverIndex
  const tags = asStrings(p.hashtags)
  if (tags.length) out.hashtags = tags
  const names = asStrings(p.mentions)
  if (names.length) out.mentions = names
  for (const key of ["ai_generated", "is_branded", "paid_promotion"] as const) {
    if (typeof p[key] === "boolean") out[key] = p[key] as boolean
  }
  const lat = asNumber(p.location_lat)
  const lng = asNumber(p.location_lng)
  if (lat !== null) out.location_lat = lat
  if (lng !== null) out.location_lng = lng
  return out
}

export function toDraftRow(raw: unknown): PostDraftRow | null {
  const d = asRecord(raw)
  const id = asString(d.id)
  if (!id) return null
  return {
    id,
    postType: asString(d.post_type) || "post",
    status: asString(d.status) || "draft",
    scheduleAt: asString(d.schedule_at) || null,
    createdAt: asString(d.created_at),
    updatedAt: asString(d.updated_at) || asString(d.created_at),
    payload: toDraftPayload(d.payload),
  }
}

/** GET /v1/posts/drafts's data: the author's drafts, newest first, published ones left out. */
export function toDraftRows(raw: unknown): PostDraftRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(toDraftRow)
    .filter((d): d is PostDraftRow => d !== null && d.status !== "published")
    .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : b.updatedAt < a.updatedAt ? -1 : 0))
}

/** The serve route for an uploaded asset (proxied under /v1 by the web). */
export const mediaServeUrl = (mediaId: string) => `/v1/media/${encodeURIComponent(mediaId)}/serve`

/** What a draft opens into: the caption, the details, the media and the extras. */
export interface ComposeState {
  text: string
  details: PostDetailsForm
  media: ComposeMedia[]
  extras: ComposeExtras
}

/** A saved draft, as the form edits it. Every value it held comes back; nothing is defaulted over. */
export function draftToCompose(row: PostDraftRow, fallbackLanguage: string = defaultLanguage()): ComposeState {
  const p = row.payload
  const ids = p.media_ids ?? []
  const alts = p.alt_texts ?? {}
  const media: ComposeMedia[] = ids.map((id) => ({
    key: `draft-${id}`,
    // A draft's payload is text or image; post-service refuses video in one.
    kind: "image",
    mediaId: id,
    previewUrl: mediaServeUrl(id),
    altText: alts[id] ?? "",
  }))
  const own = captionTags(p.text)
  const ownTags = new Set(own.hashtags.map((t) => t.toLowerCase()))
  const ownNames = new Set(own.mentions.map((n) => n.toLowerCase()))
  const comment = p.comment_access && COMMENT_ACCESS.has(p.comment_access)
    ? (p.comment_access as CommentAccess)
    : p.no_comments ? "nobody" : "everyone"
  let coverIndex = typeof p.cover_index === "number" ? p.cover_index : -1
  if (coverIndex < 0 && p.cover_media_id) coverIndex = ids.indexOf(p.cover_media_id)
  const details: PostDetailsForm = {
    ...emptyDetails(fallbackLanguage),
    title: p.title ?? "",
    visibility: isAudience(p.visibility) ? p.visibility : "public",
    commentAccess: comment,
    remixSetting: p.remix_setting && REMIX_SETTINGS.has(p.remix_setting) ? (p.remix_setting as RemixSetting) : "allow",
    paidPromotion: p.paid_promotion ?? false,
    isBranded: p.is_branded ?? false,
    aiGenerated: p.ai_generated ?? false,
    link: p.link_url ?? "",
    locationName: p.location_name ?? "",
    locationPlaceId: p.location_place_id ?? null,
    locationLat: p.location_lat ?? null,
    locationLng: p.location_lng ?? null,
    coverIndex: clampCover(coverIndex, ids.length),
    language: p.language || fallbackLanguage,
    extraHashtags: (p.hashtags ?? []).filter((t) => !ownTags.has(t.replace(/^#/, "").toLowerCase())),
    extraMentions: (p.mentions ?? []).filter((n) => !ownNames.has(n.replace(/^@/, "").toLowerCase())),
  }
  const isPoll = row.postType === "poll" || Boolean(p.poll)
  return {
    text: p.text,
    details,
    media,
    extras: {
      contentType: isPoll ? "poll" : "post",
      feeling: p.feeling ?? null,
      activity: p.activity ?? null,
      activityDetail: p.activity_detail ?? null,
      poll: p.poll ?? null,
      richText: p.rich_text ?? null,
    },
  }
}

/* ─── The drafts list ──────────────────────────────────────────────── */

/** "Just now", "5 min ago", "3 h ago", "Yesterday", "4 days ago", then the date. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return ""
  const seconds = Math.max(0, Math.round((now - at) / 1000))
  if (seconds < 60) return "Just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: new Date(at).getFullYear() === new Date(now).getFullYear() ? undefined : "numeric" })
}

/** The first words of a caption, for a draft without a title. */
export function firstWords(text: string, maxChars = 60): string {
  const flat = text.replace(/\s+/g, " ").trim()
  if (flat.length <= maxChars) return flat
  const cut = flat.slice(0, maxChars)
  const space = cut.lastIndexOf(" ")
  return `${(space > maxChars / 2 ? cut.slice(0, space) : cut).trimEnd()}…`
}

export interface DraftSummary {
  heading: string
  meta: string
  /** The cover (or first photo), for the thumbnail. */
  thumbMediaId: string | null
}

/** One row of the drafts list: its title or first words, and "N photos · <when>". */
export function draftSummary(row: PostDraftRow, now: number = Date.now()): DraftSummary {
  const p = row.payload
  const ids = p.media_ids ?? []
  const heading = (p.title ?? "").trim() || firstWords(p.text) || (p.poll?.question ? firstWords(p.poll.question) : "") || "Untitled draft"
  const kind = ids.length === 1 ? "1 photo" : ids.length > 1 ? `${ids.length} photos` : p.poll || row.postType === "poll" ? "Poll" : "Text"
  const when = relativeTime(row.updatedAt, now)
  const cover = p.cover_media_id && ids.includes(p.cover_media_id)
    ? p.cover_media_id
    : typeof p.cover_index === "number" && ids[p.cover_index] ? ids[p.cover_index] : ids[0] ?? null
  return { heading, meta: when ? `${kind} · ${when}` : kind, thumbMediaId: cover }
}

/* ─── One key per publish attempt ──────────────────────────────────── */

export interface AttemptKeys {
  /** The key for this exact request: the same body gets the same key, a changed one a new key. */
  keyFor(fingerprint: string): string
  /** The post went out: the next one is a new intent. */
  reset(): void
}

/**
 * post-service needs one Idempotency-Key per intent. A failed POST may have
 * committed with its response lost, so a retry of the same post must send the
 * SAME key (it then returns the post already made) — and a post the author
 * changed after the failure must not, or the server answers 409
 * IDEMPOTENCY_KEY_REUSED. So the key is tied to the request body.
 */
export function createAttemptKeys(generate: () => string = () => crypto.randomUUID()): AttemptKeys {
  let key = ""
  let last: string | null = null
  return {
    keyFor(fingerprint) {
      if (!key || fingerprint !== last) {
        key = generate()
        last = fingerprint
      }
      return key
    },
    reset() {
      key = ""
      last = null
    },
  }
}

/* ─── Refusals, in our words ───────────────────────────────────────── */

const REFUSAL_COPY: Record<string, string> = {
  INVALID_LINK_URL: "Use a full https:// link.",
  INVALID_COVER: "Pick one of this post's photos as its cover.",
  INVALID_VISIBILITY: "Choose who can view this post again.",
  INVALID_COMMENT_ACCESS: "Check the comment setting and try again.",
  INVALID_REMIX_SETTING: "Check the reuse setting and try again.",
  INVALID_LOCATION_PLACE_ID: "That place couldn't be used. Type it again.",
  MEDIA_NOT_READY: "A photo is still processing. Try again in a moment.",
  MEDIA_NOT_FOUND: "A photo couldn't be found. Remove it and add it again.",
  MEDIA_NOT_OWNED: "A photo couldn't be attached. Remove it and add it again.",
  MEDIA_TYPE_MISMATCH: "Photos and videos can't be mixed this way. Remove one and try again.",
  TEXT_TOO_LONG: "The description is too long.",
  TITLE_TOO_LONG: `A title can be at most ${MAX_TITLE_LENGTH} characters.`,
  EMPTY_POST: "Add a photo or some words first.",
  IDEMPOTENCY_KEY_REUSED: "Something changed while posting. Try again.",
  RATE_LIMITED: "You're posting quickly. Wait a moment and try again.",
  DRAFT_QUOTA: "You have too many drafts. Delete some first.",
  DRAFT_NOT_EDITABLE: "This draft has already been posted.",
  NOT_FOUND: "This draft no longer exists.",
}

/**
 * What the composer says for a refused request: our words for the codes we
 * know, the server's message for the rest, and `fallback` when there is none.
 * Hashtag and mention refusals arrive as INVALID_REQUEST/INVALID_DRAFT with
 * the server's message, which names the value.
 */
export function refusalCopy(code: string | null, message: string | null, fallback: string): string {
  if (code && REFUSAL_COPY[code]) return REFUSAL_COPY[code]
  return message || fallback
}
