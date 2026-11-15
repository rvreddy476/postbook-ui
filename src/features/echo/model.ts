/*
  Echo (premium short notes): the client model, pure.

  The contract is modernsmapp docs/designs/echo-contract.md; nothing here
  changes it. A note is the post JSON post-service already returns plus the
  Echo fields. Every reader below tolerates a missing or wrongly typed
  field, so an older or newer server never breaks a screen. The words match
  the Android client (feature/echo EchoErrors.kt, EchoRules.kt) so web and
  app say the same things.
*/

// ── Wire shapes ─────────────────────────────────────────────────────────

export type ReplyPolicy = "everyone" | "following" | "mentioned"

export const REPLY_POLICIES: readonly { value: ReplyPolicy; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "following", label: "People you follow" },
  { value: "mentioned", label: "Only people you mention" },
]

export function replyPolicyLabel(policy: ReplyPolicy): string {
  return REPLY_POLICIES.find((p) => p.value === policy)?.label ?? "Everyone"
}

/** The author's mark (design §3.4). Premium alone shows nothing; only a verified account carries one. */
export type VerificationMark = "none" | "person" | "official" | "government"

export function verificationMark(isVerified: boolean, level: string): VerificationMark {
  if (!isVerified) return "none"
  if (level === "organisation") return "official"
  if (level === "government") return "government"
  return "person"
}

export const MARK_LABEL: Record<VerificationMark, string> = {
  none: "",
  person: "Verified",
  official: "Official",
  government: "Government",
}

export interface NoteAuthor {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  mark: VerificationMark
}

export interface NoteMedia {
  mediaId: string
  isGif: boolean
  altText: string
  /** A note's one video (kind "video"); everything else is a picture. */
  isVideo: boolean
  /** Measured length; 0 until media-service has measured it. */
  durationMs: number
  /** The authorised HLS master playlist once transcoded, else null. */
  hlsUrl: string | null
}

export interface Note {
  id: string
  authorId: string
  author: NoteAuthor | null
  text: string
  media: NoteMedia[]
  createdAt: string
  editedAt: string | null
  replyToId: string | null
  conversationId: string
  quoteOfId: string | null
  replyPolicy: ReplyPolicy
  replyCount: number
  likeCount: number
  repostCount: number
  liked: boolean
  reposted: boolean
  viewerCanReply: boolean
  /** One level deep; null when there is none or the quoted note is gone (quoteOfId stays). */
  quoted: Note | null
  // ── Echo v2 (echo-v2-contract.md §1) ──
  viewCount: number
  bookmarkCount: number
  bookmarked: boolean
  quoteCount: number
  /** counts.shares on the post JSON (POST /v1/posts/:id/share). */
  shareCount: number
  status: NoteStatus
  scheduledAt: string | null
  /** Why a due scheduled note did not publish (contract §3); null when none. */
  publishError: string | null
  poll: Poll | null
  /** On the first note of a thread, its live part count (the first included); 0 otherwise. */
  threadParts: number
  /** A video still transcoding or awaiting its check: only its author is shown the note. */
  isProcessing: boolean
  /** The author's own note whose video is longer than the note allows; nobody else sees it. */
  videoTooLong: boolean
}

/** "failed": a scheduled note that could not publish after its retries (server rule; publish_error says why). */
export type NoteStatus = "published" | "scheduled" | "failed"

export interface PollOption {
  index: number
  label: string
  /** null while the counts are hidden from this viewer (contract §1). */
  votes: number | null
}

export interface Poll {
  options: PollOption[]
  totalVotes: number
  endsAt: string
  closed: boolean
  viewerVote: number | null
}

export interface NotePage {
  items: Note[]
  /** null on the last page. */
  nextCursor: string | null
}

export type EligibilityReason = "" | "premium_required" | "account_too_new" | "suspended"

export interface Eligibility {
  canPost: boolean
  canReply: boolean
  reason: EligibilityReason
}

const str = (v: unknown): string => (typeof v === "string" ? v : "")
const optStr = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null)
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)
const bool = (v: unknown): boolean => v === true
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)

