"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import {
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
} from "livekit-client"

import { useViewerToken } from "@/hooks/useLiveV2"
import { liveRoomSlot } from "../discovery"
import { isHostIdentity, pickHostVideo, type HostRef } from "../encoder"
import "../live.css"
import "../surfaces.css"

type PlayerPhase = "idle" | "connecting" | "connected" | "error"

/**
 * The viewer's player: joins the LiveKit room with a VIEWER token and shows
 * the host's media only (the creator's identity or the stream's encoder).
 *
 * `connect` is the caller's word that media may flow AND that this player
 * should hold a connection (the hero passes false when it is off screen).
 * The room is left the moment `connect` turns false or the player unmounts.
 * A page holds one room at a time: the player claims `liveRoomSlot` before
 * it connects, and a player that loses the slot disconnects and offers
 * "Resume".
 */
export function LivePlayer({
  streamId,
  creatorId,
  connect,
  muted = false,
  controls = true,
  fit = "contain",
  poster,
  waiting,
  children,
}: {
  streamId: string
  creatorId: string
  connect: boolean
  /** Silences the sound without leaving the room. */
  muted?: boolean
  controls?: boolean
  fit?: "contain" | "cover"
  /** The cover, shown until the host's video arrives. */
  poster?: string
  /** Shown over the video instead of "Connecting…" (the host is reconnecting). */
  waiting?: string
  /** Laid over the stage (hearts, a badge, a button). */
  children?: ReactNode
}) {
  const owner = useId()
  const tokenQuery = useViewerToken(streamId, connect)
  const token = tokenQuery.data?.token
  const serverUrl = tokenQuery.data?.server_url
  const [evicted, setEvicted] = useState(false)
  const join = connect && !!token && !!serverUrl && !evicted

  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const [phase, setPhase] = useState<PlayerPhase>("idle")

  useEffect(() => {
    if (!join || !token || !serverUrl) return
    let cancelled = false
    const host: HostRef = { id: streamId, creator_user_id: creatorId }
    const lkRoom = new Room({ adaptiveStream: true, dynacast: true })
    const leave = () => {
      try { void lkRoom.disconnect() } catch { /* already gone */ }
    }
    // Whoever held the slot is told to leave before this player joins.
    const done = liveRoomSlot.claim(owner, () => {
      cancelled = true
      leave()
      setEvicted(true)
    })

    const hostVideoIdentity = () =>
      pickHostVideo(
        Array.from(lkRoom.remoteParticipants.values(), (p) => ({
          identity: p.identity,
          hasVideo: Array.from(p.trackPublications.values()).some((pub) => pub.kind === Track.Kind.Video),
        })),
        host,
      )?.identity
    const attach = (track: RemoteTrack, _pub: RemoteTrackPublication | undefined, participant: RemoteParticipant) => {
      if (!isHostIdentity(participant.identity, host)) return
      if (track.kind === Track.Kind.Video && videoElRef.current) {
        const chosen = hostVideoIdentity()
        if (chosen && chosen !== participant.identity) return
        track.attach(videoElRef.current)
      }
      // Sound is always attached and silenced on the element, so turning it
      // on or off never leaves and rejoins the room.
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
      leave()
      done()
      setPhase("idle")
    }
  }, [join, token, serverUrl, streamId, creatorId, owner])

  useEffect(() => {
    const el = audioElRef.current
    if (!el) return
    el.muted = muted
    if (!muted) void el.play().catch(() => { /* the browser wants a tap first */ })
  }, [muted, phase])

  return (
    <div className={`live-stage${fit === "cover" ? " live-stage--cover" : ""}`} data-phase={phase}>
      <video ref={videoElRef} autoPlay playsInline muted={muted} controls={controls} poster={poster} className="live-stage__video" />
      <audio ref={audioElRef} autoPlay muted={muted} />
      {evicted ? (
        <div className="live-stage__overlay flex-col gap-3">
          <span>Paused while another stream plays.</span>
          <button type="button" className="live-stage__resume" onClick={() => setEvicted(false)}>Resume</button>
        </div>
      ) : !connect ? null : waiting ? (
        <div className="live-stage__overlay">{waiting}</div>
      ) : tokenQuery.isError ? (
        <div className="live-stage__overlay flex-col gap-3">
          <span>We couldn&apos;t connect to the stream.</span>
          <button type="button" className="live-stage__resume" onClick={() => tokenQuery.refetch()}>Try again</button>
        </div>
      ) : phase !== "connected" ? (
        <div className="live-stage__overlay">{phase === "error" ? "We couldn't connect to the stream. Refresh to try again." : "Connecting…"}</div>
      ) : null}
      {children}
    </div>
  )
}
