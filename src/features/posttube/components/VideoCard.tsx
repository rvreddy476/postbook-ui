"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Play, Eye, MessageCircle, ThumbsUp } from "lucide-react";
import type { PostTubeVideo } from "../types";
import { formatCount, formatDuration, timeAgo } from "../model";
import { useDataSaver } from "@/hooks/useDataSaver";
import { resolveImageUrl } from "@/lib/imageUrl";

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
      <div className="absolute inset-0 flex items-center justify-center bg-primary-ink">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
          <Play className="ml-0.5 h-7 w-7 text-white/40" />
        </div>
      </div>
      {hasVideoFallback && (
        <video
          src={videoUrl}
          muted
          preload="metadata"
          className={`absolute inset-0 h-full w-full object-cover ${className ?? ""}`}
          onError={() => setVideoFailed(true)}
        />
      )}
      {hasThumbnail && (
        <img
          src={resolvedThumb}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover ${className ?? ""}`}
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

  if (variant === "wide") {
    return (
      <Link
        href={href}
        className="group flex gap-3.5 rounded-2xl bg-brand-card p-2.5 transition-shadow duration-300 hover:shadow-md"
        onMouseEnter={() => setSpotlightActive(true)}
        onMouseLeave={() => setSpotlightActive(false)}
      >
        <div className="relative aspect-video w-[220px] shrink-0 overflow-hidden rounded-xl bg-brand-secondary">
          <VideoThumbnail thumbnailUrl={video.thumbnail_url} videoUrl={video.video_url} />
          <SpotlightPreview videoUrl={video.video_url} previewUrl={video.preview_url} isActive={spotlightActive} />
          {duration && (
            <span className="absolute bottom-2 right-2 z-10 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
              {duration}
            </span>
          )}
          {hasResumeState && (
            <div className="absolute inset-x-0 bottom-0 z-10 h-1 bg-white/30">
              <div className="h-full bg-brand-accent" style={{ width: `${Math.max(4, resumePercent)}%` }} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 py-1">
          <h3 className="line-clamp-2 text-[13px] font-semibold leading-tight text-brand-text transition-colors group-hover:text-primary-ink">{video.title}</h3>
          <p className="mt-1.5 text-[11px] text-muted-foreground">{video.channel_name}</p>
          {hasResumeState && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Resume at {formatDuration(resumePosition)} · {Math.round(resumePercent)}%
              {video.last_watched_at ? ` · ${timeAgo(video.last_watched_at)}` : ""}
            </p>
          )}
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {formatCount(video.view_count)} views · {timeAgo(video.published_at)}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-2xl bg-brand-card p-3 transition-all duration-300 ${spotlightActive ? "z-10 -translate-y-1 shadow-lg ring-1 ring-border" : "shadow-xs"}`}
      onMouseEnter={() => setSpotlightActive(true)}
      onMouseLeave={() => setSpotlightActive(false)}
    >
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-brand-secondary">
        <VideoThumbnail thumbnailUrl={video.thumbnail_url} videoUrl={video.video_url} className="transition-transform duration-500 ease-out" />
        <SpotlightPreview videoUrl={video.video_url} previewUrl={video.preview_url} isActive={spotlightActive} />

        {duration && (
          <span className="absolute bottom-3 right-3 z-10 rounded-lg bg-black/80 px-2 py-0.5 text-[11px] font-bold tracking-wider text-white">
            {duration}
          </span>
        )}

        {hasResumeState && (
          <div className="absolute inset-x-0 bottom-0 z-10 h-1 bg-white/30">
            <div className="h-full bg-brand-accent" style={{ width: `${Math.max(4, resumePercent)}%` }} />
          </div>
        )}

        <div className={`absolute inset-0 z-10 flex items-center justify-center transition-all duration-300 ${spotlightActive ? "pointer-events-none opacity-0" : "opacity-0 group-hover:opacity-100"}`}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-card shadow-md">
            <Play className="ml-0.5 h-6 w-6 fill-brand-accent text-primary-ink" />
          </div>
        </div>

        {video.view_count >= 100 && (
          <div className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1 rounded-lg bg-black/70 px-2 py-1">
            <Eye className="h-3 w-3 text-white" />
            <span className="text-[10px] font-bold text-white">{formatCount(video.view_count)}</span>
          </div>
        )}
      </div>

      <div className="mt-3.5 flex gap-3">
        <img
          src={video.channel_avatar_url}
          alt=""
          className="mt-0.5 h-10 w-10 shrink-0 rounded-full bg-brand-secondary object-cover ring-1 ring-border"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug text-brand-text transition-colors group-hover:text-primary-ink">{video.title}</h3>
          <p className="mt-1 text-[12px] text-muted-foreground">{video.channel_name}</p>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            {video.like_count > 0 && (
              <span className="flex items-center gap-0.5">
                <ThumbsUp className="h-3 w-3" />
                <span className="font-semibold">{formatCount(video.like_count)}</span>
              </span>
            )}
            {video.comment_count > 0 && (
              <span className="flex items-center gap-0.5">
                <MessageCircle className="h-3 w-3" />
                <span>{formatCount(video.comment_count)}</span>
              </span>
            )}
            <span>{formatCount(video.view_count)} views</span>
            <span aria-hidden>·</span>
            <span>{timeAgo(video.published_at)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
