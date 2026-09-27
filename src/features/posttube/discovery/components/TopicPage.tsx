"use client";

import Link from "next/link";
import { ChevronLeft, LayoutGrid } from "lucide-react";
import { useMemo, useState } from "react";
import { VideoCard } from "../../components/VideoCard";
import { VideoGridSkeleton, useLoadMoreSentinel } from "../../components/HomePage";
import type { PostTubeVideo } from "../../types";
import { TOPIC_SORTS, type TopicSort } from "../discoveryApi";
import { useTopicFeed, useTopics } from "../hooks/useDiscovery";
import { EmptyState, ErrorState, LoadMore } from "./DiscoveryState";
import { PageHead } from "./PageHead";
import { PillRow } from "./Pills";
import type { ViewStatus } from "./TrendingPage";
import "../../components/tube.css";
import "../discovery.css";

export interface TopicViewProps {
  slug: string;
  label: string;
  sort: TopicSort;
  onSortChange: (s: TopicSort) => void;
  videos: PostTubeVideo[];
  status: ViewStatus;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onRetry?: () => void;
}

function labelFromSlug(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** The pure screen for one topic: its videos, Recent or Popular. */
export function TopicView({ slug, label, sort, onSortChange, videos, status, hasMore, loadingMore, onLoadMore, onRetry }: TopicViewProps) {
  return (
    <div className="disco-page" data-screen="topic" data-topic={slug}>
      <PageHead
        icon={<LayoutGrid strokeWidth={1.75} />}
        title={label}
        sub={sort === "recent" ? "Newest first" : "Most watched first"}
        aside={
          <Link href="/posttube/topics" className="disco-pill">
            <ChevronLeft size={14} strokeWidth={2} aria-hidden />
            All topics
          </Link>
        }
      />
      <PillRow name="Order" options={TOPIC_SORTS} value={sort} onChange={onSortChange} />
      {status === "loading" ? (
        <VideoGridSkeleton count={8} />
      ) : status === "error" ? (
        <ErrorState what={`${label} videos`} onRetry={onRetry} />
      ) : videos.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid size={20} strokeWidth={1.75} />}
          title={`Nothing in ${label} yet`}
          body="Videos land here as creators file them under this topic."
          actionHref="/posttube/topics"
          actionLabel="Other topics"
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

export function TopicPage({ slug }: { slug: string }) {
  const [sort, setSort] = useState<TopicSort>("recent");
  const topics = useTopics();
  const label = useMemo(() => topics.topics.find((t) => t.slug === slug)?.label ?? labelFromSlug(slug), [topics.topics, slug]);
  const query = useTopicFeed(slug, sort, 20);
  const videos = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const sentinelRef = useLoadMoreSentinel(videos.length > 0 && !!query.hasNextPage && !query.isFetchingNextPage, () => void query.fetchNextPage());
  const status: ViewStatus = query.isLoading ? "loading" : query.isError ? "error" : "ready";
  return (
    <>
      <TopicView
        slug={slug}
        label={label}
        sort={sort}
        onSortChange={setSort}
        videos={videos}
        status={status}
        hasMore={!!query.hasNextPage}
        loadingMore={query.isFetchingNextPage}
        onLoadMore={() => void query.fetchNextPage()}
        onRetry={() => void query.refetch()}
      />
      <div ref={sentinelRef} className="disco-sentinel" />
    </>
  );
}
