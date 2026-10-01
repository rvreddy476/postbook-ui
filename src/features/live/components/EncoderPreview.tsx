"use client"

import { useEffect, useRef, useState } from "react"
import { Users, Volume2, VolumeX } from "lucide-react"
import {
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
} from "livekit-client"

import { useViewerToken } from "@/hooks/useLiveV2"
import { isHostIdentity, pickHostVideo, type HostRef } from "../encoder"
import type { LiveStatusView } from "../status"
import "../encoder.css"

type PreviewPhase = "idle" | "connecting" | "connected" | "error"

/**
 * The host's own view of an encoder stream: exactly what viewers get. The
 * browser joins with a VIEWER token and only subscribes; it never asks for
 * the camera or microphone and never publishes. Sound starts muted so the
 * stream does not feed back into the host's microphone.
 */
export function EncoderPreview({
  streamId,
  creatorId,
  view,
  viewersLabel,
}: {
  streamId: string
  creatorId: string
  view: LiveStatusView
  viewersLabel: string
}) {
  const tokenQuery = useViewerToken(streamId, view.connectPlayer)
  const token = tokenQuery.data?.token
  const serverUrl = tokenQuery.data?.server_url
  const connect = view.connectPlayer && !!token && !!serverUrl

  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const mutedRef = useRef(true)
  const [muted, setMuted] = useState(true)
  const [phase, setPhase] = useState<PreviewPhase>("idle")

  useEffect(() => {
    mutedRef.current = muted
    if (audioElRef.current) audioElRef.current.muted = muted
  }, [muted])

  useEffect(() => {
    if (!connect || !token || !serverUrl) return
    let cancelled = false
    const host: HostRef = { id: streamId, creator_user_id: creatorId }
    const lkRoom = new Room({ adaptiveStream: true, dynacast: true })

    const hostVideoIdentity = () =>
      pickHostVideo(
        Array.from(lkRoom.remoteParticipants.values(), (p) => ({
          identity: p.identity,
          hasVideo: Array.from(p.trackPublications.values()).some((pub) => pub.kind === Track.Kind.Video),
        })),
        host,
      )?.identity
    const attach = (track: RemoteTrack, _pub: RemoteTrackPublication | undefined, participant: RemoteParticipant) => {
      // Only the host's media (creator or this stream's encoder) is shown.
      if (!isHostIdentity(participant.identity, host)) return
      if (track.kind === Track.Kind.Video && videoElRef.current) {
        const chosen = hostVideoIdentity()
        if (chosen && chosen !== participant.identity) return
        track.attach(videoElRef.current)
      }
      if (track.kind === Track.Kind.Audio && audioElRef.current) {
        track.attach(audioElRef.current)
        audioElRef.current.muted = mutedRef.current
      }
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
      setPhase("idle")
    }
  }, [connect, token, serverUrl, streamId, creatorId])

  return (
    <div className="live-stage">
      <video ref={videoElRef} autoPlay muted playsInline className="live-stage__video" />
      <audio ref={audioElRef} autoPlay />
      <div className="live-stage__hud">
        <Users className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{viewersLabel}</span>
      </div>
      <button
        type="button"
        className="live-stage__hud live-encoder__mute"
        onClick={() => setMuted((m) => !m)}
        aria-pressed={!muted}
        aria-label={muted ? "Turn preview sound on" : "Turn preview sound off"}
      >
        {muted ? <VolumeX className="h-3.5 w-3.5" aria-hidden="true" /> : <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />}
        <span>{muted ? "Sound off" : "Sound on"}</span>
      </button>
      {view.kind === "reconnecting" ? (
        <div className="live-stage__overlay">Waiting for your streaming software…</div>
      ) : tokenQuery.isError ? (
        <div className="live-stage__overlay flex-col gap-3">
          <span>We couldn&apos;t load the preview. Your stream is not affected.</span>
          <button type="button" className="live-btn live-btn--primary" onClick={() => tokenQuery.refetch()}>
            Try again
          </button>
        </div>
      ) : phase !== "connected" ? (
        <div className="live-stage__overlay">
          {phase === "error" ? "We couldn't load the preview. Your stream is not affected." : "Loading the preview…"}
        </div>
      ) : null}
    </div>
  )
}