/** The envelope's `data`, or the value itself when it is not an envelope. */
export function unwrap(body: unknown): unknown {
  return isObj(body) && "data" in body ? body.data : body
}

function toPolicy(v: unknown): ReplyPolicy {
  return v === "following" || v === "mentioned" ? v : "everyone"
}

function toAuthor(v: unknown, authorId: string): NoteAuthor | null {
  if (!isObj(v)) return null
  return {
    id: str(v.id) || authorId,
    username: str(v.username),
    displayName: str(v.display_name),
    avatarUrl: optStr(v.avatar_url),
    mark: verificationMark(bool(v.is_verified), str(v.verification_level)),
  }
}

function toMedia(v: unknown): NoteMedia[] {
  if (!Array.isArray(v)) return []
  return v
    .filter(isObj)
    .filter((m) => str(m.media_id))
    .sort((a, b) => num(a.position) - num(b.position))
    .map((m) => ({
      mediaId: str(m.media_id),
      isGif: m.kind === "gif" || m.mime_type === "image/gif",
      altText: str(m.alt_text),
      isVideo: m.kind === "video",
      durationMs: num(m.duration_ms),
      hlsUrl: optStr(m.hls_url),
    }))
}

function toPoll(v: unknown): Poll | null {
  if (!isObj(v) || !Array.isArray(v.options)) return null
  const options = v.options
    .filter(isObj)
    .map((o, i) => ({
      index: typeof o.index === "number" && Number.isInteger(o.index) ? o.index : i,
      label: str(o.label),
      votes: typeof o.votes === "number" && Number.isFinite(o.votes) ? Math.max(0, Math.floor(o.votes)) : null,
    }))
  if (options.length === 0) return null
  return {
    options,
    totalVotes: num(v.total_votes),
    endsAt: str(v.ends_at),
    closed: bool(v.closed),
    viewerVote: typeof v.viewer_vote === "number" && Number.isInteger(v.viewer_vote) ? v.viewer_vote : null,
  }
}

/** One note from the wire; null when it is not one (no id). */
export function parseNote(raw: unknown, depth = 0): Note | null {
  const v = unwrap(raw)
  if (!isObj(v) || !str(v.id)) return null
  const id = str(v.id)
  const authorId = str(v.author_id)
  return {
    id,
    authorId,
    author: toAuthor(v.author, authorId),
    text: str(v.text),
    media: toMedia(v.media),
    createdAt: str(v.created_at),
    editedAt: optStr(v.edited_at),
    replyToId: optStr(v.reply_to_id),
    conversationId: optStr(v.conversation_id) ?? id,
    quoteOfId: optStr(v.quote_of_id),
    replyPolicy: toPolicy(v.reply_policy),
    replyCount: num(v.reply_count),
    likeCount: num(v.like_count),
    repostCount: num(v.repost_count),
    liked: bool(v.viewer_has_liked),
    reposted: bool(v.viewer_has_reposted),
    viewerCanReply: bool(v.viewer_can_reply),
    // The contract keeps it one level deep; so does the reader.
    quoted: depth === 0 ? parseNote(v.quoted_note, 1) : null,
    viewCount: num(v.view_count),
    bookmarkCount: num(v.bookmark_count),
    // The server lane adds viewer_has_bookmarked; the post JSON already has is_bookmarked.
    bookmarked: typeof v.viewer_has_bookmarked === "boolean" ? v.viewer_has_bookmarked : bool(v.is_bookmarked),
    quoteCount: num(v.quote_count),
    shareCount: isObj(v.counts) ? num(v.counts.shares) : num(v.share_count),
    status: v.status === "scheduled" || v.status === "failed" ? v.status : "published",
    scheduledAt: optStr(v.scheduled_at),
    publishError: optStr(v.publish_error),
    poll: toPoll(v.poll),
    threadParts: num(v.thread_parts),
    isProcessing: bool(v.is_processing),
    videoTooLong: bool(v.video_too_long),
  }
}

