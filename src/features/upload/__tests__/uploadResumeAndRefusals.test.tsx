import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import api from "@/lib/api";
import { initMediaUpload } from "@/features/reels/data/reelsApi";
import { createSubtitleTrack } from "@/features/posttube/data/posttubeApi";
import { convertSrtToVtt, normalizeCaptionTimestamp } from "@/features/posttube/data/captionUpload";
import type { ResumeRecord, ResumeStore } from "@/lib/resumableUpload";
import { retryAfterSeconds, uploadRefusal } from "@/lib/uploadRefusal";

import { VideoStep } from "../steps/VideoStep";
import { INITIAL_FORM_STATE, type StudioFormState } from "../types";
import { publishFailure, saveDraftTolerant } from "../studioApi";
import { RESUME_EXPIRED_NOTICE, readResumeOffer, resumeFileProblem } from "../uploadResume";

afterEach(() => mock.restore());

const refusal = (status: number, code: string, details: Record<string, unknown> = {}, headers: Record<string, string> = {}, message = "") =>
  Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, headers, data: { error: { code, message, details } } } });

/* ── Task 3: each new refusal reads as itself, with the wait ── */

describe("upload refusals in the studio", () => {
  test("VIDEO_TOO_LONG shows the server's own sentence, or one built from its number", () => {
    const server = "This video is longer than 4 hours, the longest we can process right now. Trim it or split it into parts, then upload again.";
    expect(publishFailure(refusal(413, "VIDEO_TOO_LONG", { max_duration_seconds: 14400 }, {}, server))?.message).toBe(server);
    expect(publishFailure(refusal(413, "VIDEO_TOO_LONG", { max_duration_seconds: 5400 }))?.message).toContain("longer than 1 hour 30 minutes");
  });

  test("UPLOAD_QUOTA_EXCEEDED names the daily limit, what was used and when to try again", () => {
    const bytes = publishFailure(refusal(429, "UPLOAD_QUOTA_EXCEEDED", { limit: "daily_video_bytes", max: 32 * 1024 ** 3, used: 31 * 1024 ** 3, requested: 2 * 1024 ** 3 }, { "retry-after": "3600" }));
    expect(bytes?.code).toBe("UPLOAD_QUOTA_EXCEEDED");
    expect(bytes?.message).toBe("You've reached today's video upload limit of 32 GB (31 GB used in the last 24 hours). Your upload is kept. Try again in about 1 hour.");
    const seconds = uploadRefusal(refusal(429, "UPLOAD_QUOTA_EXCEEDED", { limit: "daily_video_seconds", max: 8 * 3600, used: 7 * 3600 }, { "Retry-After": "1800" }));
    expect(seconds?.message).toContain("of 8 hours of video (7 hours used");
    expect(seconds?.message).toContain("Try again in about 30 minutes.");
    expect(seconds?.retryAfterSeconds).toBe(1800);
  });

  test("LONG_VIDEO_IN_PROGRESS, UPLOAD_LIMITER_UNAVAILABLE and RATE_LIMITED each say what happened and when", () => {
    expect(publishFailure(refusal(429, "LONG_VIDEO_IN_PROGRESS", { limit: "inflight_long_videos", max: 2, used: 2 }, { "retry-after": "600" }))?.message)
      .toBe("You already have 2 long videos being processed at once. Your upload is kept. Try again in about 10 minutes, once one has finished.");
    expect(publishFailure(refusal(503, "UPLOAD_LIMITER_UNAVAILABLE", {}, { "retry-after": "30" }))?.message)
      .toBe("Uploads are paused for a moment and nothing was charged. Try again in 30 seconds.");
    expect(publishFailure(refusal(429, "RATE_LIMITED", {}, { "retry-after": "3600" }))?.message)
      .toBe("You've started too many uploads in a short time. Try again in about 1 hour.");
  });

  test("UPLOAD_EXPIRED and UPLOAD_INCOMPLETE tell the creator what Publish will do next", () => {
    expect(publishFailure(refusal(410, "UPLOAD_EXPIRED"))?.message).toContain("expired. Publish again to start it from the beginning");
    expect(publishFailure(refusal(409, "UPLOAD_INCOMPLETE"))?.message).toContain("Publish again to send the missing parts");
  });

  test("Retry-After as an HTTP date, and a refusal without one falls back to the server's documented wait", () => {
    const now = Date.parse("2026-11-18T10:00:00Z");
    expect(retryAfterSeconds("Wed, 18 Nov 2026 10:05:00 GMT", now)).toBe(300);
    expect(retryAfterSeconds("soon")).toBeNull();
    expect(uploadRefusal(refusal(503, "UPLOAD_LIMITER_UNAVAILABLE"))?.message).toContain("Try again in 30 seconds.");
  });

  test("other errors keep their existing handling", () => {
    expect(uploadRefusal(refusal(400, "BAD_REQUEST"))).toBeNull();
    expect(publishFailure(refusal(400, "BAD_REQUEST", {}, {}, "nope"))?.message).toBe("nope.");
  });
});

