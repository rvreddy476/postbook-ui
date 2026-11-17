import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import api from "@/lib/api";
import { createReel, postDetailToReel } from "@/features/reels/data/reelsApi";
import { createSubtitleTrack } from "@/features/posttube/data/posttubeApi";
import { MAX_CAPTION_CONTENT_BYTES } from "@/features/posttube/data/captionUpload";
import { updatePost, uploadCaption } from "@/features/posttube/hub/hubApi";
import type { PostDetail } from "@/types/profile";

import { PublishProblems } from "../components/PublishProblems";
import { captionOutcomePatch, secureAgeRestriction, studioCreateFields, uploadStudioCaptions } from "../studioApi";
import { INITIAL_FORM_STATE, type StudioFormState } from "../types";

const VTT = "WEBVTT\n\n00:00:00.000 --> 00:00:01.500\nhello there\n";
const SRT = "1\r\n00:00:00,000 --> 00:00:01,500\r\nhello there\r\n";
const track = { id: "t1", media_asset_id: "m1", language: "en", source: "manual", format: "vtt", content_url: "/v1/subtitles/m1/track/en.vtt", created_at: "" };
const form = (over: Partial<StudioFormState> = {}): StudioFormState => ({ ...INITIAL_FORM_STATE, contentType: "long", ...over });
const refusal = (status: number, code: string, message: string) =>
  Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data: { error: { code, message } } } });
const bodyOf = (spy: { mock: { calls: unknown[][] } }, i = 0) => spy.mock.calls[i][1] as Record<string, unknown>;

afterEach(() => mock.restore());

/* ── lv-8: captions are sent as content, checked first, and a failure is shown ── */

describe("caption upload request (lv-8)", () => {
  test("a .vtt goes as `content`, never `content_url`, with the server's source and format", async () => {
    const post = spyOn(api, "post").mockResolvedValue({ data: { data: track } } as never);
    await createSubtitleTrack("m1", { language: "en", file: new File([VTT], "captions.vtt") });
    expect(post.mock.calls[0][0]).toBe("/v1/subtitles/m1");
    const body = bodyOf(post);
    expect(body).toEqual({ language: "en", source: "manual", format: "vtt", content: VTT });
    expect("content_url" in body).toBe(false);
  });

  test("an .srt becomes WebVTT in `content`", async () => {
    const post = spyOn(api, "post").mockResolvedValue({ data: { data: track } } as never);
    await createSubtitleTrack("m1", { language: "hi", file: new File([SRT], "subs.SRT") });
    const body = bodyOf(post);
    expect(body.content).toBe("WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.500\nhello there\n");
    expect("content_url" in body).toBe(false);
  });

  test("Creator Hub uploads through the same request", async () => {
    const post = spyOn(api, "post").mockResolvedValue({ data: { data: track } } as never);
    await uploadCaption("m1", "en", new File([VTT], "a.vtt"));
    expect(bodyOf(post)).toEqual({ language: "en", source: "manual", format: "vtt", content: VTT });
  });

  test("an oversized file is refused before any request", async () => {
    const post = spyOn(api, "post").mockResolvedValue({ data: { data: track } } as never);
    const big = new File([`WEBVTT\n\n${"x".repeat(MAX_CAPTION_CONTENT_BYTES)}`], "big.vtt");
    await expect(createSubtitleTrack("m1", { language: "en", file: big })).rejects.toThrow(/too large/);
    expect(post).not.toHaveBeenCalled();
  });

  test("an .srt that only grows over the limit as WebVTT is refused too", async () => {
    const post = spyOn(api, "post").mockResolvedValue({ data: { data: track } } as never);
    const cue = "00:00:00,000 --> 00:00:01,000\n";
    const filler = "y".repeat(MAX_CAPTION_CONTENT_BYTES - cue.length - 2);
    const srt = new File([`${cue}${filler}`], "edge.srt");
    expect(srt.size).toBeLessThanOrEqual(MAX_CAPTION_CONTENT_BYTES);
    await expect(createSubtitleTrack("m1", { language: "en", file: srt })).rejects.toThrow(/too large/);
    expect(post).not.toHaveBeenCalled();
  });

  test("a wrong format, a .vtt without WEBVTT, an empty file and a bad language are refused before any request", async () => {
    const post = spyOn(api, "post").mockResolvedValue({ data: { data: track } } as never);
    await expect(createSubtitleTrack("m1", { language: "en", file: new File([VTT], "captions.txt") })).rejects.toThrow(/\.srt or \.vtt/);
    await expect(createSubtitleTrack("m1", { language: "en", file: new File(["hello"], "captions.vtt") })).rejects.toThrow(/WEBVTT/);
    await expect(createSubtitleTrack("m1", { language: "en", file: new File(["hello"], "captions.srt") })).rejects.toThrow(/timings/);
    await expect(createSubtitleTrack("m1", { language: "en", file: new File(["  "], "captions.vtt") })).rejects.toThrow(/empty/);
    await expect(createSubtitleTrack("m1", { language: "en_1", file: new File([VTT], "captions.vtt") })).rejects.toThrow(/language/);
    expect(post).not.toHaveBeenCalled();
  });

  test("a 400 from media-service reaches the studio state and the success screen, with a retry", async () => {
    spyOn(api, "post").mockRejectedValue(refusal(400, "INVALID_CAPTION", "invalid caption: transcript exceeds 200000 characters") as never);
    const outcome = await uploadStudioCaptions("m1", new File([VTT], "a.vtt"), "en");
    expect(outcome.ok).toBe(false);
    const patch = captionOutcomePatch(outcome, []);
    expect(patch.subtitleUploadState).toBe("error");
    expect(patch.publishCaptionError).toBe("The captions were refused: invalid caption: transcript exceeds 200000 characters.");
    expect(patch.subtitleUploadError).toBe(patch.publishCaptionError);

    const html = renderToStaticMarkup(
      <PublishProblems postId="p1" ageGateError={null} captionError={patch.publishCaptionError} onRetryCaptions={() => undefined} />,
    );
    expect(html).toContain('data-publish-problem="captions"');
    expect(html).toContain("transcript exceeds 200000 characters");
    expect(html).toContain('data-action="retry-captions"');
    expect(html).toContain("sheet=captions");
  });

  test("a successful retry clears the error and lists the track", async () => {
    spyOn(api, "post").mockResolvedValue({ data: { data: track } } as never);
    const patch = captionOutcomePatch(await uploadStudioCaptions("m1", new File([VTT], "a.vtt"), "en"), []);
    expect(patch).toMatchObject({ subtitleUploadState: "done", publishCaptionError: null, subtitleUploadError: null });
    expect(patch.subtitleTracks.map((t) => t.id)).toEqual(["t1"]);
  });
});

