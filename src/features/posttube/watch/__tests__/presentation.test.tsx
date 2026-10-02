import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ChapterStrip } from "../components/ChapterStrip";
import { UpNext } from "../components/UpNext";
import { WATCH_ACTION_ORDER, WatchActions } from "../components/WatchActions";
import { WatchDetails } from "../components/WatchDetails";
import { WatchMoreMenu, watchMoreRows, type WatchMoreInput } from "../components/WatchMoreMenu";
import { TubeSettingsMenu } from "../../components/TubePlayer";
import { DEFAULT_TUBE_PREFS } from "../../model";
import type { PostTubeVideo } from "../../types";

const noop = () => undefined;
const css = readFileSync(resolve(import.meta.dir, "../watch.css"), "utf8");
const playerCss = readFileSync(resolve(import.meta.dir, "../../components/tube-player.css"), "utf8");

const actionsBase = {
  loved: false,
  likeCount: 1200,
  passed: false,
  queued: false,
  onLove: noop,
  onPass: noop,
  onQueue: noop,
  onAdd: noop,
  onMore: noop,
};

const detailsBase = {
  title: "Rain on a tin roof",
  authorId: "u1",
  channelName: "Ravi",
  channelHref: "/posttube/channel/ravi",
  followerCount: 2100,
  topic: { slug: "music", label: "Music" },
  viewCount: 272000,
  publishedAt: "2026-09-01T00:00:00Z",
  source: "upload" as const,
  chapters: [],
  currentChapter: -1,
  onSeek: noop,
  description: "Three hours of rain.\nSleep well.",
  hashtags: [],
};

