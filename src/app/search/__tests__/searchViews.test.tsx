import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  PopularSearches,
  RecentSearches,
  ResultsView,
  SearchTabs,
  SignedOutRecentsNote,
  StartPrompt,
} from "../SearchViews";
import { parseTop } from "../searchModel";

const noop = () => {};
const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("tab bar", () => {
  test("a tablist with one selected, focusable tab (roving tabindex)", () => {
    const out = html(<SearchTabs active="sounds" onSelect={noop} />);
    expect(out).toContain('role="tablist"');
    expect(out.match(/role="tab"/g)?.length).toBe(6);
    expect(out.match(/aria-selected="true"/g)?.length).toBe(1);
    expect(out).toMatch(/aria-selected="true"[^>]*tabindex="0"[^>]*data-tab="sounds"|data-tab="sounds"[^>]*aria-selected="true"/);
    expect(out.match(/tabindex="-1"/g)?.length).toBe(5);
    expect(out).not.toMatch(/>LIVE</i);
  });
});

describe("empty box", () => {
  test("popular searches render when the server has some", () => {
    const out = html(<PopularSearches items={["cricket", "recipes"]} status="ready" onSelect={noop} />);
    expect(out).toContain("Popular searches");
    expect(out).toContain("cricket");
    expect(out).toContain("recipes");
    expect(out).toContain('data-section="popular"');
  });

  test("an empty, loading or failed popular list draws nothing", () => {
    expect(html(<PopularSearches items={[]} status="ready" onSelect={noop} />)).toBe("");
    expect(html(<PopularSearches items={["x"]} status="loading" onSelect={noop} />)).toBe("");
    expect(html(<PopularSearches items={["x"]} status="error" onSelect={noop} />)).toBe("");
  });

  test("recents: one remove button per entry, plus Clear all", () => {
    const out = html(
      <RecentSearches
        items={[{ id: "h1", query: "cats" }, { id: "h2", query: "dogs" }]}
        status="ready"
        onSelect={noop}
        onRemove={noop}
        onClearAll={noop}
        onRetry={noop}
      />,
    );
    expect(out).toContain("Recent searches");
    expect(out).toContain('data-recent-id="h1"');
    expect(out).toContain("Remove “cats” from recent searches");
    expect(out).toContain("Remove “dogs” from recent searches");
    expect(out).toContain("Clear all");
  });

  test("recents: error offers a retry; none at all draws nothing", () => {
    const err = html(<RecentSearches items={[]} status="error" onSelect={noop} onRemove={noop} onClearAll={noop} onRetry={noop} />);
    expect(err).toContain('role="alert"');
    expect(err).toContain("Retry");
    expect(html(<RecentSearches items={[]} status="ready" onSelect={noop} onRemove={noop} onClearAll={noop} onRetry={noop} />)).toBe("");
  });

  test("signed out: a sign-in link back to search, no recents", () => {
    const out = html(<SignedOutRecentsNote signInHref="/login?next=%2Fsearch&amp;redirect=%2Fsearch" />);
    expect(out).toContain("Sign in");
    expect(out).toContain('data-section="signed-out"');
    expect(html(<StartPrompt />)).toContain("Search Momentum");
  });
});

describe("results states", () => {
  const base = { query: "rain", onRetry: noop, onSelectTab: noop };

  test("loading draws a skeleton; reels draw poster tiles", () => {
    expect(html(<ResultsView {...base} tab="people" status="loading" data={undefined} />)).toContain('aria-busy="true"');
    expect(html(<ResultsView {...base} tab="reels" status="loading" data={undefined} />)).toContain("liked-reels__tile is-skeleton");
  });

  test("error offers a retry", () => {
    const out = html(<ResultsView {...base} tab="videos" status="error" data={undefined} />);
    expect(out).toContain('role="alert"');
    expect(out).toContain("Retry");
  });

  test("empty names the tab and offers Top", () => {
    const out = html(<ResultsView {...base} tab="sounds" status="ready" data={{ tab: "sounds", sounds: [] }} />);
    expect(out).toContain("No sounds for “rain”");
    expect(out).toContain("Search everything");
  });

  test("sounds link to the sound page", () => {
    const out = html(
      <ResultsView
        {...base}
        tab="sounds"
        status="ready"
        data={{ tab: "sounds", sounds: [{ id: "s1", title: "Rain", artist: "Meera", startMs: 0, durationMs: 0, useCount: 2, sourcePostId: null }] }}
      />,
    );
    expect(out).toContain('href="/reels/sound/s1"');
    expect(out).toContain("Meera · 2 reels");
  });

  test("top mixes people, posts and hashtags", () => {
    const top = parseTop({
      results: {
        users: { items: [{ user_id: "u1", username: "asha", display_name: "Asha" }] },
        posts: { items: [{ id: "p1", content_type: "long_video", title: "Long trip" }] },
        hashtags: { items: [{ hashtag: "travel", use_count: 3 }] },
      },
    });
    const out = html(<ResultsView {...base} tab="top" status="ready" data={{ tab: "top", top }} />);
    expect(out).toContain('href="/u/asha"');
    expect(out).toContain('href="/posttube/watch/p1"');
    expect(out).toContain('href="/hashtag/travel"');
  });
});
