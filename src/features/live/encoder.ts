import type { CreateStreamInput, LiveStream } from "./model"
import { errorCode, errorStatus, str } from "./model"
import { ACCOUNT_CHECK_FAILED_COPY, NOT_ELIGIBLE_COPY, PILOT_REFUSAL_COPY, isPilotRefusal } from "./errors"
import { liveStatusView, normalizeStatus, type LiveStatusView } from "./status"

// Going live from streaming software (OBS, a hardware encoder, a camera)
// instead of this device's camera. Contract, 1 Oct 2026:
//   stream row   source: "device" | "encoder", has_ingress (host, moderators)
//   POST   /v1/livestream/streams/:id/ingress  → {data:{server_url, stream_key, ingress_id}}
//   DELETE /v1/livestream/streams/:id/ingress  → the next POST issues a new key
//   POST   /start answers an EMPTY publisher_token for an encoder stream.
// The encoder joins the LiveKit room as `encoder_<stream id>`; the host's own
// browser joins with a viewer token and never publishes.
//
// The stream key is a secret. Nothing here writes it to a URL, to storage or
// to a log, and nothing here keeps it: callers hold it in component state.

export type LiveSource = "device" | "encoder"

/** Anything that is not exactly "encoder" (absent, "", unknown) is this device. */
export function streamSource(stream: { source?: unknown } | null | undefined): LiveSource {
  return str(stream?.source) === "encoder" ? "encoder" : "device"
}

// ── Create ────────────────────────────────────────────────────────────

/** The POST /v1/livestream/streams body. `source` is sent only for an encoder stream. */
export function createStreamBody(input: CreateStreamInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: input.title,
    description: input.description ?? "",
    visibility: input.visibility,
    cover_media_id: input.cover_media_id ?? null,
    scheduled_at: input.scheduled_at ?? null,
  }
  if (input.source === "encoder") body.source = "encoder"
  return body
}

// ── Which studio the host gets ────────────────────────────────────────

export type StudioKind = "loading" | "device" | "encoder"

/**
 * The camera studio asks for the camera and microphone as soon as it has a
 * stream, so it is mounted only once the row says this is a device stream.
 * A row that failed to load goes to the camera studio, which owns the error
 * copy (and starts nothing without a row).
 */
export function studioFor(stream: { source?: unknown } | null | undefined, failed: boolean): StudioKind {
  if (!stream) return failed ? "device" : "loading"
  return streamSource(stream)
}

export type EncoderPanel = "setup" | "preview" | "over"

export interface EncoderPanelView {
  panel: EncoderPanel
  /** Server URL and stream key may be asked for and shown. */
  showKey: boolean
  /** "Start" is offered: the room does not exist yet. */
  canStart: boolean
  /** "End stream" is offered. */
  canEnd: boolean
  /** The host's browser joins the room (viewer token) to preview the stream. */
  connectPreview: boolean
}

/** What the host of an encoder stream sees, from the server's status alone. */
export function encoderPanel(stream: { status?: unknown }): EncoderPanelView {
  switch (normalizeStatus(stream.status)) {
    case "scheduled":
      return { panel: "setup", showKey: true, canStart: true, canEnd: false, connectPreview: false }
    case "starting":
      return { panel: "setup", showKey: true, canStart: false, canEnd: true, connectPreview: false }
    case "live":
    case "reconnecting":
      return { panel: "preview", showKey: false, canStart: false, canEnd: true, connectPreview: true }
    case "ended":
    case "failed":
      return { panel: "over", showKey: false, canStart: false, canEnd: false, connectPreview: false }
    default:
      return { panel: "setup", showKey: false, canStart: false, canEnd: false, connectPreview: false }
  }
}

/**
 * liveStatusView for the host of an encoder stream: same status, tone and
 * flags, with the sentences that talk about "your device" or "your
 * connection" rewritten for streaming software.
 */
export function encoderHostView(
  stream: Pick<LiveStream, "status"> & Partial<Pick<LiveStream, "ended_reason" | "scheduled_at">>,
): LiveStatusView {
  const view = liveStatusView(stream, "host")
  const reason = str(stream.ended_reason)
  switch (view.kind) {
    case "scheduled":
      return { ...view, label: "Not started", title: "Set up your streaming software", body: "Paste the server URL and stream key into your software, then press Start." }
    case "starting":
      return { ...view, title: "Waiting for your software to connect", body: "Press Start Streaming in your software. You'll be live as soon as its video reaches us." }
    case "reconnecting":
      return { ...view, body: "Your streaming software stopped sending video. Start streaming again and we'll pick up where you left off." }
    case "ended":
    case "failed":
      if (reason === "host_lost") return { ...view, body: "Your streaming software was disconnected for too long, so the stream ended." }
      if (reason === "no_media") return { ...view, body: "No video reached us from your streaming software, so the stream was closed." }
      if (view.kind === "failed" && !reason) return { ...view, body: "Something went wrong before your software's video reached us." }
      return view
    default:
      return view
  }
}

