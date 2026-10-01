"use client";

import { useCreatorInsights, useHubLibrary, useHubSummary } from "../hooks/useHub";
import { OverviewDashboard } from "./OverviewDashboard";

export function OverviewPage() {
  const summary = useHubSummary();
  const library = useHubLibrary("videos");
  const insights = useCreatorInsights("28d");
  return <OverviewDashboard
    summary={{ data: summary.data, pending: summary.isPending, error: summary.isError, onRetry: () => { void summary.refetch(); } }}
    library={{ data: library.rows, pending: library.isPending, error: library.isError, onRetry: () => { void library.refetch(); } }}
    insights={{ data: insights.data, pending: insights.isPending, error: insights.isError, onRetry: () => { void insights.refetch(); } }}
  />;
}
