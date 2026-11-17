/*
  Caption upload: what POST /v1/subtitles/:mediaId accepts, checked before
  the request so a creator hears about a bad file at once.

  The server contract (media-service internal/http/clips_handler.go
  CreateSubtitle and internal/service/audio.go CreateSubtitle):
    { language (required), source (required), format, content }
  - `content` is the caption text itself. `content_url` is REFUSED with 400
    CONTENT_URL_NOT_ACCEPTED whenever it is non-empty: the service derives
    the track URL. (lv-8: the web used to send the whole file as a data: URL
    in content_url, so every upload failed.)
  - language: 1-10 characters, letters and "-" only (en, hi, en-IN).
  - content: at most 200,000 bytes (maxCaptionContentBytes).
  - source: auto_generated | manual | translated; anything else is stored
    as manual, so an upload says "manual".
*/

export const MAX_CAPTION_CONTENT_BYTES = 200_000;
export const CAPTION_FILE_EXTENSIONS = [".vtt", ".srt"] as const;

export interface CaptionUploadBody {
  language: string;
  source: string;
  format: "vtt";
  content: string;
}

/** A caption the client refused, or the server's refusal in words a creator can act on. */
export class CaptionUploadError extends Error {
  constructor(message: string, readonly code: string | null = null) {
    super(message);
    this.name = "CaptionUploadError";
  }
}

const LANGUAGE_TAG = /^[A-Za-z-]{1,10}$/;
/** An SRT cue timing as files really carry it: hours optional and 1-2 digits, "," or "." before 1-3 ms digits. */
const SRT_TIMESTAMP = /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[,.](\d{1,3})/;
const SRT_TIMING = new RegExp(`${SRT_TIMESTAMP.source}\\s*-->`);

const pad = (value: string, width: number) => value.padStart(width, "0");

/** One SRT timestamp as WebVTT's hh:mm:ss.mmm (REG-8: the server refuses "0:00:01,000"). */
export function normalizeCaptionTimestamp(stamp: string): string {
  const m = new RegExp(`^${SRT_TIMESTAMP.source}$`).exec(stamp.trim());
  if (!m) return stamp;
  const [, hours = "0", minutes, seconds, fraction] = m;
  // The digits after the separator are a fraction of a second: ",5" is 500 ms.
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${seconds}.${fraction.padEnd(3, "0")}`;
}

export function convertSrtToVtt(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "WEBVTT\n\n";
  if (normalized.startsWith("WEBVTT")) return `${normalized}\n`;
  // Only timing lines change: a cue's text may itself hold something that looks like a time.
  const stamp = new RegExp(SRT_TIMESTAMP.source, "g");
  const body = normalized
    .split("\n")
    .map((line) => (line.includes("-->") ? line.replace(stamp, (match) => normalizeCaptionTimestamp(match)) : line))
    .join("\n");
  return `WEBVTT\n\n${body}\n`;
}

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

function captionKind(fileName: string): "vtt" | "srt" | null {
  const name = fileName.toLowerCase();
  if (name.endsWith(".vtt")) return "vtt";
  if (name.endsWith(".srt")) return "srt";
  return null;
}

const TOO_BIG = `This caption file is too large. The limit is ${Math.round(MAX_CAPTION_CONTENT_BYTES / 1000)} KB.`;

/**
 * Reads and checks a caption file and returns the request body. Throws a
 * CaptionUploadError (no request made) for a wrong format, an empty or
 * malformed file, an oversized one or a language the server would refuse.
 */
export async function prepareCaptionUpload(
  file: File,
  language: string,
  source = "manual",
): Promise<CaptionUploadBody> {
  const lang = language.trim();
  if (!LANGUAGE_TAG.test(lang)) {
    throw new CaptionUploadError("Choose the caption language before uploading.", "INVALID_LANGUAGE");
  }
  const kind = captionKind(file.name);
  if (!kind) throw new CaptionUploadError("Captions must be an .srt or .vtt file.", "INVALID_FORMAT");
  // Refuse a huge file before reading it into memory.
  if (file.size > MAX_CAPTION_CONTENT_BYTES) throw new CaptionUploadError(TOO_BIG, "TOO_LARGE");

  const raw = (await file.text()).replace(/^﻿/, "");
  if (!raw.trim()) throw new CaptionUploadError("This caption file is empty.", "EMPTY");
  if (kind === "vtt" && !raw.trimStart().startsWith("WEBVTT")) {
    throw new CaptionUploadError("This .vtt file does not start with WEBVTT. Export it again as WebVTT.", "INVALID_FORMAT");
  }
  if (kind === "srt" && !SRT_TIMING.test(raw)) {
    throw new CaptionUploadError("This .srt file has no subtitle timings. Export it again as SRT.", "INVALID_FORMAT");
  }
  const content = kind === "srt" ? convertSrtToVtt(raw) : raw.replace(/\r\n/g, "\n");
  if (utf8Bytes(content) > MAX_CAPTION_CONTENT_BYTES) throw new CaptionUploadError(TOO_BIG, "TOO_LARGE");

  return { language: lang, source: normalizeCaptionSource(source), format: "vtt", content };
}

/** The server's source set; the old "manual_upload" spelling is a manual upload. */
export function normalizeCaptionSource(source: string): string {
  return source === "auto_generated" || source === "translated" ? source : "manual";
}

/**
 * Why a caption upload failed, in words. A client refusal keeps its own
 * sentence; a server refusal uses the service's message (axios's "Request
 * failed with status code 400" says nothing).
 */
export function captionUploadMessage(err: unknown): string {
  if (err instanceof CaptionUploadError) return err.message;
  const res = (err as { response?: { status?: number; data?: { error?: { code?: unknown; message?: unknown } } } } | null)?.response;
  const code = typeof res?.data?.error?.code === "string" ? res.data.error.code : null;
  if (res?.status === 403 || code === "FORBIDDEN") return "Captions can only be added to your own video.";
  const message = typeof res?.data?.error?.message === "string" ? res.data.error.message.trim() : "";
  if (res?.status && res.status >= 400 && res.status < 500 && message) {
    return `The captions were refused: ${/[.!?]$/.test(message) ? message : `${message}.`}`;
  }
  if (!res) return "The captions could not be uploaded. Check your connection and try again.";
  return "The captions could not be uploaded. Try again in a moment.";
}
