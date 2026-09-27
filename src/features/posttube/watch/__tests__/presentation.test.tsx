import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ChapterStrip } from "../components/ChapterStrip";
import { UpNext } from "../components/UpNext";
import { WATCH_RAIL_ORDER, WatchRail } from "../components/WatchRail";
import { WatchMoreMenu } from "../components/WatchMoreMenu";
import { TubeSettingsMenu } from "../../components/TubePlayer";
import { DEFAULT_TUBE_PREFS } from "../../model";
import type { PostTubeVideo } from "../../types";

const noop = () => undefined;
const css = readFileSync(resolve(import.meta.dir, "../watch.css"), "utf8");
const playerCss = readFileSync(resolve(import.meta.dir, "../../components/tube-player.css"), "utf8");

const railBase = {
  loved: false,
  likeCount: 1200,
  passed: false,
  keepHref: "/v1/media/m1/download",
  queued: false,
  commentCount: 34,
  onLove: noop,
  onPass: noop,
  onShare: noop,
  onThanks: noop,
  onQueue: noop,
  onAdd: noop,
  onComments: noop,
  onMore: noop,
};

describe("the rail", () => {
  test("geometry is the Reels rail: 36px circles on a 56px pitch; the comments column is 380px", () => {
    expect(css).toContain("--tube-rail-w: 36px");
    expect(css).toContain("--tube-rail-pitch: 56px");
    expect(css).toContain("--tube-comments-w: 380px");
    expect(css).toMatch(/\.tube-rail__icon \{[^}]*width: 36px; height: 36px/);
    expect(css).toMatch(/\.tube-rail__button \{[^}]*height: var\(--tube-rail-pitch\)/);
    expect(css).toMatch(/\.tube-comments-column \{[^}]*position: fixed;[^}]*right: 0;[^}]*width: var\(--tube-comments-w, 380px\)/);
    // hover-only controls, 11px time, one seek bar
    expect(playerCss).toMatch(/\.tube-player__controls \{[^}]*opacity: 0/);
    expect(playerCss).toMatch(/\.tube-player__time \{[^}]*font-size: 11px/);
    expect(playerCss).toMatch(/\.tube-seek__track \{[^}]*height: 3px/);
  });

  test("order: Love · Pass · Share · Thanks · Keep · Queue · Add · Comments · More; Keep is a new-tab link; counts under Love and Comments", () => {
    const html = renderToStaticMarkup(<WatchRail {...railBase} />);
    const at = WATCH_RAIL_ORDER.map((a) => html.indexOf(`data-action="${a}"`));
    for (const [i, pos] of at.entries()) expect(pos, WATCH_RAIL_ORDER[i]).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html).toContain('href="/v1/media/m1/download" target="_blank" rel="noopener"');
    expect(html).toContain('class="tube-rail__count">1.2K<');
    expect(html).toContain('class="tube-rail__count">34<');
    expect(html).not.toContain("Subscribe");
    expect(html).not.toContain("Like");
    expect(html).not.toContain("Watch later");
  });

  test("loved and passed light their own button only; Keep hides without a href; comments hide when off", () => {
    const loved = renderToStaticMarkup(<WatchRail {...railBase} loved keepHref={null} commentsOff />);
    expect(loved).toContain('data-action="love" class="tube-rail__button is-loved"');
    expect(loved).toContain('aria-pressed="false"');
    expect(loved).not.toContain('data-action="keep"');
    expect(loved).not.toContain('data-action="comments"');
    const passed = renderToStaticMarkup(<WatchRail {...railBase} passed queued />);
    expect(passed).toContain('data-action="pass" class="tube-rail__button is-passed"');
    expect(passed).toContain('data-action="queue" class="tube-rail__button is-queued"');
    expect(passed).not.toContain("is-loved");
    const bar = renderToStaticMarkup(<WatchRail {...railBase} variant="bar" onLeaveTheater={noop} />);
    expect(bar).toContain('class="tube-rail is-bar"');
    expect(bar).toContain("Leave theater");
  });

  test("More: the choice-pane shell with our rows only", () => {
    const html = renderToStaticMarkup(
      <WatchMoreMenu open onClose={noop} isOwner={false} channelName="Ravi" onNotInterested={noop} onDontRecommend={noop} onReport={noop} onBlock={noop} onEdit={noop} onAudioTracks={noop} onDelete={noop} />,
    );
    expect(html).toContain("reel-more-menu tube-more-menu");
    const marks = ['data-row="block"', 'data-row="dont-recommend"', 'data-row="not-interested"', 'data-row="report"'];
    const at = marks.map((m) => html.indexOf(m));
    for (const pos of at) expect(pos).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html).not.toContain('data-row="edit"');
    const owner = renderToStaticMarkup(
      <WatchMoreMenu open onClose={noop} isOwner channelName="Ravi" onNotInterested={noop} onDontRecommend={noop} onReport={noop} onBlock={noop} onEdit={noop} onAudioTracks={noop} onDelete={noop} />,
    );
    expect(owner).toContain('data-row="audio"');
    expect(owner).toContain('data-row="delete"');
    expect(owner).toContain('data-row="edit"');
    expect(owner).not.toContain('data-row="report"');
  });
});