/** `{items:[Note], next_cursor}`; an empty cursor means the end. */
export function parseNotePage(raw: unknown): NotePage {
  const v = unwrap(raw)
  if (!isObj(v)) return { items: [], nextCursor: null }
  const items = Array.isArray(v.items) ? v.items.map((n) => parseNote(n)).filter((n): n is Note => n !== null) : []
  return { items, nextCursor: optStr(v.next_cursor) }
}

/** `{notes:[Note]}` from POST /v1/notes/thread. */
export function parseThread(raw: unknown): Note[] {
  const v = unwrap(raw)
  if (!isObj(v) || !Array.isArray(v.notes)) return []
  return v.notes.map((n) => parseNote(n)).filter((n): n is Note => n !== null)
}

export function parseEligibility(raw: unknown): Eligibility {
  const v = unwrap(raw)
  if (!isObj(v)) return { canPost: false, canReply: false, reason: "" }
  const r = v.reason
  const reason: EligibilityReason = r === "premium_required" || r === "account_too_new" || r === "suspended" ? r : ""
  return { canPost: bool(v.can_post), canReply: bool(v.can_reply), reason }
}

// ── Rules (the server enforces them; the client checks first so Post says why it is off) ──

export const ECHO_RULES = {
  maxChars: 500,
  maxImages: 4,
  threadMin: 2,
  threadMax: 25,
  editMinutes: 30,
  warnAtRemaining: 20,
} as const

/** Code points after trimming: the way the server counts runes. */
export function noteLength(text: string): number {
  return Array.from(text.trim()).length
}

export function remaining(text: string): number {
  return ECHO_RULES.maxChars - noteLength(text)
}

export const MEDIA_LIMIT_MESSAGE = "Add up to 4 photos, 1 GIF or 1 video."

/** A picture or the one video staged on a composer entry. */
export interface StagedMedia {
  key: string
  isGif: boolean
  isVideo?: boolean
  mediaId?: string
  failed?: boolean
}

/** The media rule: up to 4 images, or exactly 1 GIF on its own, or exactly 1 video on its own. */
export function mediaProblem(media: readonly Pick<StagedMedia, "isGif" | "isVideo">[]): string | null {
  if (media.some((m) => m.isVideo) && media.length > 1) return MEDIA_LIMIT_MESSAGE
  const gifs = media.filter((m) => m.isGif).length
  if (gifs > 0 && media.length > 1) return MEDIA_LIMIT_MESSAGE
  if (media.length > ECHO_RULES.maxImages) return MEDIA_LIMIT_MESSAGE
  return null
}

/** How many of the picked files (true for a GIF, in pick order) fit beside what is staged. */
export function acceptedPicks(current: readonly Pick<StagedMedia, "isGif">[], incomingGifs: readonly boolean[]): number {
  let staged = current.map((m) => m.isGif)
  let accepted = 0
  for (const gif of incomingGifs) {
    const next = [...staged, gif]
    const ok = next.some(Boolean) ? next.length === 1 : next.length <= ECHO_RULES.maxImages
    if (!ok) break
    staged = next
    accepted += 1
  }
  return accepted
}

/** Echo takes photos and GIFs; a video goes through the Video pill. */
export function isAcceptedFile(file: { type: string }): boolean {
  return file.type.startsWith("image/")
}

export function isVideoFile(file: { type: string }): boolean {
  return file.type.startsWith("video/")
}

/**
 * Video limits, after X (founder, 15 Nov 2026): 140 s and 512 MB without
 * Premium (replies), 10 minutes with Premium. The server keeps the same
 * numbers (docs/designs/echo-v2-contract.md, "Video in notes").
 */
export const VIDEO_LIMITS = {
  standard: { maxMs: 140_000, maxBytes: 512 * 1024 * 1024, words: "2 min 20 s" },
  premium: { maxMs: 600_000, maxBytes: 0, words: "10 minutes" },
} as const

export function videoLimit(premium: boolean) {
  return premium ? VIDEO_LIMITS.premium : VIDEO_LIMITS.standard
}

/** Why a picked video cannot go on a note, or null. durationMs 0 means unknown. */
export function videoProblem(durationMs: number, sizeBytes: number, premium: boolean): string | null {
  const lim = videoLimit(premium)
  if (durationMs > lim.maxMs) return `Videos can be up to ${lim.words}.`
  if (lim.maxBytes > 0 && sizeBytes > lim.maxBytes) return "Videos can be up to 512 MB."
  return null
}

