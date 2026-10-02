/*
  The selfie liveness check (lane D5):

    GET  /verification/status            where the check stands
    POST /verification/selfie/challenge  a single-use challenge (blink twice)
    POST /verification/selfie            {challenge_id, video_media_id}

  The body field is `video_media_id` (handler_verification.go SubmitSelfie and
  Android's SelfieSubmitRequest), not `media_id`.

  Everything that decides what the person sees next is here and pure; the
  screen owns the camera, the upload and the timers.
*/

import { copyFor, GENERIC_COPY } from "./errors"
import { bool, num, obj, str, time, type DatingError } from "./wire"

/* ── wire ────────────────────────────────────────────────────────── */

export interface VerificationStatus {
  selfieState: string
  attemptsLeftToday: number
  attemptsPerDay: number
  verified: boolean
  profileStatus: string
  nextStep: string
}

export function toVerificationStatus(wire: unknown): VerificationStatus {
  const w = obj(wire)
  const selfie = obj(w.selfie)
  return {
    selfieState: str(selfie.state),
    attemptsLeftToday: num(selfie.attempts_left_today),
    attemptsPerDay: num(selfie.attempts_per_day),
    verified: bool(w.verified),
    profileStatus: str(w.profile_status),
    nextStep: str(w.next_step),
  }
}

export interface SelfieChallenge {
  challengeId: string
  instruction: string
  maxDurationMs: number
  expiresAt: string
}

export function toSelfieChallenge(wire: unknown): SelfieChallenge {
  const w = obj(wire)
  return { challengeId: str(w.challenge_id), instruction: str(w.instruction), maxDurationMs: num(w.max_duration_ms), expiresAt: time(w.expires_at) }
}

export interface SelfieResult {
  status: string
  passed: boolean
  reason: string
  profileStatus: string
  attemptsRemaining: number
}

export function toSelfieResult(wire: unknown): SelfieResult {
  const w = obj(wire)
  return {
    status: str(w.status),
    passed: bool(w.passed),
    reason: str(w.reason),
    profileStatus: str(w.profile_status),
    attemptsRemaining: num(w.attempts_remaining),
  }
}

export function selfieBody(challengeId: string, mediaId: string): { challenge_id: string; video_media_id: string } {
  return { challenge_id: challengeId, video_media_id: mediaId }
}

/* ── what the person sees ────────────────────────────────────────── */

export type SelfieView =
  | { kind: "passed" }
  | { kind: "in_review" }
  | { kind: "limit_reached" }
  | { kind: "retry"; copy: string; attemptsLeft: number | null }
  | { kind: "blocked"; copy: string }
  | { kind: "needs_consent" }
  | { kind: "new_challenge" }
  | { kind: "error"; copy: string }

/** What the status settles on its own; null when the person should record a clip. */
export function viewFromStatus(status: VerificationStatus): SelfieView | null {
  if (status.selfieState === "passed") return { kind: "passed" }
  if (status.selfieState === "review" || status.nextStep === "wait_for_review") return { kind: "in_review" }
  if (status.nextStep === "retry_tomorrow") return { kind: "limit_reached" }
  return null
}

export function reasonCopy(reason: string): string {
  switch (reason) {
    case "NOT_ENOUGH_BLINKS":
      return "We couldn't see you blink twice. Hold the camera at eye level, keep your face in the frame, and blink twice slowly while it records."
    case "NO_FACE":
      return "We couldn't see your face. Face the camera in good light and try again."
    case "MULTIPLE_FACES":
      return "More than one face was in the video. Make sure only you are in the frame."
    case "FACE_CHANGED":
      return "Keep your face in the frame for the whole clip, then try again."
    case "LOW_QUALITY":
      return "The video was too dark or blurry. Find better light and hold still."
    case "NO_MATCH":
      return "The video didn't match your main photo. Make sure your main photo clearly shows your face."
    default:
      return "The check didn't pass. Try again."
  }
}

export function viewFromResult(result: SelfieResult): SelfieView {
  if (result.passed || result.status === "passed") return { kind: "passed" }
  if (result.status === "pending_review") return { kind: "in_review" }
  if (result.status === "failed" && result.attemptsRemaining <= 0) return { kind: "limit_reached" }
  return { kind: "retry", copy: reasonCopy(result.reason), attemptsLeft: result.attemptsRemaining }
}

export const MEDIA_NOT_READY = "MEDIA_NOT_READY"

