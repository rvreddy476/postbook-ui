"use client";

import { useState } from "react";
import { Upload, Flame, Clock, Radio, Sparkles, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/features/reels/components/AppShell";
import { HeroSection, HeroSkeleton } from "./HeroSection";
import { VideoRow, VideoRowSkeleton } from "./VideoRow";
import { useCategoryFeed } from "../hooks/usePosttubeHome";

const FILTER_CHIPS = [
  { label: "All", value: "all" },
  { label: "Gaming", value: "gaming" },
  { label: "Music", value: "music" },
  { label: "Tech", value: "tech" },
  { label: "Comedy", value: "comedy" },
  { label: "Education", value: "education" },
  { label: "News", value: "news" },
  { label: "Sports", value: "sports" },
  { label: "Cooking", value: "cooking" },
  { label: "Travel", value: "travel" },
] as const;

export function HomePage() {
  const [activeChip, setActiveChip] = useState("all");

  // Parallel category fetches — each is an independent React Query
  const trending = useCategoryFeed("trending", 12);
  const continueWatching = useCategoryFeed("continue_watching", 8);
  const live = useCategoryFeed("live", 8);
  const recommended = useCategoryFeed("recommended", 12);
  const recent = useCategoryFeed("recent", 12);
  const popular = useCategoryFeed("popular", 12);

  // Hero uses trending data
  const heroVideos = trending.data?.items ?? [];
  const heroFeatured = heroVideos[0];
  const heroSecondary = heroVideos.slice(1, 4);

  return (
    <AppShell sectionLabel="PostTube">
      <div className="mx-auto max-w-[1200px] px-6 py-5 space-y-8">
            {/* Filter chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {FILTER_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => setActiveChip(chip.value)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-[12px] font-medium transition-all ${
                    activeChip === chip.value
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Hero */}
            {trending.isLoading ? (
              <HeroSkeleton />
            ) : heroFeatured ? (
              <HeroSection featured={heroFeatured} secondary={heroSecondary} />
            ) : null}

            {/* Continue Watching */}
            {continueWatching.isLoading ? (
              <VideoRowSkeleton count={3} />
            ) : (continueWatching.data?.items.length ?? 0) > 0 ? (
              <VideoRow
                title="Continue Watching"
                icon={<Clock className="h-4.5 w-4.5 text-blue-500" />}
                videos={continueWatching.data!.items}
                variant="wide"
              />
            ) : null}

            {/* Trending */}
            {trending.isLoading ? (
              <VideoRowSkeleton />
            ) : (trending.data?.items.length ?? 0) > 4 ? (
              <VideoRow
                title="Trending Now"
                icon={<Flame className="h-4.5 w-4.5 text-orange-500" />}
                videos={trending.data!.items.slice(4)} // skip hero items
                badge="Hot"
                badgeColor="bg-orange-50 text-orange-500"
              />
            ) : null}

            {/* Live */}
            {live.isLoading ? (
              <VideoRowSkeleton count={3} />
            ) : (live.data?.items.length ?? 0) > 0 ? (
              <VideoRow
                title="Live Now"
                icon={<Radio className="h-4.5 w-4.5 text-red-500" />}
                videos={live.data!.items}
                badge="Live"
                badgeColor="bg-red-50 text-red-500"
              />
            ) : null}

            {/* Recommended */}
            {recommended.isLoading ? (
              <VideoRowSkeleton />
            ) : (recommended.data?.items.length ?? 0) > 0 ? (
              <VideoRow
                title="Recommended For You"
                icon={<Sparkles className="h-4.5 w-4.5 text-violet-500" />}
                videos={recommended.data!.items}
              />
            ) : null}

            {/* Recently Uploaded */}
            {recent.isLoading ? (
              <VideoRowSkeleton />
            ) : (recent.data?.items.length ?? 0) > 0 ? (
              <VideoRow
                title="Recently Uploaded"
                icon={<TrendingUp className="h-4.5 w-4.5 text-emerald-500" />}
                videos={recent.data!.items}
              />
            ) : null}

            {/* Popular */}
            {popular.isLoading ? (
              <VideoRowSkeleton />
            ) : (popular.data?.items.length ?? 0) > 0 ? (
              <VideoRow
                title="Popular on PostTube"
                icon={<Users className="h-4.5 w-4.5 text-sky-500" />}
                videos={popular.data!.items}
              />
            ) : null}

            {/* Empty state */}
            {!trending.isLoading && heroVideos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-50">
                  <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                  </svg>
                </div>
                <h3 className="mt-5 text-[16px] font-bold text-slate-900">No videos yet</h3>
                <p className="mt-1.5 text-[13px] text-slate-500 max-w-[320px]">
                  Be the first to upload content. Share your stories with the world.
                </p>
                <Link
                  href="/posttube/upload"
                  className="mt-5 flex items-center gap-1.5 rounded-full bg-violet-600 px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-violet-700"
                >
                  <Upload className="h-4 w-4" />
                  Upload Video
                </Link>
              </div>
            )}

            {/* Bottom spacer */}
            <div className="h-8" />
      </div>
    </AppShell>
  );
}
