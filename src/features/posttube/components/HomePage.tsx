"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, Play, ChevronLeft, ChevronRight, Zap, Eye, Sparkles, Tv2, History } from "lucide-react";
import Link from "next/link";
import { PostTubeShell } from "./PostTubeShell";
import { VideoCard } from "./VideoCard";
import { VideoRow, VideoRowSkeleton } from "./VideoRow";
import {
  useHomeFeed,
  useContinueWatchingFeed,
  useFlicksFeed,
  useLongVideosFeed,
} from "../hooks/usePosttubeHome";
import type { PostTubeVideo } from "../types";

const FILTER_CHIPS = [
  { label: "All", value: "all", icon: null },
  { label: "Gaming", value: "gaming", icon: null },
  { label: "Music", value: "music", icon: null },
  { label: "Tech", value: "tech", icon: null },
  { label: "Comedy", value: "comedy", icon: null },
  { label: "Education", value: "education", icon: null },
  { label: "News", value: "news", icon: null },
  { label: "Sports", value: "sports", icon: null },
  { label: "Cooking", value: "cooking", icon: null },
  { label: "Travel", value: "travel", icon: null },
] as const;

/* ── Shimmer Skeleton ─────────────────────────────────── */

function VideoGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl bg-brand-card dark:bg-[#1C1A28] p-3">
          <div className="rounded-2xl bg-gradient-to-br from-[#EEEDF5] to-[#E3E1EE] dark:from-[#2A2740] dark:to-[#221F32]" style={{ aspectRatio: "16/9" }} />
          <div className="mt-3.5 flex gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-[#EEEDF5] dark:bg-[#2A2740]" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-4 w-full rounded-lg bg-[#EEEDF5] dark:bg-[#2A2740]" />
              <div className="h-3.5 w-3/4 rounded-lg bg-[#EEEDF5] dark:bg-[#2A2740]" />
              <div className="h-3 w-1/2 rounded-lg bg-brand-secondary dark:bg-[#221F32]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

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

/* ── Flicks Horizontal Row ────────────────────────────── */

function FlicksRow({ videos }: { videos: PostTubeVideo[] }) {
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
    <section className="pb-3">
      {/* Section header */}
      <div className="mb-5 flex items-center gap-3 px-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-text to-black shadow-[0_2px_8px_-2px_rgba(0,0,0,0.3)]">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div>
          <h2 className="text-[17px] font-bold text-[#0F0D15] dark:text-[#EEEDF5]">Reels</h2>
          <p className="text-[11px] text-[#B0ADBE] dark:text-[#6B6980] -mt-0.5">Quick bites, big moments</p>
        </div>
      </div>

      <div className="group/row relative">
        {/* Scroll arrows */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll("left")}
            className="absolute -left-2 top-[42%] z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-2xl bg-brand-card dark:bg-[#2A2740] shadow-[0_4px_20px_-4px_rgba(15,13,21,0.15)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] border border-[#EEEDF5] dark:border-[#3A3650] text-brand-text opacity-0 transition-all group-hover/row:opacity-100 hover:scale-105"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll("right")}
            className="absolute -right-2 top-[42%] z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-2xl bg-brand-card dark:bg-[#2A2740] shadow-[0_4px_20px_-4px_rgba(15,13,21,0.15)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] border border-[#EEEDF5] dark:border-[#3A3650] text-brand-text opacity-0 transition-all group-hover/row:opacity-100 hover:scale-105"
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
            <Link
              key={v.id}
              href={`/reels?reelId=${v.id}`}
              className="group shrink-0 w-[180px]"
            >
              <div className="relative overflow-hidden rounded-2xl bg-[#1A1430] aspect-[9/16] shadow-[0_4px_24px_-6px_rgba(15,13,21,0.2)] dark:shadow-[0_4px_24px_-6px_rgba(0,0,0,0.5)] transition-all duration-300 group-hover:shadow-[0_8px_32px_-6px_rgba(0,0,0,0.25)] group-hover:-translate-y-1">
                {/* Placeholder */}
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#2D2640] via-[#1A1430] to-[#0F0D15]">
                  <Zap className="h-8 w-8 text-brand-text/30" />
                </div>
                {/* Video first-frame fallback */}
                {v.video_url && !v.thumbnail_url && (
                  <video
                    src={v.video_url}
                    muted
                    preload="metadata"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                {/* Thumbnail */}
                {v.thumbnail_url && (
                  <FlickImg src={v.thumbnail_url} videoUrl={v.video_url} />
                )}

                {/* View badge */}
                {v.view_count > 0 && (
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-xl bg-[#0F0D15]/60 px-2 py-1 backdrop-blur-md">
                    <Eye className="h-2.5 w-2.5 text-[#F59E0B]" />
                    <span className="text-[9px] font-bold text-white/90">
                      {v.view_count >= 1_000_000
                        ? `${(v.view_count / 1_000_000).toFixed(1)}M`
                        : v.view_count >= 1_000
                          ? `${(v.view_count / 1_000).toFixed(1)}K`
                          : v.view_count}
                    </span>
                  </div>
                )}

                {/* Hover play */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100">
                  <div className="absolute inset-0 bg-[#0F0D15]/15" />
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-card/95 shadow-lg backdrop-blur-xl">
                    <Play className="ml-0.5 h-5 w-5 fill-brand-text text-brand-text" />
                  </div>
                </div>

                {/* Bottom gradient + meta */}
                <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0F0D15]/80 via-[#0F0D15]/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="line-clamp-2 text-[12px] font-semibold text-white leading-tight drop-shadow-md">
                    {v.title}
                  </p>
                  {v.channel_name && (
                    <p className="mt-1 text-[10px] text-white/60 truncate font-medium">
                      {v.channel_name}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Home Page ──────────────────────────────────────── */

export function HomePage() {
  const [activeChip, setActiveChip] = useState("all");

  const homeFeed = useHomeFeed();
  const continueWatchingFeed = useContinueWatchingFeed(10);

  const [moreVideosEnabled, setMoreVideosEnabled] = useState(false);
  const [moreFlicksEnabled, setMoreFlicksEnabled] = useState(false);
  const longVideosFeed = useLongVideosFeed(20, moreVideosEnabled);
  const flicksFeed = useFlicksFeed(20, moreFlicksEnabled);
  const continueWatching = continueWatchingFeed.data ?? [];

  let flicks: PostTubeVideo[] = homeFeed.data?.flicks ?? [];
  let longVideos: PostTubeVideo[] = homeFeed.data?.longVideos ?? [];

  if (flicksFeed.data?.pages) {
    const extraFlicks = flicksFeed.data.pages.flatMap((p) => p.items);
    const flickIds = new Set(flicks.map((v) => v.id));
    flicks = [...flicks, ...extraFlicks.filter((v) => !flickIds.has(v.id))];
  }
  if (longVideosFeed.data?.pages) {
    const extraVideos = longVideosFeed.data.pages.flatMap((p) => p.items);
    const videoIds = new Set(longVideos.map((v) => v.id));
    longVideos = [...longVideos, ...extraVideos.filter((v) => !videoIds.has(v.id))];
  }

  const hasContent = continueWatching.length > 0 || flicks.length > 0 || longVideos.length > 0;
  const isLoading = (homeFeed.isLoading || continueWatchingFeed.isLoading) && !hasContent;

  return (
    <PostTubeShell>
      <div className="mx-auto max-w-[1400px] px-6 py-6 space-y-7">
        {/* Filter chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setActiveChip(chip.value)}
              className={`shrink-0 rounded-xl px-4 py-2 text-[12px] font-semibold transition-all duration-200 ${
                activeChip === chip.value
                  ? "bg-gradient-to-r from-brand-text to-black text-white shadow-[0_2px_12px_-3px_rgba(0,0,0,0.4)]"
                  : "bg-brand-secondary dark:bg-[#2A2740] text-brand-text dark:text-brand-text hover:bg-brand-secondary dark:hover:bg-[#3A3650] hover:shadow-sm"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <VideoGridSkeleton />
        ) : hasContent ? (
          <>
            {continueWatchingFeed.isLoading && continueWatching.length === 0 ? (
              <VideoRowSkeleton count={3} />
            ) : (
              <VideoRow
                title="Continue watching"
                icon={
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#F59E0B] to-[#F97316] shadow-[0_2px_8px_-2px_rgba(245,158,11,0.35)]">
                    <History className="h-4 w-4 text-white" />
                  </div>
                }
                videos={continueWatching}
                variant="wide"
                badge="Resume"
                badgeColor="bg-[#FFF1DA] text-[#C56508] dark:bg-[#3A2410] dark:text-[#F7B154]"
              />
            )}

            {/* Flicks */}
            {flicks.length > 0 && <FlicksRow videos={flicks} />}

            {/* Videos grid */}
            {longVideos.length > 0 && (
              <section>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-6">
                  {longVideos.map((v) => (
                    <VideoCard key={v.id} video={v} />
                  ))}
                </div>
                {(longVideosFeed.hasNextPage || !moreVideosEnabled) && longVideos.length >= 6 && (
                  <div className="mt-8 flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (!moreVideosEnabled) setMoreVideosEnabled(true);
                        else longVideosFeed.fetchNextPage();
                      }}
                      disabled={longVideosFeed.isFetchingNextPage}
                      className="group flex items-center gap-2 rounded-2xl border border-[#EEEDF5] dark:border-[#2A2740] bg-brand-card dark:bg-[#1C1A28] px-6 py-3 text-[13px] font-semibold text-brand-text shadow-sm transition-all hover:border-brand-text/20 hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.15)] disabled:opacity-50"
                    >
                      <Sparkles className="h-4 w-4 text-[#F59E0B] transition-transform group-hover:rotate-12" />
                      {longVideosFeed.isFetchingNextPage ? "Loading..." : "Discover more"}
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* Load more flicks */}
            {(flicksFeed.hasNextPage || !moreFlicksEnabled) && flicks.length >= 6 && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    if (!moreFlicksEnabled) setMoreFlicksEnabled(true);
                    else flicksFeed.fetchNextPage();
                  }}
                  disabled={flicksFeed.isFetchingNextPage}
                  className="group flex items-center gap-2 rounded-2xl border border-[#EEEDF5] dark:border-[#2A2740] bg-brand-card dark:bg-[#1C1A28] px-6 py-3 text-[13px] font-semibold text-brand-text shadow-sm transition-all hover:border-brand-text/20 hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.15)] disabled:opacity-50"
                >
                  <Zap className="h-4 w-4 text-[#F59E0B]" />
                  {flicksFeed.isFetchingNextPage ? "Loading..." : "More flicks"}
                </button>
              </div>
            )}
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-secondary to-brand-card dark:from-[#2A2740] dark:to-[#221F32]">
                <Tv2 className="h-10 w-10 text-brand-text" />
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#F59E0B] to-[#F97316] shadow-[0_2px_8px_-2px_rgba(245,158,11,0.4)]">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
            </div>
            <h3 className="mt-7 text-[18px] font-bold text-[#0F0D15] dark:text-[#EEEDF5]">Your stage awaits</h3>
            <p className="mt-2 text-[13px] text-[#8B8B9E] dark:text-[#6B6980] max-w-[340px] leading-relaxed">
              Be the first to share something amazing. Upload a video and start building your audience.
            </p>
            <Link
              href="/posttube/upload"
              className="mt-6 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand-text to-black px-6 py-3 text-[13px] font-bold text-white shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4)] transition-all hover:shadow-[0_6px_24px_-4px_rgba(0,0,0,0.5)] hover:-translate-y-0.5"
            >
              <Upload className="h-4 w-4" />
              Upload Video
            </Link>
          </div>
        )}

        <div className="h-6" />
      </div>
    </PostTubeShell>
  );
}
