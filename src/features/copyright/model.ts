import { tubePathnameToPosttube } from "@/features/posttube/tubeRedirect"

/*
  Copyright title review, the author's side (server commit dbdd1c0ea,
  24 Oct 2026). Every wire shape and every sentence the web shows for it
  lives here, so a contract change is one edit.

  Reads (post-service, the author only; absent for every other viewer and
  for a video that was never flagged):
    GET /v1/posts/:id and GET /v1/uploads/videos|flicks rows carry
    "copyright_review": {state: pending|cleared|blocked, matched_title,
    created_at, decided_at?, review_requested_at?}
    (service/copyright_title_review.go:651 CopyrightReviewView). The create
    response does NOT carry it: the studio re-reads the detail after a long
    video is published.

  Write:
    POST /v1/posts/:postId/copyright-review/request {"note"} (1-1000 chars)
      → 200 the same view; 400 INVALID_REQUEST, 404 REVIEW_NOT_FOUND,
        409 REVIEW_ALREADY_DECIDED, 503 COPYRIGHT_REVIEW_UNAVAILABLE
      (http/copyright_review.go:304 RequestCopyrightReview)

  Refusals on the publication routes (http/standing_errors.go:31):
    403 UPLOADS_PAUSED   error.details.until (RFC3339) — long videos only
    409 COPYRIGHT_REVIEW members-only on a held video: PUT /membership,
                         PATCH /v1/posts/:id (keeping a tier counts), and a
                         create the review would hold
*/

/* ── small readers (Go zero values count as absent) ─────────────── */

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function str(v: unknown): string {
  return typeof v === "string" ? v : ""
}

/** An RFC3339 instant, or null for absent, "", Go's zero time or garbage. */
function instant(v: unknown): string | null {
  const s = str(v).trim()
  if (!s || s.startsWith("0001-01-01")) return null
  return Number.isFinite(new Date(s).getTime()) ? s : null
}

/* ── the review ─────────────────────────────────────────────────── */

export const COPYRIGHT_REVIEW_STATES = ["pending", "cleared", "blocked"] as const
export type CopyrightReviewState = (typeof COPYRIGHT_REVIEW_STATES)[number]

export interface CopyrightReview {
  state: CopyrightReviewState
  /** The catalogue title the video matched; "" when the server sent none. */
  matchedTitle: string
  createdAt: string | null
  decidedAt: string | null
  /** When the author sent "I own the rights"; null until then. */
  reviewRequestedAt: string | null
}

/** `copyright_review` off a post detail or an uploads row; null when absent or not a state we know. */
export function decodeCopyrightReview(raw: unknown): CopyrightReview | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const state = str(r.state).toLowerCase()
  if (!(COPYRIGHT_REVIEW_STATES as readonly string[]).includes(state)) return null
  return {
    state: state as CopyrightReviewState,
    matchedTitle: str(r.matched_title).trim(),
    createdAt: instant(r.created_at),
    decidedAt: instant(r.decided_at),
    reviewRequestedAt: instant(r.review_requested_at),
  }
}

/** Hidden from viewers: pending (until a reviewer decides) or blocked (for good). */
export function isCopyrightHeld(review: CopyrightReview | null | undefined): boolean {
  return review?.state === "pending" || review?.state === "blocked"
}

/** "24 Oct 2026", in India time (like the membership dates). "" for no date. */
export function formatCopyrightDate(iso: string | null | undefined, locale = "en-IN"): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ""
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
}

/* ── the copy, per state ────────────────────────────────────────── */

export type CopyrightTone = "warning" | "success" | "danger"

export interface CopyrightReviewCopy {
  tone: CopyrightTone
  /** The short pill for a library row. */
  label: string
  /** The sentence the row, the edit sheet and the video detail show. */
  message: string
  /** "Review requested 24 Oct 2026" once the author asked; null otherwise. */
  requested: string | null
  /** Whether "Request review" is offered: pending and not yet asked. */
  canRequest: boolean
}

export const REQUEST_REVIEW_LABEL = "Request review"
export const REVIEW_NOTE_PLACEHOLDER = "I own the rights / I have a licence"
export const CLEARED_COPY = "Cleared — your video is live"

const matched = (title: string) => (title ? ` It matched “${title}”.` : "")

