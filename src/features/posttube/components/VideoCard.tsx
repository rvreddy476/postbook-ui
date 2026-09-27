"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Play, Eye, MessageCircle, ThumbsUp } from "lucide-react";
import type { PostTubeVideo } from "../types";
import { formatCount, formatDuration, timeAgo } from "../model";
import { useDataSaver } from "@/hooks/useDataSaver";
import { resolveImageUrl } from "@/lib/imageUrl";
import "./tube.css";

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

/* ── 3-tier thumbnail ─────────────────────────────────── */

function VideoThumbnail({ thumbnailUrl, videoUrl, className }: { thumbnailUrl: string; videoUrl: string; className?: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const { effective: dataSaver } = useDataSaver();

  const hasThumbnail = thumbnailUrl && !imgFailed;
  // Data-saver: skip the autoplay-on-no-thumbnail video fallback —
  // it would still emit a metadata range request to the CDN.
  const hasVideoFallback = !dataSaver && videoUrl && !videoFailed && !hasThumbnail;
  const resolvedThumb = hasThumbnail ? resolveImageUrl(thumbnailUrl, { dataSaver, size: "medium" }) : "";

  return (
    <>
      <div className="tube-tile__poster-fallback" aria-hidden>
        <Play className="h-7 w-7" />
      </div>
      {hasVideoFallback && (
        <video
          src={videoUrl}
          muted
          preload="metadata"
          className={className}
          onError={() => setVideoFailed(true)}
        />
      )}
      {hasThumbnail && (
        <img
          src={resolvedThumb}
          alt=""
          className={className}
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      )}
    </>
  );
}

/* ── Hover preview ────────────────────────────────────── */

const HOVER_DELAY_MS = 200;

function SpotlightPreview({ videoUrl, previewUrl, isActive }: { videoUrl: string; previewUrl?: string; isActive: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number>(0);
  const barRef = useRef<HTMLDivElement>(null);

  const src = previewUrl || videoUrl;

  const startPreview = useCallback(() => {
    timerRef.current = setTimeout(() => {
      const vid = videoRef.current;
      if (!vid) return;
      vid.play().then(() => setPlaying(true)).catch(() => {});
    }, HOVER_DELAY_MS);
  }, []);

  const stopPreview = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    cancelAnimationFrame(rafRef.current);
    const vid = videoRef.current;
    if (vid) vid.pause();
    setPlaying(false);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const vid = videoRef.current;
    if (!vid) return;
    const tick = () => {
      const bar = barRef.current;
      if (bar && vid.duration) bar.style.width = `${(vid.currentTime / vid.duration) * 100}%`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  useEffect(() => {
    if (isActive) startPreview();
    else stopPreview();
    return () => stopPreview();
  }, [isActive, startPreview, stopPreview]);

  if (!src) return null;

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        muted
        playsInline
        preload="none"
        className={`absolute inset-0 z-5 h-full w-full object-cover transition-opacity duration-300 ${playing ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <div className={`absolute bottom-0 left-0 right-0 z-20 h-[3px] bg-white/20 transition-opacity duration-300 ${playing ? "opacity-100" : "opacity-0"}`}>
        <div ref={barRef} className="h-full bg-brand-accent" style={{ width: "0%" }} />
      </div>
    </>
  );
}

/* ── VideoCard ────────────────────────────────────────── */

interface VideoCardProps {
  video: PostTubeVideo;
  variant?: "default" | "wide";
}

export function VideoCard({ video, variant = "default" }: VideoCardProps) {
  const duration = formatDuration(video.duration_seconds);
  const { effective: dataSaver } = useDataSaver();
  // Data-saver: never run the hover preview — it would lazily fetch a few
  // seconds of video on every hover.
  const [spotlightActive, setSpotlightActiveState] = useState(false);
  const setSpotlightActive = (value: boolean) => setSpotlightActiveState(dataSaver ? false : value);

  const resumePosition = typeof video.resume_position_ms === "number" ? Math.max(0, Math.floor(video.resume_position_ms / 1000)) : 0;
  const resumePercent = typeof video.resume_percent_watched === "number" ? clampPercent(video.resume_percent_watched) : 0;
  const hasResumeState = resumePosition > 0 && resumePercent > 0;
  const href = `/posttube/watch/${video.id}`;

  const poster = (
    <div className="tube-tile__poster">
      <VideoThumbnail thumbnailUrl={video.thumbnail_url} videoUrl={video.video_url} />
      <SpotlightPreview videoUrl={video.video_url} previewUrl={video.preview_url} isActive={spotlightActive} />
      {duration && <span className="tube-tile__duration">{duration}</span>}
      {hasResumeState && (
        <div className="tube-tile__progress" aria-hidden>
          <div className="tube-tile__progress-bar" style={{ width: `${Math.max(4, resumePercent)}%` }} />
        </div>
      )}
      {variant === "default" ? (
        <>
          <div className={`tube-tile__play${spotlightActive ? " is-hidden" : ""}`} aria-hidden>
            <span className="tube-tile__play-circle">
              <Play className="fill-current" />
            </span>
          </div>
          {video.view_count >= 100 && (
            <span className="tube-tile__views">
              <Eye aria-hidden />
              <span>{formatCount(video.view_count)}</span>
            </span>
          )}
        </>
      ) : null}
    </div>
  );

  if (variant === "wide") {
    return (
      <Link
        href={href}
        className="tube-tile tube-tile--wide"
        onMouseEnter={() => setSpotlightActive(true)}
        onMouseLeave={() => setSpotlightActive(false)}
      >
        {poster}
        <div className="tube-tile__text">
          <h3 className="tube-tile__title">{video.title}</h3>
          <p className="tube-tile__meta">{video.channel_name}</p>
          {hasResumeState && (
            <p className="tube-tile__meta">
              Resume at {formatDuration(resumePosition)} · {Math.round(resumePercent)}%
              {video.last_watched_at ? ` · ${timeAgo(video.last_watched_at)}` : ""}
            </p>
          )}
          <p className="tube-tile__meta">
            {formatCount(video.view_count)} views · {timeAgo(video.published_at)}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="tube-tile"
      onMouseEnter={() => setSpotlightActive(true)}
      onMouseLeave={() => setSpotlightActive(false)}
    >
      {poster}
      <div className="tube-tile__body">
        <img src={video.channel_avatar_url} alt="" className="tube-tile__avatar" loading="lazy" />
        <div className="tube-tile__text">
          <h3 className="tube-tile__title">{video.title}</h3>
          <p className="tube-tile__meta">{video.channel_name}</p>
          <p className="tube-tile__meta">
            {video.like_count > 0 && (
              <span className="tube-tile__meta-count">
                <ThumbsUp aria-hidden />
                <strong>{formatCount(video.like_count)}</strong>
              </span>
            )}
            {video.comment_count > 0 && (
              <span className="tube-tile__meta-count">
                <MessageCircle aria-hidden />
                <span>{formatCount(video.comment_count)}</span>
              </span>
            )}
            <span>{formatCount(video.view_count)} views</span>
            <span aria-hidden>·</span>
            <span>{timeAgo(video.published_at)}</span>
          </p>
        </div>
      </div>
    </Link>
  );
}
