"use client";

import { useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PostTubeVideo } from "../types";
import { VideoCard } from "./VideoCard";

interface VideoRowProps {
  title: string;
  icon?: React.ReactNode;
  videos: PostTubeVideo[];
  variant?: "default" | "wide";
  badge?: string;
  /** Link for a "See all" affordance on the right of the heading. */
  seeAllHref?: string;
}

export function VideoRow({ title, icon, videos, variant = "default", badge, seeAllHref }: VideoRowProps) {
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
      <div className="mb-3 flex items-center gap-2.5 px-1">
        {icon}
        <h2 className="text-[16px] font-bold text-brand-text">{title}</h2>
        {badge && <span className="rounded-full bg-brand-secondary px-2.5 py-0.5 text-[10px] font-bold text-brand-text">{badge}</span>}
        {seeAllHref && (
          <Link href={seeAllHref} className="ml-auto text-[12px] font-semibold text-primary-ink hover:underline">
            See all
          </Link>
        )}
      </div>

      <div className="group/row relative">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll("left")}
            aria-label="Scroll left"
            className="absolute -left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-brand-card text-brand-text opacity-0 shadow-lg transition-opacity hover:bg-brand-secondary group-hover/row:opacity-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll("right")}
            aria-label="Scroll right"
            className="absolute -right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-brand-card text-brand-text opacity-0 shadow-lg transition-opacity hover:bg-brand-secondary group-hover/row:opacity-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-4 overflow-x-auto scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {videos.map((v) => (
            <div key={v.id} className={variant === "wide" ? "w-[360px] shrink-0" : "w-[280px] shrink-0"}>
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
        <div className="h-5 w-32 animate-pulse rounded-sm bg-brand-secondary" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="w-[280px] shrink-0">
            <div className="aspect-video animate-pulse rounded-xl bg-brand-secondary" />
            <div className="mt-3 flex gap-2.5">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-brand-secondary" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-3/4 animate-pulse rounded-sm bg-brand-secondary" />
                <div className="h-3 w-1/2 animate-pulse rounded-sm bg-brand-secondary" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
