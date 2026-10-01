"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { StopCircle, Users } from "lucide-react"
import {
  LocalAudioTrack,
  LocalVideoTrack,
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  createLocalVideoTrack,
} from "livekit-client"

import { useEndStream, useLiveRoom, useLiveStream, useStartStream } from "@/hooks/useLiveV2"
import { getCurrentUserId } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { goLiveErrorCopy, isPilotRefusal, watchErrorCopy } from "@/features/live/errors"
import { currentViewerCount, liveStatusView, viewerCountLabel } from "@/features/live/status"
import { StudioForSource } from "@/features/live/components/EncoderStudio"
import { LiveChat } from "@/features/live/components/LiveChat"
import { LivePageHeading } from "@/features/live/components/LivePageHeading"
import { LiveStatusPanel, ReconnectingNotice } from "@/features/live/components/LiveStatus"
import { PilotNotice } from "@/features/live/components/PilotNotice"
import "@/features/live/live.css"

// Host studio. POST /start mints the publisher token and puts the stream in
// `starting`; it becomes `live` only when LiveKit reports this host's track
// (server-side). The badge always shows the server's status, never a local
// guess, and the viewer number is the server's count without the host.

export default function BroadcastPage() {
  const params = useParams<{ streamId: string }>()
  const streamId = params?.streamId
  if (!streamId) return null
  // Streaming-software streams get the encoder studio; the camera studio
  // below mounts only for a stream that publishes from this device.
  return <StudioForSource key={streamId} streamId={streamId} device={<Studio key={streamId} streamId={streamId} />} />
}

type PublishPhase = "idle" | "starting" | "publishing" | "error" | "pilot" | "stopped"

