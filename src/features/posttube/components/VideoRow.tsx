"use client";

import { useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PostTubeVideo } from "../types";
import { VideoCard } from "./VideoCard";
import "./tube.css";

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
    <section className="tube-row">
      <div className="tube-row__head">
        {icon ? <span className="tube-row__icon">{icon}</span> : null}
        <h2 className="tube-row__title">{title}</h2>
        {badge && <span className="tube-row__badge">{badge}</span>}
        {seeAllHref && (
          <Link href={seeAllHref} className="tube-row__all">
            See all
          </Link>
        )}
      </div>

      {canScrollLeft && (
        <button type="button" onClick={() => scroll("left")} aria-label="Scroll left" className="tube-row__arrow tube-row__arrow--left">
          <ChevronLeft aria-hidden />
        </button>
      )}
      {canScrollRight && (
        <button type="button" onClick={() => scroll("right")} aria-label="Scroll right" className="tube-row__arrow tube-row__arrow--right">
          <ChevronRight aria-hidden />
        </button>
      )}

      <div ref={scrollRef} onScroll={checkScroll} className="tube-row__scroller">
        {videos.map((v) => (
          <div key={v.id} className={variant === "wide" ? "tube-row__item tube-row__item--wide" : "tube-row__item"}>
            <VideoCard video={v} variant={variant} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Skeleton loader ─────────────────────────────────────── */

export function VideoRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <section className="tube-row" aria-hidden>
      <div className="tube-row__head">
        <div className="tube-tile__bone" style={{ width: 128, height: 14 }} />
      </div>
      <div className="tube-row__scroller" style={{ overflow: "hidden" }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="tube-row__item">
            <TileSkeleton />
          </div>
        ))}
      </div>
    </section>
  );
}

/** One pulsing tile: the poster box, an avatar dot, a title line and a meta line. */
export function TileSkeleton() {
  return (
    <div className="tube-tile is-skeleton" aria-hidden>
      <div className="tube-tile__poster" />
      <div className="tube-tile__body">
        <div className="tube-tile__bone tube-tile__bone--avatar" />
        <div className="tube-tile__bones">
          <div className="tube-tile__bone tube-tile__bone--title" />
          <div className="tube-tile__bone tube-tile__bone--line" />
        </div>
      </div>
    </div>
  );
}