/* ── Task 2: the simple path sends duration_ms too ── */

describe("duration_ms on the single-shot init (N-3)", () => {
  test("a video sends its length; an unknown length is left out", async () => {
    const post = spyOn(api, "post").mockResolvedValue({ data: { data: { media_id: "m", upload_url: "u", object_key: "k" } } } as never);
    const file = new File(["x"], "a.mp4", { type: "video/mp4" });
    await initMediaUpload(file, 61_000);
    await initMediaUpload(file, null);
    expect(post.mock.calls[0][0]).toBe("/v1/media/init");
    expect(post.mock.calls[0][1]).toEqual({ file_type: "video", media_subtype: "reel", mime_type: "video/mp4", file_size_bytes: 1, duration_ms: 61_000 });
    expect("duration_ms" in (post.mock.calls[1][1] as object)).toBe(false);
  });
});

/* ── Task 1: the studio's offer to continue ── */

function memoryStore(initial: ResumeRecord | null) {
  let value = initial;
  const store: ResumeStore = { load: () => value, save: (r) => { value = r; }, clear: () => { value = null; } };
  return { store, get: () => value };
}
const kept = (over: Partial<ResumeRecord> = {}): ResumeRecord => ({
  v: 1, upload_id: "up-1", media_id: "med-1", chunk_size: 10, total_parts: 3, draft_id: null,
  expires_at: "2026-11-19T00:00:00Z", saved_at: 0,
  file: { name: "trip.mp4", size: 1.5 * 1024 ** 3, last_modified: 42, type: "video/mp4" }, ...over,
});

describe("continuing an unfinished upload in the studio (reels-39)", () => {
  test("opening the studio with a live kept upload offers to continue, naming the file", () => {
    const mem = memoryStore(kept());
    const { offer, notice } = readResumeOffer(mem.store, Date.parse("2026-11-18T12:00:00Z"));
    expect(notice).toBeNull();
    expect(offer?.upload_id).toBe("up-1");
    const html = renderToStaticMarkup(<VideoStep form={{ ...INITIAL_FORM_STATE, contentType: "long" } as StudioFormState} patch={() => {}}
      onFileSelected={() => {}} clearFile={() => {}} contentType="long" resumeOffer={offer} onDiscardResume={() => {}} />);
    expect(html).toContain("data-upload-resume-offer");
    expect(html).toContain("trip.mp4");
    expect(html).toContain("1.5 GB");
    expect(html).toContain("Start over");
  });

  test("a kept upload past its expiry is forgotten and the creator is told", () => {
    const mem = memoryStore(kept());
    const { offer, notice } = readResumeOffer(mem.store, Date.parse("2026-11-20T00:00:00Z"));
    expect(offer).toBeNull();
    expect(notice).toContain("expired");
    expect(mem.get()).toBeNull();
    expect(RESUME_EXPIRED_NOTICE).toContain("started again from the beginning");
  });

  test("only the same file (name, size and date) is accepted; another one is refused with the expected file named", () => {
    const offer = kept();
    expect(resumeFileProblem(offer, { name: "trip.mp4", size: 1.5 * 1024 ** 3, lastModified: 42, type: "video/mp4" })).toBeNull();
    const problem = resumeFileProblem(offer, { name: "trip.mp4", size: 1.5 * 1024 ** 3, lastModified: 43, type: "video/mp4" });
    expect(problem).toContain("This isn't the file you were uploading");
    expect(problem).toContain("“trip.mp4” (1.5 GB)");
    expect(problem).toContain("Start over");
    expect(resumeFileProblem(null, { name: "x.mp4", size: 1, lastModified: 1, type: "video/mp4" })).toBeNull();
  });
});