/** What the author is told about a note whose video is over its limit. */
export function videoTooLongNotice(durationMs: number): string {
  const words = durationMs > VIDEO_LIMITS.premium.maxMs ? VIDEO_LIMITS.premium.words : VIDEO_LIMITS.standard.words
  return `This video is longer than ${words} and is only visible to you.`
}

/** "1:05", "12:03", "1:02:03". */
export function videoClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, "0")
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`
}

/** Why one entry cannot be posted yet, or null when it can. */
export function entryProblem(text: string, media: readonly StagedMedia[] = []): string | null {
  const length = noteLength(text)
  if (length > ECHO_RULES.maxChars) return `Notes can be up to ${ECHO_RULES.maxChars} characters.`
  if (length === 0 && media.length === 0) return "Write something or add a photo."
  if (media.some((m) => m.failed)) return media.some((m) => m.isVideo) ? "The video didn't upload. Remove it and try again." : "A photo didn't upload. Remove it and try again."
  return mediaProblem(media)
}

/** Why a thread cannot be posted yet, or null. Each entry obeys the note rules. */
export function threadProblem(entries: readonly { text: string; media?: readonly StagedMedia[] }[]): string | null {
  if (entries.length < ECHO_RULES.threadMin || entries.length > ECHO_RULES.threadMax) {
    return `A thread needs ${ECHO_RULES.threadMin} to ${ECHO_RULES.threadMax} notes.`
  }
  for (let i = 0; i < entries.length; i += 1) {
    const problem = entryProblem(entries[i].text, entries[i].media ?? [])
    if (problem) return `Note ${i + 1}: ${problem}`
  }
  return null
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null
  const t = Date.parse(value)
  return Number.isFinite(t) ? t : null
}

/** Only the author deletes a note or changes who can reply. */
export function isAuthor(note: Pick<Note, "authorId">, viewerId: string | null | undefined): boolean {
  return !!viewerId && note.authorId === viewerId
}

/**
 * The author may change a note's text for 30 minutes after posting. A time
 * that does not parse is never editable here; the server stays the authority.
 */
export function canEditText(note: Pick<Note, "authorId" | "createdAt">, viewerId: string | null | undefined, now: number = Date.now()): boolean {
  if (!isAuthor(note, viewerId)) return false
  const created = parseTime(note.createdAt)
  if (created === null || now < created) return false
  return now - created < ECHO_RULES.editMinutes * 60_000
}

/** "now", "5m", "3h", "2d", then the date. */
export function shortAge(createdAt: string, now: number = Date.now()): string {
  const created = parseTime(createdAt)
  if (created === null) return ""
  const minutes = Math.floor((now - created) / 60_000)
  if (minutes < 1) return "now"
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(created).toISOString().slice(0, 10)
}

/** "1.2K", "3M". Zero shows nothing. */
export function compactCount(count: number): string {
  if (count <= 0) return ""
  if (count < 1000) return String(count)
  const [unit, suffix] = count < 1_000_000 ? [1000, "K"] : [1_000_000, "M"]
  const tenths = Math.floor((count * 10) / unit)
  return `${tenths % 10 === 0 ? tenths / 10 : (tenths / 10).toFixed(1)}${suffix}`
}

// ── Text: mentions, hashtags, links ─────────────────────────────────────

export type TextSegment =
  | { kind: "text"; text: string }
  | { kind: "mention"; text: string; username: string }
  | { kind: "hashtag"; text: string; tag: string }
  | { kind: "link"; text: string; href: string }

const TOKEN = /(https?:\/\/[^\s<>"]+)|(^|[^\p{L}\p{N}_@])@([A-Za-z0-9_.]{1,30})|(^|[^\p{L}\p{N}_&#])#([\p{L}\p{N}_]{1,50})/gu

/** Splits a note's text into plain runs, @mentions, #hashtags and http(s) links. */
export function textSegments(text: string): TextSegment[] {
  const out: TextSegment[] = []
  let last = 0
  const push = (seg: TextSegment) => {
    if (seg.kind === "text" && !seg.text) return
    const prev = out[out.length - 1]
    if (seg.kind === "text" && prev?.kind === "text") prev.text += seg.text
    else out.push(seg)
  }
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0
    if (m[1]) {
      // A link's trailing punctuation belongs to the sentence.
      const href = m[1].replace(/[.,!?;:)\]]+$/, "")
      push({ kind: "text", text: text.slice(last, at) })
      push({ kind: "link", text: href, href })
      last = at + href.length
    } else if (m[3]) {
      const lead = m[2] ?? ""
      push({ kind: "text", text: text.slice(last, at + lead.length) })
      const username = m[3].replace(/\.+$/, "")
      push({ kind: "mention", text: `@${username}`, username })
      last = at + lead.length + 1 + username.length
    } else if (m[5]) {
      const lead = m[4] ?? ""
      push({ kind: "text", text: text.slice(last, at + lead.length) })
      push({ kind: "hashtag", text: `#${m[5]}`, tag: m[5] })
      last = at + lead.length + 1 + m[5].length
    }
  }
  push({ kind: "text", text: text.slice(last) })
  return out
}

