"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Flag, Video } from "lucide-react"
import {
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
} from "livekit-client"

import { useLiveRoom, useLiveStream, useViewerToken } from "@/hooks/useLiveV2"
import { useBatchProfiles } from "@/hooks/useProfile"
import { getCurrentUserId } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { chatRole, streamTools } from "@/features/live/chat"
import { isHostIdentity } from "@/features/live/encoder"
import { isStreamNotLive, watchErrorCopy } from "@/features/live/errors"
import { currentViewerCount, liveStatusView, viewerCountLabel } from "@/features/live/status"
import { FoundingBadge } from "@/features/live/components/FoundingBadge"
import { LiveChat } from "@/features/live/components/LiveChat"
import { HeartCount, StageHearts } from "@/features/live/components/LiveHearts"
import { LivePageHeading } from "@/features/live/components/LivePageHeading"
import { LiveStatusPanel, ReconnectingNotice } from "@/features/live/components/LiveStatus"
import { ReportSheet } from "@/features/live/components/ReportSheet"
import { SupportersCard } from "@/features/live/components/TopSupporters"
import "@/features/live/live.css"

export default function LiveViewerPage() {
  const params = useParams<{ streamId: string }>()
  const streamId = params?.streamId
  if (!streamId) return null
  return <LiveViewer key={streamId} streamId={streamId} />
}

type PlayerPhase = "idle" | "connecting" | "connected" | "error"

