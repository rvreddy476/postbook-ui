/*
  The upload refusals media-service answers on init, parts, status,
  complete and confirm (internal/http/upload_limit_errors.go, lane
  media-upload 2026-11-17), in words a creator can act on. Each names the
  limit and, where the server sends Retry-After, when to try again.

    413 VIDEO_TOO_LONG              {max_duration_seconds, limit}           final for this file
    429 UPLOAD_QUOTA_EXCEEDED       {limit: daily_video_bytes|daily_video_seconds, max, used, requested}  Retry-After 3600
    429 LONG_VIDEO_IN_PROGRESS      {limit: inflight_long_videos, max, used}  Retry-After 600
    503 UPLOAD_LIMITER_UNAVAILABLE  Retry-After 30                           nothing was charged
    410 UPLOAD_EXPIRED              the session expired; start again
    409 UPLOAD_INCOMPLETE           parts missing at complete
    429 RATE_LIMITED                too many uploads started; Retry-After 3600
*/

interface ErrorShape {
  response?: {
    status?: unknown;
    headers?: unknown;
    data?: { error?: { code?: unknown; message?: unknown; details?: unknown } };
  };
}

export interface UploadRefusal {
  code: string;
  message: string;
  /** Seconds from Retry-After, when the server sent one. */
  retryAfterSeconds: number | null;
}

const UPLOAD_CODES = new Set([
  "VIDEO_TOO_LONG",
  "UPLOAD_QUOTA_EXCEEDED",
  "LONG_VIDEO_IN_PROGRESS",
  "UPLOAD_LIMITER_UNAVAILABLE",
  "UPLOAD_EXPIRED",
  "UPLOAD_INCOMPLETE",
  "RATE_LIMITED",
]);

function header(headers: unknown, name: string): string | null {
  if (!headers || typeof headers !== "object") return null;
  const get = (headers as { get?: unknown }).get;
  if (typeof get === "function") {
    const v = (get as (n: string) => unknown).call(headers, name);
    if (typeof v === "string") return v;
  }
  for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
    if (k.toLowerCase() === name && (typeof v === "string" || typeof v === "number")) return String(v);
  }
  return null;
}

/** Retry-After as seconds: delta-seconds or an HTTP date. */
export function retryAfterSeconds(value: string | null, now: number = Date.now()): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const at = Date.parse(trimmed);
  if (!Number.isFinite(at)) return null;
  return Math.max(0, Math.ceil((at - now) / 1000));
}

/** "in 30 seconds", "in about 10 minutes", "in about 1 hour". */
export function retryWhen(seconds: number): string {
  if (seconds < 60) return `in ${Math.max(1, Math.round(seconds))} second${Math.round(seconds) === 1 ? "" : "s"}`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `in about ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
}

/** 4 hours, 1 hour 30 minutes, 45 minutes. */
export function durationWords(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const parts: string[] = [];
  if (h) parts.push(`${h} hour${h === 1 ? "" : "s"}`);
  if (m) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  if (!parts.length) parts.push(`${total} second${total === 1 ? "" : "s"}`);
  return parts.join(" ");
}

function bytesWords(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * The creator-facing sentence for an upload refusal, or null when err is
 * not one of the codes above (the caller keeps its own handling).
 */
export function uploadRefusal(err: unknown): UploadRefusal | null {
  const res = (err as ErrorShape | null)?.response;
  const body = res?.data?.error;
  const code = typeof body?.code === "string" ? body.code : null;
  if (!code || !UPLOAD_CODES.has(code)) return null;
  const details = body?.details && typeof body.details === "object" ? (body.details as Record<string, unknown>) : {};
  const serverMessage = typeof body?.message === "string" ? body.message.trim() : "";
  const retry = retryAfterSeconds(header(res?.headers, "retry-after"));
  const later = (fallbackSeconds: number) => `Try again ${retryWhen(retry ?? fallbackSeconds)}.`;

  let message: string;
  switch (code) {
    case "VIDEO_TOO_LONG": {
      const max = num(details.max_duration_seconds);
      message = serverMessage ||
        (max ? `This video is longer than ${durationWords(max)}, the longest we can process right now. Trim it or split it into parts, then upload again.`
          : "This video is longer than we can process right now. Trim it or split it into parts, then upload again.");
      break;
    }
    case "UPLOAD_QUOTA_EXCEEDED": {
      const max = num(details.max);
      const used = num(details.used);
      if (details.limit === "daily_video_seconds") {
        message = `You've reached today's video upload limit${max != null ? ` of ${durationWords(max)} of video` : ""}${used != null ? ` (${durationWords(used)} used in the last 24 hours)` : ""}. Your upload is kept. ${later(3600)}`;
      } else {
        message = `You've reached today's video upload limit${max != null ? ` of ${bytesWords(max)}` : ""}${used != null ? ` (${bytesWords(used)} used in the last 24 hours)` : ""}. Your upload is kept. ${later(3600)}`;
      }
      break;
    }
    case "LONG_VIDEO_IN_PROGRESS": {
      const max = num(details.max);
      message = `You already have ${max != null ? `${max} long video${max === 1 ? "" : "s"}` : "the most long videos"} being processed at once. Your upload is kept. Try again ${retryWhen(retry ?? 600)}, once one has finished.`;
      break;
    }
    case "UPLOAD_LIMITER_UNAVAILABLE":
      message = `Uploads are paused for a moment and nothing was charged. ${later(30)}`;
      break;
    case "UPLOAD_EXPIRED":
      message = "This upload took too long and expired. Publish again to start it from the beginning.";
      break;
    case "UPLOAD_INCOMPLETE":
      message = "Part of the video did not arrive. Publish again to send the missing parts; what already arrived is kept.";
      break;
    case "RATE_LIMITED":
    default:
      message = `You've started too many uploads in a short time. ${later(3600)}`;
      break;
  }
  return { code, message, retryAfterSeconds: retry };
}
