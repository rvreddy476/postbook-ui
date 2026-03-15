"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Play, Eye, Zap, MessageCircle, Bookmark, Share2 } from "lucide-react";
import type { PostTubeVideo } from "../types";

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

  const hasThumbnail = thumbnailUrl && !imgFailed;
  const hasVideoFallback = videoUrl && !videoFailed && !hasThumbnail;

  return (
    <>
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#2D2640] via-[#3D3560] to-[#1A1430]">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.08] backdrop-blur-sm">
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
          src={thumbnailUrl}
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
      <div className={`absolute bottom-0 left-0 right-0 z-20 h-[3px] bg-white/20 dark:bg-white/10 transition-opacity duration-300 ${playing ? "opacity-100" : "opacity-0"}`}>
        <div
          ref={barRef}
          className="h-full bg-gradient-to-r from-[#F97066] to-[#7C5CFC]"
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
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0F0D15]/60 text-white/90 backdrop-blur-md transition-all hover:bg-[#7C5CFC] hover:scale-110"
        title="Spark"
      >
        <Zap className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0F0D15]/60 text-white/90 backdrop-blur-md transition-all hover:bg-[#7C5CFC] hover:scale-110"
        title="Stash"
      >
        <Bookmark className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0F0D15]/60 text-white/90 backdrop-blur-md transition-all hover:bg-[#7C5CFC] hover:scale-110"
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
  const [spotlightActive, setSpotlightActive] = useState(false);

  if (variant === "wide") {
    return (
      <Link
        href={`/posttube/watch/${video.id}`}
        className="spotlight-card group flex gap-3.5 rounded-2xl p-2.5 bg-white dark:bg-[#1C1A28] transition-all duration-300 hover:shadow-[0_8px_40px_-8px_rgba(124,92,252,0.2)]"
        onMouseEnter={() => setSpotlightActive(true)}
        onMouseLeave={() => setSpotlightActive(false)}
      >
        <div className="relative w-[220px] shrink-0 overflow-hidden rounded-xl bg-[#1A1430] aspect-video">
          <VideoThumbnail thumbnailUrl={video.thumbnail_url} videoUrl={video.video_url} />
          <SpotlightPreview videoUrl={video.video_url} previewUrl={video.preview_url} isActive={spotlightActive} />
          {duration && (
            <span className={`absolute bottom-2 right-2 z-10 rounded-lg bg-[#0F0D15]/80 px-2 py-0.5 text-[10px] font-bold text-white/90 tracking-wide backdrop-blur-sm transition-opacity duration-300 ${spotlightActive ? "opacity-0" : "opacity-100"}`}>
              {duration}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 py-1">
          <h3 className="line-clamp-2 text-[13px] font-semibold leading-tight text-[#0F0D15] dark:text-[#EEEDF5] group-hover:text-[#7C5CFC] transition-colors">
            {video.title}
          </h3>
          <p className="mt-1.5 text-[11px] text-[#8B8B9E] dark:text-[#6B6980]">{video.channel_name}</p>
          <p className="text-[11px] text-[#B0ADBE] dark:text-[#555368]">{fmtViews(video.view_count)} · {timeAgo(video.published_at)}</p>
        </div>
      </Link>
    );
  }

  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  return (
    <Link
      href={`/posttube/watch/${video.id}`}
      className="spotlight-card group flex flex-col rounded-2xl bg-white dark:bg-[#1C1A28] p-3 transition-all duration-300"
      onMouseEnter={() => setSpotlightActive(true)}
      onMouseLeave={() => setSpotlightActive(false)}
      style={{
        transform: spotlightActive ? "scale(1.03) translateY(-4px)" : "scale(1) translateY(0)",
        boxShadow: spotlightActive
          ? isDark
            ? "0 20px 60px -12px rgba(124, 92, 252, 0.35), 0 0 0 1px rgba(124, 92, 252, 0.15)"
            : "0 20px 60px -12px rgba(124, 92, 252, 0.25), 0 0 0 1px rgba(124, 92, 252, 0.08)"
          : isDark
            ? "0 1px 3px -1px rgba(0, 0, 0, 0.3)"
            : "0 1px 3px -1px rgba(15, 13, 21, 0.04)",
        zIndex: spotlightActive ? 10 : 1,
      }}
    >
      {/* Thumbnail */}
      <div className="relative overflow-hidden rounded-2xl bg-[#1A1430]" style={{ aspectRatio: "16/9" }}>
        <VideoThumbnail
          thumbnailUrl={video.thumbnail_url}
          videoUrl={video.video_url}
          className="transition-transform duration-500 ease-out"
        />

        <SpotlightPreview videoUrl={video.video_url} previewUrl={video.preview_url} isActive={spotlightActive} />
        <QuickActions visible={spotlightActive} />

        {duration && (
          <span className={`absolute bottom-3 right-3 z-10 rounded-xl bg-[#0F0D15]/75 px-2.5 py-1 text-[11px] font-bold text-white tracking-wider backdrop-blur-md transition-opacity duration-300 ${spotlightActive ? "opacity-0" : "opacity-100"}`}>
            {duration}
          </span>
        )}

        <div className={`absolute inset-0 z-10 flex items-center justify-center transition-all duration-300 ${spotlightActive ? "opacity-0 pointer-events-none" : "opacity-0 group-hover:opacity-100"}`}>
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F0D15]/40 via-transparent to-transparent" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white/95 dark:bg-white/90 shadow-[0_8px_32px_-8px_rgba(124,92,252,0.4)] backdrop-blur-xl">
            <Play className="ml-0.5 h-6 w-6 fill-[#7C5CFC] text-[#7C5CFC]" />
          </div>
        </div>

        {video.view_count >= 100 && (
          <div className={`absolute top-2.5 left-2.5 z-10 flex items-center gap-1 rounded-xl bg-[#0F0D15]/60 px-2 py-1 backdrop-blur-md transition-opacity duration-300 ${spotlightActive ? "opacity-0" : "opacity-100"}`}>
            <Eye className="h-3 w-3 text-[#F59E0B]" />
            <span className="text-[10px] font-bold text-white/90">{fmtViews(video.view_count).replace(" views", "")}</span>
          </div>
        )}
      </div>

      {/* Meta row */}
      <div className="mt-3.5 flex gap-3">
        <div className="relative mt-0.5">
          <img
            src={video.channel_avatar_url}
            alt=""
            className="h-10 w-10 shrink-0 rounded-xl bg-[#F0EEFF] dark:bg-[#2A2740] object-cover ring-2 ring-[#EEEDF5] dark:ring-[#2A2740] shadow-sm"
            loading="lazy"
          />
          <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-gradient-to-br from-[#7C5CFC] to-[#5B3FD4] ring-2 ring-white dark:ring-[#1C1A28] flex items-center justify-center">
            <Zap className="h-2 w-2 text-white" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug text-[#0F0D15] dark:text-[#EEEDF5] group-hover:text-[#7C5CFC] transition-colors">
            {video.title}
          </h3>
          <p className="mt-1 text-[12px] text-[#8B8B9E] dark:text-[#6B6980] group-hover:text-[#7C5CFC]/70 transition-colors">
            {video.channel_name}
          </p>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-[#B0ADBE] dark:text-[#555368]">
            {video.like_count > 0 && (
              <span className="flex items-center gap-0.5 text-[#F59E0B]">
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
            <span className="text-[#D8D6E2] dark:text-[#3A3650]">·</span>
            <span>{timeAgo(video.published_at)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
