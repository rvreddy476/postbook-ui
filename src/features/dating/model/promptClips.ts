/*
  Voice and video prompt answers (mechanic M15, DATING_MEDIA_PROMPTS_ENABLED).

  On a card, an answer may carry `clip: {kind, duration_ms, url}`. The url is
  a dating route (/v1/dating/people/:id/prompts/:n/clip) that answers 307 to
  a short-lived media URL; it needs the bearer token, so it is fetched like a
  dating photo and played from a blob URL. Only approved clips ever reach a
  card. The answer's text may be empty when there is a clip.

  The owner's GET /prompts carries clip_kind, clip_duration_ms, clip_status
  (pending | pending_review | approved | rejected) and clip_reason. A clip
  is uploaded through media-service like a photo, then attached with
  PUT /prompts/:id/clip {media_id}; DELETE removes it.

  Refusals: 409 CLIP_NOT_READY is retried a few times; 422 CLIP_TOO_LONG
  (details.max_ms), 422 CLIP_UNSUPPORTED, 404 CLIP_MEDIA_NOT_FOUND and
  503 CLIP_MEDIA_UNAVAILABLE have their own words; 404 MECHANIC_NOT_ENABLED
  hides the clip controls. This file is pure: no DOM, no network.
*/

import { datingErrorCopy } from "./errors"
import { num, obj, str, toDatingError } from "./wire"

export type ClipKind = "audio" | "video"
export type ClipStatus = "pending" | "pending_review" | "approved" | "rejected"

/** The longest clip the server takes (media-service's default; CLIP_TOO_LONG says the live figure). */
export const CLIP_MAX_MS = 30_000
/** Recording stops a little before the cap, so the encoder's tail can't tip it over. */
export const RECORD_LIMIT_MS = 29_500
/** media-service refuses a voice clip under a second. */
export const MIN_VOICE_MS = 1_000

