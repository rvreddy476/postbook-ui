import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { moreRows, type MoreCapabilities, type MorePost, type MoreSurface } from "@/features/video-shell/moreRows";
import { VideoMoreMenu } from "@/features/video-shell/VideoMoreMenu";

import { COPY_IDLE, copyReducer, type CopyEvent } from "../copyState";
import { durationLabel, OfflinePage, rowMeta } from "../components/OfflinePage";
import { OfflineBadge } from "../components/OfflineBadge";
import { OfflineProgressRing, ringDashOffset } from "../components/OfflineProgressRing";
import { offlineRowAction, offlineRowAvailable, offlineRowInfo, offlineSupported } from "../row";
import { DAY, T0 } from "./fakes";

const POST: MorePost = { channelName: "Ravi", hasDescription: false, shareHidden: false, downloadAllowed: true, audioTrackCount: 1, hasCaptions: false, renditionCount: 1, usableSound: false };
const CAN: MoreCapabilities = { offline: true, edit: true, delete: true, manageAudio: true };
const SURFACES: MoreSurface[] = ["reels", "watch"];

function offlineRow(surface: MoreSurface, post: Partial<MorePost>, isOwner: boolean, can: Partial<MoreCapabilities> = {}) {
  return moreRows({ surface, post: { ...POST, ...post }, viewer: { isOwner }, can: { ...CAN, ...can } }).find((r) => r.key === "offline") ?? null;
}

describe("storage decides whether the row can exist", () => {
  test("only real private storage counts: unknown (the server, before detection) and none hide the row", () => {
    expect(offlineSupported("opfs")).toBe(true);
    expect(offlineSupported("cache")).toBe(true);
    expect(offlineSupported("none")).toBe(false);
    expect(offlineSupported("unknown")).toBe(false);
  });

  test("available needs storage, a signed-in viewer and a video", () => {
    expect(offlineRowAvailable({ kind: "opfs", hasMedia: true, signedIn: true })).toBe(true);
    expect(offlineRowAvailable({ kind: "none", hasMedia: true, signedIn: true })).toBe(false);
    expect(offlineRowAvailable({ kind: "unknown", hasMedia: true, signedIn: true })).toBe(false);
    expect(offlineRowAvailable({ kind: "opfs", hasMedia: false, signedIn: true })).toBe(false);
    expect(offlineRowAvailable({ kind: "cache", hasMedia: true, signedIn: false })).toBe(false);
  });
});

describe("no Save offline row in the shared More model (saved copies are managed on the Offline page)", () => {
  test("no row for a viewer or the owner, whether the creator allows copies or not", () => {
    for (const surface of SURFACES) {
      for (const isOwner of [false, true]) {
        for (const downloadAllowed of [false, true]) {
          expect(offlineRow(surface, { downloadAllowed }, isOwner)).toBeNull();
        }
      }
    }
  });

  test("no private storage in this browser: no row for anyone, allowed or not, owner or not", () => {
    for (const surface of SURFACES) {
      for (const isOwner of [false, true]) {
        for (const downloadAllowed of [false, true]) {
          expect(offlineRow(surface, { downloadAllowed }, isOwner, { offline: false })).toBeNull();
          expect(offlineRow(surface, { downloadAllowed, offlineSaved: true }, isOwner, { offline: false })).toBeNull();
        }
      }
    }
  });

  test("a stored copy does not bring back a Remove offline copy row, even after the creator turns copies off", () => {
    for (const surface of SURFACES) {
      expect(offlineRow(surface, { offlineSaved: true }, false)).toBeNull();
      expect(offlineRow(surface, { offlineSaved: true }, true)).toBeNull();
      expect(offlineRow(surface, { offlineSaved: true, downloadAllowed: false }, false)).toBeNull();
    }
  });

  test("the menu stays alphabetical, saved or not, with no Save offline, Remove offline copy or Keep a copy row", () => {
    for (const offlineSaved of [false, true]) {
      const labels = moreRows({ surface: "watch", post: { ...POST, offlineSaved, hasDescription: true }, viewer: { isOwner: false }, can: CAN }).map((r) => r.label);
      expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })));
      for (const gone of ["Keep a copy", "Save offline", "Remove offline copy"]) expect(labels).not.toContain(gone);
    }
  });
});

const state = (events: CopyEvent[]) => events.reduce(copyReducer, COPY_IDLE);