// ── Paths ───────────────────────────────────────────────────────────────

/** The legacy permalink (/echo/note/<id>); it redirects to the status page. Notifications still link here. */
export function notePath(id: string): string {
  return `/echo/note/${encodeURIComponent(id)}`
}

/** X-style permalink: /echo/<handle>/status/<id>. "i" stands in when the handle is unknown. */
export function statusPath(note: Pick<Note, "id" | "author">): string {
  const handle = note.author?.username || "i"
  return `/echo/${encodeURIComponent(handle)}/status/${encodeURIComponent(note.id)}`
}

export function quotesPath(note: Pick<Note, "id" | "author">): string {
  return `${statusPath(note)}/quotes`
}

export function hashtagPath(tag: string): string {
  return `/echo/hashtag/${encodeURIComponent(tag.replace(/^#/, ""))}`
}

export function echoProfilePath(username: string): string {
  return `/echo/${encodeURIComponent(username)}`
}

/** "1,234" for the big post's counts. */
export function fullCount(count: number): string {
  return Math.max(0, Math.floor(count)).toLocaleString("en-US")
}

/** "3:45 PM · Nov 14, 2026" for the big post. */
export function fullDate(createdAt: string): string {
  const t = parseTime(createdAt)
  if (t === null) return ""
  const d = new Date(t)
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  return `${time} · ${date}`
}

/** A picture on a note, drawn from media-service by id. */
export function noteMediaPath(mediaId: string): string {
  return `/v1/media/${encodeURIComponent(mediaId)}/serve`
}

/** The author's Echo profile when the handle is known; the VChat profile by id otherwise. */
export function profilePath(author: Pick<NoteAuthor, "username" | "id"> | null, authorId: string): string {
  if (author?.username) return echoProfilePath(author.username)
  return `/u/${encodeURIComponent(author?.id || authorId)}`
}

// ── Errors ──────────────────────────────────────────────────────────────

export const ECHO_ERROR_CODES = [
  "PREMIUM_REQUIRED",
  "PREMIUM_CHECK_UNAVAILABLE",
  "ACCOUNT_TOO_NEW",
  "ACCOUNT_CHECK_UNAVAILABLE",
  "REPLY_NOT_ALLOWED",
  "NOTE_TOO_LONG",
  "EMPTY_NOTE",
  "TOO_MANY_MEDIA",
  "MEDIA_NOT_ALLOWED",
  "VIDEO_TOO_LONG",
  "VIDEO_TOO_LARGE",
  "NOTE_NOT_FOUND",
  "INVALID_THREAD",
  "INVALID_REQUEST",
  "RATE_LIMITED",
  "EDIT_WINDOW_CLOSED",
  "NOT_AUTHOR",
  "ECHO_NOT_ENABLED",
  "MEDIA_NOT_OWNED",
  "MEDIA_NOT_FOUND",
  "MEDIA_NOT_READY",
  "INVALID_POLL",
  "POLL_WITH_MEDIA",
  "INVALID_SCHEDULE",
  "POLL_CLOSED",
  "ALREADY_VOTED",
  "OWN_POLL",
] as const

