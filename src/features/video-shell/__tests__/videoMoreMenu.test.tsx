import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { WatchMoreMenu, watchMoreRows } from "@/features/posttube/watch/components/WatchMoreMenu";
import { ReelMoreMenu } from "@/features/reels/components/ReelMoreMenu";
import { toReelItem } from "@/features/reels/model";
import { DEFAULT_PREFS } from "@/features/reels/playback/playerPrefs";

import { moreRows } from "../moreRows";
import { VideoMoreMenu, type MorePlayback } from "../VideoMoreMenu";

/*
  The founder's rule (2 Oct 2026): the More options menu is the SAME on
  reels and on long video. These render both surfaces for the same item
  and viewer and compare what is drawn.
*/

const noop = () => undefined;
const TRACKS = [{ id: "original", label: "Original" }, { id: "t1", label: "Hindi" }];

const reel = {
  ...toReelItem({
    id: "r1", author_id: "b", content_type: "reel", text: "a caption", tags: ["x"],
    author: { id: "b", username: "bee", display_name: "Bee" },
    media: [{ media_id: "m", kind: "video" }],
  })!,
  downloadAllowed: true,
};

function reelsHtml(isOwn: boolean) {
  return renderToStaticMarkup(
    <ReelMoreMenu
      open onClose={noop} reel={reel} isOwn={isOwn} prefs={DEFAULT_PREFS} onPrefsChange={noop}
      qualityHeights={[720, 1080]} hasCaptions audioTracks={TRACKS} currentAudioTrack="original" onAudioTrack={noop}
      onManageAudio={isOwn ? noop : undefined} onKeep={noop} onCopyLink={noop} onDescription={noop} onShare={noop} onBlock={noop}
      onDelete={noop} onNotInterested={noop} onDontRecommend={noop} onReport={noop} onUseSound={noop} anchor="below"
    />,
  );
}

const playback: MorePlayback = {
  speed: 1, onSpeed: noop, quality: "auto", qualityHeights: [720, 1080], onQuality: noop,
  captions: { on: false, tracks: [{ lang: "en", label: "EN" }], lang: "en", onChange: noop },
  audio: { options: TRACKS, current: "original", onChange: noop },
};
const allActions = {
  block: noop, "copy-link": noop, delete: noop, description: noop, "dont-recommend": noop, edit: noop,
  keep: noop, "manage-audio": noop, "not-interested": noop, report: noop, share: noop,
};

function watchHtml(isOwner: boolean) {
  const rows = watchMoreRows({
    channelName: "Bee", isOwner, hasDescription: true, shareHidden: false, downloadAllowed: true,
    audioTrackCount: 2, hasCaptions: true, levels: [720, 1080], canKeep: true, canManageAudio: true,
  });
  return renderToStaticMarkup(<WatchMoreMenu open onClose={noop} rows={rows} channelName="Bee" playback={playback} actions={allActions} />);
}

/** Every drawn row, keyed by data-row: the whole <button> markup. */
function drawnRows(html: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of html.matchAll(/<button[^>]*data-row="([^"]+)"[^>]*>.*?<\/button>/g)) out.set(m[1], m[0]);
  return out;
}
const labelsOf = (html: string) =>
  html.split('<span class="reel-more-menu__title">').slice(1).map((part) => part.slice(0, part.indexOf("<")).split("&#x27;").join("'"));