export function copyrightReviewCopy(review: CopyrightReview): CopyrightReviewCopy {
  switch (review.state) {
    case "pending": {
      const requestedOn = review.reviewRequestedAt ? formatCopyrightDate(review.reviewRequestedAt) : ""
      return {
        tone: "warning",
        label: "In copyright review",
        message: `In copyright review — this video is hidden until our team checks it.${matched(review.matchedTitle)}`,
        requested: review.reviewRequestedAt ? `Review requested ${requestedOn}`.trim() : null,
        canRequest: !review.reviewRequestedAt,
      }
    }
    case "cleared":
      return { tone: "success", label: "Copyright cleared", message: CLEARED_COPY, requested: null, canRequest: false }
    case "blocked":
      return {
        tone: "danger",
        label: "Blocked for copyright",
        message: `Blocked for copyright${review.matchedTitle ? ` — it matched “${review.matchedTitle}”` : ""}. This isn't a strike, but repeated blocks pause long-video uploads.`,
        requested: null,
        canRequest: false,
      }
  }
}

/* ── "Request review" ───────────────────────────────────────────── */

export const REVIEW_NOTE_MAX = 1000

/** Characters as the server counts them (runes, after trimming). */
export function reviewNoteLength(note: string): number {
  return Array.from(note.trim()).length
}

/** Why the note can't be sent yet; null when it can. */
export function reviewNoteProblem(note: string): string | null {
  const n = reviewNoteLength(note)
  if (n === 0) return "Tell us why you have the rights to use it."
  if (n > REVIEW_NOTE_MAX) return `Keep it to ${REVIEW_NOTE_MAX.toLocaleString("en-IN")} characters (${n.toLocaleString("en-IN")} now).`
  return null
}

/** The request body: `{note}`, trimmed (the server trims too and counts runes). */
export function reviewRequestBody(note: string): { note: string } {
  return { note: note.trim() }
}

export function reviewRequestPath(postId: string): string {
  return `/v1/posts/${encodeURIComponent(postId)}/copyright-review/request`
}

/* ── refusals ───────────────────────────────────────────────────── */

interface WireError {
  /** 0 when there was no response. */
  status: number
  code: string
  details: Record<string, unknown>
}

function wireError(err: unknown): WireError {
  const response = obj(obj(err).response)
  const e = obj(obj(response.data).error)
  return { status: typeof response.status === "number" ? response.status : 0, code: str(e.code), details: obj(e.details) }
}

export const UPLOADS_PAUSED = "UPLOADS_PAUSED"
export const COPYRIGHT_REVIEW = "COPYRIGHT_REVIEW"

export const COPYRIGHT_REVIEW_EDIT_COPY = "This video is in copyright review — you can't change who can see it until it's cleared."
/** The same refusal on a create or publish, where nothing was posted yet. */
export const COPYRIGHT_REVIEW_CREATE_COPY =
  "This video needs a copyright review first, so it can't be members-only. Nothing was posted — choose Everyone and publish again."

export function uploadsPausedCopy(until: string | null | undefined): string {
  const day = formatCopyrightDate(until)
  return day
    ? `Long-video uploads are paused until ${day} after repeated copyright blocks. Reels and posts still work.`
    : "Long-video uploads are paused after repeated copyright blocks. Reels and posts still work."
}

/** The pause's end (error.details.until) when this is a 403 UPLOADS_PAUSED; null otherwise or without a date. */
export function uploadsPausedUntil(err: unknown): string | null {
  const e = wireError(err)
  if (e.code !== UPLOADS_PAUSED) return null
  return instant(e.details.until)
}

/** The two copyright refusals a write can meet. */
export function isCopyrightRefusalCode(code: string | null | undefined): boolean {
  return code === UPLOADS_PAUSED || code === COPYRIGHT_REVIEW
}

export function isCopyrightRefusal(err: unknown): boolean {
  return isCopyrightRefusalCode(wireError(err).code)
}

/**
  A copyright refusal as the sentence to show, or null for anything else.
  `where` is "edit" for the members-only control and the owner edit,
  "create" for a create or publish (nothing exists yet).
*/
export function copyrightRefusalMessage(err: unknown, where: "edit" | "create" = "edit"): string | null {
  const e = wireError(err)
  return copyrightCodeMessage(e.code, where, e.code === UPLOADS_PAUSED ? instant(e.details.until) : null)
}

