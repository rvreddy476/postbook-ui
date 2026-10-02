/*
  The words for a server refusal, by stable CODE (dating-service
  respondServiceError, respondPhotoError, respondVerificationError,
  writePremiumError). The server's own message is written for developers and
  is never shown.
*/

import { num, toDatingError, type DatingError } from "./wire"

export const GENERIC_COPY = "Something went wrong. Please try again."
export const NETWORK_COPY = "Check your connection and try again."
export const CLOSED_TITLE = "Pulse isn't available for your account yet"
export const CLOSED_BODY = "We're opening Pulse to a small group first. When it's ready for you, it will appear here."
export const AGE_REQUIRED_COPY =
  "Pulse is for adults only. It needs a confirmed birth date on your Momentum account showing you're 18 or older."
export const PASSES_UNAVAILABLE_COPY = "Passes aren't available yet"

const PREMIUM_UNAVAILABLE_CODES: ReadonlySet<string> = new Set(["PREMIUM_UNAVAILABLE", "PREMIUM_PAYMENTS_UNAVAILABLE"])

export function isPremiumUnavailable(error: unknown): boolean {
  return PREMIUM_UNAVAILABLE_CODES.has(toDatingError(error).code)
}

export function isAgeRefusal(error: unknown): boolean {
  return toDatingError(error).code === "AGE_REQUIRED"
}

/** A refusal with no response at all. */
export function isNetworkError(error: unknown): boolean {
  return toDatingError(error).status === 0
}

function locationLimited(e: DatingError): string {
  const minutes = num(e.details.min_interval_minutes)
  const perDay = num(e.details.max_changes_per_day)
  if (minutes > 0 && perDay > 0) {
    return `You can change your location once every ${minutes} minutes, up to ${perDay} times a day. Try again later.`
  }
  return "You've changed your location a lot recently. Try again later."
}

/* First move (M5): the limits the server sends in details. */
function questionsTooMany(e: DatingError): string {
  const max = num(e.details.max)
  return max > 0 ? `You can have up to ${max} questions.` : "That's too many questions. Remove one and save."
}

function questionInvalid(e: DatingError): string {
  const max = num(e.details.max_length)
  return max > 0 ? `Each question needs 1 to ${max} characters.` : "Each question needs a few words, and not too many."
}

function answerInvalid(e: DatingError): string {
  const max = num(e.details.max_length)
  return max > 0 ? `Write an answer of up to ${max} characters.` : "Write a shorter answer."
}

/** Codes whose words depend on the details the server sent. */
const DYNAMIC: Record<string, (e: DatingError) => string> = {
  LOCATION_CHANGE_RATE_LIMITED: locationLimited,
  OPENING_ANSWER_INVALID: answerInvalid,
  OPENING_QUESTION_INVALID: questionInvalid,
  OPENING_QUESTIONS_TOO_MANY: questionsTooMany,
}

