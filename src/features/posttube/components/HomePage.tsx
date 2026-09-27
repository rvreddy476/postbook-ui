"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Flame, History, Loader2, Tv2, Upload } from "lucide-react";

import { useAuthUser } from "@/store/auth";
import { VideoCard } from "./VideoCard";
import { TileSkeleton, VideoRow } from "./VideoRow";
import { FlicksRow } from "./FlicksRow";
import { useContinueWatchingFeed, useFlicksFeed, useTrendingVideos } from "../hooks/usePosttubeHome";
import { TopicStrip, useStripFeed } from "@/features/posttube/discovery";
import { CHIP_ALL, CHIP_SUBSCRIPTIONS } from "../model";
import { gridColumnsFor, interleaveShelves, type ShelfKey } from "../shelves";
import type { PostTubeVideo } from "../types";
import "./tube.css";

/** The tile grid (tube.css): 1 / 2 / 3 / 4 columns at the breakpoints gridColumnsFor mirrors. */
const GRID_CLASS = "tube-grid";

/** The grid's column count for the current viewport (mirrors .tube-grid). */
function useGridColumns(): number {
  const [columns, setColumns] = useState(3);
  useEffect(() => {
    const update = () => setColumns(gridColumnsFor(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return columns;
}

/* ── Skeleton ─────────────────────────────────────────── */

export function VideoGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className={GRID_CLASS} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <TileSkeleton key={i} />
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

/* ── Home ─────────────────────────────────────────────── */

export function HomePage() {
  const user = useAuthUser();
  const [chip, setChip] = useState<string>(CHIP_ALL);

  const videosFeed = useStripFeed(chip, 20);
  const flicksFeed = useFlicksFeed(20, chip === CHIP_ALL);
  const continueWatchingFeed = useContinueWatchingFeed(10);
  const trendingFeed = useTrendingVideos(12);
  const columns = useGridColumns();

  const videos = videosFeed.data?.pages.flatMap((p) => p.items) ?? [];
  const flicks = flicksFeed.data?.pages.flatMap((p) => p.items) ?? [];
  const continueWatching = continueWatchingFeed.data ?? [];
  const trending = trendingFeed.data ?? [];

  const sentinelRef = useLoadMoreSentinel(
    !!videosFeed.hasNextPage && !videosFeed.isFetchingNextPage,
    () => void videosFeed.fetchNextPage(),
  );

  const isEmpty = !videosFeed.isLoading && videos.length === 0;

  // Shelves only on "All": a category or the subscriptions feed is its own list.
  const shelves = chip === CHIP_ALL ? { reels: flicks.length > 0, trending: trending.length > 0, continue: continueWatching.length > 0 } : { reels: false, trending: false, continue: false };
  const blocks = interleaveShelves(videos, columns, shelves);
  const shelfFor = (key: ShelfKey) => {
    if (key === "reels") return <FlicksRow videos={flicks} />;
    if (key === "trending") return <TrendingShelf videos={trending} />;
    return <ContinueWatchingShelf videos={continueWatching} />;
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-7 px-4 py-5 sm:px-6">
      {/* Topic strip: All · Following · Fresh · Seen · New to you · topics */}
      <TopicStrip value={chip} onChange={setChip} showFollowing={Boolean(user)} />

      {/* Video grid */}
      {videosFeed.isLoading ? (
        <VideoGridSkeleton />
      ) : isEmpty ? (
        <EmptyState chip={chip} />
      ) : (
        <section className="space-y-7">
          {blocks.map((block) =>
            block.type === "videos" ? (
              <div key={block.key} className={GRID_CLASS}>
                {block.items.map((v) => (
                  <VideoCard key={v.id} video={v} />
                ))}
              </div>
            ) : (
              <div key={block.key}>{shelfFor(block.shelf)}</div>
            ),
          )}
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

      {/* A short first page still deserves the reels shelf once. */}
      {chip === CHIP_ALL && flicks.length > 0 && !blocks.some((b) => b.type === "shelf") && !videosFeed.isLoading ? <FlicksRow videos={flicks} /> : null}

      <div className="h-6" />
    </div>
  );
}

function TrendingShelf({ videos }: { videos: PostTubeVideo[] }) {
  return (
    <VideoRow title="Trending" icon={<Flame aria-hidden />} videos={videos} />
  );
}

function ContinueWatchingShelf({ videos }: { videos: PostTubeVideo[] }) {
  return (
    <VideoRow title="Continue watching" icon={<History aria-hidden />} videos={videos} variant="wide" seeAllHref="/posttube/history" />
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
