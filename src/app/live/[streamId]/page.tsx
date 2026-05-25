"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import {
  AlertCircle,
  Calendar,
  Lock,
  Radio,
  Users,
  Video,
} from "lucide-react"

import {
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
} from "livekit-client"

import {
  useLiveStream,
  useViewerToken,
  visibilityErrorReason,
} from "@/hooks/useLiveV2"
import { useBatchProfiles } from "@/hooks/useProfile"

export default function LiveViewerPage() {
  const params = useParams<{ streamId: string }>()
  const streamId = params?.streamId

  const { data: stream, error: streamError } = useLiveStream(streamId, 5000)
  const isLive = stream?.status === "live"
  const tokenQuery = useViewerToken(streamId, !!streamId && isLive)

  const roomRef = useRef<Room | null>(null)
  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const connectedRef = useRef(false)

  const [phase, setPhase] = useState<
    "idle" | "connecting" | "connected" | "error" | "denied"
  >("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [viewerCount, setViewerCount] = useState(0)

  const creatorProfiles = useBatchProfiles(stream ? [stream.creator_user_id] : [])
  // useBatchProfiles returns a Map<string, UserProfile>; pull the first entry.
  const creator = (stream && creatorProfiles.data instanceof Map)
    ? (creatorProfiles.data as Map<string, { id: string; display_name?: string }>).get(stream.creator_user_id)
    : null

  // Stream visibility gate — surfaces a clean fallback if the token call
  // returned 403/402.
  useEffect(() => {
    if (!tokenQuery.error) return
    const reason = visibilityErrorReason(tokenQuery.error)
    if (reason) {
      setErrorMessage(reason.message)
      setPhase("denied")
    } else {
      setErrorMessage("Couldn't load the stream.")
      setPhase("error")
    }
  }, [tokenQuery.error])

  // Connect the viewer to LiveKit as a subscriber once the token + room
  // are known. We only run this when the stream is in 'live' state — if
  // the host hasn't pressed Start yet we wait.
  useEffect(() => {
    if (!isLive) return
    if (!tokenQuery.data || connectedRef.current) return
    connectedRef.current = true
    void connectViewer(tokenQuery.data.server_url, tokenQuery.data.token)

    return () => {
      const room = roomRef.current
      if (room) {
        try {
          room.disconnect()
        } catch {
          // ignore
        }
        roomRef.current = null
      }
      connectedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, tokenQuery.data?.token])

  async function connectViewer(serverURL: string, token: string) {
    setPhase("connecting")
    try {
      const room = new Room({ adaptiveStream: true, dynacast: true })
      roomRef.current = room

      const onTrackSubscribed = (
        track: RemoteTrack,
        _pub: RemoteTrackPublication,
        _participant: RemoteParticipant,
      ) => {
        if (track.kind === Track.Kind.Video && videoElRef.current) {
          track.attach(videoElRef.current)
        }
        if (track.kind === Track.Kind.Audio && audioElRef.current) {
          track.attach(audioElRef.current)
        }
      }

      room.on(RoomEvent.TrackSubscribed, onTrackSubscribed)
      room.on(RoomEvent.ParticipantConnected, () => setViewerCount(room.numParticipants))
      room.on(RoomEvent.ParticipantDisconnected, () => setViewerCount(room.numParticipants))
      room.on(RoomEvent.Disconnected, () => {
        setPhase("idle")
      })

      await room.connect(serverURL, token)
      setViewerCount(room.numParticipants)

      // Catch any tracks already published before we joined.
      for (const participant of room.remoteParticipants.values()) {
        for (const pub of participant.trackPublications.values()) {
          if (pub.track) {
            onTrackSubscribed(pub.track, pub, participant)
          }
        }
      }
      setPhase("connected")
    } catch (err) {
      setErrorMessage(humanizeError(err))
      setPhase("error")
    }
  }

  if (!stream) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        {streamError ? (
          <div className="text-sm text-brand-text/60">Couldn't load this stream.</div>
        ) : (
          <div className="text-sm text-brand-text/60">Loading…</div>
        )}
      </div>
    )
  }

  // Visibility gate hit before we even tried to connect (e.g. 403/402
  // returned from the GET /v1/live/streams/:id call itself).
  const detailErrReason = streamError ? visibilityErrorReason(streamError) : null

  return (
    <div className="min-h-screen bg-brand-bg py-6 px-4">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-4 flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            {stream.status === "live" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-rose-500">
                <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                Live
              </span>
            )}
            <h1 className="text-xl font-bold text-brand-text">{stream.title}</h1>
          </div>
          <p className="text-xs text-brand-text/60">
            {creator?.display_name ?? "Creator"} · {viewerLabel(stream.status, viewerCount, stream.viewer_peak)}
          </p>
          {stream.description && (
            <p className="text-sm text-brand-text/80">{stream.description}</p>
          )}
        </header>

        {detailErrReason ? (
          <VisibilityFallback message={detailErrReason.message} />
        ) : phase === "denied" ? (
          <VisibilityFallback message={errorMessage ?? "Access denied"} />
        ) : stream.status === "scheduled" ? (
          <ScheduledPanel scheduledAt={stream.scheduled_at} />
        ) : stream.status === "ended" && stream.recording_url ? (
          <VODPlayer url={stream.recording_url} />
        ) : stream.status === "ended" ? (
          <EndedPanel />
        ) : stream.status === "failed" ? (
          <FailedPanel />
        ) : (
          <LivePlayer
            videoRef={videoElRef}
            audioRef={audioElRef}
            phase={phase}
            errorMessage={errorMessage}
          />
        )}
      </div>
    </div>
  )
}