const COPY: Record<string, string> = {
  AGE_REQUIRED: AGE_REQUIRED_COPY,
  CANDIDATE_UNAVAILABLE: "This person isn't available any more.",
  CHAT_UNAVAILABLE: "Chat is busy right now. Try again in a moment.",
  CLIENT_PRICE_REFUSED: "That purchase couldn't be started. Try again.",
  CONNECTION_CHECK_UNAVAILABLE: "We couldn't check that right now. Try again in a moment.",
  CONSENT_REQUIRED: "We need your consent before saving that.",
  EXPLAIN_RATE_LIMITED: "Try again later.",
  EXTEND_LIMIT_REACHED: "You've used your free extra time for now. Try again later.",
  FIRST_MOVE_NOT_PENDING: "This match isn't waiting for your answer any more.",
  FIRST_MOVE_PENDING: "Your match starts this chat. Answer one of their questions from the match page, or wait for their hello.",
  FACE_COMPARE_UNAVAILABLE: "Verification is unavailable right now. Try again in a few minutes.",
  FORBIDDEN: "You can't do that right now.",
  IDEMPOTENCY_KEY_REUSED: "That purchase changed. Start again.",
  IDENTITY_UNAVAILABLE: "We couldn't confirm your details right now. Try again in a moment.",
  INVALID_AGE_RANGE: "Choose an age range between 18 and 120, with the lower age first.",
  INVALID_CONSENT_TYPE: "That choice isn't available any more.",
  INVALID_DISTANCE_KM: "Choose a distance between 1 and 500 km.",
  INVALID_GENDER: "That choice isn't available any more. Pick your gender and try again.",
  INVALID_INTENT: "That choice isn't available any more. Pick what you're looking for and try again.",
  INVALID_INTENT_FILTER: "That choice isn't available any more. Pick again and save.",
  INVALID_INTERESTED_IN_GENDER: "That choice isn't available any more. Pick who you want to see and try again.",
  INVALID_LOCATION: "That location didn't look right. Type your city instead.",
  INVALID_PRODUCT: "That pass isn't sold any more. Reload and pick again.",
  INVALID_REPORT_EVIDENCE: "That report couldn't be sent. Check the details and try again.",
  INVALID_REPORT_REASON: "That report couldn't be sent. Check the details and try again.",
  INVALID_VISIBILITY: "That choice isn't available any more.",
  MECHANIC_NOT_ENABLED: "That isn't available yet.",
  MEDIA_NOT_READY: "Your video is still processing. Try again in a moment.",
  OPENING_ANSWER_REFUSED: "Answers can't include phone numbers, emails or links.",
  OPENING_QUESTION_REFUSED: "Questions can't include phone numbers, emails or links.",
  OPENING_QUESTION_UNKNOWN: "That question was changed or removed. Pick another.",
  ONBOARDING_INCOMPLETE: "Finish setting up your profile first.",
  PASS_REASON_TOO_LONG: "That note is too long.",
  PAYMENT_METHOD_INVALID: "That way to pay isn't available. Try again.",
  PHOTO_ALREADY_ATTACHED: "That photo is already on your profile.",
  PHOTO_LIMIT_REACHED: "You've reached the photo limit. Remove one to add another.",
  PHOTO_MEDIA_NOT_FOUND: "That photo couldn't be added. Try another.",
  PHOTO_MEDIA_NOT_READY: "That photo is still processing. Try again in a moment.",
  PHOTO_MEDIA_UNAVAILABLE: "Photos are unavailable right now. Try again later.",
  PHOTO_MEDIA_UNSUPPORTED: "That file can't be used. Choose a JPG or PNG photo.",
  PII_NOT_CONFIGURED: "This can't be saved right now. Try again later.",
  PREMIUM_PAYMENTS_REFUSED: "The payment couldn't be started. Try again later.",
  PREMIUM_PAYMENTS_UNAVAILABLE: PASSES_UNAVAILABLE_COPY,
  PREMIUM_UNAVAILABLE: PASSES_UNAVAILABLE_COPY,
  PRIMARY_PHOTO_NOT_APPROVED: "Your main photo needs to be approved before the face check.",
  PROFILE_STATUS_CONFLICT: "Your profile can't do that right now.",
  PROFILE_TRANSITION_NOT_ALLOWED: "Your profile can't do that right now.",
  PROMPT_ANSWER_REQUIRED: "Write an answer first.",
  PROMPT_ANSWER_TOO_LONG: "Keep your answer to 280 characters.",
  PURCHASE_INTENT_CONFLICT: "That purchase changed. Start again.",
  PURCHASE_NOT_FOUND: "We couldn't find that purchase.",
  REPORT_RATE_LIMITED: "You've sent a lot of reports today. Our team is reviewing them.",
  REPORT_TARGET_MISMATCH: "That report couldn't be sent.",
  REWIND_LIMIT_REACHED: "You've used your undo for now. Try again later.",
  REWIND_NOTHING_TO_UNDO: "There's nothing to undo.",
  SELFIE_ALREADY_PASSED: "You're already verified.",
  SELFIE_ATTEMPTS_EXCEEDED: "You've used today's attempts. Try again tomorrow.",
  SELFIE_REVIEW_PENDING: "Your selfie is being reviewed.",
  SHARE_RECIPIENT_NOT_ALLOWED: "You can share your location only with a match or a trusted contact.",
  SPARK_NOTE_REFUSED: "Notes can't include phone numbers, emails or links.",
  LIKED_YOU_LOCKED: "See who sparked you with a pass, or find them in your deck.",
  SPARK_RATE_LIMITED: "You're out of sparks for now. Try again later.",
  SUPER_SPARK_LIMIT_REACHED: "You're out of Super Sparks for now. Get a pack, or try again later.",
  TRUSTED_CONTACT_LIMIT: "You already have the most trusted contacts allowed. Remove one to add another.",
  TRUSTED_CONTACT_NOT_ELIGIBLE: "A trusted contact must be one of your matches or connections.",
  UNKNOWN_PROMPT: "That prompt isn't available any more. Pick another.",
}

/** Every code this client has words for, for the contract test. */
export const KNOWN_ERROR_CODES: readonly string[] = Object.keys(COPY).concat(Object.keys(DYNAMIC)).sort()

export function datingErrorCopy(error: unknown): string {
  const e = toDatingError(error)
  return copyFor(e)
}

export function copyFor(e: DatingError): string {
  if (DYNAMIC[e.code]) return DYNAMIC[e.code](e)
  if (COPY[e.code]) return COPY[e.code]
  if (e.status === 0) return NETWORK_COPY
  if (e.status === 401) return "Your session ended. Sign in again."
  return GENERIC_COPY
}
