import { CONTENT_TYPE_META, type ContentType } from "./tokens";

/** datetime-local is a local wall clock, not an ISO UTC string with its zone cut off. */
export function tomorrowLocalInput(now = new Date()): string {
  const date = new Date(now.getTime() + 86400000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Keep the UI honest about the existing uploader's 500 MB client ceiling.
// Raising this requires an end-to-end upload contract change, not a label edit.
export function uploadLimits(type: ContentType) {
  return { maxSize: Math.min(CONTENT_TYPE_META[type].maxSize, 500 * 1024 * 1024), maxDuration: CONTENT_TYPE_META[type].maxDuration };
}

export function validateSelectedFile(file: Pick<File, "type" | "size">, type: ContentType): string | null {
  const video = ["video/mp4", "video/webm", "video/quicktime"].includes(file.type);
  if (!video && !(type === "podcast" && file.type.startsWith("audio/"))) return type === "podcast" ? "Choose an MP4, WebM, MOV or audio file." : "This format isn't supported. Choose an MP4, WebM or MOV video.";
  if (file.size === 0) return "This file is empty. Choose a video that contains playable content.";
  if (file.size > uploadLimits(type).maxSize) return "This file is too large. Choose a file of 500 MB or less.";
  return null;
}

export function validateMediaDuration(seconds: number, type: ContentType): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return "We couldn't read this file's duration. Try another file or export it again.";
  const max = uploadLimits(type).maxDuration;
  if (seconds > max) return `Choose a ${CONTENT_TYPE_META[type].label.toLowerCase()} of ${max >= 3600 ? `${max / 3600} hours` : `${max / 60} minutes`} or less.`;
  return null;
}
