import type { CreateStreamInput, LiveEndedReason, LiveOrientation, LiveStreamStatus, LiveVisibility } from "./model"
import { errorCode, errorStatus, num, str } from "./model"
import { createStreamBody, streamSource, type LiveSource } from "./encoder"
import { liveStatusView, normalizeStatus, type LiveAudience, type LiveStatusKind, type LiveStatusView } from "./status"

// Live discovery, scheduling and reminders (live surfaces contract, 2 Oct
// 2026). EVERY wire name of that contract is read or written in this file,
// so a late rename on the backend is a one-file fix:
//
//   GET    /v1/livestream/streams?status=live&orientation=&category=&following=true&sort=viewers|recent&limit&cursor
//   GET    /v1/livestream/streams/upcoming?orientation=&category=&following=&limit&cursor   (reminder_set, reminder_count)
//   GET    /v1/livestream/categories/live                 [{slug, label, live_count, viewer_count}]
//   GET    /v1/livestream/creators/live?limit=            [{creator, stream_id, viewer_count, orientation}]
//   GET    /v1/livestream/users/:userId/streams?status=live|upcoming|past   (past rows: recording_post_id)
//   GET    /v1/livestream/users/:userId/badges            {data:{badges:[{badge, granted_at}]}}
//   PATCH  /v1/livestream/streams/:id                     host, only while scheduled
//   PUT    /v1/livestream/streams/:id/reminder            {data:{reminder_set, reminder_count}}
//   DELETE /v1/livestream/streams/:id/reminder            same answer
//   row    orientation, category, creator{user_id,name,handle,avatar_url,badges}, heart_count
//
// Go omits zero values: an absent field, "" and 0 all read as "nothing"
// here, never as an error. No React and no network in this file; the hooks
// in hooks/useLiveV2.ts call it.

type Obj = Record<string, unknown>

function asObj(v: unknown): Obj | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null
}

/** `{data: X}` → X; a bare body is read as the data itself. */
function dataOf(body: unknown): unknown {
  const obj = asObj(body)
  return obj && "data" in obj ? obj.data : body
}

function count(v: unknown): number {
  const n = num(v)
  return n !== null && n > 0 ? Math.floor(n) : 0
}

// ── Routes ────────────────────────────────────────────────────────────

const BASE = "/v1/livestream"
const seg = (id: string) => encodeURIComponent(id)

export const LIVE_ROUTES = {
  streams: `${BASE}/streams`,
  upcoming: `${BASE}/streams/upcoming`,
  categories: `${BASE}/categories/live`,
  creators: `${BASE}/creators/live`,
  stream: (id: string) => `${BASE}/streams/${seg(id)}`,
  reminder: (id: string) => `${BASE}/streams/${seg(id)}/reminder`,
  userStreams: (userId: string) => `${BASE}/users/${seg(userId)}/streams`,
  userBadges: (userId: string) => `${BASE}/users/${seg(userId)}/badges`,
} as const

// ── Creator card and badges ───────────────────────────────────────────

export const FOUNDING_BADGE = "founding_creator"

export interface CreatorCard {
  user_id: string
  name: string
  handle: string
  avatar_url: string
  /** Badge keys; empty when the card carried none. */
  badges: string[]
}

/** `badges: ["founding_creator"]`; absent, null, empty or junk → []. */
export function parseBadges(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const entry of raw) {
    // The creator card carries strings; the badges route carries {badge, granted_at}.
    const key = typeof entry === "string" ? entry : str(asObj(entry)?.badge)
    if (key && !out.includes(key)) out.push(key)
  }
  return out
}

/** GET /users/:userId/badges → the badge keys; anything unreadable is none. */
export function parseUserBadges(body: unknown): string[] {
  return parseBadges(asObj(dataOf(body))?.badges)
}

export function hasFoundingBadge(badges: readonly string[] | null | undefined): boolean {
  return !!badges && badges.includes(FOUNDING_BADGE)
}

/**
 * "You earned the Founding creator badge." is shown only when the host's
 * card had no badge BEFORE the stream and has it once the stream is over.
 * An unknown before (the page opened on a stream that had already ended)
 * is never "newly earned".
 */
export function foundingNewlyEarned(before: readonly string[] | null | undefined, after: readonly string[] | null | undefined): boolean {
  if (!before) return false
  return !hasFoundingBadge(before) && hasFoundingBadge(after)
}

