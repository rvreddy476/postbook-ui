import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StudioToolbar } from "../components/StudioToolbar";
import { PreviewPanel } from "../components/PreviewPanel";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VideoStep } from "../steps/VideoStep";
import { DetailsStep } from "../steps/DetailsStep";
import { FieldLabel, StudioSelect, ToggleRow } from "../primitives";
import { INITIAL_FORM_STATE, type StudioFormState } from "../types";
import { STEP_SCHEMAS } from "../tokens";
import { canPublish, getAllErrors, getStepErrors } from "../validation";
import { tomorrowLocalInput, uploadLimitLabels, validateMediaDuration, validateSelectedFile } from "../fileRules";

const form = (patch: Partial<StudioFormState> = {}): StudioFormState => ({ ...INITIAL_FORM_STATE, contentType: "long", ...patch });
const noop = () => {};

const GB = 1024 * 1024 * 1024;

describe("upload file requirements", () => {
  test("no size cap anywhere: a 2 GB+ long video, a 50 GB one and a large Short all pass the file rules", () => {
    expect(validateSelectedFile({ type: "video/mp4", size: 2 * GB + 1 }, "long")).toBeNull();
    expect(validateSelectedFile({ type: "video/quicktime", size: 50 * GB }, "long")).toBeNull();
    expect(validateSelectedFile({ type: "video/webm", size: 3 * GB }, "podcast")).toBeNull();
    expect(validateSelectedFile({ type: "video/mp4", size: 600 * 1024 * 1024 }, "reel")).toBeNull();
    expect(validateSelectedFile({ type: "video/mp4", size: 600 * 1024 * 1024 }, "short")).toBeNull();
  });
  test("the labels advertise no number that is not enforced", () => {
    expect(uploadLimitLabels("long")).toEqual({ size: "Any file size", duration: "Any length" });
    expect(uploadLimitLabels("podcast")).toEqual({ size: "Any file size", duration: "Any length" });
    expect(uploadLimitLabels("reel")).toEqual({ size: "Any file size", duration: "Up to 10 minutes as a Short" });
  });
  test("empty and unsupported files receive actionable errors", () => {
    expect(validateSelectedFile({ type: "video/mp4", size: 0 }, "long")).toContain("empty");
    expect(validateSelectedFile({ type: "image/png", size: 100 }, "long")).toContain("MP4");
    expect(validateSelectedFile({ type: "audio/mpeg", size: 100 }, "long")).not.toBeNull();
    expect(validateSelectedFile({ type: "audio/mpeg", size: 100 }, "podcast")).toBeNull();
  });
  test("duration must be finite and positive; there is no upper limit", () => {
    for (const duration of [0, -1, NaN, Infinity]) expect(validateMediaDuration(duration)).not.toBeNull();
    for (const duration of [300.1, 600, 601, 43201, 100 * 3600]) expect(validateMediaDuration(duration)).toBeNull();
  });
});

describe("required-field and schedule validation", () => {
  test("empty form names each real requirement; optional steps are not made mandatory", () => {
    const errors = getAllErrors(form(), STEP_SCHEMAS.long);
    expect(errors.map((item) => item.step)).toEqual(["video", "details", "publish"]);
    expect(errors.flatMap((item) => item.errors).map((item) => item.field)).toContain("category");
    expect(canPublish(form(), STEP_SCHEMAS.long)).toBe(false);
    expect(canPublish(form({ videoFile: {} as File, title: "A video", category: "music" }), STEP_SCHEMAS.long)).toBe(true);
  });
  test("an uploaded media id satisfies the file requirement", () => {
    expect(getStepErrors("video", form({ mediaId: "media-1" }))).toEqual([]);
  });
  test("invalid, empty and past schedule dates are blocked while no schedule is allowed", () => {
    const check = (scheduleAt: string | null) => getStepErrors("publish", form({ videoFile: {} as File, category: "music", scheduleAt })).filter((e) => e.field === "scheduleAt");
    for (const value of ["", "invalid-date", "2001-01-01T12:00"]) expect(check(value)).toHaveLength(1);
    expect(check(null)).toEqual([]);
    expect(check(new Date(Date.now() + 86400000).toISOString())).toEqual([]);
  });
  test("schedule default preserves local wall-clock hours instead of removing a UTC suffix", () => {
    const now = new Date(2026, 8, 30, 19, 15);
    const next = new Date(tomorrowLocalInput(now));
    expect(next.getTime() - now.getTime()).toBe(86400000);
    expect(next.getHours()).toBe(new Date(now.getTime() + 86400000).getHours());
  });
  test("conditional series requirements remain enforced", () => {
    const errors = getStepErrors("publish", form({ videoFile: {} as File, category: "music", seriesChoice: { kind: "new", title: " " }, seriesEpisodeNum: 0 }));
    expect(errors.map((e) => e.field)).toEqual(["seriesTitle", "seriesEpisode"]);
  });
});

