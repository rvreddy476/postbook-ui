import { errorCode, errorStatus } from "./model"

// Human copy for server refusals. Branches on the error CODE, never on the
// server's message text. Every code below is one live-service-v2 actually
// writes (internal/http/handler.go writeServiceErr / writeModerationErr and
// SendChat's own cases, 1 Oct 2026).

export const PILOT_REFUSAL_COPY = "Going live is in a closed pilot right now."
export const PILOT_REFUSAL_DETAIL = "Watching streams is open to everyone. We'll let you know when you can go live."

/** POST /streams and POST /streams/:id/start answer 403 LIVE_NOT_ENABLED outside the pilot. */
export function isPilotRefusal(err: unknown): boolean {
  return errorCode(err) === "LIVE_NOT_ENABLED"
}

/** POST /streams, POST /streams/:id/start. */
export function goLiveErrorCopy(err: unknown): string {
  if (isPilotRefusal(err)) return PILOT_REFUSAL_COPY
  switch (errorCode(err)) {
    case "LIVE_BANNED":
      return "You can't go live right now."
    case "FORBIDDEN":
      return "Only the host can start this stream."
    case "STREAM_STATE_CONFLICT":
      return "This stream has already ended. Start a new one."
    case "NOT_FOUND":
      return "This stream no longer exists."
    case "INVALID_REQUEST":
    case "VALIDATION_ERROR":
      return "Check the details and try again."
    // Open mode. The pages show the "nearly ready" panel for LIVE_NOT_ELIGIBLE
    // (features/live/eligibility.ts); this sentence is for a place with no panel.
    case "LIVE_NOT_ELIGIBLE":
      return NOT_ELIGIBLE_COPY
    case "AUTHORITY_UNAVAILABLE":
      return ACCOUNT_CHECK_FAILED_COPY
  }
  if (errorStatus(err) === 401) return "Sign in to go live."
  return "We couldn't start your stream. Try again."
}

export const NOT_ELIGIBLE_COPY = "You're nearly ready to go live. A few things are still needed."
/** 503 AUTHORITY_UNAVAILABLE on create / start / ingress: a requirement could not be checked. Retryable. */
export const ACCOUNT_CHECK_FAILED_COPY = "We couldn't check your account just now. Try again."
export const STREAM_FULL_COPY = "This stream is full right now. Try again in a little while."

/** GET /viewer-token answers 403 STREAM_FULL when a new streamer's viewer cap is reached. */
export function isStreamFull(err: unknown): boolean {
  return errorCode(err) === "STREAM_FULL"
}

/** POST /streams/:id/chat. */
export function chatSendErrorCopy(err: unknown): string {
  switch (errorCode(err)) {
    case "CHAT_BANNED":
      return "You've been removed from this stream."
    case "LIVE_BANNED":
      return "You can't chat on live streams right now."
    case "CHAT_MUTED":
      return "You've been muted in this chat."
    case "CHAT_BLOCKED_WORD":
      return "That message has a word the host doesn't allow."
    case "RATE_LIMITED":
      return "You're sending too quickly. Wait a moment."
    case "STREAM_NOT_LIVE":
      return "Chat opens when the stream is live."
    case "NOT_FOLLOWER":
      return "Only the creator's followers can chat here."
    case "NOT_FOUND":
      return "This stream is no longer available."
    case "INVALID_REQUEST":
      return "Messages can be up to 500 characters."
  }
  if (errorStatus(err) === 401) return "Sign in to chat."
  return "Your message didn't send. Try again."
}

/** The chat refusal that means "you are banned from this stream". */
export function isChatBan(err: unknown): boolean {
  return errorCode(err) === "CHAT_BANNED"
}

/**
 * Viewer-token / stream-read refusals (visibility, blocks, bans). Null when
 * the answer is not an access refusal: STREAM_NOT_LIVE (the status panel
 * says why), AUTHORITY_UNAVAILABLE and other transient failures (retried).
 */
export function watchErrorCopy(err: unknown): string | null {
  const code = errorCode(err)
  if (code === "BANNED_FROM_STREAM") return "You've been removed from this stream."
  if (code === "NOT_FOLLOWER") return "Only the creator's followers can watch this stream."
  if (code === "PAID_REQUIRED") return "Paid streams aren't available yet."
  if (code === "STREAM_FULL") return STREAM_FULL_COPY
  switch (errorStatus(err)) {
    case 401:
      return "Sign in to watch this stream."
    case 403:
      return "You don't have access to this stream."
    case 404:
      return "This stream no longer exists."
    default:
      return null
  }
}

/** The viewer-token refusal that only means "not on air right now". */
export function isStreamNotLive(err: unknown): boolean {
  return errorCode(err) === "STREAM_NOT_LIVE"
}

/** DELETE /chat/:messageId, POST/DELETE /bans, PUT /moderators. */
export function moderationErrorCopy(err: unknown): string {
  switch (errorCode(err)) {
    case "FORBIDDEN":
      return "You can't do that in this stream."
    case "VALIDATION_ERROR":
      return "That isn't possible for this person."
    case "NOT_FOUND":
      return "That message is already gone."
  }
  return "That didn't work. Try again."
}

/**
 * Retry rule for GET /viewer-token. 401, 402, 403 (NOT_FOLLOWER,
 * BANNED_FROM_STREAM) and 404 (missing or blocked) are final. 409
 * STREAM_NOT_LIVE is retried briefly: the page asks only once the stream row
 * says it is on air, so a 409 is a status that is still catching up.
 */
export function viewerTokenRetry(failureCount: number, err: unknown): boolean {
  const status = errorStatus(err)
  if (status === 401 || status === 402 || status === 403 || status === 404) return false
  if (isStreamNotLive(err)) return failureCount < 3
  return failureCount < 2
}