/** A refusal from the challenge or the submit. MEDIA_NOT_READY is handled before this (it is retried). */
export function viewFromRefusal(error: DatingError): SelfieView {
  switch (error.code) {
    case "CONSENT_REQUIRED":
      return { kind: "needs_consent" }
    case "SELFIE_ATTEMPTS_EXCEEDED":
      return { kind: "limit_reached" }
    case "SELFIE_ALREADY_PASSED":
      return { kind: "passed" }
    case "SELFIE_REVIEW_PENDING":
      return { kind: "in_review" }
    case "SELFIE_CHALLENGE_INVALID":
    case "SELFIE_CHALLENGE_REQUIRED":
      return { kind: "new_challenge" }
    case "PRIMARY_PHOTO_NOT_APPROVED":
      return { kind: "blocked", copy: copyFor(error) }
    case "SELFIE_VIDEO_TOO_LONG":
      return { kind: "retry", copy: "That clip was too long. Record again and stop when the timer ends.", attemptsLeft: null }
    case "SELFIE_SAME_AS_PRIMARY_PHOTO":
      return { kind: "retry", copy: "Record a new selfie video, not your profile photo.", attemptsLeft: null }
    case "SELFIE_MEDIA_NOT_FOUND":
    case "SELFIE_VIDEO_UNSUPPORTED":
      return { kind: "retry", copy: "That recording couldn't be used. Record again, or finish this step in the mobile app.", attemptsLeft: null }
    default:
      return { kind: "error", copy: copyFor(error) || GENERIC_COPY }
  }
}

export function attemptsLine(remaining: number | null): string {
  if (remaining === null || remaining <= 0) return ""
  return remaining === 1 ? "1 attempt left today" : `${remaining} attempts left today`
}

export function instructionCopy(instruction: string): string {
  return instruction === "blink_twice" || !instruction ? "Look at the camera and blink twice, slowly." : "Follow the instruction on screen while it records."
}

/* ── recording ───────────────────────────────────────────────────── */

export const MAX_CLIP_MS = 4000
const ENCODER_MARGIN_MS = 300
const MIN_CLIP_MS = 2000

/** How long to record: the challenge's cap less a margin for the encoder, never more than 4 s. */
export function recordMillis(maxDurationMs: number): number {
  const cap = maxDurationMs >= 1 && maxDurationMs <= MAX_CLIP_MS ? maxDurationMs : MAX_CLIP_MS
  return Math.max(cap - ENCODER_MARGIN_MS, MIN_CLIP_MS)
}

/** Preferred first: MP4 is what the mobile clients upload. */
export const RECORDER_MIME_CANDIDATES: readonly string[] = [
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
]

export interface RecorderEnv {
  hasGetUserMedia: boolean
  hasMediaRecorder: boolean
  isTypeSupported: (mime: string) => boolean
}

/** The mime to record with, or "" when this browser cannot record a clip the check accepts. */
export function pickRecorderMime(env: RecorderEnv): string {
  if (!env.hasGetUserMedia || !env.hasMediaRecorder) return ""
  for (const mime of RECORDER_MIME_CANDIDATES) {
    try {
      if (env.isTypeSupported(mime)) return mime
    } catch {
      /* a browser that throws on an unknown type simply does not support it */
    }
  }
  return ""
}

/** `video/webm;codecs=vp8` → `video/webm`: the type the upload is declared as. */
export function uploadMime(recorderMime: string): string {
  return recorderMime.split(";")[0].trim()
}

export function clipExtension(mime: string): string {
  return uploadMime(mime) === "video/mp4" ? "mp4" : "webm"
}

/* ── MEDIA_NOT_READY backoff ─────────────────────────────────────── */

/** The waits before each re-send of the SAME clip and challenge; the attempt was never spent. */
export const NOT_READY_BACKOFF_MS: readonly number[] = [1500, 3000, 5000, 8000, 12000]

/** The wait before retry number `retriesSoFar + 1`, or null when it is time to stop and let the person decide. */
export function notReadyDelay(retriesSoFar: number): number | null {
  return retriesSoFar < NOT_READY_BACKOFF_MS.length ? NOT_READY_BACKOFF_MS[retriesSoFar] : null
}

export const MOBILE_ONLY_COPY =
  "Selfie verification is done in the Momentum mobile app. Open Pulse there to finish this step, then come back."