function LiveViewer({ streamId }: { streamId: string }) {
  const { data: stream, error: streamError, refetch } = useLiveStream(streamId)
  const [meId, setMeId] = useState<string | null>(null)
  useEffect(() => setMeId(getCurrentUserId()), [])

  const view = liveStatusView(stream ?? { status: "starting" }, "viewer")
  const tokenQuery = useViewerToken(streamId, !!stream && view.connectPlayer)
  const room = useLiveRoom(streamId)

  const roomRef = useRef<Room | null>(null)
  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const [phase, setPhase] = useState<PlayerPhase>("idle")
  const [reportOpen, setReportOpen] = useState(false)

  const creatorProfiles = useBatchProfiles(stream ? [stream.creator_user_id] : [])
  const creator = stream && creatorProfiles.data instanceof Map
    ? (creatorProfiles.data as Map<string, { display_name?: string; username?: string }>).get(stream.creator_user_id)
    : null

  const token = tokenQuery.data?.token
  const serverUrl = tokenQuery.data?.server_url
  const connect = view.connectPlayer && !!token && !!serverUrl
  const creatorId = stream?.creator_user_id

  // 409 STREAM_NOT_LIVE after the retries: our row says on air but the
  // server no longer does. Re-read the row so the panel tells the truth.
  const tokenNotLive = isStreamNotLive(tokenQuery.error)
  useEffect(() => {
    if (tokenNotLive) void refetch()
  }, [tokenNotLive, refetch])

  // Join the LiveKit room only while the server says media can flow
  // (live or reconnecting); leave the moment it ends or fails.
  useEffect(() => {
    if (!connect || !token || !serverUrl) return
    let cancelled = false
    const lkRoom = new Room({ adaptiveStream: true, dynacast: true })
    roomRef.current = lkRoom
    const attach = (track: RemoteTrack, _pub?: RemoteTrackPublication, _p?: RemoteParticipant) => {
      // Host media only: the creator's identity or this stream's encoder.
      if (!isHostIdentity(_p?.identity, { id: streamId, creator_user_id: creatorId ?? "" })) return
      if (track.kind === Track.Kind.Video && videoElRef.current) track.attach(videoElRef.current)
      if (track.kind === Track.Kind.Audio && audioElRef.current) track.attach(audioElRef.current)
    }
    lkRoom.on(RoomEvent.TrackSubscribed, attach)
    lkRoom.on(RoomEvent.Disconnected, () => { if (!cancelled) setPhase("idle") })
    setPhase("connecting")
    lkRoom
      .connect(serverUrl, token)
      .then(() => {
        if (cancelled) return
        for (const participant of lkRoom.remoteParticipants.values()) {
          for (const pub of participant.trackPublications.values()) {
            if (pub.track) attach(pub.track as RemoteTrack, pub, participant)
          }
        }
        setPhase("connected")
      })
      .catch(() => { if (!cancelled) setPhase("error") })
    return () => {
      cancelled = true
      try { void lkRoom.disconnect() } catch { /* already gone */ }
      roomRef.current = null
      setPhase("idle")
    }
  }, [connect, token, serverUrl, streamId, creatorId])

  if (!stream) {
    const copy = streamError ? watchErrorCopy(streamError) : null
    return (
      <div className="live-page">
        <div className="live-page__inner">
          {streamError ? (
            <div className="live-panel">
              <div className="live-panel__title">{copy ?? "Couldn't load this stream."}</div>
              {!copy && (
                <button type="button" className="live-btn live-btn--ghost" onClick={() => refetch()}>Try again</button>
              )}
            </div>
          ) : (
            <Skeleton className="aspect-video w-full" />
          )}
        </div>
      </div>
    )
  }

  const role = chatRole(meId, stream.creator_user_id, room.chat.moderators)
  const tools = streamTools(role)
  const watchError = watchErrorCopy(tokenQuery.error)
  const viewers = currentViewerCount(stream, null)
  const showCount = view.kind === "live" || view.kind === "reconnecting"

  return (
    <div className="live-page">
      <div className="live-page__inner">
        <LivePageHeading title={stream.title} view={view}>
          <div className="flex flex-wrap items-center gap-3">
            <p className="live-page__meta">
              {creator?.display_name || creator?.username || "Creator"}
              {showCount ? ` · ${viewerCountLabel(viewers)}` : ""}
            </p>
            <FoundingBadge badges={stream.creator?.badges} />
            {showCount && <HeartCount streamId={stream.id} heartCount={stream.heart_count} />}
            {role === "host" && (
              <Link href={`/live/${stream.id}/broadcast`} className="live-btn live-btn--ghost">Open your studio</Link>
            )}
            {tools.reportStream && (
              <button
                type="button"
                className="live-btn live-btn--ghost"
                onClick={() => setReportOpen(true)}
                aria-label="Report stream"
              >
                <Flag className="h-4 w-4" aria-hidden="true" /> Report
              </button>
            )}
          </div>
        </LivePageHeading>

        <div className="live-layout">
          <div className="flex flex-col gap-3">
            {watchError ? (
              <LiveStatusPanel view={{ ...view, title: watchError, body: "" }} />
            ) : view.connectPlayer ? (
              <>
                <ReconnectingNotice view={view} />
                <div className="live-stage">
                  <video ref={videoElRef} autoPlay playsInline controls className="live-stage__video" />
                  <audio ref={audioElRef} autoPlay />
                  <StageHearts streamId={stream.id} heartCount={stream.heart_count} status={stream.status} signedIn={!!meId} banned={!!meId && room.chat.banned.includes(meId)} />
                  {view.kind === "reconnecting" ? (
                    <div className="live-stage__overlay">Waiting for the host to reconnect…</div>
                  ) : tokenQuery.isError ? (
                    <div className="live-stage__overlay flex-col gap-3">
                      <span>We couldn&apos;t connect to the stream.</span>
                      <button type="button" className="live-btn live-btn--primary" onClick={() => tokenQuery.refetch()}>
                        Try again
                      </button>
                    </div>
                  ) : phase !== "connected" ? (
                    <div className="live-stage__overlay">
                      {phase === "error" ? "We couldn't connect to the stream. Refresh to try again." : "Connecting…"}
                    </div>
                  ) : null}
                </div>
              </>
            ) : view.kind === "ended" && stream.recording_url ? (
              <>
                <div className="live-stage">
                  <video src={stream.recording_url} controls className="live-stage__video" />
                </div>
                <p className="live-page__meta flex items-center gap-1">
                  <Video className="h-3 w-3" aria-hidden="true" /> {view.body} This is the recording.
                </p>
              </>
            ) : (
              <LiveStatusPanel view={view} />
            )}
            {view.kind === "ended" && <SupportersCard streamId={stream.id} status={stream.status} />}
            {stream.description ? <section className="live-section"><h2 className="live-section__title">About this broadcast</h2><p className="live-description">{stream.description}</p></section> : null}
          </div>
          {view.showChat && !watchError && (
            <LiveChat streamId={stream.id} hostId={stream.creator_user_id} meId={meId} room={room} view={view} />
          )}
        </div>
      </div>
      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} streamId={stream.id} />
    </div>
  )
}