describe("accessible upload surfaces", () => {
  test("dropzone has a keyboard-operable button, accurate limits and linked error", () => {
    const html = renderToStaticMarkup(<VideoStep form={form()} patch={noop} onFileSelected={noop} clearFile={noop} contentType="long" showErrors />);
    expect(html).toContain("Select file");
    expect(html).toContain('aria-describedby="upload-file-error upload-file-limits"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("Any file size");
    expect(html).toContain("Any length");
    expect(html).not.toContain("500 MB");
    expect(html).not.toContain("12 hours");
    expect(html).not.toContain("overflow-y-auto");
    expect(html).not.toContain("audio/*");
  });
  test("the Shorts drop zone says 10 minutes as a Short", () => {
    const html = renderToStaticMarkup(<VideoStep form={form({ contentType: "reel" })} patch={noop} onFileSelected={noop} clearFile={noop} contentType="reel" />);
    expect(html).toContain("Up to 10 minutes as a Short");
    expect(html).not.toContain("5 minutes");
  });
  test("a 15-minute file in the Shorts studio is accepted with a calm long-video notice, not an error", () => {
    const fifteen = { name: "talk.mp4", size: 2.5 * GB } as File;
    const picked = form({ contentType: "reel", videoFile: fifteen, videoPreviewUrl: "blob:v", videoDurationSec: 900, videoWidth: 1080, videoHeight: 1920, computedVideoCategory: "long_video", finalVideoCategory: "long_video" });
    const html = renderToStaticMarkup(<VideoStep form={picked} patch={noop} onFileSelected={noop} clearFile={noop} contentType="reel" />);
    expect(html).toContain("Over 10 minutes — this will be posted as a long video.");
    expect(html).toContain("data-long-video-notice");
    expect(html).toContain("2.5 GB");
    expect(html).not.toContain('role="alert"');
    expect(getStepErrors("video", picked)).toEqual([]);
    const short = form({ contentType: "reel", videoFile: fifteen, videoDurationSec: 600, videoWidth: 1080, videoHeight: 1920 });
    expect(renderToStaticMarkup(<VideoStep form={short} patch={noop} onFileSelected={noop} clearFile={noop} contentType="reel" />)).not.toContain("data-long-video-notice");
  });
  test("the Details step repeats the notice for an over-10-minute Short", () => {
    const picked = form({ contentType: "reel", videoFile: { name: "talk.mp4", size: 1 } as File, videoPreviewUrl: "blob:v", videoDurationSec: 900, videoWidth: 1080, videoHeight: 1920 });
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <DetailsStep form={picked} patch={noop} contentType="reel" extractCoverPreview={{ mutate: noop, isPending: false }} selectCustomCover={noop} />
      </QueryClientProvider>,
    );
    expect(html).toContain("this will be posted as a long video");
  });
  test("file checking has a visible, disabled state", () => {
    const html = renderToStaticMarkup(<VideoStep form={form()} patch={noop} onFileSelected={noop} clearFile={noop} contentType="long" checking />);
    expect(html).toContain("Checking your file");
    expect(html).toContain('disabled=""');
  });
  test("steps retain their names on phones and identify the current step", () => {
    const html = renderToStaticMarkup(<StudioToolbar steps={STEP_SCHEMAS.long} currentStep="details" currentStepIndex={1} form={form()} onStepClick={noop} />);
    expect(html).toContain('aria-label="Upload steps"');
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('aria-label="2. Details"');
    expect(html).not.toContain("overflow-x-auto");
  });
  test("empty preview is useful guidance, with no fake content link or black player", () => {
    const html = renderToStaticMarkup(<PreviewPanel form={form()} contentType="long" steps={STEP_SCHEMAS.long} />);
    expect(html).toContain("Before you publish");
    expect(html).toContain("These three items are required");
    expect(html).not.toContain("<video");
    expect(html).not.toContain("Content link");
  });
  test("preview has real native controls and a selected poster", () => {
    const html = renderToStaticMarkup(<PreviewPanel form={form({ videoPreviewUrl: "blob:video", coverPreviewUrl: "blob:cover", title: "Mountain walk" })} contentType="long" steps={STEP_SCHEMAS.long} />);
    expect(html).toContain('poster="blob:cover"');
    expect(html).toContain('controls=""');
    expect(html).toContain("Mountain walk");
  });
  test("required labels, select errors and switches have accessible names", () => {
    expect(renderToStaticMarkup(<FieldLabel htmlFor="upload-title" label="Title" required />)).toContain('for="upload-title"');
    const html = renderToStaticMarkup(<StudioSelect id="upload-category" label="Topic" required invalid describedBy="upload-category-error" value="" onChange={noop} options={[]} />);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="upload-category-error"');
    expect(renderToStaticMarkup(<ToggleRow label="Schedule publish" checked={false} onChange={noop} />)).toContain('aria-label="Schedule publish"');
  });
});
