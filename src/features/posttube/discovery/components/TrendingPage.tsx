"use client";

import { Flame } from "lucide-react";
import { useMemo, useState } from "react";
import { VideoCard } from "../../components/VideoCard";
import { VideoGridSkeleton, useLoadMoreSentinel } from "../../components/HomePage";
import type { PostTubeVideo } from "../../types";
import { DEFAULT_TRENDING_PERIOD, TRENDING_PERIODS, TRENDING_PERIOD_ON_WIRE, type TrendingPeriod } from "../discoveryApi";
import { filterByPeriod } from "../discoveryModel";
import { useTrendingPage } from "../hooks/useDiscovery";
import { EmptyState, ErrorState, LoadMore } from "./DiscoveryState";
import { PageHead } from "./PageHead";
import { PillRow } from "./Pills";
import "../../components/tube.css";
import "../discovery.css";

export type ViewStatus = "loading" | "error" | "ready";

export interface TrendingViewProps {
  period: TrendingPeriod;
  onPeriodChange: (p: TrendingPeriod) => void;
  videos: PostTubeVideo[];
  status: ViewStatus;
  /** Rows exist but none fall in the period: offer the wider one. */
  narrowedOut?: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onRetry?: () => void;
}

const PERIOD_SUB: Record<TrendingPeriod, string> = {
  today: "What people are watching today",
  week: "What people are watching this week",
  month: "What people are watching this month",
};

/** The pure screen: the page passes state in, nothing here fetches. */
export function TrendingView({ period, onPeriodChange, videos, status, narrowedOut, hasMore, loadingMore, onLoadMore, onRetry }: TrendingViewProps) {
  return (
    <div className="disco-page" data-screen="trending">
      <PageHead icon={<Flame strokeWidth={1.75} />} title="Trending" sub={PERIOD_SUB[period]} />
      <PillRow name="Period" options={TRENDING_PERIODS} value={period} onChange={onPeriodChange} />
      {status === "loading" ? (
        <VideoGridSkeleton count={8} />
      ) : status === "error" ? (
        <ErrorState what="trending" onRetry={onRetry} />
      ) : videos.length === 0 ? (
        <EmptyState
          icon={<Flame size={20} strokeWidth={1.75} />}
          title={narrowedOut ? `Nothing new ${period === "today" ? "today" : `this ${period}`}` : "Nothing is trending yet"}
          body={narrowedOut ? "Widen the period to see what is moving." : "Trending fills as videos get watched. Come back soon or browse by topic."}
          actionHref={narrowedOut ? undefined : "/posttube/topics"}
          actionLabel={narrowedOut ? undefined : "Browse topics"}
        />
      ) : (
        <>
          <div className="tube-grid">
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
          <LoadMore hasMore={hasMore} loading={loadingMore} onLoadMore={onLoadMore} />
        </>
      )}
    </div>
  );
}

export function TrendingPage() {
  const [period, setPeriod] = useState<TrendingPeriod>(DEFAULT_TRENDING_PERIOD);
  const query = useTrendingPage(24);
  const all = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  // Not on the wire yet (see discoveryApi.TRENDING_PERIOD_ON_WIRE): narrow the ranked rows by date here.
  const videos = useMemo(() => (TRENDING_PERIOD_ON_WIRE ? all : filterByPeriod(all, period)), [all, period]);
  // Auto-page only while something is showing; a period that hid every row must not drain the ranking.
  const sentinelRef = useLoadMoreSentinel(videos.length > 0 && !!query.hasNextPage && !query.isFetchingNextPage, () => void query.fetchNextPage());
  const status: ViewStatus = query.isLoading ? "loading" : query.isError ? "error" : "ready";
  return (
    <>
      <TrendingView
        period={period}
        onPeriodChange={setPeriod}
        videos={videos}
        status={status}
        narrowedOut={all.length > 0 && videos.length === 0}
        hasMore={!!query.hasNextPage}
        loadingMore={query.isFetchingNextPage}
        onLoadMore={() => void query.fetchNextPage()}
        onRetry={() => void query.refetch()}
      />
      <div ref={sentinelRef} className="disco-sentinel" />
    </>
  );
}