describe("the RUTUBE layout", () => {
  test("two columns from 1100px (player + primary left, Up next right 402px); theater spans the player across both", () => {
    expect(css).toContain("--tube-side-w: 402px");
    expect(css).toMatch(/@media \(min-width: 1100px\) \{\s*\.tube-watch__grid \{[^}]*grid-template-columns: minmax\(0, 1fr\) var\(--tube-side-w\);[^}]*grid-template-areas: "player side" "primary side"/);
    expect(css).toMatch(/\.tube-watch\[data-theater\] \.tube-watch__grid \{ grid-template-areas: "player player" "primary side"; \}/);
    expect(css).toMatch(/\.tube-details__title \{[^}]*font-size: 20px/);
    expect(css).not.toContain("tube-rail");
    expect(css).not.toContain("tube-comments-column");
    // hover-only controls, 11px time, one seek bar
    expect(playerCss).toMatch(/\.tube-player__controls \{[^}]*opacity: 0/);
    expect(playerCss).toMatch(/\.tube-player__time \{[^}]*font-size: 11px/);
    expect(playerCss).toMatch(/\.tube-seek__track \{[^}]*height: 3px/);
  });

  test("action row: Like (count) | Dislike in one pill, then Watch later, Add to collection, More", () => {
    const html = renderToStaticMarkup(<WatchActions {...actionsBase} />);
    const at = WATCH_ACTION_ORDER.map((a) => html.indexOf(`data-action="${a}"`));
    for (const [i, pos] of at.entries()) expect(pos, WATCH_ACTION_ORDER[i]).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html).toContain('class="tube-actions__count">1.2K<');
    const vote = html.slice(html.indexOf("tube-actions__vote"), html.indexOf('data-action="queue"'));
    expect(vote).toContain('data-action="love"');
    expect(vote).toContain('data-action="pass"');
    expect(html).toContain(">Watch later<");
    expect(html).toContain(">Add to collection<");
    expect(html).toContain('aria-label="Like"');
    expect(html).toContain('aria-label="Dislike"');
    expect(html).not.toMatch(/Love|Pass|Queue/);
  });

  test("liked and disliked light their own button only; Watch later lights when saved", () => {
    const loved = renderToStaticMarkup(<WatchActions {...actionsBase} loved />);
    expect(loved).toContain('class="tube-actions__btn is-love is-on" aria-pressed="true"');
    expect(loved).toContain('class="tube-actions__btn is-pass" aria-pressed="false"');
    const passed = renderToStaticMarkup(<WatchActions {...actionsBase} passed queued />);
    expect(passed).toContain('class="tube-actions__btn is-pass is-on" aria-pressed="true"');
    expect(passed).not.toContain("is-love is-on");
    expect(passed).toContain('class="tube-actions__pill is-on" aria-pressed="true" data-action="queue"');
  });

  test("details: title, the creator row with Subscribe and Thanks after the name, the actions, the about card", () => {
    const html = renderToStaticMarkup(<WatchDetails {...detailsBase} follow={<button type="button">Subscribe</button>} onThanks={noop} actions={<div data-slot="actions" />} />);
    const order = ['class="tube-details__title"', 'class="tube-creator__name"', ">Subscribe<", 'data-action="thanks"', 'data-slot="actions"', 'class="tube-about"'].map((m) => html.indexOf(m));
    for (const pos of order) expect(pos).toBeGreaterThan(-1);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain("2.1K subscribers");
    expect(html).toContain("272K views");
    // collapsed: no facts yet, the toggle reads Show more
    expect(html).not.toContain("tube-about__facts");
    expect(html).toContain(">Show more<");
    const noThanks = renderToStaticMarkup(<WatchDetails {...detailsBase} />);
    expect(noThanks).not.toContain('data-action="thanks"');
  });

  test("More: the shared video menu (the same rows as the reels stage) in the choice-pane shell", () => {
    const bare: WatchMoreInput = {
      channelName: "Ravi", isOwner: false, hasDescription: false, shareHidden: true, downloadAllowed: false,
      audioTrackCount: 1, hasCaptions: false, levels: [720], canOffline: true, canManageAudio: true,
    };
    const playback = {
      speed: 1.5, onSpeed: noop, quality: "720p", qualityHeights: [720, 1080], onQuality: noop,
      captions: { on: true, tracks: [{ lang: "en", label: "EN" }], lang: "en", onChange: noop },
      audio: { options: [{ id: "original", label: "Original" }, { id: "t1", label: "Hindi" }], current: "t1", onChange: noop },
    };
    const actions = {
      block: noop, "copy-link": noop, delete: noop, description: noop, "dont-recommend": noop, edit: noop,
      offline: noop, "manage-audio": noop, "not-interested": noop, report: noop, share: noop,
    };
    const draw = (extra: Partial<WatchMoreInput> = {}) =>
      renderToStaticMarkup(<WatchMoreMenu open onClose={noop} rows={watchMoreRows({ ...bare, ...extra })} channelName="Ravi" playback={playback} actions={actions} />);
    const inOrder = (html: string, keys: string[]) => {
      const at = keys.map((k) => html.indexOf(`data-row="${k}"`));
      for (const [i, pos] of at.entries()) expect(pos, keys[i]).toBeGreaterThan(-1);
      expect([...at].sort((a, b) => a - b)).toEqual(at);
    };

    const html = draw();
    expect(html).toContain("reel-more-menu tube-more-menu");
    inOrder(html, ["block", "copy-link", "dont-recommend", "not-interested", "speed", "report"]);
    for (const gone of ["edit", "delete", "manage-audio", "share", "offline", "audio", "captions", "quality", "description", "auto-scroll", "use-sound"]) {
      expect(html).not.toContain(`data-row="${gone}"`);
    }
    expect(html).toContain('class="reel-more-menu__value">1.5x<svg');

    const owner = draw({ isOwner: true });
    inOrder(owner, ["manage-audio", "copy-link", "delete", "edit", "speed", "offline"]);
    for (const gone of ["report", "block", "not-interested", "dont-recommend"]) expect(owner).not.toContain(`data-row="${gone}"`);

    const full = draw({ hasDescription: true, shareHidden: false, downloadAllowed: true, audioTrackCount: 2, hasCaptions: true, levels: [720, 1080] });
    inOrder(full, ["audio", "block", "captions", "copy-link", "description", "dont-recommend", "not-interested", "speed", "quality", "report", "offline", "share"]);
    // The choice rows read the player's own state: the track, the caption language, the rung.
    expect(full).toContain('class="reel-more-menu__value">Hindi<svg');
    expect(full).toContain('class="reel-more-menu__value">EN<svg');
    expect(full).toContain('class="reel-more-menu__value">720p<svg');
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

  test("related mode: the pills and the right-column rows", () => {
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
    expect(html).toContain('class="tube-upnext__meta">Ravi<');
    expect(html).toContain("1.5K views · ");
    expect(html).toContain('class="tube-upnext__duration">2:05<');
    expect(css).toMatch(/\.tube-upnext__thumb \{[^}]*width: 168px; height: 94px/);
    expect(css).toMatch(/\.tube-upnext__name \{[^}]*font-size: 14px/);
    expect(css).toMatch(/\.tube-upnext__meta \{[^}]*font-size: 12px/);
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
