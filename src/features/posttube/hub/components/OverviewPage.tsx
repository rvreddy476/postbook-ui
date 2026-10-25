"use client";

import { useMemo, useState } from "react";

import { useBatchProfiles } from "@/hooks/useProfile";
import { useCreatorInsights, useHubInbox, useHubLibrary, useHubSummary } from "../hooks/useHub";
import { OVERVIEW_COMMENTS, OverviewDashboard, type OverviewPeriod } from "./OverviewDashboard";

export function OverviewPage() {
  const [period, setPeriod] = useState<OverviewPeriod>("28d");
  const summary = useHubSummary();
  const library = useHubLibrary("videos");
  const insights = useCreatorInsights(period);
  // The Conversations page's "All · newest" query: one cache, no second request when the creator opens it.
  const inbox = useHubInbox("all", "all", "newest");
  const latestComments = useMemo(() => inbox.rows.slice(0, OVERVIEW_COMMENTS), [inbox.rows]);
  const authorIds = useMemo(() => [...new Set(latestComments.map((r) => r.comment.author_id).filter(Boolean))], [latestComments]);
  const profiles = useBatchProfiles(authorIds);
  return <OverviewDashboard
    period={period}
    onPeriodChange={setPeriod}
    summary={{ data: summary.data, pending: summary.isPending, error: summary.isError, onRetry: () => { void summary.refetch(); } }}
    library={{ data: library.rows, pending: library.isPending, error: library.isError, onRetry: () => { void library.refetch(); } }}
    insights={{ data: insights.data, pending: insights.isPending, error: insights.isError, onRetry: () => { void insights.refetch(); } }}
    comments={{ data: latestComments, pending: inbox.isPending, error: inbox.isError, onRetry: () => { void inbox.refetch(); } }}
    authorName={(id) => {
      const p = profiles.data?.get(id);
      return p ? p.display_name || (p.username ? `@${p.username}` : undefined) : undefined;
    }}
  />;
}