describe("the row's state", () => {
  test("idle: save; saving: the ring's progress and stop; stored: remove", () => {
    const idle = offlineRowInfo(null);
    expect(idle).toMatchObject({ saved: false, saving: false });
    expect(offlineRowAction(idle)).toBe("save");

    const saving = offlineRowInfo(state([{ type: "start", totalBytes: 100 }, { type: "progress", receivedBytes: 42 }]));
    expect(saving).toMatchObject({ saved: false, saving: true, progress: 0.42, hint: "Saving 42% · press to stop" });
    expect(offlineRowAction(saving)).toBe("cancel");

    const stored = offlineRowInfo(state([{ type: "start", totalBytes: 100 }, { type: "complete", totalBytes: 100 }]));
    expect(stored).toMatchObject({ saved: true, saving: false, hint: "Stored in the app on this device" });
    expect(offlineRowAction(stored)).toBe("remove");
  });

  test("a paused copy says how far it got and saves again; an unknown size has no percentage", () => {
    const paused = offlineRowInfo(state([{ type: "start", totalBytes: 100 }, { type: "progress", receivedBytes: 40 }, { type: "fail", message: "dropped", keptBytes: 40 }]));
    expect(paused).toMatchObject({ saved: false, saving: false, hint: "Paused at 40% · press to continue" });
    expect(offlineRowAction(paused)).toBe("save");
    expect(offlineRowInfo(state([{ type: "start", totalBytes: null }])).hint).toBe("Saving · press to stop");
  });
});

describe("what is drawn", () => {
  const playback = {
    speed: 1, onSpeed: () => undefined, quality: "auto", qualityHeights: [], onQuality: () => undefined,
    captions: { on: false, onChange: () => undefined }, audio: { options: [], current: "original", onChange: () => undefined },
  };
  const menu = (offline: { saved: boolean; saving: boolean; progress: number | null; hint: string }) =>
    renderToStaticMarkup(
      <VideoMoreMenu open onClose={() => undefined} channelName="Ravi" playback={playback} offline={offline}
        rows={moreRows({ surface: "watch", post: { ...POST, offlineSaved: offline.saved }, viewer: { isOwner: false }, can: CAN })}
        actions={{ "copy-link": () => undefined, offline: () => undefined }} />,
    );

  test("the More menu draws no offline row in any copy state, and never a link", () => {
    const idle = menu(offlineRowInfo(null));
    const saving = menu({ saved: false, saving: true, progress: 0.42, hint: "Saving 42% · press to stop" });
    const stored = menu(offlineRowInfo(state([{ type: "start", totalBytes: 1 }, { type: "complete", totalBytes: 1 }])));
    for (const html of [idle, saving, stored]) {
      expect(html).not.toContain('data-row="offline"');
      expect(html).not.toContain("Save offline");
      expect(html).not.toContain("Remove offline copy");
      expect(html).not.toContain('role="progressbar"');
      expect(html).toContain('data-row="copy-link"');
    }
    for (const html of [idle, saving, stored]) {
      expect(html).not.toContain("<a ");
      expect(html).not.toContain("href=");
      expect(html).not.toContain("Download");
    }
  });

  test("the ring: empty at 0, full at 1, a quarter arc while the size is unknown", () => {
    const full = 2 * Math.PI * 9;
    expect(ringDashOffset(0)).toBeCloseTo(full);
    expect(ringDashOffset(1)).toBeCloseTo(0);
    expect(ringDashOffset(0.5)).toBeCloseTo(full / 2);
    expect(ringDashOffset(null)).toBeCloseTo(full * 0.75);
    expect(renderToStaticMarkup(<OfflineProgressRing progress={null} />)).toContain("is-unknown");
  });

  test("the Offline copy marker", () => {
    expect(renderToStaticMarkup(<OfflineBadge />)).toContain("Offline copy");
  });

  test("the Offline page before storage is known: a neutral skeleton, the title, the promise — no links to files", () => {
    const html = renderToStaticMarkup(<OfflinePage />);
    expect(html).toContain(">Offline</h1>");
    expect(html).toContain("tube-library__skeleton");
    expect(html).toContain("play only here in the app");
    expect(html).not.toContain("download");
  });

  test("a stored row's meta line and length", () => {
    const view = { postId: "p1", state: COPY_IDLE, record: { channelName: "Ravi", bytes: 84 * 1024 * 1024, expiresAt: T0 + 12 * DAY + 1 } } as never as Parameters<typeof rowMeta>[0];
    expect(rowMeta(view, T0)).toBe("Ravi · 84 MB · Expires in 12 days");
    expect(durationLabel(754_000)).toBe("12:34");
    expect(durationLabel(3_754_000)).toBe("1:02:34");
    expect(durationLabel(0)).toBe("");
  });
});
