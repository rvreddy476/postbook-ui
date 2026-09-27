import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { TrendingView } from "../components/TrendingPage";
import { TopicsView } from "../components/TopicsPage";
import { TopicView } from "../components/TopicPage";
import { SearchView } from "../components/SearchPage";
import { LiveView } from "../components/LivePage";
import { TopicStripView } from "../TopicStrip";
import { DEFAULT_SEARCH_FILTERS } from "../discoveryApi";

/*
  The pure screens rendered to static markup, the way
  features/reels/__tests__/presentation.test.tsx pins the reels screens:
  every page has a loading state, an empty state with one next step, and
  an error state with Retry, and the words on them are ours (Watch,
  Following, Topics, Collections) — never the other product's labels.
*/

const noop = () => {};
const paging = { hasMore: false, loadingMore: false, onLoadMore: noop };

describe("Trending", () => {
  test("loading shows the tile skeleton under the period row; the row is a radiogroup with Today / Week / Month", () => {
    const html = renderToStaticMarkup(<TrendingView period="week" onPeriodChange={noop} videos={[]} status="loading" {...paging} />);
    expect(html).toContain('data-screen="trending"');
    // The tile skeleton is tube.css's (the foundations lane's), in its 1/2/3/4 grid.
    expect(html).toContain('class="tube-grid"');
    expect(html).toContain("tube-tile is-skeleton");
    expect(html).toContain('role="radiogroup" aria-label="Period"');
    expect(html).toContain('aria-checked="true" class="disco-pill">Week');
    expect(html).toContain(">Today<");
    expect(html).toContain(">Month<");
    expect(html).not.toContain("disco-state__title");
  });

  test("empty offers Topics; a period that hid every row says so instead", () => {
    const empty = renderToStaticMarkup(<TrendingView period="week" onPeriodChange={noop} videos={[]} status="ready" {...paging} />);
    expect(empty).toContain("Nothing is trending yet");
    expect(empty).toContain('href="/posttube/topics"');
    const narrowed = renderToStaticMarkup(<TrendingView period="today" onPeriodChange={noop} videos={[]} status="ready" narrowedOut {...paging} />);
    expect(narrowed).toContain("Nothing new today");
    expect(narrowed).toContain("Widen the period");
    expect(narrowed).not.toContain('href="/posttube/topics"');
  });

  test("error carries Retry", () => {
    const html = renderToStaticMarkup(<TrendingView period="week" onPeriodChange={noop} videos={[]} status="error" onRetry={noop} {...paging} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Could not load trending");
    expect(html).toContain(">Retry<");
  });
});

describe("Topics", () => {
  test("loading, empty and error", () => {
    expect(renderToStaticMarkup(<TopicsView topics={[]} status="loading" />)).toContain('role="status"');
    const empty = renderToStaticMarkup(<TopicsView topics={[]} status="ready" />);
    expect(empty).toContain("No topics yet");
    expect(empty).toContain('href="/posttube"');
    expect(renderToStaticMarkup(<TopicsView topics={[]} status="error" onRetry={noop} />)).toContain("Could not load topics");
  });

  test("a topic card links to its page and names its kind in our words", () => {
    const html = renderToStaticMarkup(
      <TopicsView topics={[{ slug: "science-tech", label: "Science & tech", kind: "long" }, { slug: "music", label: "Music", kind: "all" }]} status="ready" />,
    );
    expect(html).toContain('href="/posttube/topics/science-tech"');
    expect(html).toContain("Science &amp; tech");
    expect(html).toContain(">Videos<");
    expect(html).toContain(">Videos and reels<");
  });

  test("one topic: loading skeleton, empty with a way back, error with Retry; Recent / Popular pills", () => {
    const base = { slug: "music", label: "Music", sort: "recent" as const, onSortChange: noop, videos: [], ...paging };
    const loading = renderToStaticMarkup(<TopicView {...base} status="loading" />);
    expect(loading).toContain('data-topic="music"');
    expect(loading).toContain("tube-tile is-skeleton");
    expect(loading).toContain('role="radiogroup" aria-label="Order"');
    expect(loading).toContain(">Recent<");
    expect(loading).toContain(">Popular<");
    const empty = renderToStaticMarkup(<TopicView {...base} status="ready" />);
    expect(empty).toContain("Nothing in Music yet");
    expect(empty).toContain('href="/posttube/topics"');
    expect(renderToStaticMarkup(<TopicView {...base} status="error" onRetry={noop} />)).toContain("Could not load Music videos");
  });
});

describe("Search", () => {
  const base = { onFiltersChange: noop, onSubmitQuery: noop, videos: [], channels: [], collections: [], onRetry: noop };

  test("no query: an invitation, the tab pills and the three filter rows, nothing loading", () => {
    const html = renderToStaticMarkup(<SearchView {...base} filters={DEFAULT_SEARCH_FILTERS} status="ready" />);
    expect(html).toContain('data-screen="search"');
    expect(html).toContain("Type something to search");
    for (const name of ["Show", "Length", "When", "Sort"]) expect(html).toContain(`aria-label="${name}"`);
    for (const label of ["Videos", "Channels", "Collections", "Under 4 min", "4–20 min", "Over 20 min", "Last hour", "This year", "Relevance", "Views", "Date"]) {
      expect(html).toContain(`>${label}<`);
    }
    expect(html).not.toContain("disco-skeleton");
    // Our words, not the other product's.
    expect(html).not.toContain("Playlists");
    expect(html).not.toContain("Upload date");
  });

  test("loading shows row skeletons with the 160×90 thumb; empty names the tab and the query; error carries Retry", () => {
    const filters = { ...DEFAULT_SEARCH_FILTERS, q: "deep sea" };
    const loading = renderToStaticMarkup(<SearchView {...base} filters={filters} status="loading" />);
    expect(loading).toContain("disco-skeleton is-row");
    expect(loading).toContain("Results for “deep sea”");
    const empty = renderToStaticMarkup(<SearchView {...base} filters={{ ...filters, tab: "channels" }} status="ready" />);
    expect(empty).toContain("No channels for “deep sea”");
    const narrowedEmpty = renderToStaticMarkup(<SearchView {...base} filters={{ ...filters, length: "long" }} status="ready" />);
    expect(narrowedEmpty).toContain("Try clearing the length or date filter.");
    const error = renderToStaticMarkup(<SearchView {...base} filters={filters} status="error" />);
    expect(error).toContain("Could not load results");
    expect(error).toContain(">Retry<");
  });

  test("channel and collection tabs hide the video-only filters; result rows carry their kind", () => {
    const filters = { ...DEFAULT_SEARCH_FILTERS, q: "bee", tab: "channels" as const };
    const html = renderToStaticMarkup(
      <SearchView
        {...base}
        filters={filters}
        status="ready"
        channels={[{ kind: "channel", id: "c1", name: "Bee TV", handle: "bee", href: "/posttube/channel/bee", avatarUrl: "", followerCount: 1200 }]}
      />,
    );
    expect(html).not.toContain('aria-label="Length"');
    expect(html).toContain('data-kind="channel"');
    expect(html).toContain("@bee · 1.2K followers");
  });

  test("the CSS pins the result row: 160×90 thumb, 13px title, 11px meta", () => {
    const css = readFileSync(resolve(import.meta.dir, "../discovery.css"), "utf8");
    expect(css).toContain(".disco-row__thumb { position: relative; flex: 0 0 160px; width: 160px; height: 90px;");
    expect(css).toContain(".disco-row__title { margin: 0; font-size: 13px;");
    expect(css).toContain(".disco-row__meta { margin: 4px 0 0; font-size: 11px;");
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

describe("Live", () => {
  const base = { creatorNames: {}, ...paging, onRetry: noop };

  test("loading, empty with Go live, error with Retry", () => {
    expect(renderToStaticMarkup(<LiveView {...base} status="loading" live={[]} upcoming={[]} />)).toContain("disco-skeleton__thumb");
    const empty = renderToStaticMarkup(<LiveView {...base} status="ready" live={[]} upcoming={[]} />);
    expect(empty).toContain("Nobody is live right now");
    expect(empty).toContain('href="/live/new"');
    expect(renderToStaticMarkup(<LiveView {...base} status="error" live={[]} upcoming={[]} />)).toContain("Could not load live streams");
  });

  test("with rows: Live now and Upcoming sections, each with its count and a card per stream", () => {
    const stream = {
      id: "s1",
      creator_user_id: "u1",
      livekit_room: "r",
      title: "Morning show",
      description: "",
      cover_media_id: null,
      status: "live" as const,
      visibility: "public" as const,
      scheduled_at: null,
      started_at: "2026-09-27T09:00:00Z",
      ended_at: null,
      viewer_peak: 42,
      recording_url: null,
      recording_duration_seconds: null,
      created_at: "2026-09-27T09:00:00Z",
      updated_at: "2026-09-27T09:00:00Z",
    };
    const html = renderToStaticMarkup(<LiveView {...base} creatorNames={{ u1: "Bee" }} status="ready" live={[stream]} upcoming={[]} />);
    expect(html).toContain(">Live now<");
    expect(html).toContain(">Upcoming<");
    expect(html).toContain("Nothing scheduled yet.");
    expect(html).toContain('href="/live/s1"');
    expect(html).toContain('data-status="live"');
    expect(html).toContain("Morning show");
    expect(html).toContain("Bee");
    expect(html).not.toContain("Past streams");
  });
});

describe("Topic strip", () => {
  test("All · Following · Fresh · Seen · New to you, then the topics, then the link to Topics; loading spins in place", () => {
    const html = renderToStaticMarkup(<TopicStripView value="fresh" onChange={noop} topics={[{ slug: "music", label: "Music", kind: "all" }]} />);
    // The band and the pills are tube.css's tube-strip__* (the foundations lane's).
    expect(html).toContain('class="tube-strip"');
    expect(html).toContain('role="group" aria-label="Narrow the feed" class="tube-strip__scroller"');
    const order = [">All<", ">Following<", ">Fresh<", ">Seen<", ">New to you<", ">Music<", 'href="/posttube/topics"'];
    const positions = order.map((s) => html.indexOf(s));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html).toContain('aria-pressed="true" class="tube-strip__pill">Fresh');
    expect(html).not.toContain('aria-pressed="true" class="tube-strip__pill">All');
    expect(html).not.toContain("Subscriptions");
    const loading = renderToStaticMarkup(<TopicStripView value="all" onChange={noop} topics={[]} loading />);
    expect(loading).toContain('aria-label="Loading topics"');
    expect(renderToStaticMarkup(<TopicStripView value="all" onChange={noop} topics={[]} showFollowing={false} />)).not.toContain(">Following<");
  });
});
