import { LONG_VIDEO_MAX_DURATION_LABEL, SHORTS_MAX_DURATION_LABEL, SHORTS_MAX_DURATION_SECONDS } from "@/lib/videoLimits";
import { isShortStudio, type ContentType } from "./tokens";

/** datetime-local is a local wall clock, not an ISO UTC string with its zone cut off. */
export function tomorrowLocalInput(now = new Date()): string {
  const date = new Date(now.getTime() + 86400000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/*
  No size limit in any studio (founder, 2026-10-21): files of 20 MB and more
  go up through the resumable multipart path (reelsApi.uploadMediaResumable),
  which takes any size the server accepts. In the Shorts studio, a file over
  the boundary is not refused — it is classified long_video and posted as a
  long video.

  Length: media-service refuses a video over MEDIA_MAX_VIDEO_DURATION_SEC
  (default 4 hours) with 413 VIDEO_TOO_LONG, at init from the duration_ms the
  studio sends, so the label no longer says "Any length" (lv-30). The
  server's message, with its own number, is what a refused creator sees.
*/

/** The two lines under the drop zone: how big, how long. Honest, so no number that is not enforced. */
export function uploadLimitLabels(type: ContentType): { size: string; duration: string } {
  return {
    size: "Any file size",
    duration: isShortStudio(type) ? `Up to ${SHORTS_MAX_DURATION_LABEL} as a Short` : `Up to ${LONG_VIDEO_MAX_DURATION_LABEL}`,
  };
}

/** 734.2 MB, 2.4 GB — a multi-GB long video reads in GB. */
export function fileSizeLabel(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}

export function validateSelectedFile(file: Pick<File, "type" | "size">, type: ContentType): string | null {
  const video = ["video/mp4", "video/webm", "video/quicktime"].includes(file.type);
  if (!video && !(type === "podcast" && file.type.startsWith("audio/"))) return type === "podcast" ? "Choose an MP4, WebM, MOV or audio file." : "This format isn't supported. Choose an MP4, WebM or MOV video.";
  if (!(file.size > 0)) return "This file is empty. Choose a video that contains playable content.";
  return null;
}

/** Only a duration that cannot be read is refused here; the upper limit is the server's (VIDEO_TOO_LONG at init). */
export function validateMediaDuration(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return "We couldn't read this file's duration. Try another file or export it again.";
  return null;
}

/**
 * The calm notice the Shorts studio shows when the chosen file is over the
 * boundary: it will be posted as a long video. Null when it is a Short, when
 * the duration is unknown, and in the long-video and podcast studios.
 */
export function shortsLongVideoNotice(type: ContentType, durationSec: number | null): string | null {
  if (!isShortStudio(type) || durationSec == null || !(durationSec > SHORTS_MAX_DURATION_SECONDS)) return null;
  return `Over ${SHORTS_MAX_DURATION_LABEL} — this will be posted as a long video.`;
}
