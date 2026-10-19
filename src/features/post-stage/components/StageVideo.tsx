"use client";

import { useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import { Play, Volume2, VolumeX } from "lucide-react";

import type { StageMedia } from "@/features/post-stage/model";
import { useStageSound } from "@/features/post-stage/hooks/stageSound";

/*
  A feed video on the stage: plays muted when its page is the one on
  screen, pauses when it is not, and a tap pauses or resumes it. HLS through
  hls.js wherever Media Source exists (some Chromes answer "maybe" to native
  HLS and never load a byte), native HLS where it does not (iOS Safari), the
  progressive file otherwise.

  Deliberately NOT the reels player: that one reports watch telemetry the
  creator fund is computed from, and a feed video is a post — no reels,
  no Tube, no monetization.
*/

export function StageVideo({ media, active, poster }: { media: StageMedia; active: boolean; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [sound, setSound] = useStageSound();

  // Attach the source once, when the page is first rendered near the screen.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    const useFile = () => {
      if (cancelled) return;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.src = media.fileUrl;
    };
    const attach = async () => {
      const hlsUrl = media.hlsUrl;
      if (!hlsUrl) return useFile();
      const { default: HlsCtor } = await import("hls.js");
      if (cancelled) return;
      if (!HlsCtor.isSupported()) {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = hlsUrl;
          return;
        }
        return useFile();
      }
      const hls = new HlsCtor({ maxBufferLength: 12, xhrSetup: (xhr) => { xhr.withCredentials = true; } });
      hlsRef.current = hls;
      hls.on(HlsCtor.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }
        useFile();
      });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
    };
    void attach();
    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [media.fileUrl, media.hlsUrl]);

  // Play only while on screen; leaving resets the viewer's pause.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active && !userPaused) void video.play().catch(() => undefined);
    else video.pause();
  }, [active, userPaused]);
  useEffect(() => {
    if (!active) setUserPaused(false);
  }, [active]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = !sound;
  }, [sound]);

  return (
    <div className="ps-video">
      <video
        ref={videoRef}
        className="ps-video__el"
        playsInline
        loop
        muted={!sound}
        preload="metadata"
        poster={poster}
        aria-label={media.alt || "Video"}
        onClick={() => setUserPaused((p) => !p)}
      />
      {userPaused ? (
        <button type="button" className="ps-video__play" aria-label="Play" onClick={() => setUserPaused(false)}>
          <Play size={40} fill="currentColor" aria-hidden="true" />
        </button>
      ) : null}
      <button
        type="button"
        className="ps-video__sound"
        aria-label={sound ? "Mute" : "Turn sound on"}
        aria-pressed={sound}
        onClick={(e) => {
          e.stopPropagation();
          setSound(!sound);
        }}
      >
        {sound ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}
