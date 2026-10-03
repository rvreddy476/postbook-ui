import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/*
  "Never a download link for viewers" — a scan of the source, so the rule
  holds for code nobody has written yet.

  The founder's rule (2 Oct 2026): a viewer never receives a video file.
  The only real download left is the OWNER's "Download video" in Creator
  Hub (src/features/posttube/hub), on a route the server answers only for
  the owner.
*/

const SRC = join(import.meta.dir, "..", "..", "..");
const rel = (file: string) => relative(SRC, file).split(sep).join("/");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "__tests__" || name === "node_modules") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const FILES = walk(SRC).map((file) => ({ path: rel(file), text: readFileSync(file, "utf8") }));

/** The Creator Hub owner path: the one place the attachment route may be built. */
const OWNER_PATH = "features/posttube/hub/";

/** The media attachment route: a /media/…/download URL closing a string or template, or followed by a query. */
export const DOWNLOAD_URL = /\/media\/[^\s"'`]*\/download(?=[`"'?])/;

/** Any URL ending in /download — on the video surfaces not even a non-media one is allowed. */
export const ANY_DOWNLOAD_URL = /\/download(?=[`"'?])/;

/** Saving a file from script or markup: the `download` attribute or property. */
export const DOWNLOAD_ATTR = /(?:<a\b[^>]*\sdownload\b)|(?:\.download\s*=[^=])|(?:setAttribute\(\s*["']download["'])|(?:\bdownload=)/;

/** Opening a media or file URL in a new window (which is how the old Keep a copy saved a file). */
export const OPEN_MEDIA = /window\.open\([^)]*(?:download|media|serve|fileUrl|videoUrl|Href)/i;

/** The surfaces a viewer watches video on. */
const VIDEO_SURFACES = ["features/offline/", "features/video-shell/", "features/reels/", "features/posttube/", "features/live/", "app/posttube/", "app/reels/", "app/tube/"];

/*
  Files outside the video surfaces that save a file the person themselves
  made or asked for (an admin's CSV report, your own data export). They are
  not video, and each is named so a new one cannot slip in unnoticed.
*/
const NOT_VIDEO_EXPORTS = new Set(["app/admin/mopedu/reports/page.tsx", "app/settings/data/page.tsx", "app/settings/page.tsx", "features/dating/hooks/safety.ts"]);

describe("never a download link for viewers", () => {
  test("the scan sees the source tree", () => {
    expect(FILES.length).toBeGreaterThan(300);
    expect(FILES.some((f) => f.path === "features/video-shell/moreRows.ts")).toBe(true);
    expect(FILES.some((f) => f.path.startsWith(OWNER_PATH))).toBe(true);
  });

  test("the patterns catch what they are for", () => {
    for (const hit of ["mediaHref(`/v1/media/${id}/download`)", '"/v1/media/m1/download"', "`/v1/media/${id}/download?x=1`"]) expect(DOWNLOAD_URL.test(hit)).toBe(true);
    for (const miss of ["/v1/media/:id/download   307", "the download route", 'controlsList="nodownload"', "/v1/media/m1/downloads/list`", '"/v1/data-export/7/download"']) expect(DOWNLOAD_URL.test(miss)).toBe(false);
    expect(ANY_DOWNLOAD_URL.test('"/v1/data-export/7/download"')).toBe(true);
    expect(ANY_DOWNLOAD_URL.test('from "./transfer"')).toBe(false);
    for (const hit of ['<a href={url} download>', '<a download="video.mp4" href={u}>', "a.download = name", 'el.setAttribute("download", "")', "<Link download={name}>"]) expect(DOWNLOAD_ATTR.test(hit)).toBe(true);
    for (const miss of ['controlsList="nodownload noremoteplayback"', "downloadAllowed: true", "if (a.download === b)", "allow_download", "<Download />"]) expect(DOWNLOAD_ATTR.test(miss)).toBe(false);
    for (const hit of ['window.open(downloadHref(id), "_blank")', "window.open(keepHref)", "window.open(reel.media.fileUrl)", "window.open(`/v1/media/${id}/serve`)"]) expect(OPEN_MEDIA.test(hit)).toBe(true);
    expect(OPEN_MEDIA.test('window.open(shareUrl, "_blank")')).toBe(false);
  });

  test("the attachment route is built only inside Creator Hub (the owner's Download video)", () => {
    const offenders = FILES.filter((f) => DOWNLOAD_URL.test(f.text) && !f.path.startsWith(OWNER_PATH)).map((f) => f.path);
    expect(offenders).toEqual([]);
    // …and it is still there for the owner.
    expect(FILES.filter((f) => DOWNLOAD_URL.test(f.text)).map((f) => f.path)).toEqual(["features/posttube/hub/hubApi.ts"]);
    // On the video surfaces no URL of any kind ends in /download.
    const onVideo = FILES.filter((f) => VIDEO_SURFACES.some((s) => f.path.startsWith(s)) && !f.path.startsWith(OWNER_PATH) && ANY_DOWNLOAD_URL.test(f.text)).map((f) => f.path);
    expect(onVideo).toEqual([]);
  });

  test("no video surface saves a file: no download attribute, no script-made download, outside Creator Hub", () => {
    const offenders = FILES.filter((f) => VIDEO_SURFACES.some((s) => f.path.startsWith(s)) && !f.path.startsWith(OWNER_PATH) && DOWNLOAD_ATTR.test(f.text)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  test("no video surface opens a media URL in a new window", () => {
    const offenders = FILES.filter((f) => VIDEO_SURFACES.some((s) => f.path.startsWith(s)) && !f.path.startsWith(OWNER_PATH) && OPEN_MEDIA.test(f.text)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  test("the offline feature itself has no link, no window and no save prompt in it", () => {
    const own = FILES.filter((f) => f.path.startsWith("features/offline/"));
    expect(own.length).toBeGreaterThan(8);
    for (const f of own) {
      expect([f.path, /window\.open\(/.test(f.text)]).toEqual([f.path, false]);
      expect([f.path, /showSaveFilePicker|msSaveBlob|saveAs\(/.test(f.text)]).toEqual([f.path, false]);
      expect([f.path, /<a\b/.test(f.text)]).toEqual([f.path, false]);
    }
  });

  test("the players a stored copy plays in offer no download control and no context menu", () => {
    for (const path of ["features/posttube/components/TubePlayer.tsx", "features/reels/components/ReelVideo.tsx", "features/offline/components/OfflinePlayer.tsx"]) {
      const text = FILES.find((f) => f.path === path)!.text;
      expect([path, /controlsList="nodownload/.test(text)]).toEqual([path, true]);
      expect([path, /onContextMenu=\{\(e\) => e\.preventDefault\(\)\}/.test(text)]).toEqual([path, true]);
    }
  });

  test("elsewhere in the app, a script-made file save is only ever one of the named non-video exports", () => {
    const unnamed = FILES.filter((f) => /\.download\s*=[^=]/.test(f.text) && !f.path.startsWith(OWNER_PATH) && !NOT_VIDEO_EXPORTS.has(f.path)).map((f) => f.path);
    expect(unnamed).toEqual([]);
  });

  test("the words: no Keep a copy anywhere, and Download video only in Creator Hub", () => {
    expect(FILES.filter((f) => f.text.includes("Keep a copy")).map((f) => f.path)).toEqual([]);
    expect(FILES.filter((f) => f.text.includes("Download video") && !f.path.startsWith(OWNER_PATH)).map((f) => f.path)).toEqual([]);
  });
});