/** The same, from a code (and the pause's end, when known). */
export function copyrightCodeMessage(code: string | null | undefined, where: "edit" | "create" = "edit", until: string | null = null): string | null {
  if (code === UPLOADS_PAUSED) return uploadsPausedCopy(until)
  if (code === COPYRIGHT_REVIEW) return where === "create" ? COPYRIGHT_REVIEW_CREATE_COPY : COPYRIGHT_REVIEW_EDIT_COPY
  return null
}

const REQUEST_ERROR_COPY: Record<string, string> = {
  INVALID_REQUEST: "Write a note of 1 to 1,000 characters.",
  REVIEW_NOT_FOUND: "This video has no copyright review to answer any more.",
  REVIEW_ALREADY_DECIDED: "This review has already been decided. Refresh to see the result.",
  COPYRIGHT_REVIEW_UNAVAILABLE: "Copyright review is unavailable right now. Try again in a few minutes.",
}

/** Why "Request review" failed, in words. */
export function reviewRequestErrorMessage(err: unknown): string {
  const e = wireError(err)
  if (e.code && REQUEST_ERROR_COPY[e.code]) return REQUEST_ERROR_COPY[e.code]
  if (e.status === 0) return "The connection dropped. Check your network and try again."
  if (e.status === 503) return REQUEST_ERROR_COPY.COPYRIGHT_REVIEW_UNAVAILABLE
  return "Your request couldn't be sent. Try again."
}

/** A decided review (409) or a gone one (404): the cached state is stale, so refetch it. */
export function reviewRequestIsStale(err: unknown): boolean {
  const e = wireError(err)
  return e.code === "REVIEW_ALREADY_DECIDED" || e.code === "REVIEW_NOT_FOUND"
}

/* ── report reasons (trust-safety migration 018) ────────────────── */

export const COPYRIGHT_REPORT_REASONS = [
  { value: "copyright_mine", label: "Copyright: this is my content" },
  { value: "copyright_media", label: "Copyright: film, TV or music" },
] as const

/* ── notifications (notification-service copyright_notify.go) ───── */

export const COPYRIGHT_NOTIFICATION_TYPES = ["copyright_review_hold", "copyright_review_cleared", "copyright_review_blocked"] as const
export type CopyrightNotificationType = (typeof COPYRIGHT_NOTIFICATION_TYPES)[number]

export const isCopyrightNotification = (type: string): type is CopyrightNotificationType =>
  (COPYRIGHT_NOTIFICATION_TYPES as readonly string[]).includes(type)

/** Where a hold or a block lands: the creator's uploads, with the review and "Request review". */
export const CREATOR_HUB_PATH = "/posttube/hub"

const watchPath = /^\/posttube\/watch\/[^/?#]+/

/** A cleared video's watch page on /posttube (the server links /tube/watch/{id}); the hub when there is none. */
function clearedLink(rowLink: string | undefined): string {
  if (!rowLink) return CREATOR_HUB_PATH
  const link = tubePathnameToPosttube(rowLink) ?? rowLink
  return watchPath.test(link) ? link : CREATOR_HUB_PATH
}

/**
  The row for a copyright notice: the server's title wins (it is the
  template's), the second line is ours, and the link is the contract's.
  null for every other type.
*/
export function copyrightNotificationCopy(
  type: string,
  serverTitle: string | undefined,
  rowLink?: string,
): { title: string; body: string; link: string } | null {
  switch (type) {
    case "copyright_review_hold":
      return {
        title: serverTitle ?? "Your video is in copyright review",
        body: "Only you can see it until our team checks it. You can request a review in Creator Hub.",
        link: CREATOR_HUB_PATH,
      }
    case "copyright_review_cleared":
      return { title: serverTitle ?? "Your video cleared copyright review", body: "It's live for everyone now.", link: clearedLink(rowLink) }
    case "copyright_review_blocked":
      return {
        title: serverTitle ?? "Your video was blocked after copyright review",
        body: "It stays hidden. This isn't a strike, but repeated blocks pause long-video uploads.",
        link: CREATOR_HUB_PATH,
      }
    default:
      return null
  }
}
