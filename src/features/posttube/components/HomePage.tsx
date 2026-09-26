"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { History, Loader2, Tv2, Upload } from "lucide-react";

import { useAuthUser } from "@/store/auth";
import { VideoCard } from "./VideoCard";
import { VideoRow, VideoRowSkeleton } from "./VideoRow";
import { FlicksRow } from "./FlicksRow";
import { useContinueWatchingFeed, useFlicksFeed, useLongVideosFeed, useVideoCategories } from "../hooks/usePosttubeHome";
import { CHIP_ALL, CHIP_SUBSCRIPTIONS } from "../model";

/* ── Skeleton ─────────────────────────────────────────── */

export function VideoGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl bg-brand-card p-3">
          <div className="aspect-video rounded-2xl bg-brand-secondary" />
          <div className="mt-3.5 flex gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-brand-secondary" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-4 w-full rounded-lg bg-brand-secondary" />
              <div className="h-3.5 w-3/4 rounded-lg bg-brand-secondary" />
              <div className="h-3 w-1/2 rounded-lg bg-brand-secondary" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Fires `onVisible` when the sentinel scrolls into view. */
export function useLoadMoreSentinel(enabled: boolean, onVisible: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onVisible();
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled, onVisible]);
  return ref;
}

/* ── Chips ────────────────────────────────────────────── */

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-4 py-1.5 text-[12px] font-semibold transition-colors ${
        active ? "bg-primary-ink text-primary-foreground" : "bg-brand-secondary text-brand-text hover:bg-brand-divider"
      }`}
    >
      {label}
    </button>
  );
}

/* ── Home ─────────────────────────────────────────────── */

export function HomePage() {
  const user = useAuthUser();
  const [chip, setChip] = useState<string>(CHIP_ALL);

  const categoriesQuery = useVideoCategories();
  const videosFeed = useLongVideosFeed(chip, 20);
  const flicksFeed = useFlicksFeed(20, chip === CHIP_ALL);
  const continueWatchingFeed = useContinueWatchingFeed(10);

  const videos = videosFeed.data?.pages.flatMap((p) => p.items) ?? [];
  const flicks = flicksFeed.data?.pages.flatMap((p) => p.items) ?? [];
  const continueWatching = continueWatchingFeed.data ?? [];
  const categories = categoriesQuery.data ?? [];

  const sentinelRef = useLoadMoreSentinel(
    !!videosFeed.hasNextPage && !videosFeed.isFetchingNextPage,
    () => void videosFeed.fetchNextPage(),
  );

  const chips = [
    { slug: CHIP_ALL, label: "All" },
    ...(user ? [{ slug: CHIP_SUBSCRIPTIONS, label: "Subscriptions" }] : []),
    ...categories,
  ];

  const isEmpty = !videosFeed.isLoading && videos.length === 0;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-7 px-4 py-5 sm:px-6">
      {/* Chips */}
      <div className="sticky top-0 z-20 -mx-4 bg-canvas/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {chips.map((c) => (
            <Chip key={c.slug} label={c.label} active={chip === c.slug} onClick={() => setChip(c.slug)} />
          ))}
          {categoriesQuery.isLoading ? <Loader2 className="ml-1 h-4 w-4 shrink-0 animate-spin text-muted-foreground" /> : null}
        </div>
      </div>

      {/* Continue watching (only on All; hidden when empty) */}
      {chip === CHIP_ALL ? (
        continueWatchingFeed.isLoading ? (
          <VideoRowSkeleton count={3} />
        ) : continueWatching.length > 0 ? (
          <VideoRow
            title="Continue watching"
            icon={
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-secondary text-brand-text">
                <History className="h-4 w-4" />
              </div>
            }
            videos={continueWatching}
            variant="wide"
            seeAllHref="/posttube/history"
          />
        ) : null
      ) : null}

      {/* Video grid */}
      {videosFeed.isLoading ? (
        <VideoGridSkeleton />
      ) : isEmpty ? (
        <EmptyState chip={chip} />
      ) : (
        <section>
          <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
          <div ref={sentinelRef} className="h-px" />
          {videosFeed.hasNextPage ? (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => videosFeed.fetchNextPage()}
                disabled={videosFeed.isFetchingNextPage}
                className="flex items-center gap-2 rounded-full border border-border bg-brand-card px-6 py-2.5 text-[13px] font-semibold text-brand-text hover:bg-brand-secondary disabled:opacity-50"
              >
                {videosFeed.isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {videosFeed.isFetchingNextPage ? "Loading..." : "Load more"}
              </button>
            </div>
          ) : null}
        </section>
      )}

      {/* Reels shelf */}
      {chip === CHIP_ALL && flicks.length > 0 ? <FlicksRow videos={flicks} /> : null}

      <div className="h-6" />
    </div>
  );
}

function EmptyState({ chip }: { chip: string }) {
  if (chip === CHIP_SUBSCRIPTIONS) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-secondary">
          <Tv2 className="h-9 w-9 text-brand-text" />
        </div>
        <h3 className="mt-6 text-[18px] font-bold text-brand-text">Nothing from your subscriptions yet</h3>
        <p className="mt-2 max-w-[340px] text-[13px] leading-relaxed text-muted-foreground">
          Subscribe to channels and their new videos will show up here.
        </p>
        <Link href="/posttube/subscriptions" className="mt-5 rounded-full bg-primary-ink px-5 py-2.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary-hover">
          Manage subscriptions
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-secondary">
        <Tv2 className="h-9 w-9 text-brand-text" />
      </div>
      <h3 className="mt-6 text-[18px] font-bold text-brand-text">{chip === CHIP_ALL ? "Your stage awaits" : "No videos in this category yet"}</h3>
      <p className="mt-2 max-w-[340px] text-[13px] leading-relaxed text-muted-foreground">
        Be the first to share something. Upload a video and start building your audience.
      </p>
      <Link
        href="/posttube/upload?type=long"
        className="mt-5 flex items-center gap-2 rounded-full bg-primary-ink px-5 py-2.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary-hover"
      >
        <Upload className="h-4 w-4" /> Upload video
      </Link>
    </div>
  );
}
