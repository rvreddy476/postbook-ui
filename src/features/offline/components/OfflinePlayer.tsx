"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import { useOfflineSource } from "../hooks";
import type { OfflineSurface } from "../wire";
import { OfflineBadge } from "./OfflineBadge";
import "./offline.css";

/*
  Plays a stored copy on the Offline page, with nothing from the network:
  the video, its captions and (for a reel) its added sound all come from
  the private store as object URLs.

  The element offers no way to take the file: no download control, no
  remote playback, no picture-in-picture, and no context menu.
*/

export interface OfflinePlayerProps {
  postId: string;
  title: string;
  surface: OfflineSurface;
  onClose: () => void;
}

export function OfflinePlayer({ postId, title, surface, onClose }: OfflinePlayerProps) {
  const source = useOfflineSource(postId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const sound = source?.sound ?? null;

  // A reel's added sound follows the picture: same play state, same rate, the clock offset by where the sound starts.
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio || !sound) return;
    const align = () => {
      const length = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
      const at = sound.startMs / 1000 + video.currentTime;
      audio.currentTime = length ? at % length : at;
    };
    const mix = () => {
      audio.volume = Math.max(0, Math.min(1, video.volume * sound.overlayVolume));
      audio.muted = video.muted;
    };
    const onPlay = () => {
      align();
      void audio.play().catch(() => undefined);
    };
    const onPause = () => audio.pause();
    const onRate = () => {
      audio.playbackRate = video.playbackRate;
    };
    mix();
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeked", align);
    video.addEventListener("ratechange", onRate);
    video.addEventListener("volumechange", mix);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", align);
      video.removeEventListener("ratechange", onRate);
      video.removeEventListener("volumechange", mix);
      audio.pause();
    };
  }, [sound]);

  return (
    <div className={`offline-player${surface === "reel" ? " is-reel" : ""}`} data-offline-player>
      <div className="offline-player__bar">
        <p className="offline-player__title">{title}</p>
        <button type="button" className="offline-player__close" onClick={onClose} aria-label="Close player">
          <X />
        </button>
      </div>
      {source ? (
        <div style={{ position: "relative" }}>
          <OfflineBadge />
          <video
            ref={videoRef}
            key={source.videoUrl}
            src={source.videoUrl}
            poster={source.posterUrl ?? undefined}
            controls
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            disableRemotePlayback
            playsInline
            autoPlay
            loop={surface === "reel"}
            onContextMenu={(e) => e.preventDefault()}
          >
            {source.captions.map((c) => (
              <track key={c.lang} kind="subtitles" src={c.src} srcLang={c.lang} label={c.label} />
            ))}
          </video>
          {sound ? <audio ref={audioRef} src={sound.url} preload="auto" loop hidden aria-hidden /> : null}
        </div>
      ) : (
        <p className="offline-player__wait">Opening the offline copy…</p>
      )}
    </div>
  );
}