// ── Helper sub-views ──────────────────────────────────────────────────

function viewerLabel(status: string, current: number, peak: number) {
  if (status === "live") {
    return `${current.toLocaleString()} watching`
  }
  if (status === "ended") {
    return `Peak: ${peak.toLocaleString()} viewers`
  }
  return ""
}

function LivePlayer({
  videoRef,
  audioRef,
  phase,
  errorMessage,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>
  audioRef: React.RefObject<HTMLAudioElement | null>
  phase: "idle" | "connecting" | "connected" | "error" | "denied"
  errorMessage: string | null
}) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-sm">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        controls
        className="absolute inset-0 h-full w-full object-contain"
      />
      <audio ref={audioRef} autoPlay />
      {phase !== "connected" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-white text-sm">
          {phase === "connecting" || phase === "idle" ? (
            <span>Connecting to the live stream…</span>
          ) : phase === "error" ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <AlertCircle className="h-6 w-6 text-rose-400" />
              <span>{errorMessage ?? "Stream connection failed"}</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function VODPlayer({ url }: { url: string }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-black">
      <video src={url} controls className="w-full" />
      <div className="bg-brand-card px-3 py-2 text-[11px] text-brand-text/60">
        <Video className="mr-1 inline h-3 w-3" /> Recording from a past live stream.
      </div>
    </div>
  )
}

function ScheduledPanel({ scheduledAt }: { scheduledAt: string | null }) {
  const when = scheduledAt ? new Date(scheduledAt).toLocaleString() : "soon"
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-brand-divider bg-brand-card px-6 py-12 text-center">
      <Calendar className="h-10 w-10 text-brand-text/40" />
      <div className="text-sm font-semibold text-brand-text">This stream hasn't started yet</div>
      <div className="text-xs text-brand-text/60">Starts at {when}</div>
    </div>
  )
}

function EndedPanel() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-brand-divider bg-brand-card px-6 py-12 text-center">
      <Radio className="h-10 w-10 text-brand-text/40" />
      <div className="text-sm font-semibold text-brand-text">Stream ended</div>
      <div className="text-xs text-brand-text/60">
        The recording is processing — check back shortly.
      </div>
    </div>
  )
}

function FailedPanel() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/40 px-6 py-12 text-center">
      <AlertCircle className="h-10 w-10 text-rose-400" />
      <div className="text-sm font-semibold text-brand-text">This stream couldn't be played</div>
      <div className="text-xs text-brand-text/60">Something went wrong on the broadcaster's side.</div>
    </div>
  )
}

function VisibilityFallback({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-brand-divider bg-brand-card px-6 py-12 text-center">
      <Lock className="h-10 w-10 text-brand-text/40" />
      <div className="text-sm font-semibold text-brand-text">{message}</div>
      <div className="text-xs text-brand-text/60">
        Reach out to the creator if you think this is a mistake.
      </div>
    </div>
  )
}

function humanizeError(err: unknown): string {
  if (!err) return "Unknown error"
  if (err instanceof Error) return err.message
  return String(err)
}