/**
 * One step of watching the host's own stream for the badge. While the
 * stream is not over, the first card seen is remembered as "before"; once
 * it is over, `earned` says whether the badge is new. `stream` is the raw
 * row as polled (status, creator.badges).
 */
export function foundingEarnedStep(
  before: string[] | null,
  stream: { status?: unknown; creator?: { badges?: unknown } | null } | null | undefined,
): { before: string[] | null; earned: boolean } {
  if (!stream) return { before, earned: false }
  const badges = parseBadges(stream.creator?.badges)
  const over = stream.status === "ended" || stream.status === "failed"
  if (!over) return { before: before ?? badges, earned: false }
  return { before, earned: foundingNewlyEarned(before, badges) }
}

/**
 * The host card. A failed lookup leaves only `user_id`; a row from before
 * the contract has no card at all, so the row's creator_user_id stands in.
 */
export function parseCreator(raw: unknown, fallbackUserId = ""): CreatorCard {
  const o = asObj(raw) ?? {}
  return {
    user_id: str(o.user_id) || fallbackUserId,
    name: str(o.name),
    handle: str(o.handle).replace(/^@/, ""),
    avatar_url: str(o.avatar_url),
    badges: parseBadges(o.badges),
  }
}

/** The name on a tile: the name, else @handle, else "Creator". Never an id. */
export function creatorName(card: Pick<CreatorCard, "name" | "handle"> | null | undefined): string {
  if (card?.name) return card.name
  if (card?.handle) return `@${card.handle}`
  return "Creator"
}

/** The channel page of a creator: by handle when there is one, else by user id; "" when neither. */
export function creatorHref(card: Pick<CreatorCard, "handle" | "user_id"> | null | undefined): string {
  const ref = card?.handle || card?.user_id || ""
  return ref ? `/posttube/channel/${encodeURIComponent(ref)}` : ""
}

// ── Stream row ────────────────────────────────────────────────────────

export interface StreamRow {
  id: string
  creator_user_id: string
  title: string
  description: string
  status: LiveStatusKind
  visibility: LiveVisibility
  orientation: LiveOrientation
  /** A post-service category slug; "" when the host chose none. */
  category: string
  cover_media_id: string
  scheduled_at: string
  started_at: string
  ended_at: string
  ended_reason: string
  viewer_count: number
  viewer_peak: number
  heart_count: number
  source: LiveSource
  creator: CreatorCard
  reminder_set: boolean
  reminder_count: number
  /** The video the recording became; "" when it has not (or never will). */
  recording_post_id: string
  recording_url: string
  created_at: string
}

export function parseOrientation(raw: unknown): LiveOrientation {
  return str(raw) === "portrait" ? "portrait" : "landscape"
}

function parseVisibility(raw: unknown): LiveVisibility {
  const v = str(raw)
  return v === "followers" || v === "paid" ? v : "public"
}

/** One stream row of any list or of the detail route; null without an id. */
export function parseStream(raw: unknown): StreamRow | null {
  const o = asObj(raw)
  const id = str(o?.id)
  if (!o || !id) return null
  const creatorUserId = str(o.creator_user_id) || str(asObj(o.creator)?.user_id)
  return {
    id,
    creator_user_id: creatorUserId,
    title: str(o.title),
    description: str(o.description),
    status: normalizeStatus(o.status),
    visibility: parseVisibility(o.visibility),
    orientation: parseOrientation(o.orientation),
    category: str(o.category).trim().toLowerCase(),
    cover_media_id: str(o.cover_media_id),
    scheduled_at: str(o.scheduled_at),
    started_at: str(o.started_at),
    ended_at: str(o.ended_at),
    ended_reason: str(o.ended_reason),
    viewer_count: count(o.viewer_count),
    viewer_peak: count(o.viewer_peak),
    heart_count: count(o.heart_count),
    source: streamSource(o),
    creator: parseCreator(o.creator, creatorUserId),
    reminder_set: o.reminder_set === true,
    reminder_count: count(o.reminder_count),
    recording_post_id: str(o.recording_post_id),
    recording_url: str(o.recording_url),
    created_at: str(o.created_at),
  }
}

export interface StreamPage {
  items: StreamRow[]
  /** "" on the last page. */
  next_cursor: string
}