export type EchoErrorCode = (typeof ECHO_ERROR_CODES)[number]

export const ECHO_WORDS = {
  premiumRequired: "Posting on Echo needs Momentum Premium",
  premiumRequiredDetail: "You can still read, like, repost and reply. Premium members can post notes, threads and quotes.",
  accountTooNew: "Your account is too new to reply on Echo",
  accountTooNewDetail: "Accounts can reply once they are 7 days old.",
  suspended: "Your account can't post on Echo right now",
  suspendedDetail: "Your account isn't in good standing, so posting and replying are paused.",
  replyNotAllowed: "The author has limited who can reply to this note.",
  noteNotFound: "This note isn't available.",
  generic: "Something went wrong. Try again.",
  noNetwork: "No connection. Check your network and try again.",
} as const

const MESSAGES: Record<EchoErrorCode, string> = {
  PREMIUM_REQUIRED: ECHO_WORDS.premiumRequired,
  PREMIUM_CHECK_UNAVAILABLE: "We couldn't check your Premium membership. Try again in a moment.",
  ACCOUNT_TOO_NEW: ECHO_WORDS.accountTooNewDetail,
  ACCOUNT_CHECK_UNAVAILABLE: "We couldn't check your account. Try again in a moment.",
  REPLY_NOT_ALLOWED: ECHO_WORDS.replyNotAllowed,
  NOTE_TOO_LONG: `Notes can be up to ${ECHO_RULES.maxChars} characters.`,
  EMPTY_NOTE: "Write something or add a photo.",
  TOO_MANY_MEDIA: MEDIA_LIMIT_MESSAGE,
  MEDIA_NOT_ALLOWED: "Echo takes photos, GIFs and videos only.",
  VIDEO_TOO_LONG: "This video is too long for a note.",
  VIDEO_TOO_LARGE: "Videos can be up to 512 MB.",
  NOTE_NOT_FOUND: ECHO_WORDS.noteNotFound,
  INVALID_THREAD: "A thread needs 2 to 25 notes, each within the limits.",
  INVALID_REQUEST: "Something in this note isn't right. Check it and try again.",
  RATE_LIMITED: "You're posting too fast. Try again later.",
  EDIT_WINDOW_CLOSED: "Notes can only be edited for 30 minutes after posting.",
  NOT_AUTHOR: "Only the author can change this note.",
  ECHO_NOT_ENABLED: "Echo isn't available right now.",
  MEDIA_NOT_OWNED: "One of these photos isn't yours to post.",
  MEDIA_NOT_FOUND: "One of these photos is missing. Remove it and add it again.",
  MEDIA_NOT_READY: "Your photos are still processing. Try again in a moment.",
  INVALID_POLL: "A poll needs 2 to 4 choices of up to 25 characters, open from 5 minutes to 7 days.",
  POLL_WITH_MEDIA: "A post with a poll can't have photos or a GIF.",
  INVALID_SCHEDULE: "Pick a time from 5 minutes to 18 months from now.",
  POLL_CLOSED: "This poll has ended.",
  ALREADY_VOTED: "You've already voted in this poll.",
  OWN_POLL: "You can't vote in your own poll.",
}

/** What an axios-style failure says: the server's code, status and Retry-After. */
export interface EchoFailure {
  code: string | null
  status: number | null
  retryAfterSeconds: number | null
  network: boolean
}

export function readFailure(err: unknown): EchoFailure {
  const e = isObj(err) ? err : {}
  const response = isObj(e.response) ? e.response : null
  const data = response && isObj(response.data) ? response.data : null
  const error = data && isObj(data.error) ? data.error : null
  const headers = response && isObj(response.headers) ? response.headers : null
  const retry = headers ? Number(headers["retry-after"] ?? headers["Retry-After"]) : Number.NaN
  return {
    code: error && typeof error.code === "string" && error.code ? error.code : null,
    status: response && typeof response.status === "number" ? response.status : null,
    retryAfterSeconds: Number.isFinite(retry) && retry > 0 ? Math.floor(retry) : null,
    network: !response && (e.isAxiosError === true || e.code === "ERR_NETWORK"),
  }
}