// ── Whose media is the host's ─────────────────────────────────────────

export function encoderIdentity(streamId: string): string {
  return `encoder_${streamId}`
}

export type HostRef = Pick<LiveStream, "id" | "creator_user_id">

/**
 * The host's media comes from the creator's own identity (this-device
 * streams) or from the stream's encoder identity. Nobody else is the host,
 * whatever they publish.
 */
export function isHostIdentity(identity: unknown, stream: HostRef | null | undefined): boolean {
  const id = str(identity)
  if (!id || !stream) return false
  if (str(stream.creator_user_id) && id === stream.creator_user_id) return true
  return !!str(stream.id) && id === encoderIdentity(stream.id)
}

export interface ParticipantLike {
  identity: string
  /** True when the participant has a video track published. */
  hasVideo: boolean
}

/**
 * The participant whose video is shown as the host's: a host identity that
 * publishes video. When both do (never expected), the encoder wins for an
 * encoder stream because the creator's browser does not publish there.
 */
export function pickHostVideo<P extends ParticipantLike>(participants: Iterable<P>, stream: HostRef | null | undefined): P | null {
  let creator: P | null = null
  let encoder: P | null = null
  if (!stream) return null
  for (const p of participants) {
    if (!p.hasVideo || !isHostIdentity(p.identity, stream)) continue
    if (p.identity === encoderIdentity(stream.id)) encoder ??= p
    else creator ??= p
  }
  return encoder ?? creator
}

// ── Server URL and stream key ─────────────────────────────────────────

export interface StreamIngress {
  server_url: string
  stream_key: string
  ingress_id: string
}

export function ingressPath(streamId: string): string {
  return `/v1/livestream/streams/${encodeURIComponent(streamId)}/ingress`
}

/** `{data:{server_url, stream_key, ingress_id}}`; null when either value the host must paste is empty. */
export function parseIngress(body: unknown): StreamIngress | null {
  const data = body && typeof body === "object" ? (body as { data?: unknown }).data : null
  if (!data || typeof data !== "object") return null
  const row = data as Record<string, unknown>
  const server_url = str(row.server_url)
  const stream_key = str(row.stream_key)
  if (!server_url || !stream_key) return null
  return { server_url, stream_key, ingress_id: str(row.ingress_id) }
}

/** The two calls the ingress routes need; `api` (axios) satisfies it. */
export interface IngressHttp {
  post(url: string): Promise<{ data: unknown }>
  delete(url: string): Promise<unknown>
}

export class IngressShapeError extends Error {
  constructor() {
    super("ingress response had no server URL or stream key")
    this.name = "IngressShapeError"
  }
}

/** POST /ingress: idempotent, answers the same key while the ingress exists. No body, no query. */
export async function requestIngress(http: IngressHttp, streamId: string): Promise<StreamIngress> {
  const res = await http.post(ingressPath(streamId))
  const ingress = parseIngress(res.data)
  if (!ingress) throw new IngressShapeError()
  return ingress
}

/** "Reset key": DELETE /ingress, then POST for a new one. The old key stops working at the DELETE. */
export async function resetIngress(http: IngressHttp, streamId: string): Promise<StreamIngress> {
  await http.delete(ingressPath(streamId))
  return requestIngress(http, streamId)
}

const MASK = "•".repeat(16)

/** What is on screen while the key is hidden: a fixed run of dots, never a character or the length of the key. */
export function maskKey(key: string): string {
  return key ? MASK : ""
}

export function shownKey(key: string, revealed: boolean): string {
  return revealed ? key : maskKey(key)
}

/** POST / DELETE /streams/:id/ingress. Branches on the code, never on the server's message. */
export function ingressErrorCopy(err: unknown): string {
  if (isPilotRefusal(err)) return PILOT_REFUSAL_COPY
  switch (errorCode(err)) {
    case "INGRESS_UNAVAILABLE":
      return "We couldn't set up the connection for your streaming software. Try again in a moment."
    case "STREAM_STATE_CONFLICT":
      return "The stream key can't be shown or changed once you're live or the stream is over."
    case "VALIDATION_ERROR":
      return "This stream uses this device's camera, so it has no stream key."
    case "LIVE_BANNED":
      return "You can't go live right now."
    case "LIVE_NOT_ELIGIBLE":
      return NOT_ELIGIBLE_COPY
    case "AUTHORITY_UNAVAILABLE":
      return ACCOUNT_CHECK_FAILED_COPY
    case "FORBIDDEN":
      return "Only the host can see the stream key."
    case "NOT_FOUND":
      return "This stream no longer exists."
  }
  if (errorStatus(err) === 401) return "Sign in to go live."
  return "We couldn't get your stream key. Try again."
}

export const ENCODER_STEPS: readonly string[] = [
  "In OBS, open Settings → Stream, choose Custom, and paste the server URL and stream key.",
  "Press Start on this page.",
  "Press Start Streaming in OBS.",
]
