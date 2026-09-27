"use client";

import Link from "next/link";
import { ArrowRight, LayoutGrid } from "lucide-react";
import type { Topic } from "../discoveryApi";
import { useTopics } from "../hooks/useDiscovery";
import { EmptyState, ErrorState, LoadingState } from "./DiscoveryState";
import { PageHead } from "./PageHead";
import type { ViewStatus } from "./TrendingPage";
import "../discovery.css";

export interface TopicsViewProps {
  topics: Topic[];
  status: ViewStatus;
  onRetry?: () => void;
}

export function topicHref(slug: string): string {
  return `/posttube/topics/${encodeURIComponent(slug)}`;
}

const KIND_WORD: Record<Topic["kind"], string> = { all: "Videos and reels", long: "Videos", short: "Reels" };

export function TopicCard({ topic }: { topic: Topic }) {
  return (
    <Link href={topicHref(topic.slug)} className="disco-topic">
      <span className="disco-topic__label">{topic.label}</span>
      <span className="disco-topic__meta">
        <span>{KIND_WORD[topic.kind]}</span>
        <ArrowRight strokeWidth={1.75} aria-hidden />
      </span>
    </Link>
  );
}

/** The pure screen: every topic a long-video viewer can open, as calm tiles. */
export function TopicsView({ topics, status, onRetry }: TopicsViewProps) {
  return (
    <div className="disco-page" data-screen="topics">
      <PageHead icon={<LayoutGrid strokeWidth={1.75} />} title="Topics" sub="Every subject on the platform, one page each" />
      {status === "loading" ? (
        <LoadingState label="Loading topics…" />
      ) : status === "error" ? (
        <ErrorState what="topics" onRetry={onRetry} />
      ) : topics.length === 0 ? (
        <EmptyState icon={<LayoutGrid size={20} strokeWidth={1.75} />} title="No topics yet" body="Topics appear once the taxonomy is published." actionHref="/posttube" actionLabel="Back to Watch" />
      ) : (
        <div className="disco-topic-grid">
          {topics.map((t) => (
            <TopicCard key={t.slug} topic={t} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TopicsPage() {
  const query = useTopics();
  const status: ViewStatus = query.isLoading ? "loading" : query.isError ? "error" : "ready";
  return <TopicsView topics={query.topics} status={status} onRetry={() => void query.refetch()} />;
}
