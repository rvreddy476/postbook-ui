import { mediaHref } from "@/features/reels/model";

/*
  A frame of the video as its cover (Creator Hub, 2026-09-29).

  The picker used to ask media-service for a frame and then name the VIDEO
  itself as the cover, with a short-lived signed link as the picture. The
  link expired, and every card that draws the cover from cover_media_id got a
  video where it wanted an image. Now the frame is drawn in the browser at the
  chosen time, uploaded as the creator's own image and set through the owner
  edit route, the same path "Upload image" takes.

  Where the frame is read from, in order:
    1. the stream the player plays (hls.js). Media that arrives through
       Media Source belongs to this page, so the canvas can be exported, and
       the segments come straight from storage.
    2. the MP4 files through THIS site's /v1 route, never an absolute API
       host: a frame drawn from another origin taints the canvas and cannot
       be exported. The session cookie rides along, so a private or unlisted
       video works for its owner.
*/

/** Longest side of the uploaded cover; a 4K frame is scaled down to this. */
export const COVER_FRAME_MAX_WIDTH = 1280;
export const COVER_FRAME_QUALITY = 0.9;
/** How long one source may take to show the frame before the next is tried. */
export const COVER_FRAME_TIMEOUT_MS = 20_000;
/** The rendition a cover is drawn from: enough for the cap above, no heavier. */
export const COVER_FRAME_LEVEL_HEIGHT = 720;

export interface FrameSource {
  kind: "hls" | "file";
  url: string;
}

/** Same-origin files to draw the frame from, best first. */
export function frameSourcePaths(mediaId: string): string[] {
  const id = encodeURIComponent(mediaId);
  return [`/v1/media/${id}/serve/720p`, `/v1/media/${id}/serve/480p`, `/v1/media/${id}/serve`];
}

/** Every source for the frame, in the order they are tried. */
export function frameSources(mediaId: string): FrameSource[] {
  return [
    { kind: "hls", url: mediaHref(`/v1/media/${encodeURIComponent(mediaId)}/hls/master.m3u8`) },
    ...frameSourcePaths(mediaId).map((url): FrameSource => ({ kind: "file", url })),
  ];
}

/** The stream level to draw from: the tallest that does not exceed the target, else the smallest there is. */
export function pickFrameLevel(heights: number[], target = COVER_FRAME_LEVEL_HEIGHT): number {
  let best = -1;
  let smallest = -1;
  heights.forEach((h, i) => {
    if (!(h > 0)) return;
    if (smallest < 0 || h < heights[smallest]) smallest = i;
    if (h <= target && (best < 0 || h > heights[best])) best = i;
  });
  if (best >= 0) return best;
  return smallest >= 0 ? smallest : 0;
}

/** The seek target in seconds, kept inside the video so the seek always lands on a frame. */
export function frameSeekSeconds(timestampMs: number, durationSeconds: number): number {
  const wanted = Number.isFinite(timestampMs) && timestampMs > 0 ? timestampMs / 1000 : 0;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return wanted;
  return Math.min(wanted, Math.max(0, durationSeconds - 0.05));
}

/** The cover's pixel size: the frame's own shape, no wider than the cap, even on both sides. */
export function frameSize(videoWidth: number, videoHeight: number, maxWidth = COVER_FRAME_MAX_WIDTH): { width: number; height: number } | null {
  if (!(videoWidth > 0) || !(videoHeight > 0)) return null;
  const scale = Math.min(1, maxWidth / videoWidth);
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return { width: even(videoWidth * scale), height: even(videoHeight * scale) };
}

export function frameFileName(postId: string, timestampMs: number): string {
  return `cover-${postId.slice(0, 8)}-${Math.max(0, Math.round(timestampMs))}ms.jpg`;
}

/** Draws the frame at `seconds` of one source. Rejects on a load error, a tainted canvas or the timeout. */
export function captureFrame(source: FrameSource, seconds: number, timeoutMs = COVER_FRAME_TIMEOUT_MS): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    let release: (() => void) | null = null;
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      release?.();
      video.removeAttribute("src");
      video.load();
      fn();
    };
    const fail = (message: string) => finish(() => reject(new Error(message)));
    const timer = window.setTimeout(() => fail("The frame took too long to load"), timeoutMs);
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      video.currentTime = frameSeekSeconds(seconds * 1000, video.duration);
    };
    // Drawn once the seek has landed AND the frame is decoded, whichever
    // comes last. Not on an animation frame: those never fire while the tab
    // is hidden, and the picker would wait out its whole timeout.
    let sought = false;
    let drawing = false;
    const draw = () => {
      if (settled || drawing || !sought || video.seeking || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      drawing = true;
      const size = frameSize(video.videoWidth, video.videoHeight);
      const canvas = document.createElement("canvas");
      const ctx = size ? canvas.getContext("2d") : null;
      if (!size || !ctx) {
        fail("The frame could not be drawn");
        return;
      }
      canvas.width = size.width;
      canvas.height = size.height;
      try {
        ctx.drawImage(video, 0, 0, size.width, size.height);
        canvas.toBlob(
          (blob) => finish(() => (blob && blob.size > 0 ? resolve(blob) : reject(new Error("The frame could not be saved")))),
          "image/jpeg",
          COVER_FRAME_QUALITY,
        );
      } catch (err) {
        finish(() => reject(err instanceof Error ? err : new Error("The frame could not be saved")));
      }
    };
    video.onseeked = () => {
      sought = true;
      draw();
    };
    video.onloadeddata = draw;
    video.oncanplay = draw;
    video.onerror = () => fail("The video could not be loaded");

    if (source.kind === "file") {
      video.src = source.url;
      return;
    }
    void (async () => {
      try {
        const { default: HlsCtor } = await import("hls.js");
        if (settled) return;
        if (!HlsCtor.isSupported()) {
          fail("This browser cannot read the stream");
          return;
        }
        // Loads from the chosen time, and only what one frame needs.
        const hls = new HlsCtor({
          startPosition: Math.max(0, seconds),
          maxBufferLength: 4,
          maxMaxBufferLength: 8,
          capLevelToPlayerSize: false,
          xhrSetup: (xhr) => {
            xhr.withCredentials = true;
          },
        });
        release = () => hls.destroy();
        hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
          const level = pickFrameLevel(hls.levels.map((l) => l.height));
          hls.startLevel = level;
          hls.currentLevel = level;
        });
        hls.on(HlsCtor.Events.ERROR, (_e, data) => {
          if (data.fatal) fail("The stream could not be loaded");
        });
        hls.loadSource(source.url);
        hls.attachMedia(video);
      } catch {
        fail("The stream could not be loaded");
      }
    })();
  });
}

/** The frame at `timestampMs` as an image file, from the first source that yields one. */
export async function captureCoverFrame(
  postId: string,
  mediaId: string,
  timestampMs: number,
  durationSeconds: number,
  capture: (source: FrameSource, seconds: number) => Promise<Blob> = captureFrame,
): Promise<File> {
  const seconds = frameSeekSeconds(timestampMs, durationSeconds);
  let lastError: unknown = new Error("The video could not be loaded");
  for (const source of frameSources(mediaId)) {
    try {
      const blob = await capture(source, seconds);
      return new File([blob], frameFileName(postId, timestampMs), { type: "image/jpeg" });
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