describe("the settings menu", () => {
  test("rows in ascending order with the switches and the panes", () => {
    const html = renderToStaticMarkup(
      <TubeSettingsMenu
        open
        onClose={noop}
        prefs={DEFAULT_TUBE_PREFS}
        onChange={noop}
        levels={[720, 1080]}
        captions={[{ lang: "en", label: "EN", src: "" }]}
        captionLang="en"
        onCaptionLang={noop}
        autoplayNext={{ on: true, onChange: noop }}
        ambient
        onAmbient={noop}
        stableVolume={false}
        onStableVolume={noop}
        audioTracks={{ options: [{ id: "original", label: "Original" }, { id: "t1", label: "Hindi" }], current: "original", onChange: noop }}
        sleepChoice="off"
        sleepSchedule={null}
        onSleep={noop}
      />,
    );
    const marks = ['data-row="ambient"', 'data-row="audio"', 'data-row="autoplay"', 'data-row="captions"', 'data-row="keys"', 'data-row="speed"', 'data-row="quality"', 'data-row="sleep"', 'data-row="stable-volume"'];
    const at = marks.map((m) => html.indexOf(m));
    for (const [i, pos] of at.entries()) expect(pos, marks[i]).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html).toContain('role="menuitemcheckbox" aria-checked="true" data-row="ambient"');
    expect(html).toContain('role="menuitemcheckbox" aria-checked="true" data-row="autoplay"');
    expect(html).toContain('role="menuitemcheckbox" aria-checked="false" data-row="stable-volume"');
    expect(html).toContain('class="reel-more-menu__value">Off<svg');
    expect(html).toContain("reel-more-menu tube-settings-menu");
  });
});

describe("chapters and up next", () => {
  test("the chapter strip marks the playing one", () => {
    const html = renderToStaticMarkup(
      <ChapterStrip chapters={[{ startMs: 0, title: "Intro" }, { startMs: 130_000, title: "Middle" }]} currentIndex={1} onSeek={noop} />,
    );
    expect(html).toContain('class="tube-chapters__pill" aria-current="true"><time>2:10</time>Middle');
    expect(html).toContain("<time>0:00</time>Intro");
    expect(renderToStaticMarkup(<ChapterStrip chapters={[]} currentIndex={-1} onSeek={noop} />)).toBe("");
  });

  const video: PostTubeVideo = {
    id: "v2",
    author_id: "a",
    title: "Second video",
    description: "",
    video_url: "",
    thumbnail_url: "https://cdn/x.jpg",
    channel_id: "a",
    channel_name: "Ravi",
    channel_avatar_url: "",
    channel_subscriber_count: 0,
    view_count: 1500,
    like_count: 0,
    dislike_count: 0,
    comment_count: 0,
    share_count: 0,
    hashtags: [],
    published_at: "2026-09-01T00:00:00Z",
    duration_seconds: 125,
    viewer_has_liked: false,
    viewer_has_disliked: false,
    viewer_has_saved: false,
    viewer_has_subscribed: false,
  };

  test("related mode: the pills and compact rows", () => {
    const html = renderToStaticMarkup(
      <UpNext
        rows={[{ video, href: "/posttube/watch/v2" }]}
        pills={[{ id: "all", label: "All" }, { id: "topic", label: "Science" }, { id: "fresh", label: "Fresh" }, { id: "seen", label: "Seen" }]}
        chip="fresh"
        onChip={noop}
      />,
    );
    expect(html).toContain('class="tube-upnext__pill" aria-pressed="true">Fresh<');
    expect(html).toContain('class="tube-upnext__pill" aria-pressed="false">Science<');
    expect(html).toContain('class="tube-upnext__name">Second video<');
    expect(html).toContain("Ravi · 1.5K views");
    expect(html).toContain('class="tube-upnext__duration">2:05<');
    expect(css).toMatch(/\.tube-upnext__thumb \{[^}]*width: 120px; height: 68px/);
    expect(css).toMatch(/\.tube-upnext__name \{[^}]*font-size: 13px/);
    expect(css).toMatch(/\.tube-upnext__meta \{[^}]*font-size: 11px/);
  });

  test("collection mode: Playing from, the position, prev / next hrefs keep the list", () => {
    const html = renderToStaticMarkup(
      <UpNext
        rows={[{ video, href: "/posttube/watch/v2?list=pl1", position: 2, current: true }]}
        collection={{ id: "pl1", title: "Late night builds", index: 1, count: 3, prev: "v1", next: "v3" }}
      />,
    );
    expect(html).toContain("Playing from");
    expect(html).toContain("Late night builds");
    expect(html).toContain("2 / 3");
    expect(html).toContain('href="/posttube/watch/v1?list=pl1"');
    expect(html).toContain('href="/posttube/watch/v3?list=pl1"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('class="tube-upnext__pos">2<');
    expect(html).not.toContain("tube-upnext__pill");
  });
});
