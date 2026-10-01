import type { LiveStream, LiveStreamStatus } from "./model"
import { num, str } from "./model"

// Truthful status: the badge and panel come ONLY from the server's
// `status` (+ `ended_reason`). A host who pressed Start is "Starting" until
// LiveKit reports their track; a host who vanished is "Reconnecting", then
// "Ended" with a reason. Nothing on the client promotes a stream to Live.

export type LiveStatusKind = LiveStreamStatus | "unknown"
export type LiveAudience = "host" | "viewer"
export type LiveTone = "live" | "calm" | "neutral" | "danger"

export interface LiveStatusView {
  kind: LiveStatusKind
  /** Short badge text. */
  label: string
  tone: LiveTone
  /** Panel heading; empty while the video is the content (Live). */
  title: string
  /** One calm human sentence; empty when nothing needs saying. */
  body: string
  /** The LiveKit room exists and media may flow: connect the player. */
  connectPlayer: boolean
  /** Chat panel is shown. */
  showChat: boolean
  /**
   * Chat accepts new messages: live-service-v2's chatOpen is live or
   * reconnecting; anything else answers 409 STREAM_NOT_LIVE.
   */
  chatOpen: boolean
  /** Terminal: nothing more will happen to this stream. */
  terminal: boolean
}

const KNOWN: ReadonlySet<string> = new Set([
  "scheduled", "starting", "live", "reconnecting", "ended", "failed",
])

export function normalizeStatus(raw: unknown): LiveStatusKind {
  const s = str(raw)
  return KNOWN.has(s) ? (s as LiveStreamStatus) : "unknown"
}

/** The human reason a stream ended, phrased for who is reading it. */
export function endedReasonCopy(reason: unknown, audience: LiveAudience): string {
  const host = audience === "host"
  switch (str(reason)) {
    case "host_ended":
      return host ? "You ended the stream." : "The host ended the stream."
    case "host_lost":
      return host
        ? "Your connection dropped for too long, so the stream ended."
        : "The host's connection dropped for too long, so the stream ended."
    case "room_finished":
      return "The stream has finished."
    case "admin_stopped":
      return "Our moderators stopped this stream."
    case "no_media":
      return host
        ? "No video reached us from your device, so the stream was closed."
        : "No video reached us from the host, so the stream was closed."
    default:
      return host ? "Your stream has ended." : "This stream has ended."
  }
}

export function liveStatusView(
  stream: Pick<LiveStream, "status"> & Partial<Pick<LiveStream, "ended_reason" | "scheduled_at">>,
  audience: LiveAudience = "viewer",
): LiveStatusView {
  const kind = normalizeStatus(stream.status)
  const host = audience === "host"
  switch (kind) {
    case "scheduled":
      return {
        kind, label: "Scheduled", tone: "neutral",
        title: host ? "Your stream is scheduled" : "This stream hasn't started yet",
        body: scheduledCopy(stream.scheduled_at),
        connectPlayer: false, showChat: false, chatOpen: false, terminal: false,
      }
    case "starting":
      return {
        kind, label: "Starting", tone: "calm",
        title: host ? "Starting your stream" : "Starting soon",
        body: host
          ? "You'll be live as soon as your video reaches us."
          : "The host is getting ready. The stream will begin in a moment.",
        connectPlayer: false, showChat: true, chatOpen: false, terminal: false,
      }
    case "live":
      return {
        kind, label: "Live", tone: "live", title: "", body: "",
        connectPlayer: true, showChat: true, chatOpen: true, terminal: false,
      }
    case "reconnecting":
      return {
        kind, label: "Reconnecting", tone: "calm",
        title: "Reconnecting",
        body: host
          ? "Your connection dropped. Stay on this page and we'll pick up where you left off."
          : "The host's connection dropped. We'll pick up as soon as they're back.",
        connectPlayer: true, showChat: true, chatOpen: true, terminal: false,
      }
    case "ended":
      return {
        kind, label: "Ended", tone: "neutral",
        title: "Stream ended",
        body: endedReasonCopy(stream.ended_reason, audience),
        connectPlayer: false, showChat: false, chatOpen: false, terminal: true,
      }
    case "failed":
      return {
        kind, label: "Failed", tone: "danger",
        title: host ? "Your stream couldn't start" : "This stream couldn't start",
        body: str(stream.ended_reason)
          ? endedReasonCopy(stream.ended_reason, audience)
          : host
            ? "Something went wrong before your video reached us."
            : "Something went wrong before the stream could start.",
        connectPlayer: false, showChat: false, chatOpen: false, terminal: true,
      }
    default:
      return {
        kind: "unknown", label: "Unavailable", tone: "neutral",
        title: "This stream isn't available right now",
        body: "Try again in a little while.",
        connectPlayer: false, showChat: false, chatOpen: false, terminal: false,
      }
  }
}

function scheduledCopy(at: unknown): string {
  const s = str(at)
  if (!s) return "It will start soon."
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return "It will start soon."
  return `Starts ${d.toLocaleString()}.`
}

/**
 * The audience number shown next to the badge: the server's count, which
 * excludes the host. Never the LiveKit participant count (that includes the
 * host and the reader) and never the peak.
 */
export function currentViewerCount(
  stream: Partial<Pick<LiveStream, "viewer_count">> | null | undefined,
  realtime: number | null | undefined,
): number {
  const live = num(realtime)
  if (live !== null && live >= 0) return Math.floor(live)
  const fromStream = num(stream?.viewer_count)
  return fromStream !== null && fromStream >= 0 ? Math.floor(fromStream) : 0
}

export function viewerCountLabel(count: number): string {
  if (count <= 0) return "No viewers yet"
  return count === 1 ? "1 watching" : `${count.toLocaleString()} watching`
}
