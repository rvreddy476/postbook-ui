"use client";

import Link from "next/link";
import { Play, Clock } from "lucide-react";
import type { PostTubeVideo } from "../types";

function fmtViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDuration(sec: number) {
  if (sec <= 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface HeroSectionProps {
  featured: PostTubeVideo;
  secondary: PostTubeVideo[];
}

export function HeroSection({ featured, secondary }: HeroSectionProps) {
  return (
    <section className="grid grid-cols-3 gap-4">
      {/* Featured large card */}
      <Link
        href={`/posttube/watch?v=${featured.id}`}
        className="group col-span-2 relative overflow-hidden rounded-2xl bg-slate-900"
      >
        {/* Thumbnail */}
        <div className="relative aspect-[2.1/1]">
          {featured.thumbnail_url ? (
            <img
              src={featured.thumbnail_url}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-[#6b081f] to-slate-900" />
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-md ring-2 ring-white/30">
              <Play className="ml-1 h-7 w-7 text-white" fill="white" />
            </div>
          </div>
        </div>

        {/* Info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="rounded-full bg-red-500/90 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white tracking-wide">
              Featured
            </span>
            {featured.duration_seconds > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-white/15 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-white/90">
                <Clock className="h-2.5 w-2.5" />
                {fmtDuration(featured.duration_seconds)}
              </span>
            )}
          </div>
          <h2 className="text-[20px] font-bold text-white leading-tight line-clamp-2">
            {featured.title}
          </h2>
          <div className="mt-2 flex items-center gap-3">
            <img
              src={featured.channel_avatar_url}
              alt=""
              className="h-6 w-6 rounded-full ring-1 ring-white/20"
            />
            <span className="text-[13px] font-medium text-white/80">{featured.channel_name}</span>
            <span className="text-[12px] text-white/50">{fmtViews(featured.view_count)} views</span>
          </div>
        </div>
      </Link>

      {/* Secondary stack (right column) */}
      <div className="flex flex-col gap-3">
        {secondary.slice(0, 3).map((video) => (
          <Link
            key={video.id}
            href={`/posttube/watch?v=${video.id}`}
            className="group relative flex-1 overflow-hidden rounded-xl bg-slate-100"
          >
            {video.thumbnail_url ? (
              <img
                src={video.thumbnail_url}
                alt=""
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-slate-200 to-slate-100" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <h3 className="text-[12px] font-semibold text-white line-clamp-2 leading-tight">
                {video.title}
              </h3>
              <p className="mt-0.5 text-[10px] text-white/60">
                {video.channel_name} · {fmtViews(video.view_count)} views
              </p>
            </div>
            {video.duration_seconds > 0 && (
              <span className="absolute top-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-medium text-white">
                {fmtDuration(video.duration_seconds)}
              </span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function HeroSkeleton() {
  return (
    <section className="grid grid-cols-3 gap-4">
      <div className="col-span-2 aspect-[2.1/1] animate-pulse rounded-2xl bg-slate-100" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex-1 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    </section>
  );
}
