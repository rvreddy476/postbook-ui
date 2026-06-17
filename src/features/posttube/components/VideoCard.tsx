"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Play, Eye, Zap, MessageCircle, Bookmark, Share2 } from "lucide-react";
import type { PostTubeVideo } from "../types";
import { useDataSaver } from "@/hooks/useDataSaver";
import { resolveImageUrl } from "@/lib/imageUrl";

/* ── Helpers ──────────────────────────────────────────── */

function fmtDuration(sec: number) {
  if (sec <= 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K views`;
  return `${n} views`;
}

function fmtSparks(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/* ── 3-tier thumbnail ─────────────────────────────────── */

function VideoThumbnail({
  thumbnailUrl,
  videoUrl,
  className,
}: {
  thumbnailUrl: string;
  videoUrl: string;
  className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const { effective: dataSaver } = useDataSaver();

  const hasThumbnail = thumbnailUrl && !imgFailed;
  // Data-saver: skip the autoplay-on-no-thumbnail video fallback —
  // it would still emit a metadata range request to the CDN.
  const hasVideoFallback =
    !dataSaver && videoUrl && !videoFailed && !hasThumbnail;
  const resolvedThumb = hasThumbnail
    ? resolveImageUrl(thumbnailUrl, { dataSaver, size: "medium" })
    : "";

  return (
    <>
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#2D2640] via-[#3D3560] to-[#1A1430]">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-card/[0.08] backdrop-blur-sm">
          <Play className="h-7 w-7 text-white/30 ml-0.5" />
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

/* ── Spotlight Preview (hover video) ──────────────────── */

const HOVER_DELAY_MS = 200;

function SpotlightPreview({
  videoUrl,
  previewUrl,
  isActive,
}: {
  videoUrl: string;
  previewUrl?: string;
  isActive: boolean;
}) {
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
      if (bar && vid.duration) {
        const pct = (vid.currentTime / vid.duration) * 100;
        bar.style.width = `${pct}%`;
      }
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
        className={`absolute inset-0 z-[5] h-full w-full object-cover transition-opacity duration-300 ${
          playing ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <div className={`absolute bottom-0 left-0 right-0 z-20 h-[3px] bg-brand-card/20 transition-opacity duration-300 ${playing ? "opacity-100" : "opacity-0"}`}>
        <div
          ref={barRef}
          className="h-full bg-brand-accent"
          style={{ width: "0%" }}
        />
      </div>
    </>
  );
}

/* ── Quick Actions Overlay (Spark, Stash, Echo) ───────── */

function QuickActions({ visible }: { visible: boolean }) {
  return (
    <div className={`absolute bottom-3 right-3 z-20 flex items-center gap-1.5 transition-all duration-300 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-accent/70 text-brand-bg backdrop-blur-md transition-all hover:bg-brand-accent hover:scale-110"
        title="Spark"
      >
        <Zap className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-accent/70 text-brand-bg backdrop-blur-md transition-all hover:bg-brand-accent hover:scale-110"
        title="Stash"
      >
        <Bookmark className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-accent/70 text-brand-bg backdrop-blur-md transition-all hover:bg-brand-accent hover:scale-110"
        title="Echo"
      >
        <Share2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ── VideoCard ────────────────────────────────────────── */

interface VideoCardProps {
  video: PostTubeVideo;
  variant?: "default" | "wide";
}

export function VideoCard({ video, variant = "default" }: VideoCardProps) {
  const duration = fmtDuration(video.duration_seconds);
  const { effective: dataSaver } = useDataSaver();
  // Data-saver: never run the hover-spotlight preview — it would
  // otherwise lazily fetch a few seconds of video on every hover.
  const [spotlightActive, setSpotlightActiveState] = useState(false);
  const setSpotlightActive = (value: boolean) => {
    if (dataSaver) {
      setSpotlightActiveState(false);
      return;
    }
    setSpotlightActiveState(value);
  };
  const resumePosition = typeof video.resume_position_ms === "number"
    ? Math.max(0, Math.floor(video.resume_position_ms / 1000))
    : 0;
  const resumePercent = typeof video.resume_percent_watched === "number"
    ? clampPercent(video.resume_percent_watched)
    : 0;
  const hasResumeState = resumePosition > 0 && resumePercent > 0;

  if (variant === "wide") {
    return (
      <Link
        href={`/posttube/watch/${video.id}`}
        className="spotlight-card group flex gap-3.5 rounded-2xl p-2.5 bg-brand-card transition-all duration-300 hover:shadow-md"
        onMouseEnter={() => setSpotlightActive(true)}
        onMouseLeave={() => setSpotlightActive(false)}
      >
        <div className="relative w-[220px] shrink-0 overflow-hidden rounded-xl bg-brand-secondary aspect-video">
          <VideoThumbnail thumbnailUrl={video.thumbnail_url} videoUrl={video.video_url} />
          <SpotlightPreview videoUrl={video.video_url} previewUrl={video.preview_url} isActive={spotlightActive} />
          {duration && (
            <span className="absolute bottom-2 right-2 z-10 rounded-lg bg-brand-accent/80 px-2 py-0.5 text-[10px] font-bold text-brand-bg tracking-wide backdrop-blur-sm transition-opacity duration-300">
              {duration}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 py-1">
          <h3 className="line-clamp-2 text-[13px] font-semibold leading-tight text-brand-text group-hover:text-brand-accent transition-colors">
            {video.title}
          </h3>
          <p className="mt-1.5 text-[11px] text-brand-text/60">{video.channel_name}</p>
          {hasResumeState && (
            <div className="mt-3">
              <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-text/75">
                <span>Resume at {fmtDuration(resumePosition)}</span>
                <span>{Math.round(resumePercent)}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-brand-secondary">
                <div
                  className="h-full rounded-full bg-brand-accent"
                  style={{ width: `${Math.max(8, resumePercent)}%` }}
                />
              </div>
              {video.last_watched_at && (
                <p className="mt-1.5 text-[10px] text-brand-text/50">
                  Watched {timeAgo(video.last_watched_at)}
                </p>
              )}
            </div>
          )}
          <p className="text-[11px] text-brand-text/50">{fmtViews(video.view_count)} · {timeAgo(video.published_at)}</p>
        </div>
      </Link>
    );
  }

  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  return (
    <Link
      href={`/posttube/watch/${video.id}`}
      className="spotlight-card group flex flex-col rounded-2xl bg-brand-card p-3 transition-all duration-300"
      onMouseEnter={() => setSpotlightActive(true)}
      onMouseLeave={() => setSpotlightActive(false)}
      style={{
        transform: spotlightActive ? "scale(1.03) translateY(-4px)" : "scale(1) translateY(0)",
        boxShadow: spotlightActive
          ? isDark
            ? "0 20px 60px -12px rgba(255, 255, 255, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.15)"
            : "0 20px 60px -12px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05)"
          : isDark
            ? "0 1px 3px -1px rgba(0, 0, 0, 0.3)"
            : "0 1px 3px -1px rgba(0, 0, 0, 0.04)",
        zIndex: spotlightActive ? 10 : 1,
      }}
    >
      {/* Thumbnail */}
      <div className="relative overflow-hidden rounded-2xl bg-brand-secondary" style={{ aspectRatio: "16/9" }}>
        <VideoThumbnail
          thumbnailUrl={video.thumbnail_url}
          videoUrl={video.video_url}
          className="transition-transform duration-500 ease-out"
        />

        <SpotlightPreview videoUrl={video.video_url} previewUrl={video.preview_url} isActive={spotlightActive} />
        <QuickActions visible={spotlightActive} />

        {duration && (
          <span className="absolute bottom-3 right-3 z-10 rounded-xl bg-brand-accent/80 px-2.5 py-1 text-[11px] font-bold text-brand-bg tracking-wider backdrop-blur-md transition-opacity duration-300">
            {duration}
          </span>
        )}

        <div className={`absolute inset-0 z-10 flex items-center justify-center transition-all duration-300 ${spotlightActive ? "opacity-0 pointer-events-none" : "opacity-0 group-hover:opacity-100"}`}>
          <div className="absolute inset-0 bg-brand-accent/10" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-card shadow-md backdrop-blur-xl">
            <Play className="ml-0.5 h-6 w-6 fill-brand-accent text-brand-accent" />
          </div>
        </div>

        {video.view_count >= 100 && (
          <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 rounded-xl bg-brand-accent/80 px-2 py-1 backdrop-blur-md">
            <Eye className="h-3 w-3 text-brand-bg" />
            <span className="text-[10px] font-bold text-brand-bg">{fmtViews(video.view_count).replace(" views", "")}</span>
          </div>
        )}
      </div>

      {/* Meta row */}
      <div className="mt-3.5 flex gap-3">
        <div className="relative mt-0.5">
          <img
            src={video.channel_avatar_url}
            alt=""
            className="h-10 w-10 shrink-0 rounded-xl bg-brand-secondary object-cover ring-2 ring-brand-divider shadow-sm"
            loading="lazy"
          />
          <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-brand-accent text-brand-bg ring-2 ring-brand-bg flex items-center justify-center">
            <Zap className="h-2 w-2 text-brand-bg" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug text-brand-text group-hover:text-brand-accent transition-colors">
            {video.title}
          </h3>
          <p className="mt-1 text-[12px] text-brand-text/60 group-hover:text-brand-accent/85 transition-colors">
            {video.channel_name}
          </p>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-brand-text/50">
            {video.like_count > 0 && (
              <span className="flex items-center gap-0.5 text-brand-text/70">
                <Zap className="h-3 w-3" />
                <span className="font-semibold">{fmtSparks(video.like_count)}</span>
              </span>
            )}
            {video.comment_count > 0 && (
              <span className="flex items-center gap-0.5">
                <MessageCircle className="h-3 w-3" />
                <span>{fmtSparks(video.comment_count)}</span>
              </span>
            )}
            <span>{fmtViews(video.view_count)}</span>
            <span className="text-brand-divider">·</span>
            <span>{timeAgo(video.published_at)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
