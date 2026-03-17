"use client";

import { useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PostTubeVideo } from "../types";
import { VideoCard } from "./VideoCard";

interface VideoRowProps {
  title: string;
  icon?: React.ReactNode;
  videos: PostTubeVideo[];
  variant?: "default" | "wide";
  badge?: string;
  badgeColor?: string;
}

export function VideoRow({ title, icon, videos, variant = "default", badge, badgeColor }: VideoRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  const scroll = useCallback((dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const step = el.clientWidth * 0.75;
    el.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" });
  }, []);

  if (videos.length === 0) return null;

  return (
    <section className="relative">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2.5 px-1">
        {icon}
        <h2 className="text-[16px] font-bold text-brand-text">{title}</h2>
        {badge && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${badgeColor || "bg-slate-100 text-brand-highlight"}`}
          >
            {badge}
          </span>
        )}
        <button
          type="button"
          className="ml-auto text-[12px] font-semibold text-brand-text/60 hover:text-brand-highlight transition-colors"
        >
          See all
        </button>
      </div>

      {/* Scrollable row */}
      <div className="group/row relative">
        {/* Left arrow */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll("left")}
            className="absolute -left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-brand-card shadow-lg border border-brand-divider text-brand-highlight opacity-0 transition-opacity group-hover/row:opacity-100 hover:bg-brand-secondary"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}

        {/* Right arrow */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll("right")}
            className="absolute -right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-brand-card shadow-lg border border-brand-divider text-brand-highlight opacity-0 transition-opacity group-hover/row:opacity-100 hover:bg-brand-secondary"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-4 overflow-x-auto scroll-smooth scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {videos.map((v) => (
            <div
              key={v.id}
              className={
                variant === "wide"
                  ? "w-[320px] shrink-0"
                  : "w-[280px] shrink-0"
              }
            >
              <VideoCard video={v} variant={variant} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Skeleton loader ─────────────────────────────────────── */

export function VideoRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2.5 px-1">
        <div className="h-5 w-32 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="flex gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="w-[280px] shrink-0">
            <div className="aspect-video animate-pulse rounded-xl bg-slate-100" />
            <div className="mt-3 flex gap-2.5">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-slate-100" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-3/4 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
