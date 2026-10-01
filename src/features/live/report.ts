import { errorCode, errorStatus, str } from "./model"

// Viewer Report sheet: POST /v1/livestream/streams/:id/reports
//   {reason: spam|harassment|hate|nudity|violence|scam|other, message_id?, note?}
// One report per reporter per target; rate limited.

export type LiveReportReason = "spam" | "harassment" | "hate" | "nudity" | "violence" | "scam" | "other"

// Contract order; the sheet sorts by label.
const REASON_LABELS: Record<LiveReportReason, string> = {
  spam: "Spam",
  harassment: "Harassment or bullying",
  hate: "Hate speech",
  nudity: "Nudity or sexual content",
  violence: "Violence",
  scam: "Scam or fraud",
  other: "Other",
}

/** The sheet's choices, in ascending alphabetical order by label. */
export const REPORT_REASONS: ReadonlyArray<{ value: LiveReportReason; label: string }> = (
  Object.keys(REASON_LABELS) as LiveReportReason[]
)
  .map((value) => ({ value, label: REASON_LABELS[value] }))
  .sort((a, b) => a.label.localeCompare(b.label))

export const REPORT_NOTE_MAX = 500

export interface LiveReportBody {
  reason: LiveReportReason
  message_id?: string
  note?: string
}

export function isReportReason(v: unknown): v is LiveReportReason {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(REASON_LABELS, v)
}

/** Exact request body: unknown reasons refused, empty optionals omitted. */
export function reportBody(input: { reason: unknown; messageId?: string | null; note?: string | null }): LiveReportBody | null {
  if (!isReportReason(input.reason)) return null
  const body: LiveReportBody = { reason: input.reason }
  const messageId = str(input.messageId).trim()
  if (messageId) body.message_id = messageId
  const note = str(input.note).trim().slice(0, REPORT_NOTE_MAX)
  if (note) body.note = note
  return body
}

/**
 * What the sheet says after the server answers with an error. live-service-v2
 * answers 201, or 409 ALREADY_REPORTED, 429 RATE_LIMITED, 422
 * VALIDATION_ERROR (your own stream or message, a bad reason, a long note)
 * and 404 NOT_FOUND (the message or stream is gone).
 */
export function reportErrorCopy(err: unknown): string {
  switch (errorCode(err)) {
    case "ALREADY_REPORTED":
      return "You've already reported this. Thanks for letting us know."
    case "RATE_LIMITED":
      return "You've sent a lot of reports. Try again in a little while."
    case "VALIDATION_ERROR":
      return "You can't report this."
    case "NOT_FOUND":
      return "That's no longer available."
  }
  if (errorStatus(err) === 401) return "Sign in to report."
  return "We couldn't send your report. Try again."
}
