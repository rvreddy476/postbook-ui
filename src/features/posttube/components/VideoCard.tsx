"use client";

import Link from "next/link";
import type { PostTubeVideo } from "../types";

function fmtDuration(sec: number) {
  if (sec <= 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K views`;
  return `${n} views`;
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

interface VideoCardProps {
  video: PostTubeVideo;
  /** "default" = grid card, "wide" = horizontal card for continue watching */
  variant?: "default" | "wide";
}

export function VideoCard({ video, variant = "default" }: VideoCardProps) {
  const duration = fmtDuration(video.duration_seconds);

  if (variant === "wide") {
    return (
      <Link
        href={`/posttube/watch?v=${video.id}`}
        className="group flex gap-3 rounded-xl p-1.5 transition-colors hover:bg-slate-50"
      >
        {/* Thumbnail */}
        <div className="relative w-[168px] shrink-0 overflow-hidden rounded-lg bg-slate-100 aspect-video">
          {video.thumbnail_url ? (
            <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100">
              <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
            </div>
          )}
          {duration && (
            <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {duration}
            </span>
          )}
          {/* Progress bar for continue watching */}
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/20">
            <div className="h-full rounded-full bg-red-500" style={{ width: "45%" }} />
          </div>
        </div>

        {/* Meta */}
        <div className="min-w-0 flex-1 py-0.5">
          <h3 className="line-clamp-2 text-[13px] font-semibold leading-tight text-slate-900 group-hover:text-slate-700">
            {video.title}
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            {video.channel_name}
          </p>
          <p className="text-[11px] text-slate-400">
            {fmtViews(video.view_count)} · {timeAgo(video.published_at)}
          </p>
        </div>
      </Link>
    );
  }

  // Default grid card
  return (
    <Link
      href={`/posttube/watch?v=${video.id}`}
      className="group flex flex-col"
    >
      {/* Thumbnail */}
      <div className="relative overflow-hidden rounded-xl bg-slate-100 aspect-video">
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100">
            <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
          </div>
        )}
        {duration && (
          <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            {duration}
          </span>
        )}
        {/* Hover play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/10 group-hover:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
            <svg className="ml-0.5 h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="mt-3 flex gap-2.5">
        <img
          src={video.channel_avatar_url}
          alt=""
          className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-slate-100"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-slate-900">
            {video.title}
          </h3>
          <p className="mt-0.5 text-[12px] text-slate-500 hover:text-slate-700">
            {video.channel_name}
          </p>
          <p className="text-[11px] text-slate-400">
            {fmtViews(video.view_count)} · {timeAgo(video.published_at)}
          </p>
        </div>
      </div>
    </Link>
  );
}