/** "You're posting too fast. Try again in 2 minutes." from Retry-After when the server sent one. */
export function rateLimitedMessage(retryAfterSeconds: number | null): string {
  const base = "You're posting too fast."
  if (!retryAfterSeconds || retryAfterSeconds <= 0) return `${base} Try again later.`
  const plural = (n: number, unit: string) => (n === 1 ? `1 ${unit}` : `${n} ${unit}s`)
  const wait = retryAfterSeconds < 60 ? plural(retryAfterSeconds, "second") : plural(Math.ceil(retryAfterSeconds / 60), "minute")
  return `${base} Try again in ${wait}.`
}

/** One clear sentence for any failure an Echo call can come back with. Keyed on the code, never the server's message. */
export function echoErrorMessage(err: unknown): string {
  const f = readFailure(err)
  if (f.network) return ECHO_WORDS.noNetwork
  if (f.code === "RATE_LIMITED" || f.status === 429) return rateLimitedMessage(f.retryAfterSeconds)
  if (f.code && f.code in MESSAGES) return MESSAGES[f.code as EchoErrorCode]
  if (f.status === 404) return ECHO_WORDS.noteNotFound
  if (f.status === 503) return MESSAGES.ECHO_NOT_ENABLED
  return ECHO_WORDS.generic
}

/** The eligibility dialog's title and detail; null when nothing is blocked. */
export function eligibilityWords(reason: EligibilityReason): { title: string; detail: string } | null {
  switch (reason) {
    case "premium_required":
      return { title: ECHO_WORDS.premiumRequired, detail: ECHO_WORDS.premiumRequiredDetail }
    case "account_too_new":
      return { title: ECHO_WORDS.accountTooNew, detail: ECHO_WORDS.accountTooNewDetail }
    case "suspended":
      return { title: ECHO_WORDS.suspended, detail: ECHO_WORDS.suspendedDetail }
    default:
      return null
  }
}

/**
 * Whether the composer may open for this purpose. A top-level note, a
 * thread and a quote need can_post; a reply needs can_reply. When it may
 * not, the reason's words; a refusal with no reason still says something.
 */
export function composerGate(e: Eligibility, purpose: "note" | "reply"): { open: true } | { open: false; title: string; detail: string; premium: boolean } {
  const allowed = purpose === "reply" ? e.canReply : e.canPost
  if (allowed) return { open: true }
  // A reply refused for Premium alone cannot be (replies need no Premium); fall back to the generic words then.
  const reason = purpose === "reply" && e.reason === "premium_required" ? "" : e.reason
  const words = eligibilityWords(reason) ?? (purpose === "reply"
    ? { title: "You can't reply on Echo right now", detail: ECHO_WORDS.generic }
    : { title: ECHO_WORDS.premiumRequired, detail: ECHO_WORDS.premiumRequiredDetail })
  return { open: false, ...words, premium: reason === "premium_required" || (purpose === "note" && reason === "") }
}

/** Optimistic like toggle on a note, and the same on its quote when it is the same note. */
export function withLike(note: Note, id: string, liked: boolean, count?: number): Note {
  const apply = (n: Note): Note =>
    n.id === id ? { ...n, liked, likeCount: typeof count === "number" ? Math.max(0, count) : Math.max(0, n.likeCount + (liked === n.liked ? 0 : liked ? 1 : -1)) } : n
  const next = apply(note)
  return next.quoted ? { ...next, quoted: apply(next.quoted) } : next
}

export function withRepost(note: Note, id: string, reposted: boolean): Note {
  const apply = (n: Note): Note =>
    n.id === id ? { ...n, reposted, repostCount: Math.max(0, n.repostCount + (reposted === n.reposted ? 0 : reposted ? 1 : -1)) } : n
  const next = apply(note)
  return next.quoted ? { ...next, quoted: apply(next.quoted) } : next
}