function Studio({ streamId }: { streamId: string }) {
  const { data: stream, error: streamError } = useLiveStream(streamId, 5000)
  const startStream = useStartStream()
  const endStream = useEndStream()
  const room = useLiveRoom(streamId)
  const [meId, setMeId] = useState<string | null>(null)
  useEffect(() => setMeId(getCurrentUserId()), [])

  const roomRef = useRef<Room | null>(null)
  const tracksRef = useRef<Array<LocalVideoTrack | LocalAudioTrack>>([])
  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const startedRef = useRef(false)
  const [phase, setPhase] = useState<PublishPhase>("idle")
  const [localReconnecting, setLocalReconnecting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [confirmEnd, setConfirmEnd] = useState(false)

  const view = liveStatusView(stream ?? { status: "starting" }, "host")
  const hostReconnecting = localReconnecting && !view.terminal
  const shownView = hostReconnecting && view.kind === "live" ? liveStatusView({ status: "reconnecting" }, "host") : view

  const teardown = () => {
    const r = roomRef.current
    roomRef.current = null
    if (r) { try { void r.disconnect() } catch { /* already gone */ } }
    for (const t of tracksRef.current) { try { t.stop() } catch { /* already stopped */ } }
    tracksRef.current = []
  }

  async function runStart(id: string) {
    setPhase("starting")
    setErrorMessage(null)
    try {
      const res = await startStream.mutateAsync(id)
      const lkRoom = new Room({ adaptiveStream: true, dynacast: true })
      roomRef.current = lkRoom
      lkRoom.on(RoomEvent.Reconnecting, () => setLocalReconnecting(true))
      lkRoom.on(RoomEvent.Reconnected, () => setLocalReconnecting(false))
      lkRoom.on(RoomEvent.Disconnected, () => setPhase((p) => (p === "publishing" ? "stopped" : p)))
      await lkRoom.connect(res.server_url, res.publisher_token)
      const audio = await createLocalAudioTrack()
      const video = await createLocalVideoTrack({ resolution: { width: 1280, height: 720, frameRate: 30 } })
      tracksRef.current = [audio, video]
      await lkRoom.localParticipant.publishTrack(audio, { source: Track.Source.Microphone })
      await lkRoom.localParticipant.publishTrack(video, { source: Track.Source.Camera })
      if (videoElRef.current) video.attach(videoElRef.current)
      setPhase("publishing")
    } catch (err) {
      teardown()
      if (isPilotRefusal(err)) {
        setPhase("pilot")
        return
      }
      setErrorMessage(err && typeof err === "object" && "response" in err ? goLiveErrorCopy(err) : "We couldn't reach your camera or the live server. Check permissions and try again.")
      setPhase("error")
    }
  }

  // Start once the stream is known and not already over. The ref guard
  // matters under StrictMode: never mint two tokens or open two cameras.
  useEffect(() => {
    if (!stream || startedRef.current || view.terminal) return
    startedRef.current = true
    void runStart(streamId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream?.id, view.terminal])

  // Server says it's over (host_lost, admin_stopped, no_media, …): release
  // the camera at once.
  useEffect(() => {
    if (view.terminal) teardown()
  }, [view.terminal])

  useEffect(() => () => teardown(), [])

  async function handleEnd() {
    setConfirmEnd(false)
    try {
      await endStream.mutateAsync(streamId)
    } catch {
      // The server sweeper ends a stream whose host has gone; releasing the
      // camera below is what matters here.
    } finally {
      teardown()
      setPhase("stopped")
    }
  }

  if (!stream) {
    return (
      <div className="live-page">
        <div className="live-page__inner">
          {streamError ? (
            <div className="live-panel">
              <div className="live-panel__title">{watchErrorCopy(streamError) ?? "Couldn't load your stream."}</div>
            </div>
          ) : (
            <Skeleton className="aspect-video w-full" />
          )}
        </div>
      </div>
    )
  }

  if (meId && stream.creator_user_id !== meId) {
    return (
      <div className="live-page">
        <div className="live-page__inner">
          <div className="live-panel">
            <div className="live-panel__title">This isn&apos;t your stream.</div>
            <Link href={`/live/${stream.id}`} className="live-btn live-btn--ghost">Watch it instead</Link>
          </div>
        </div>
      </div>
    )
  }

  if (phase === "pilot") {
    return (
      <div className="live-page">
        <div className="live-form"><PilotNotice /></div>
      </div>
    )
  }

  const viewers = currentViewerCount(stream, null)
  const onAir = !view.terminal && (phase === "publishing" || phase === "starting")

  return (
    <div className="live-page">
      <div className="live-page__inner">
        <LivePageHeading title={stream.title} view={shownView} studio>
          {stream.description && <p className="live-page__meta">{stream.description}</p>}
        </LivePageHeading>

        <div className="live-layout">
          <div className="flex flex-col gap-3">
            {view.terminal ? (
              <LiveStatusPanel
                view={view}
                action={
                  // live-service-v2 lets a failed stream start again
                  // (failed → starting); an ended one is over for good.
                  view.kind === "failed" ? (
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {phase === "error" && errorMessage && (
                        <p className="live-error w-full" role="alert">{errorMessage}</p>
                      )}
                      <Link href={`/live/${stream.id}`} className="live-btn live-btn--ghost">Go to the stream page</Link>
                      <button
                        type="button"
                        className="live-btn live-btn--primary"
                        disabled={startStream.isPending}
                        onClick={() => runStart(streamId)}
                      >
                        Try again
                      </button>
                    </div>
                  ) : (
                    <Link href={`/live/${stream.id}`} className="live-btn live-btn--ghost">Go to the stream page</Link>
                  )
                }
              />
            ) : (
              <>
                <ReconnectingNotice view={shownView} />
                <div className="live-stage">
                  <video ref={videoElRef} autoPlay muted playsInline className="live-stage__video" />
                  <div className="live-stage__hud">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{viewerCountLabel(viewers)}</span>
                  </div>
                  {phase === "starting" && (
                    <div className="live-stage__overlay">{view.body || "Starting your stream…"}</div>
                  )}
                  {phase === "publishing" && view.kind === "starting" && (
                    <div className="live-stage__overlay">{view.body}</div>
                  )}
                  {phase === "error" && (
                    <div className="live-stage__overlay flex-col gap-3">
                      <span>{errorMessage}</span>
                      <button
                        type="button"
                        className="live-btn live-btn--primary"
                        onClick={() => runStart(streamId)}
                      >
                        Try again
                      </button>
                    </div>
                  )}
                  {phase === "stopped" && (
                    <div className="live-stage__overlay">Ending your stream…</div>
                  )}
                </div>
                <div className="live-section live-studio-controls">
                  <span className="live-page__meta">
                    {view.kind === "live" ? "You're live." : view.label}
                  </span>
                  <button
                    type="button"
                    className="live-btn live-btn--danger"
                    onClick={() => setConfirmEnd(true)}
                    disabled={!onAir || endStream.isPending}
                  >
                    <StopCircle className="h-4 w-4" aria-hidden="true" />
                    {endStream.isPending ? "Ending…" : "End stream"}
                  </button>
                </div>
              </>
            )}
          </div>
          {view.showChat && (
            <LiveChat streamId={stream.id} hostId={stream.creator_user_id} meId={meId} room={room} view={view} />
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        onConfirm={handleEnd}
        title="End your stream?"
        description="Viewers will see that you ended the stream. This can't be undone."
        confirmLabel="End stream"
        loading={endStream.isPending}
      />
    </div>
  )
}
