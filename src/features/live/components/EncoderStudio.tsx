"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Play, StopCircle } from "lucide-react"

import { useEndStream, useLiveRoom, useLiveStream, useStartStream, useStreamIngress } from "@/hooks/useLiveV2"
import { getCurrentUserId } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { goLiveErrorCopy, isPilotRefusal } from "../errors"
import { encoderHostView, encoderPanel, ingressErrorCopy, studioFor } from "../encoder"
import { currentViewerCount, viewerCountLabel } from "../status"
import { EncoderPreview } from "./EncoderPreview"
import { EncoderSetup } from "./EncoderSetup"
import { LiveChat } from "./LiveChat"
import { LivePageHeading } from "./LivePageHeading"
import { LiveStatusPanel, ReconnectingNotice } from "./LiveStatus"
import { PilotNotice } from "./PilotNotice"
import "../live.css"
import "../encoder.css"

/**
 * Picks the host studio from the stream row. `device` is the camera studio:
 * it is not mounted until the row says the stream is a device stream, so an
 * encoder stream never triggers a camera or microphone prompt.
 */
export function StudioForSource({ streamId, device }: { streamId: string; device: React.ReactNode }) {
  const { data: stream, error } = useLiveStream(streamId, 5000)
  const kind = studioFor(stream?.id ? stream : null, !!error)
  if (kind === "loading") {
    return (
      <div className="live-page">
        <div className="live-page__inner"><Skeleton className="aspect-video w-full" /></div>
      </div>
    )
  }
  if (kind === "encoder") return <EncoderStudio key={streamId} streamId={streamId} />
  return <>{device}</>
}

/**
 * Host studio for a stream published by streaming software. Nothing here
 * touches the camera: POST /start opens the room (no publisher token), the
 * stream turns live when the encoder's video arrives, and the host watches
 * through a viewer token. The badge is always the server's status.
 */
function EncoderStudio({ streamId }: { streamId: string }) {
  const { data: stream } = useLiveStream(streamId, 5000)
  const startStream = useStartStream()
  const endStream = useEndStream()
  const room = useLiveRoom(streamId)
  const [meId, setMeId] = useState<string | null>(null)
  useEffect(() => setMeId(getCurrentUserId()), [])
  const [startError, setStartError] = useState<string | null>(null)
  const [pilot, setPilot] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)

  const view = encoderHostView(stream ?? { status: "scheduled" })
  const panel = encoderPanel(stream ?? {})
  const isHost = !!stream && !!meId && stream.creator_user_id === meId
  const ingress = useStreamIngress(streamId, isHost && panel.showKey && !pilot)
  const ingressPilot = isPilotRefusal(ingress.error)

  if (!stream) return null

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

  if (pilot || ingressPilot) {
    return (
      <div className="live-page">
        <div className="live-form"><PilotNotice /></div>
      </div>
    )
  }

  async function handleStart() {
    setStartError(null)
    try {
      await startStream.mutateAsync(streamId)
    } catch (err) {
      if (isPilotRefusal(err)) {
        setPilot(true)
        return
      }
      setStartError(goLiveErrorCopy(err))
    }
  }

  async function handleEnd() {
    setConfirmEnd(false)
    try {
      await endStream.mutateAsync(streamId)
    } catch {
      // The server sweeper ends a stream whose encoder has gone; the status
      // poll shows what happened.
    }
  }

  const viewers = viewerCountLabel(currentViewerCount(stream, null))

  return (
    <div className="live-page">
      <div className="live-page__inner">
        <LivePageHeading title={stream.title} view={view} studio>
          {stream.description && <p className="live-page__meta">{stream.description}</p>}
        </LivePageHeading>

        <div className="live-layout">
          <div className="flex flex-col gap-3">
            {panel.panel === "over" ? (
              <LiveStatusPanel
                view={view}
                action={
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {startError && <p className="live-error w-full" role="alert">{startError}</p>}
                    <Link href={`/live/${stream.id}`} className="live-btn live-btn--ghost">Go to the stream page</Link>
                    {/* live-service-v2 lets a failed stream start again; it gets a new stream key. */}
                    {view.kind === "failed" && (
                      <button type="button" className="live-btn live-btn--primary" disabled={startStream.isPending} onClick={handleStart}>
                        Try again
                      </button>
                    )}
                  </div>
                }
              />
            ) : (
              <>
                {panel.panel === "preview" ? (
                  <>
                    <ReconnectingNotice view={view} />
                    <EncoderPreview streamId={stream.id} creatorId={stream.creator_user_id} view={view} viewersLabel={viewers} />
                  </>
                ) : (
                  <EncoderSetup
                    ingress={ingress.ingress}
                    loading={ingress.loading}
                    resetting={ingress.resetting}
                    error={ingress.error ? ingressErrorCopy(ingress.error) : null}
                    view={view}
                    onRetry={ingress.retry}
                    onReset={() => { void ingress.reset() }}
                  />
                )}
                {startError && <p className="live-error" role="alert">{startError}</p>}
                <div className="live-section live-studio-controls">
                  <span className="live-page__meta">
                    {view.kind === "live" ? `You're live. ${viewers}.` : view.kind === "starting" ? view.title : view.label}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {panel.canStart && (
                      <button
                        type="button"
                        className="live-btn live-btn--primary"
                        onClick={handleStart}
                        disabled={startStream.isPending || !ingress.ingress}
                      >
                        <Play className="h-4 w-4" aria-hidden="true" />
                        {startStream.isPending ? "Starting…" : "Start"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="live-btn live-btn--danger"
                      onClick={() => setConfirmEnd(true)}
                      disabled={!panel.canEnd || endStream.isPending}
                    >
                      <StopCircle className="h-4 w-4" aria-hidden="true" />
                      {endStream.isPending ? "Ending…" : "End stream"}
                    </button>
                  </div>
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
