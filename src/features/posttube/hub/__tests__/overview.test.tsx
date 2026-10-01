import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { normalizeCreatorInsights, normalizeLibraryRow, normalizeSummary } from "../hubApi";
import { OverviewDashboard } from "../components/OverviewDashboard";
import { HubFrame } from "../components/HubFrame";
import { HubThumbnail, hubThumbnailSources } from "../components/HubThumbnail";

const summary = normalizeSummary({ videos: 12, shorts: 4, live: 1, collections: 3, followers: 240 });
const latest = normalizeLibraryRow({
  id: "video-1", title: "An unusually long video title that still needs to fit on a phone",
  content_type: "long_video", visibility: "public", view_count: 18, comment_count: 2, like_count: 3,
  published_at: "2026-09-29T10:00:00Z", video_metadata: { duration_seconds: 232 },
})!;
const insights = normalizeCreatorInsights({
  views: 120, watch_time_ms: 660000, unique_viewers: 42, followers_delta: null,
  realtime: { views_48h: 7, series_48h: [0, 2, 5] },
}, "28d");
const ready = { summary: { data: summary }, library: { data: [latest] }, insights: { data: insights } };

describe("Creator Hub overview", () => {
  test("renders real counts and working section/action links without an extra main landmark", () => {
    const html = renderToStaticMarkup(<HubFrame><OverviewDashboard {...ready} /></HubFrame>);
    expect(html).toContain("Channel overview");
    expect(html).toContain("240");
    expect(html).toContain("11m");
    expect(html).toContain('href="/posttube/hub/library?tab=shorts"');
    expect(html).toContain('href="/posttube/hub/library?edit=video-1"');
    expect(html).toContain('href="/posttube/hub/conversations?post=video-1"');
    expect(html).not.toContain("<main");
    expect(html).not.toContain("hub-rail");
  });

  test("missing follower tracking remains unavailable, not a fabricated zero or positive trend", () => {
    const html = renderToStaticMarkup(<OverviewDashboard {...ready} />);
    expect(html).toContain("Not tracked yet");
    expect(html).not.toContain("Trending");
    expect(html).not.toContain("Net change in this period");
  });

  test("hourly views are never relabelled as a 28-day chart", () => {
    const html = renderToStaticMarkup(<OverviewDashboard {...ready} />);
    expect(html).toContain("Views per hour, last 48 hours");
    expect(html).not.toContain("Channel views by day, last 28 days");
    const daily = { ...insights, views_by_day: [{ day: "2026-09-29", views: 120 }] };
    expect(renderToStaticMarkup(<OverviewDashboard {...ready} insights={{ data: daily }} />)).toContain("Channel views by day, last 28 days");
  });

  test("request errors offer retries and cannot masquerade as a new empty channel", () => {
    const error = { error: true, onRetry: () => {} };
    const html = renderToStaticMarkup(<OverviewDashboard summary={error} library={error} insights={error} />);
    expect(html.match(/Try again/g)?.length).toBe(4);
    expect(html).toContain("Unavailable");
    expect(html).not.toContain("Your channel is quiet");
    expect(html).not.toContain("No videos yet");
  });

  test("loading and genuinely empty data have distinct states", () => {
    const pending = { pending: true };
    const loading = renderToStaticMarkup(<OverviewDashboard summary={pending} library={pending} insights={pending} />);
    expect(loading).toContain('aria-busy="true"');
    expect(loading).not.toContain("Your channel is quiet");
    const empty = renderToStaticMarkup(<OverviewDashboard summary={{ data: normalizeSummary({}) }} library={{ data: [] }} insights={{ data: insights }} />);
    expect(empty).toContain("Your channel is quiet");
    expect(empty).toContain('href="/posttube/upload"');
  });
});

describe("Hub thumbnail fallback", () => {
  test("prefers stable authorized cover delivery and deduplicates fallback URLs", () => {
    const sources = hubThumbnailSources({ cover_media_id: "cover-1", thumbnail_url: "https://example.test/expired.jpg" });
    expect(sources[0]).toContain("/v1/media/cover-1/serve");
    expect(sources[1]).toBe("https://example.test/expired.jpg");
    expect(hubThumbnailSources({ cover_media_id: "cover-1", thumbnail_url: "/v1/media/cover-1/serve" })).toHaveLength(1);
  });

  test("a missing poster is an intentional fallback, never an empty image request", () => {
    const html = renderToStaticMarkup(<HubThumbnail row={latest} />);
    expect(html).toContain("Preview unavailable");
    expect(html).toContain("3:52");
    expect(html).not.toContain("<img");
  });
});