/* ── Task 4: REG-7 and REG-8 ── */

describe("REG-7: an older post-service refuses age_restricted in the draft", () => {
  const old = refusal(400, "INVALID_DRAFT", {}, {}, 'invalid draft: json: unknown field "age_restricted"');

  test("the save is sent again without the field, and the result says so", async () => {
    const bodies: Record<string, unknown>[] = [];
    const send = async (_id: string, body: Record<string, unknown>) => { bodies.push(body); if ("age_restricted" in body) throw old; };
    const result = await saveDraftTolerant(send, "d1", { title: "t", age_restricted: true });
    expect(result).toEqual({ ageRestrictedDropped: true });
    expect(bodies).toEqual([{ title: "t", age_restricted: true }, { title: "t" }]);
  });

  test("a new server takes it in one request", async () => {
    const bodies: unknown[] = [];
    expect(await saveDraftTolerant(async (_id, b) => { bodies.push(b); }, "d1", { age_restricted: false })).toEqual({ ageRestrictedDropped: false });
    expect(bodies).toEqual([{ age_restricted: false }]);
  });

  test("any other refusal is not retried", async () => {
    let calls = 0;
    const other = refusal(400, "INVALID_REQUEST", {}, {}, "caption too long");
    await expect(saveDraftTolerant(async () => { calls++; throw other; }, "d1", { age_restricted: true })).rejects.toBe(other);
    expect(calls).toBe(1);
  });
});

describe("REG-8: SRT timings become hh:mm:ss.mmm", () => {
  test("one-digit hours, no hours, '.' or ',' and short fractions all normalise", () => {
    expect(normalizeCaptionTimestamp("0:00:01,000")).toBe("00:00:01.000");
    expect(normalizeCaptionTimestamp("00:01,500")).toBe("00:00:01.500");
    expect(normalizeCaptionTimestamp("1:02:03.4")).toBe("01:02:03.400");
    expect(normalizeCaptionTimestamp("12:34:56,789")).toBe("12:34:56.789");
  });

  test("only timing lines change; cue text keeps a time-like string as written", () => {
    const srt = "1\n0:00:01,000 --> 0:00:02,500\nMeet at 0:00:05,000\n\n2\n00:03,000 --> 00:04.250\nB\n";
    expect(convertSrtToVtt(srt)).toBe("WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.500\nMeet at 0:00:05,000\n\n2\n00:00:03.000 --> 00:00:04.250\nB\n");
  });

  test("a one-digit-hour .srt uploads as valid WebVTT", async () => {
    const post = spyOn(api, "post").mockResolvedValue({ data: { data: { id: "t" } } } as never);
    await createSubtitleTrack("m1", { language: "en", file: new File(["1\r\n0:00:01,000 --> 0:00:02,000\r\nA\r\n"], "a.srt") });
    expect((post.mock.calls[0][1] as { content: string }).content).toBe("WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\nA\n");
  });
});
