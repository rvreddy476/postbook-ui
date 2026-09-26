"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clapperboard, Eye, Play } from "lucide-react";

import { formatCount } from "../model";
import type { PostTubeVideo } from "../types";

/* ── Flick thumbnail with fallback ────────────────────── */

function FlickImg({ src, videoUrl }: { src: string; videoUrl: string }) {
  const [failed, setFailed] = useState(false);

  if (failed && videoUrl) {
    return (
      <video
        src={videoUrl}
        muted
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

/* ── Reels shelf on the PostTube home ─────────────────── */

export function FlicksRow({ videos, title = "Reels" }: { videos: PostTubeVideo[]; title?: string }) {
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
    el.scrollBy({ left: dir === "left" ? -360 : 360, behavior: "smooth" });
  }, []);

  if (videos.length === 0) return null;

  return (
    <section className="pb-1">
      <div className="mb-4 flex items-center gap-3 px-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-ink text-primary-foreground">
          <Clapperboard className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-[17px] font-bold text-brand-text">{title}</h2>
          <p className="-mt-0.5 text-[11px] text-muted-foreground">Quick bites, big moments</p>
        </div>
        <Link href="/reels" className="ml-auto text-[12px] font-semibold text-primary-ink hover:underline">
          Open Reels
        </Link>
      </div>

      <div className="group/row relative">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll("left")}
            aria-label="Scroll left"
            className="absolute -left-2 top-[42%] z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-brand-card text-brand-text opacity-0 shadow-lg transition-all hover:scale-105 group-hover/row:opacity-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll("right")}
            aria-label="Scroll right"
            className="absolute -right-2 top-[42%] z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-brand-card text-brand-text opacity-0 shadow-lg transition-all hover:scale-105 group-hover/row:opacity-100"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-4 overflow-x-auto scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {videos.map((v) => (
            <Link key={v.id} href={`/reels?reelId=${encodeURIComponent(v.id)}`} className="group w-[172px] shrink-0">
              <div className="relative aspect-9/16 overflow-hidden rounded-2xl bg-primary-ink shadow-md transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg">
                <div className="absolute inset-0 flex items-center justify-center bg-primary-ink">
                  <Clapperboard className="h-8 w-8 text-white/30" />
                </div>
                {v.video_url && !v.thumbnail_url && (
                  <video src={v.video_url} muted preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
                )}
                {v.thumbnail_url && <FlickImg src={v.thumbnail_url} videoUrl={v.video_url} />}

                {v.view_count > 0 && (
                  <div className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 backdrop-blur-md">
                    <Eye className="h-2.5 w-2.5 text-white" />
                    <span className="text-[9px] font-bold text-white/90">{formatCount(v.view_count)}</span>
                  </div>
                )}

                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100">
                  <div className="absolute inset-0 bg-black/15" />
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white/95 shadow-lg">
                    <Play className="ml-0.5 h-5 w-5 fill-black text-black" />
                  </div>
                </div>

                <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="line-clamp-2 text-[12px] font-semibold leading-tight text-white drop-shadow-md">{v.title}</p>
                  {v.channel_name && <p className="mt-1 truncate text-[10px] font-medium text-white/60">{v.channel_name}</p>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
