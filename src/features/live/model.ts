// Wire types for live-service-v2 (the only live stack; v1 is retired).
//
// Shapes follow the live-fix contract (1 Oct 2026, section 1):
//   status ∈ scheduled | starting | live | reconnecting | ended | failed
//   ended_reason ∈ host_ended | host_lost | room_finished | admin_stopped | no_media
//   viewer_count is the current audience WITHOUT the host; viewer_peak the true max.
// The new fields are optional so the PostTube Live shelf fixtures, which
// build LiveStream objects by hand, still type-check. Go's omitempty leaves
// cover_media_id, scheduled_at, started_at, ended_at, recording_url and
// recording_duration_seconds OUT of the JSON when unset (they read as
// undefined, not null); moderator_user_ids is present only for the host and
// the stream's moderators.

export type LiveStreamStatus =
  | "scheduled"
  | "starting"
  | "live"
  | "reconnecting"
  | "ended"
  | "failed"

export type LiveEndedReason =
  | "host_ended"
  | "host_lost"
  | "room_finished"
  | "admin_stopped"
  | "no_media"

export type LiveVisibility = "public" | "followers" | "paid"

/** Wide (PostTube) or vertical (Reels). Absent on rows from before 2 Oct 2026: read as landscape. */
export type LiveOrientation = "landscape" | "portrait"

/** The host card on every row (contract 2 Oct 2026). A failed lookup leaves only `user_id`. */
export interface LiveCreator {
  user_id: string
  name?: string
  handle?: string
  avatar_url?: string
  /** e.g. ["founding_creator"]; omitted when none. */
  badges?: string[]
}

export interface LiveStream {
  id: string
  creator_user_id: string
  livekit_room: string
  title: string
  description: string
  cover_media_id: string | null
  status: LiveStreamStatus
  visibility: LiveVisibility
  scheduled_at: string | null
  started_at: string | null
  ended_at: string | null
  viewer_peak: number
  /** Current audience, host excluded (server-counted from LiveKit webhooks). */
  viewer_count?: number
  ended_reason?: LiveEndedReason | "" | null
  status_changed_at?: string | null
  /** Stream moderators (host-chosen, max 5) when the backend sends them. */
  moderator_user_ids?: string[] | null
  /** How the host publishes: this device's camera (absent or "device") or streaming software. */
  source?: "device" | "encoder"
  /** Host and moderators only: an ingress (server URL + stream key) exists. */
  has_ingress?: boolean
  recording_url: string | null
  recording_duration_seconds: number | null
  created_at: string
  updated_at: string
  // Live surfaces contract (2 Oct 2026). All optional on the wire (Go omits
  // zero values); read them through features/live/discovery.ts parseStream.
  orientation?: LiveOrientation
  /** A slug from post-service's taxonomy (GET /v1/posts/categories). */
  category?: string
  creator?: LiveCreator | null
  /** Upcoming rows, signed-in caller. */
  reminder_set?: boolean
  reminder_count?: number
  /** Past rows: the video the recording became. */
  recording_post_id?: string | null
  /** Free hearts sent to the stream. */
  heart_count?: number
}

export interface CreateStreamInput {
  title: string
  description?: string
  visibility: LiveVisibility
  cover_media_id?: string | null
  scheduled_at?: string | null
  /** "encoder" = go live from streaming software; anything else is this device. */
  source?: "device" | "encoder"
  orientation?: LiveOrientation
  category?: string
}

export interface StartStreamResult {
  stream: LiveStream
  publisher_token: string
  room: string
  server_url: string
}

export interface ViewerTokenResult {
  token: string
  room: string
  server_url: string
}

export interface LiveStreamListPage {
  items: LiveStream[]
  next_cursor: string
}

/**
 * GET /v1/livestream/streams: the rows are `data` (an array) and the cursor
 * is `meta.next_cursor`, absent on the last page (api.JSON with
 * omitempty; see testdata/contracts/mtube/livestreams_scheduled.json).
 */
export function parseStreamList(body: unknown): LiveStreamListPage {
  const obj = body && typeof body === "object" ? (body as { data?: unknown; meta?: { next_cursor?: unknown } }) : null
  return {
    items: Array.isArray(obj?.data) ? (obj.data as LiveStream[]) : [],
    next_cursor: str(obj?.meta?.next_cursor),
  }
}

/** One GET /streams/:id/bans row (postgres.StreamBan; the time is `created_at`). */
export interface LiveStreamBan {
  stream_id: string
  user_id: string
  banned_by: string
  reason: string
  created_at: string
}

/** The banned user ids from a GET /bans body ({"data":[...]}). */
export function parseBanList(body: unknown): string[] {
  const data = body && typeof body === "object" ? (body as { data?: unknown }).data : null
  if (!Array.isArray(data)) return []
  return data.map((row) => str((row as Partial<LiveStreamBan> | null)?.user_id)).filter(Boolean)
}

/** The moderator ids from a GET or PUT /moderators body ({"data":{"user_ids":[...]}}). */
export function parseModeratorList(body: unknown): string[] {
  const data = body && typeof body === "object" ? (body as { data?: unknown }).data : null
  const ids = data && typeof data === "object" ? (data as { user_ids?: unknown }).user_ids : null
  return Array.isArray(ids) ? ids.map(str).filter(Boolean) : []
}

/** What the author was in this stream when the message was sent. */
export type LiveChatAuthorRole = "host" | "moderator" | "viewer"

/**
 * The author card on every chat row (contract 2 Oct 2026). Only `user_id`
 * and `role` are guaranteed: a failed lookup leaves name, handle and avatar
 * out, and they read as "" here (features/live/author.ts).
 */
export interface LiveChatAuthor {
  user_id: string
  name: string
  handle: string
  avatar_url: string
  badges: string[]
  role: LiveChatAuthorRole
}

export interface LiveChatMessage {
  id: string
  stream_id: string
  user_id: string
  text: string
  is_pinned?: boolean
  created_at: string
  /** Absent or null on a row from before the contract. */
  author?: LiveChatAuthor | null
}

/** Moderator list cap from the contract (PUT /streams/:id/moderators). */
export const MAX_MODERATORS = 5

/** Go zero values: "" and 0 mean "nothing"; fall through on empty. */
export function str(v: unknown): string {
  return typeof v === "string" ? v : ""
}

export function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

/** Server error code from an axios-shaped error; never branch on the message. */
export function errorCode(err: unknown): string {
  if (!err || typeof err !== "object") return ""
  const ax = err as { response?: { data?: { error?: { code?: unknown } } } }
  return str(ax.response?.data?.error?.code)
}

export function errorStatus(err: unknown): number {
  if (!err || typeof err !== "object") return 0
  const ax = err as { response?: { status?: unknown } }
  return num(ax.response?.status) ?? 0
}