describe("reels and long video draw the same More menu", () => {
  test("a viewer: the same labels in the same order, apart from Auto scroll and Use this sound", () => {
    const reels = labelsOf(reelsHtml(false)).filter((l) => l !== "Auto scroll" && l !== "Use this sound");
    expect(reels).toEqual(labelsOf(watchHtml(false)));
    expect(reels).toEqual([
      "Audio track", "Block Bee", "Captions", "Copy link", "Description", "Don't recommend this channel",
      "Keep a copy", "Not interested", "Playback speed", "Quality", "Report", "Share",
    ]);
  });

  test("the owner: the same, apart from Auto scroll, Use this sound and Edit (a reel has no edit screen)", () => {
    const reels = labelsOf(reelsHtml(true)).filter((l) => l !== "Auto scroll" && l !== "Use this sound");
    const watch = labelsOf(watchHtml(true)).filter((l) => l !== "Edit");
    expect(reels).toEqual(watch);
    expect(labelsOf(watchHtml(true))).toContain("Edit");
  });

  test("each shared row is the same markup on both surfaces: icon, label, hint, value, danger", () => {
    const reels = drawnRows(reelsHtml(false));
    const watch = drawnRows(watchHtml(false));
    const sharedKeys = ["audio", "block", "captions", "copy-link", "description", "dont-recommend", "keep", "not-interested", "speed", "quality", "report", "share"];
    for (const key of sharedKeys) {
      expect(reels.get(key), key).toBeDefined();
      expect(reels.get(key), key).toBe(watch.get(key)!);
    }
  });

  test("one card: the same shell, label and classes; the watch page adds only its geometry class", () => {
    const reels = reelsHtml(false);
    const watch = watchHtml(false);
    for (const html of [reels, watch]) {
      expect(html).toContain('role="menu" aria-label="More options"');
      expect(html).toContain("reel-frame-popover reel-more-menu");
      expect(html).toContain('class="reel-more-menu__list" data-pane="root"');
    }
    expect(watch).toContain("reel-more-menu tube-more-menu");
  });
});

describe("no dead rows", () => {
  const post = { channelName: "Bee", hasDescription: true, shareHidden: false, downloadAllowed: true, audioTrackCount: 2, hasCaptions: true, renditionCount: 2, usableSound: true };
  const rows = moreRows({ surface: "reels", post, viewer: { isOwner: true }, can: { keep: true, edit: true, delete: true, manageAudio: true } });

  test("an action row with no handler is not drawn", () => {
    const html = renderToStaticMarkup(<VideoMoreMenu open onClose={noop} rows={rows} channelName="Bee" playback={playback} actions={{ "copy-link": noop }} />);
    expect(labelsOf(html)).toEqual(["Audio track", "Captions", "Copy link", "Playback speed", "Quality"]);
  });

  test("Auto scroll is drawn only when the surface hands in the switch", () => {
    const without = renderToStaticMarkup(<VideoMoreMenu open onClose={noop} rows={rows} channelName="Bee" playback={playback} actions={allActions} />);
    expect(without).not.toContain('data-row="auto-scroll"');
    const withSwitch = renderToStaticMarkup(
      <VideoMoreMenu open onClose={noop} rows={rows} channelName="Bee" playback={{ ...playback, autoScroll: { on: true, onToggle: noop } }} actions={allActions} />,
    );
    expect(withSwitch).toContain('role="menuitemcheckbox" aria-checked="true" data-row="auto-scroll"');
  });

  test("a pending action waits; the danger rows are Block, Delete and Report", () => {
    const viewerRows = moreRows({ surface: "watch", post, viewer: { isOwner: false }, can: { keep: true, edit: true, delete: true, manageAudio: true } });
    const html = renderToStaticMarkup(<VideoMoreMenu open onClose={noop} rows={viewerRows} channelName="Bee" playback={playback} actions={allActions} pending={{ report: true }} />);
    expect(html).toContain('disabled="" data-row="report"');
    const danger = [...drawnRows(html)].filter(([, markup]) => markup.includes("is-danger")).map(([key]) => key);
    expect(danger).toEqual(["block", "report"]);
    const owner = renderToStaticMarkup(<VideoMoreMenu open onClose={noop} rows={rows} channelName="Bee" playback={playback} actions={allActions} />);
    expect([...drawnRows(owner)].filter(([, markup]) => markup.includes("is-danger")).map(([key]) => key)).toEqual(["delete"]);
  });

  test("the caption value names the language when the surface has named tracks", () => {
    const viewerRows = moreRows({ surface: "watch", post, viewer: { isOwner: false }, can: { keep: true, edit: true, delete: true, manageAudio: true } });
    const on = renderToStaticMarkup(
      <VideoMoreMenu open onClose={noop} rows={viewerRows} channelName="Bee" playback={{ ...playback, captions: { ...playback.captions, on: true } }} actions={allActions} />,
    );
    expect(on).toContain('class="reel-more-menu__value">EN<svg');
  });
});
