"use client"

import { useEffect, useRef, useState } from "react"
import { Volume2, VolumeX } from "lucide-react"
import type Hls from "hls.js"

import { noteMediaPath, videoClock, type NoteMedia } from "../model"

/*
  A note's one video (echo-v2-contract.md, "Video in notes").

  HLS through hls.js wherever Media Source exists (some Chromes claim native
  HLS and never load it), Safari's native HLS otherwise, and the uploaded
  file itself until a ladder exists. Playback auth rides on the
  access_token cookie scoped to /v1/media, as for every player here.

  On a card it plays muted while at least half of it is on screen and stops
  when it leaves; a tap turns the sound on or off. On the note page it has
  the browser's controls.
*/
export function EchoVideo({ media, controls = false }: { media: NoteMedia; controls?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    let cancelled = false
    const fallback = noteMediaPath(media.mediaId)
    const attach = async () => {
      if (!media.hlsUrl) {
        video.src = fallback
        return
      }
      const { default: HlsCtor } = await import("hls.js")
      if (cancelled) return
      if (!HlsCtor.isSupported()) {
        video.src = video.canPlayType("application/vnd.apple.mpegurl") ? media.hlsUrl : fallback
        return
      }
      const hls = new HlsCtor()
      hlsRef.current = hls
      hls.on(HlsCtor.Events.ERROR, (_e, data) => {
        if (!data.fatal) return
        if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError()
        else {
          hls.destroy()
          hlsRef.current = null
          video.src = fallback
        }
      })
      hls.loadSource(media.hlsUrl)
      hls.attachMedia(video)
    }
    void attach()
    return () => {
      cancelled = true
      hlsRef.current?.destroy()
      hlsRef.current = null
    }
  }, [media.hlsUrl, media.mediaId])

  // Cards: play while half on screen, pause when not.
  useEffect(() => {
    const video = ref.current
    if (!video || controls || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => {})
        else video.pause()
      },
      { threshold: 0.5 },
    )
    io.observe(video)
    return () => io.disconnect()
  }, [controls])

  return (
    <div className="relative mt-2 overflow-hidden rounded-echo-inner bg-black" data-echo-video={media.mediaId}>
      <video
        ref={ref}
        className="max-h-[32rem] w-full bg-black object-contain"
        muted={controls ? undefined : muted}
        controls={controls}
        playsInline
        loop={!controls}
        preload="metadata"
        aria-label={media.altText || "Video"}
        onClick={(e) => {
          if (controls) return
          e.stopPropagation()
          setMuted((m) => !m)
        }}
      />
      {!controls && (
        <button
          type="button"
          aria-label={muted ? "Turn sound on" : "Turn sound off"}
          onClick={(e) => {
            e.stopPropagation()
            setMuted((m) => !m)
          }}
          className="absolute bottom-2 left-2 rounded-full bg-black/60 p-1.5 text-white"
          data-echo-video-sound
        >
          {muted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
        </button>
      )}
      {media.durationMs > 0 && !controls && (
        <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold tabular-nums text-white" data-echo-video-length>
          {videoClock(media.durationMs)}
        </span>
      )}
    </div>
  )
}