/** `{data:[row…], meta:{next_cursor}}`; rows without an id and repeats are dropped. */
export function parseStreamPage(body: unknown): StreamPage {
  const obj = asObj(body)
  const data = obj?.data
  const seen = new Set<string>()
  const items: StreamRow[] = []
  if (Array.isArray(data)) {
    for (const raw of data) {
      const row = parseStream(raw)
      if (!row || seen.has(row.id)) continue
      seen.add(row.id)
      items.push(row)
    }
  }
  return { items, next_cursor: str(asObj(obj?.meta)?.next_cursor) }
}

/** The status view (badge, panel copy, flags) of a parsed row. */
export function rowStatusView(row: Pick<StreamRow, "status" | "ended_reason" | "scheduled_at">, audience: LiveAudience = "viewer"): LiveStatusView {
  return liveStatusView(
    {
      status: row.status as LiveStreamStatus,
      ended_reason: row.ended_reason as LiveEndedReason | "",
      scheduled_at: row.scheduled_at || null,
    },
    audience,
  )
}

/** The Live badge, the LIVE ring and the Live now lists: status === "live" and nothing else. */
export function isLive(row: Pick<StreamRow, "status"> | null | undefined): boolean {
  return row?.status === "live"
}

export function liveOnly<T extends Pick<StreamRow, "status">>(rows: readonly T[]): T[] {
  return rows.filter(isLive)
}

/** Scheduled rows whose time is still ahead (or unknown), soonest first. */
export function upcomingOnly<T extends Pick<StreamRow, "status" | "scheduled_at">>(rows: readonly T[], now = Date.now()): T[] {
  return rows
    .filter((r) => r.status === "scheduled")
    .map((r) => ({ r, t: Date.parse(r.scheduled_at) }))
    .filter(({ t }) => Number.isNaN(t) || t > now)
    .sort((a, b) => (Number.isNaN(a.t) ? Infinity : a.t) - (Number.isNaN(b.t) ? Infinity : b.t))
    .map(({ r }) => r)
}

/**
 * Where a stream is watched. Landscape streams live in PostTube, portrait
 * ones in the Reels Live tab (`/reels/live`, which also opens a landscape
 * stream letterboxed when asked by id). Every link is built from this map,
 * so a surface moves by changing one entry.
 */
export const LIVE_WATCH_BASE: Record<LiveOrientation, string> = {
  landscape: "/posttube/live",
  portrait: "/reels/live",
}

export function liveWatchHref(row: Pick<StreamRow, "id"> & Partial<Pick<StreamRow, "orientation">>): string {
  return `${LIVE_WATCH_BASE[row.orientation ?? "landscape"]}/${encodeURIComponent(row.id)}`
}

/** The host screen (camera studio or streaming-software studio). */
export function hostScreenHref(streamId: string): string {
  return `/live/${encodeURIComponent(streamId)}/broadcast`
}

/** The video a recording became; "" when there is none. */
export function recordingHref(row: Pick<StreamRow, "recording_post_id">): string {
  return row.recording_post_id ? `/posttube/watch/${encodeURIComponent(row.recording_post_id)}` : ""
}

// ── List requests ─────────────────────────────────────────────────────

export type LiveSort = "viewers" | "recent"

export interface LiveListFilters {
  orientation?: LiveOrientation
  category?: string
  following?: boolean
  sort?: LiveSort
  limit?: number
  cursor?: string
}

function listParams(f: LiveListFilters, defaultLimit: number): Record<string, string> {
  const params: Record<string, string> = {}
  if (f.orientation) params.orientation = f.orientation
  if (f.category) params.category = f.category
  if (f.following) params.following = "true"
  params.limit = String(f.limit ?? defaultLimit)
  if (f.cursor) params.cursor = f.cursor
  return params
}

/** GET /streams?status=live&… — status is always sent; a filter only when set. */
export function liveNowParams(f: LiveListFilters = {}): Record<string, string> {
  const params: Record<string, string> = { status: "live", ...listParams(f, 24) }
  if (f.sort) params.sort = f.sort
  return params
}

/** GET /streams/upcoming?… (soonest first; no sort). */
export function upcomingParams(f: Omit<LiveListFilters, "sort"> = {}): Record<string, string> {
  return listParams(f, 12)
}

export type UserStreamsStatus = "live" | "upcoming" | "past"