/* ── lv-9: 18+ goes with the create and fails closed ── */

describe("18+ in the create request (lv-9)", () => {
  test("the long-video studio's create body carries age_restricted", async () => {
    const post = spyOn(api, "post").mockResolvedValue({ data: { data: { id: "p1", author_id: "a", media: [], age_restricted: true } } } as never);
    const fields = studioCreateFields(form({ title: "Film", ageRestricted: true }), { longVideo: true });
    const reel = await createReel({ text: "c", mediaIds: ["m1"], content_type: "long_video", fields });
    expect(bodyOf(post).age_restricted).toBe(true);
    expect(reel.age_restricted).toBe(true);
  });

  test("off is sent as false; the shorts studio never asks and sends false", () => {
    expect(studioCreateFields(form({ title: "t" })).age_restricted).toBe(false);
    expect(studioCreateFields(form({ contentType: "reel", ageRestricted: true })).age_restricted).toBe(false);
  });

  test("the create response's age_restricted is read back only when it is there", () => {
    const base = { id: "p1", author_id: "a", media: [] } as unknown as PostDetail;
    expect(postDetailToReel({ ...base, age_restricted: false }).age_restricted).toBe(false);
    expect("age_restricted" in postDetailToReel(base)).toBe(false);
  });
});

describe("secureAgeRestriction (lv-9 fallback)", () => {
  const run = (echoed: boolean | undefined, visibility = "public") =>
    secureAgeRestriction({ postId: "p1", wanted: true, echoed, visibility, patchPost: updatePost });

  test("a create that stored it needs no PATCH", async () => {
    const patch = spyOn(api, "patch");
    expect(await run(true)).toEqual({ state: "confirmed", via: "create" });
    expect(patch).not.toHaveBeenCalled();
  });

  test("not asked for: nothing is sent", async () => {
    const patch = spyOn(api, "patch");
    expect(await secureAgeRestriction({ postId: "p1", wanted: false, echoed: undefined, visibility: "public", patchPost: updatePost })).toEqual({ state: "not_requested" });
    expect(patch).not.toHaveBeenCalled();
  });

  test("a server that ignored the field gets the PATCH", async () => {
    const patch = spyOn(api, "patch").mockResolvedValue({ data: { data: { id: "p1", age_restricted: true } } } as never);
    expect(await run(false)).toEqual({ state: "confirmed", via: "patch" });
    expect(patch.mock.calls.map((c) => c[1])).toEqual([{ age_restricted: true }]);
  });

  test("a failed fallback makes the video private, never leaves it public, and says so", async () => {
    const patch = spyOn(api, "patch").mockImplementation((async (_url: string, body: Record<string, unknown>) => {
      if ("age_restricted" in body) throw refusal(503, "UNAVAILABLE", "down");
      return { data: { data: { id: "p1", visibility: "private" } } };
    }) as never);
    const out = await run(false);
    expect(out.state).toBe("private");
    expect(patch.mock.calls.map((c) => c[1])).toEqual([{ age_restricted: true }, { age_restricted: true }, { visibility: "private" }]);
    const message = out.state === "private" ? out.message : "";
    expect(message).toMatch(/made your video private/);

    const html = renderToStaticMarkup(<PublishProblems postId="p1" ageGateError={message} captionError={null} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('data-variant="error"');
    expect(html).toContain("made your video private");
  });

  test("a PATCH that answers but did not apply it counts as a failure", async () => {
    const patch = spyOn(api, "patch").mockImplementation((async (_url: string, body: Record<string, unknown>) =>
      ({ data: { data: { id: "p1", age_restricted: false, visibility: "visibility" in body ? "private" : "public" } } })) as never);
    expect((await run(undefined)).state).toBe("private");
    expect(patch.mock.calls.at(-1)?.[1]).toEqual({ visibility: "private" });
  });

  test("already private: kept private, no visibility change, still told", async () => {
    const patch = spyOn(api, "patch").mockRejectedValue(refusal(500, "INTERNAL", "x") as never);
    const out = await run(false, "private");
    expect(out.state).toBe("private");
    expect(patch.mock.calls.every((c) => !("visibility" in (c[1] as object)))).toBe(true);
  });

  test("when it cannot be made private either, the creator is told to act now", async () => {
    spyOn(api, "patch").mockRejectedValue(new Error("Network Error") as never);
    const out = await run(false, "unlisted");
    expect(out.state).toBe("exposed");
    expect(out.state === "exposed" && out.message).toMatch(/Open Creator Hub now/);
  });
});
