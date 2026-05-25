"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  Loader2,
  Radio,
  StopCircle,
  Users,
  AlertCircle,
} from "lucide-react"

import {
  LocalVideoTrack,
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  createLocalVideoTrack,
} from "livekit-client"

import {
  useEndStream,
  useLiveStream,
  useStartStream,
  visibilityErrorReason,
} from "@/hooks/useLiveV2"
import LiveChatOverlay from "@/components/live/LiveChatOverlay"

// Broadcaster studio.
//
// On mount we call POST /v1/live/streams/:id/start to obtain a publisher
// token, then connect to the LiveKit Room as a publisher and attach the
// local camera + microphone tracks. The Room handle is kept on a ref so
// the End button can disconnect cleanly.

export default function BroadcastPage() {
  const params = useParams<{ streamId: string }>()
  const router = useRouter()
  const streamId = params?.streamId

  const { data: stream, error: streamError } = useLiveStream(streamId, 5000)
  const startStream = useStartStream()
  const endStream = useEndStream()

  const roomRef = useRef<Room | null>(null)
  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const localVideoTrackRef = useRef<LocalVideoTrack | null>(null)
  const startedRef = useRef(false)

  const [phase, setPhase] = useState<
    "idle" | "starting" | "publishing" | "ending" | "ended" | "error"
  >("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [participantCount, setParticipantCount] = useState(0)

  // Kick the start flow once the stream id is known. The ref guard
  // matters under React StrictMode: useEffect runs twice in dev and we
  // don't want to mint two publisher tokens / open two cameras.
  useEffect(() => {
    if (!streamId || startedRef.current) return
    startedRef.current = true
    void runStart(streamId)
    return () => {
      // Best-effort teardown on unmount — covers tab close + soft navigation.
      const room = roomRef.current
      if (room) {
        try {
          room.disconnect()
        } catch {
          // ignore
        }
        roomRef.current = null
      }
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.stop()
        localVideoTrackRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId])

  async function runStart(id: string) {
    setPhase("starting")
    setErrorMessage(null)
    try {
      const res = await startStream.mutateAsync(id)
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      })
      roomRef.current = room

      room.on(RoomEvent.ParticipantConnected, () => {
        setParticipantCount(room.numParticipants)
      })
      room.on(RoomEvent.ParticipantDisconnected, () => {
        setParticipantCount(room.numParticipants)
      })
      room.on(RoomEvent.Disconnected, () => {
        setPhase((p) => (p === "ending" || p === "ended" ? p : "ended"))
      })

      await room.connect(res.server_url, res.publisher_token)

      const audioTrack = await createLocalAudioTrack()
      const videoTrack = await createLocalVideoTrack({
        resolution: { width: 1280, height: 720, frameRate: 30 },
      })
      localVideoTrackRef.current = videoTrack

      await room.localParticipant.publishTrack(audioTrack, { source: Track.Source.Microphone })
      await room.localParticipant.publishTrack(videoTrack, { source: Track.Source.Camera })

      if (videoElRef.current) {
        videoTrack.attach(videoElRef.current)
      }
      setParticipantCount(room.numParticipants)
      setPhase("publishing")
    } catch (err) {
      const reason = visibilityErrorReason(err)
      setErrorMessage(reason?.message ?? humanizeError(err))
      setPhase("error")
    }
  }

  async function handleEnd() {
    if (!streamId) return
    setPhase("ending")
    try {
      // Try the server-side end first so the recording flushes cleanly.
      await endStream.mutateAsync(streamId)
    } catch (err) {
      // Even if the server call fails, we still want to release the camera.
      // The Mediums-deferred TODO covers retrying the End call from a worker.
      // eslint-disable-next-line no-console
      console.warn("end stream failed", err)
    } finally {
      if (roomRef.current) {
        await roomRef.current.disconnect()
        roomRef.current = null
      }
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.stop()
        localVideoTrackRef.current = null
      }
      setPhase("ended")
      router.push(`/live/${streamId}`)
    }
  }

  const isLive = phase === "publishing"
  const viewerCount = Math.max(0, (stream?.viewer_peak ?? 0))

  return (
    <div className="min-h-screen bg-brand-bg py-8 px-4">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-5 flex flex-col gap-1">
          <div className="flex items-center gap-3">
            {isLive && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-rose-500">
                <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                Live
              </span>
            )}
            <h1 className="text-xl font-bold text-brand-text">
              {stream?.title || "Live stream"}
            </h1>
          </div>
          {stream?.description && (
            <p className="text-sm text-brand-text/60">{stream.description}</p>
          )}
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-black aspect-video shadow-md">
          <video
            ref={videoElRef}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
          {phase === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm font-medium">Connecting to the broadcast server…</p>
              </div>
            </div>
          )}
          {phase === "error" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white p-6">
              <div className="flex max-w-md flex-col items-center gap-3 text-center">
                <AlertCircle className="h-8 w-8 text-rose-400" />
                <p className="text-sm font-semibold">Couldn't start the broadcast.</p>
                {errorMessage && (
                  <p className="text-xs text-white/70">{errorMessage}</p>
                )}
                <button
                  onClick={() => streamId && runStart(streamId)}
                  className="mt-2 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-black"
                >
                  Try again
                </button>
              </div>
            </div>
          )}
          {/* Live HUD */}
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-white">
            <Users className="h-3.5 w-3.5" />
            <span className="text-xs font-bold">{participantCount}</span>
            <span className="text-[10px] uppercase tracking-widest text-white/70">in-room</span>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between rounded-xl border border-brand-divider bg-brand-card p-4">
          <div className="text-xs text-brand-text/70">
            Peak viewers (server-tracked): <span className="font-bold text-brand-text">{viewerCount}</span>
          </div>
          <button
            onClick={handleEnd}
            disabled={phase === "ending" || phase === "ended" || phase === "idle"}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-50"
          >
            {phase === "ending" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <StopCircle className="h-4 w-4" />
            )}
            {phase === "ending" ? "Ending…" : "End stream"}
          </button>
        </div>

        {streamError && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-rose-500">
            <Radio className="h-3 w-3" /> Couldn't refresh stream metadata.
          </p>
        )}

        {/* Live chat overlay — visible during the actual broadcast.
            Hidden during connect / error / ended states. */}
        {isLive && streamId && (
          <div className="mt-5">
            <LiveChatOverlay streamId={streamId} className="h-[420px]" />
          </div>
        )}
      </div>
    </div>
  )
}

function humanizeError(err: unknown): string {
  if (!err) return "Unknown error"
  if (err instanceof Error) return err.message
  if (typeof err === "object" && err && "response" in err) {
    const ax = err as { response?: { data?: { error?: { message?: string } } } }
    return ax.response?.data?.error?.message ?? "Server error"
  }
  return String(err)
}