const CLIP_PATH = /^\/v1\/dating\/people\/[^/?#]+\/prompts\/\d+\/clip$/

/** The server's path if it is a prompt-clip route, else "". The client never builds one. */
export function clipPath(value: unknown): string {
  const s = str(value)
  return CLIP_PATH.test(s) ? s : ""
}

function clipKind(value: unknown): ClipKind | "" {
  const k = str(value)
  return k === "audio" || k === "video" ? k : ""
}

/* ── on a card ───────────────────────────────────────────────────── */

export interface PromptClip {
  kind: ClipKind
  /** 0 when the server sent none; no length is drawn then. */
  durationMs: number
  url: string
}

/** A card answer's clip, or null when there is none or it isn't one this client may load. */
export function toPromptClip(wire: unknown): PromptClip | null {
  const w = obj(wire)
  const kind = clipKind(w.kind)
  const url = clipPath(w.url)
  if (!kind || !url) return null
  return { kind, durationMs: Math.max(num(w.duration_ms), 0), url }
}

/* ── the owner's ─────────────────────────────────────────────────── */

export interface OwnClip {
  kind: ClipKind
  durationMs: number
  status: ClipStatus
  /** Why it was refused, for the owner; "" otherwise. */
  reason: string
}

function clipStatus(value: unknown): ClipStatus {
  const s = str(value)
  // Anything unexpected reads as "still being checked": never as live.
  return s === "approved" || s === "rejected" || s === "pending_review" ? s : "pending"
}

/** From GET /prompts (`clip_*` fields): null when the answer has no clip. */
export function toOwnClip(wire: unknown): OwnClip | null {
  const w = obj(wire)
  const kind = clipKind(w.clip_kind)
  if (!kind) return null
  return { kind, durationMs: Math.max(num(w.clip_duration_ms), 0), status: clipStatus(w.clip_status), reason: str(w.clip_reason) }
}

export interface ClipResult {
  promptId: number
  clip: OwnClip
}

/** PUT /prompts/:id/clip → {prompt_id, kind, duration_ms, status, reason?}. */
export function toClipResult(wire: unknown): ClipResult | null {
  const w = obj(wire)
  const promptId = num(w.prompt_id)
  const kind = clipKind(w.kind)
  if (promptId <= 0 || !kind) return null
  return { promptId, clip: { kind, durationMs: Math.max(num(w.duration_ms), 0), status: clipStatus(w.status), reason: str(w.reason) } }
}

export type ClipTone = "success" | "info" | "danger"

export interface ClipStatusView {
  tone: ClipTone
  label: string
  body: string
}

export const CLIP_REJECTED_FALLBACK = "This clip can't be shown on your profile. Try another."

/** What the owner sees about their clip. */
export function clipStatusView(clip: Pick<OwnClip, "status" | "reason">): ClipStatusView {
  switch (clip.status) {
    case "approved":
      return { tone: "success", label: "Live on your profile", body: "" }
    case "rejected":
      return { tone: "danger", label: "Not shown", body: clip.reason || CLIP_REJECTED_FALLBACK }
    default:
      return { tone: "info", label: "Being checked", body: "Only you can see it until it's approved." }
  }
}

/* ── words ───────────────────────────────────────────────────────── */

/** 12000 → "0:12". "" for no length. */
export function clipDurationLabel(ms: number): string {
  if (!(ms > 0)) return ""
  const total = Math.max(Math.round(ms / 1000), 1)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

export function clipKindLabel(kind: ClipKind): string {
  return kind === "audio" ? "Voice answer" : "Video answer"
}

/** The player's accessible name: "Play voice answer, 0:08". */
export function playLabel(kind: ClipKind, durationMs: number, playing: boolean): string {
  const verb = playing ? "Pause" : "Play"
  const length = clipDurationLabel(durationMs)
  return `${verb} ${clipKindLabel(kind).toLowerCase()}${length ? `, ${length}` : ""}`
}

/* ── recording a voice answer ────────────────────────────────────── */

/** Preferred first. media-service takes both; Safari records MP4, the others WebM. */
export const AUDIO_MIME_CANDIDATES: readonly string[] = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4"]

export interface AudioRecorderEnv {
  hasGetUserMedia: boolean
  hasMediaRecorder: boolean
  isTypeSupported: (mime: string) => boolean
}

/** The mime to record a voice answer with, or "" when this browser can't. */
export function pickAudioMime(env: AudioRecorderEnv): string {
  if (!env.hasGetUserMedia || !env.hasMediaRecorder) return ""
  for (const mime of AUDIO_MIME_CANDIDATES) {
    try {
      if (env.isTypeSupported(mime)) return mime
    } catch {
      /* a browser that throws on an unknown type simply does not support it */
    }
  }
  return ""
}

/** `audio/webm;codecs=opus` → `audio/webm`: the type the upload is declared as. */
export function audioUploadMime(recorderMime: string): string {
  return recorderMime.split(";")[0].trim()
}

/** The countdown: whole seconds left, 30 at the start, never below 0. */
export function recordSecondsLeft(elapsedMs: number): number {
  return Math.max(0, Math.ceil((RECORD_LIMIT_MS - Math.max(elapsedMs, 0)) / 1000))
}

/** The hard stop. */
export function recordingOver(elapsedMs: number): boolean {
  return elapsedMs >= RECORD_LIMIT_MS
}

/** Why a finished recording can't go, or "". */
export function voiceProblem(elapsedMs: number, size: number): string {
  if (size <= 0) return "The recording didn't work. Try again."
  if (elapsedMs < MIN_VOICE_MS) return "Record for at least a second."
  return ""
}

/* ── uploading a video answer ────────────────────────────────────── */

export const CLIP_VIDEO_TYPES: readonly string[] = ["video/mp4", "video/quicktime", "video/webm"]
export const CLIP_VIDEO_ACCEPT = CLIP_VIDEO_TYPES.join(",")

/** Before reading it: the file's type and size. */
export function videoFileProblem(file: { type: string; size: number }): string {
  if (!CLIP_VIDEO_TYPES.includes(file.type)) return "Choose an MP4, MOV or WebM video."
  if (file.size <= 0) return "That file is empty. Choose another."
  return ""
}

/**
  After reading it: its length, from the video element. Over the cap is
  refused before any upload. A length the browser can't read (NaN,
  Infinity, 0) goes to the server, which measures it and refuses with
  CLIP_TOO_LONG if it must.
*/
export function videoDurationProblem(seconds: number, maxMs = CLIP_MAX_MS): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return ""
  if (seconds * 1000 <= maxMs) return ""
  return `A video answer can be at most ${Math.floor(maxMs / 1000)} seconds. This one is ${Math.ceil(seconds)}.`
}

/* ── refusals ────────────────────────────────────────────────────── */

export type ClipRefusal = "not_ready" | "too_long" | "unsupported" | "not_found" | "unavailable" | "off" | "other"

export function clipRefusal(error: unknown): ClipRefusal {
  switch (toDatingError(error).code) {
    case "CLIP_NOT_READY":
      return "not_ready"
    case "CLIP_TOO_LONG":
      return "too_long"
    case "CLIP_UNSUPPORTED":
      return "unsupported"
    case "CLIP_MEDIA_NOT_FOUND":
      return "not_found"
    case "CLIP_MEDIA_UNAVAILABLE":
      return "unavailable"
    case "MECHANIC_NOT_ENABLED":
      return "off"
    default:
      return "other"
  }
}

export const CLIPS_OFF_COPY = "Voice and video answers aren't available right now."
export const CLIP_UPLOAD_REFUSED_COPY = "That clip couldn't be used. Try another."

/** The words for a failed clip: media-service's refusal (api/media `clip_refused`) or the server's code. */
export function clipFailureCopy(error: unknown): string {
  if (error instanceof Error && error.message === "clip_refused") return CLIP_UPLOAD_REFUSED_COPY
  return datingErrorCopy(error)
}

/** Waits before each re-send of the same media id while the server says CLIP_NOT_READY. */
export const CLIP_NOT_READY_WAITS_MS: readonly number[] = [1500, 3000, 5000]

/**
  PUT the clip, re-sending on CLIP_NOT_READY after each wait in turn. Any
  other refusal, or CLIP_NOT_READY after the last wait, is thrown as it came.
*/
export async function attachWhenReady<T>(put: () => Promise<T>, sleep: (ms: number) => Promise<void>, waits: readonly number[] = CLIP_NOT_READY_WAITS_MS): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await put()
    } catch (error) {
      if (clipRefusal(error) !== "not_ready" || attempt >= waits.length) throw error
      await sleep(waits[attempt])
    }
  }
}

/* ── the editor's progress ───────────────────────────────────────── */

export type ClipPhase =
  | { kind: "idle" }
  | { kind: "uploading"; percent: number }
  | { kind: "processing" }
  | { kind: "attaching" }
  | { kind: "failed"; message: string }

export const CLIP_IDLE: ClipPhase = { kind: "idle" }

export function clipBusy(phase: ClipPhase): boolean {
  return phase.kind === "uploading" || phase.kind === "processing" || phase.kind === "attaching"
}

/** The line under the clip buttons while something is happening; "" when idle. */
export function clipPhaseLine(phase: ClipPhase): string {
  switch (phase.kind) {
    case "uploading":
      return `Uploading… ${Math.min(Math.max(Math.round(phase.percent), 0), 100)}%`
    case "processing":
      return "Processing your clip…"
    case "attaching":
      return "Adding it to your answer…"
    case "failed":
      return phase.message
    default:
      return ""
  }
}