/** GET /users/:userId/streams?status=… */
export function userStreamsParams(status: UserStreamsStatus, opts: { limit?: number; cursor?: string } = {}): Record<string, string> {
  const params: Record<string, string> = { status, limit: String(opts.limit ?? 12) }
  if (opts.cursor) params.cursor = opts.cursor
  return params
}

// ── Topics that have someone live ─────────────────────────────────────

export interface LiveCategory {
  slug: string
  label: string
  live_count: number
  viewer_count: number
}

function titleCase(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/** GET /categories/live. A category with nobody live (live_count 0 or absent) is not a rail. */
export function parseLiveCategories(body: unknown): LiveCategory[] {
  const data = dataOf(body)
  if (!Array.isArray(data)) return []
  const out: LiveCategory[] = []
  const seen = new Set<string>()
  for (const raw of data) {
    const o = asObj(raw)
    const slug = str(o?.slug).trim().toLowerCase()
    const live = count(o?.live_count)
    if (!o || !slug || seen.has(slug) || live === 0) continue
    seen.add(slug)
    out.push({ slug, label: str(o.label).trim() || titleCase(slug), live_count: live, viewer_count: count(o.viewer_count) })
  }
  return out
}

/** The label of a category slug: the taxonomy's when it is known, else the slug in title case. */
export function categoryLabel(slug: string, known: ReadonlyArray<{ slug: string; label: string }> = []): string {
  if (!slug) return ""
  return known.find((c) => c.slug === slug)?.label || titleCase(slug)
}

// ── Creators who are live ─────────────────────────────────────────────

export interface LiveCreatorRow {
  creator: CreatorCard
  stream_id: string
  viewer_count: number
  orientation: LiveOrientation
}

/** GET /creators/live. A row without a stream or a creator id cannot be opened and is dropped. */
export function parseLiveCreators(body: unknown): LiveCreatorRow[] {
  const data = dataOf(body)
  if (!Array.isArray(data)) return []
  const out: LiveCreatorRow[] = []
  for (const raw of data) {
    const o = asObj(raw)
    const streamId = str(o?.stream_id)
    const creator = parseCreator(o?.creator)
    if (!o || !streamId || !creator.user_id) continue
    out.push({ creator, stream_id: streamId, viewer_count: count(o.viewer_count), orientation: parseOrientation(o.orientation) })
  }
  return out
}

/** user id → the stream they are live on (the LIVE ring on an avatar). */
export function liveByCreator(rows: readonly LiveCreatorRow[]): Map<string, LiveCreatorRow> {
  const map = new Map<string, LiveCreatorRow>()
  for (const row of rows) if (!map.has(row.creator.user_id)) map.set(row.creator.user_id, row)
  return map
}

// ── Hero ──────────────────────────────────────────────────────────────

/** The most-watched LIVE landscape stream; the server's order breaks ties. Null when nobody is live. */
export function pickHero<T extends Pick<StreamRow, "status" | "orientation" | "viewer_count">>(rows: readonly T[]): T | null {
  let best: T | null = null
  for (const row of rows) {
    if (!isLive(row) || row.orientation !== "landscape") continue
    if (!best || row.viewer_count > best.viewer_count) best = row
  }
  return best
}

export interface HeroPresence {
  /** The stream row says status === "live". */
  live: boolean
  /** The hero is on screen (IntersectionObserver). */
  inView: boolean
  /** The tab is in the foreground (document.visibilityState). */
  pageVisible: boolean
}

/**
 * The hero preview holds a room connection only while it is live, on
 * screen and in a foreground tab. The moment one turns false the preview
 * disconnects; an unmount disconnects through the same effect cleanup.
 */
export function heroShouldConnect(p: HeroPresence): boolean {
  return p.live && p.inView && p.pageVisible
}

// ── One room at a time ────────────────────────────────────────────────

/**
 * A page holds one LiveKit viewer connection. A player claims the slot
 * before it connects; claiming evicts whoever held it (their `release`
 * runs, which disconnects them). `done` gives the slot back on unmount.
 */
export class RoomSlot {
  private holder: { owner: string; release: () => void } | null = null

  claim(owner: string, release: () => void): () => void {
    const previous = this.holder
    this.holder = { owner, release }
    if (previous && previous.owner !== owner) previous.release()
    const mine = this.holder
    return () => {
      if (this.holder === mine) this.holder = null
    }
  }

  owner(): string | null {
    return this.holder?.owner ?? null
  }
}

export const liveRoomSlot = new RoomSlot()

// ── Watch page state ──────────────────────────────────────────────────

export type WatchKind = "live" | "starting" | "waiting" | "ended" | "failed" | "unavailable"

export interface WatchState {
  kind: WatchKind
  /** The LiveKit player is mounted (live or reconnecting). */
  player: boolean
  /** The Live badge: status === "live" only (a reconnecting stream says Reconnecting). */
  liveBadge: boolean
  chat: boolean
  /** Notify me is offered (scheduled streams). */
  canRemind: boolean
  /** A countdown runs (scheduled, with a time still ahead). */
  countdown: boolean
  /** `/posttube/watch/<post>` when the recording became a video, else "". */
  recordingHref: string
  /** The raw recording file, only when there is no video for it. */
  recordingUrl: string
}

/** What the watch page shows, from the server's row alone. */
export function watchState(row: Pick<StreamRow, "status" | "scheduled_at" | "recording_post_id" | "recording_url">, now = Date.now()): WatchState {
  const base: WatchState = { kind: "unavailable", player: false, liveBadge: false, chat: false, canRemind: false, countdown: false, recordingHref: "", recordingUrl: "" }
  switch (row.status) {
    case "live":
      return { ...base, kind: "live", player: true, liveBadge: true, chat: true }
    case "reconnecting":
      return { ...base, kind: "live", player: true, chat: true }
    case "starting":
      return { ...base, kind: "starting", chat: true }
    case "scheduled": {
      const t = Date.parse(row.scheduled_at)
      return { ...base, kind: "waiting", canRemind: true, countdown: !Number.isNaN(t) && t > now }
    }
    case "ended": {
      const href = recordingHref(row)
      return { ...base, kind: "ended", recordingHref: href, recordingUrl: href ? "" : row.recording_url }
    }
    case "failed":
      return { ...base, kind: "failed" }
    default:
      return base
  }
}

// ── Countdown and local time ──────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * "2d 4h" from a day out, "4h 05m" from an hour out, "5m 09s" from a
 * minute out, then "42s". Zero or less (the time has passed and the host
 * has not started) is "Starting soon".
 */
export function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "Starting soon"
  const total = Math.ceil(ms / 1000)
  const days = Math.floor(total / 86_400)
  const hours = Math.floor((total % 86_400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${pad(minutes)}m`
  if (minutes > 0) return `${minutes}m ${pad(seconds)}s`
  return `${seconds}s`
}

/** Milliseconds until `iso`; null when it does not parse. */
export function msUntil(iso: string | null | undefined, now = Date.now()): number | null {
  const t = Date.parse(iso ?? "")
  return Number.isNaN(t) ? null : t - now
}

/**
 * A stream's time in the VIEWER's zone and locale, with the zone named:
 * "Sat 3 Oct, 18:30 IST". "" when the time does not parse.
 */
export function formatLocalDateTime(iso: string | null | undefined, locale?: string, timeZone?: string): string {
  const t = Date.parse(iso ?? "")
  if (Number.isNaN(t)) return ""
  return new Intl.DateTimeFormat(locale, {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short", timeZone,
  }).format(new Date(t))
}

// ── Schedule form ─────────────────────────────────────────────────────

export const STREAM_TITLE_MAX = 140
export const STREAM_DESCRIPTION_MAX = 500

/** What the host may choose: "paid" is refused to every viewer by live-service-v2, so it is never offered. */
export type FormVisibility = "followers" | "public"

export interface StreamFormValues {
  title: string
  description: string
  /** Category slug, "" for none. */
  category: string
  visibility: FormVisibility
  orientation: LiveOrientation
  source: LiveSource
  /** A `<input type="datetime-local">` value in the viewer's zone, "" for "not scheduled". */
  scheduledLocal: string
  /** The uploaded cover, null for none. */
  cover_media_id: string | null
}

export const EMPTY_STREAM_FORM: StreamFormValues = {
  title: "", description: "", category: "", visibility: "public", orientation: "landscape", source: "device", scheduledLocal: "", cover_media_id: null,
}

const LOCAL_INPUT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/

/** A datetime-local value (the viewer's wall clock) → an ISO instant; "" when it is not one. */
export function localInputToIso(value: string): string {
  const m = LOCAL_INPUT_RE.exec(value.trim())
  if (!m) return ""
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]))
  return Number.isNaN(d.getTime()) ? "" : d.toISOString()
}

/** An ISO instant → the datetime-local value for the viewer's zone; "" when it does not parse. */
export function isoToLocalInput(iso: string | null | undefined): string {
  const t = Date.parse(iso ?? "")
  if (Number.isNaN(t)) return ""
  const d = new Date(t)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export interface StreamFormCheck {
  ok: boolean
  errors: { title?: string; scheduled_at?: string }
  /** The ISO instant to send; null when the stream is not scheduled. */
  scheduled_at: string | null
}

/**
 * Title: 1..140 characters after trimming. Time: optional unless
 * `requireTime` (the Creator Hub schedules; /live/new may go live now);
 * when given it must parse and lie in the future.
 */
export function validateStreamForm(values: Pick<StreamFormValues, "title" | "scheduledLocal">, opts: { requireTime?: boolean; now?: number } = {}): StreamFormCheck {
  const errors: StreamFormCheck["errors"] = {}
  const title = values.title.trim()
  if (!title) errors.title = "Give your stream a title."
  else if (title.length > STREAM_TITLE_MAX) errors.title = `Keep the title under ${STREAM_TITLE_MAX} characters.`

  let scheduledAt: string | null = null
  const raw = values.scheduledLocal.trim()
  if (!raw) {
    if (opts.requireTime) errors.scheduled_at = "Choose a date and time."
  } else {
    const iso = localInputToIso(raw)
    if (!iso) errors.scheduled_at = "That date and time isn't valid."
    else if (Date.parse(iso) <= (opts.now ?? Date.now())) errors.scheduled_at = "Choose a time in the future."
    else scheduledAt = iso
  }
  return { ok: !errors.title && !errors.scheduled_at, errors, scheduled_at: scheduledAt }
}

/** The form for editing a scheduled stream. */
export function formFromRow(row: StreamRow): StreamFormValues {
  return {
    title: row.title,
    description: row.description,
    category: row.category,
    visibility: row.visibility === "followers" ? "followers" : "public",
    orientation: row.orientation,
    source: row.source,
    scheduledLocal: isoToLocalInput(row.scheduled_at),
    cover_media_id: row.cover_media_id || null,
  }
}

// ── Create and PATCH bodies ───────────────────────────────────────────

/**
 * POST /streams. encoder.createStreamBody owns the fields that existed
 * before; orientation is sent when chosen and category only when set.
 */
export function streamCreateBody(input: CreateStreamInput): Record<string, unknown> {
  const body = createStreamBody(input)
  if (input.orientation) body.orientation = input.orientation
  if (input.category) body.category = input.category
  return body
}

/** The create input of a checked form. */
export function createInputFromForm(values: StreamFormValues, scheduledAt: string | null): CreateStreamInput {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    visibility: values.visibility,
    cover_media_id: values.cover_media_id,
    scheduled_at: scheduledAt,
    source: values.source,
    orientation: values.orientation,
    category: values.category || undefined,
  }
}

/**
 * PATCH /streams/:id — only what changed, and only the fields the route
 * takes (title, description, category, cover_media_id, scheduled_at,
 * visibility, orientation). `source` cannot be changed after create and is
 * never sent; visibility is never "paid". An empty object means "nothing
 * to save".
 */
export function streamPatchBody(original: StreamRow, values: StreamFormValues, scheduledAt: string | null): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  const title = values.title.trim()
  const description = values.description.trim()
  if (title !== original.title) body.title = title
  if (description !== original.description) body.description = description
  if (values.category !== original.category) body.category = values.category
  if (values.cover_media_id && values.cover_media_id !== original.cover_media_id) body.cover_media_id = values.cover_media_id
  if (scheduledAt && Date.parse(scheduledAt) !== Date.parse(original.scheduled_at)) body.scheduled_at = scheduledAt
  if (values.visibility !== original.visibility) body.visibility = values.visibility
  if (values.orientation !== original.orientation) body.orientation = values.orientation
  return body
}

/** POST /streams and PATCH /streams/:id refusals this form can cause. */
export function scheduleErrorCopy(err: unknown): string {
  switch (errorCode(err)) {
    case "INVALID_CATEGORY":
      return "That topic isn't available. Choose another."
    case "STREAM_STATE_CONFLICT":
      return "This stream has already started or ended, so it can't be edited."
    case "VALIDATION_ERROR":
    case "INVALID_REQUEST":
      return "Check the details and try again."
    case "FORBIDDEN":
      return "Only the host can edit this stream."
    case "NOT_FOUND":
      return "This stream no longer exists."
    case "LIVE_BANNED":
      return "You can't go live right now."
  }
  if (errorStatus(err) === 401) return "Sign in to schedule a stream."
  return "We couldn't save your stream. Try again."
}

// ── Reminders ─────────────────────────────────────────────────────────

export interface ReminderState {
  reminder_set: boolean
  reminder_count: number
}

/** `{data:{reminder_set, reminder_count}}`; null when the body has no data object. */
export function parseReminder(body: unknown): ReminderState | null {
  const data = asObj(dataOf(body))
  if (!data) return null
  return { reminder_set: data.reminder_set === true, reminder_count: count(data.reminder_count) }
}

/** What the button shows the instant it is pressed: the flag flips and the count moves by one. */
export function nextReminder(current: ReminderState, on: boolean): ReminderState {
  if (current.reminder_set === on) return current
  return { reminder_set: on, reminder_count: Math.max(0, current.reminder_count + (on ? 1 : -1)) }
}

/** PUT sets, DELETE clears; both idempotent, neither has a body. */
export function reminderRequest(streamId: string, on: boolean): { method: "put" | "delete"; url: string } {
  return { method: on ? "put" : "delete", url: LIVE_ROUTES.reminder(streamId) }
}

export interface ReminderHttp {
  put(url: string): Promise<{ data: unknown }>
  delete(url: string): Promise<{ data: unknown }>
}

/** Where the reminder state of a stream is kept (the query cache in the app, a plain object in tests). */
export interface ReminderStore<S> {
  read(streamId: string): ReminderState | null
  write(streamId: string, state: ReminderState): void
  snapshot(): S
  restore(snapshot: S): void
}

/**
 * Notify me / Reminder set. The store changes at once (optimistic); the
 * server's answer then replaces the guess. A failure puts back exactly
 * what was there before and rethrows, so the caller can say why.
 */
export async function toggleReminder<S>(http: ReminderHttp, store: ReminderStore<S>, streamId: string, on: boolean): Promise<ReminderState> {
  const before = store.read(streamId) ?? { reminder_set: !on, reminder_count: 0 }
  const snapshot = store.snapshot()
  const guess = nextReminder(before, on)
  store.write(streamId, guess)
  try {
    const req = reminderRequest(streamId, on)
    const res = await (req.method === "put" ? http.put(req.url) : http.delete(req.url))
    const answer = parseReminder(res.data) ?? guess
    store.write(streamId, answer)
    return answer
  } catch (err) {
    store.restore(snapshot)
    throw err
  }
}

/**
 * Writes a reminder state into whatever a query holds: one row, a page
 * (`{items}`) or an infinite list (`{pages}`). Anything else, and any data
 * without that stream, comes back as the same reference.
 */
export function patchReminder<T>(data: T, streamId: string, state: ReminderState): T {
  const obj = asObj(data)
  if (!obj) return data
  if (Array.isArray(obj.pages)) {
    let changed = false
    const pages = obj.pages.map((p) => {
      const next = patchReminder(p, streamId, state)
      if (next !== p) changed = true
      return next
    })
    return changed ? ({ ...obj, pages } as T) : data
  }
  if (Array.isArray(obj.items)) {
    let changed = false
    const items = obj.items.map((row) => {
      const next = patchReminder(row, streamId, state)
      if (next !== row) changed = true
      return next
    })
    return changed ? ({ ...obj, items } as T) : data
  }
  if (obj.id === streamId) return { ...obj, reminder_set: state.reminder_set, reminder_count: state.reminder_count } as T
  return data
}

export function reminderErrorCopy(err: unknown): string {
  if (errorStatus(err) === 401) return "Sign in to get a reminder."
  switch (errorCode(err)) {
    case "STREAM_STATE_CONFLICT":
      return "This stream has already started."
    case "NOT_FOUND":
      return "This stream no longer exists."
  }
  return "We couldn't save your reminder. Try again."
}

/** "1 reminder set" / "12 reminders set"; "" at zero. */
export function reminderCountLabel(n: number): string {
  if (n <= 0) return ""
  return n === 1 ? "1 reminder set" : `${n.toLocaleString()} reminders set`
}
