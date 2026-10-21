import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AudienceStep } from "../steps/AudienceStep";
import { DetailsStep } from "../steps/DetailsStep";
import { EngageStep } from "../steps/EngageStep";
import { EnrichStep } from "../steps/EnrichStep";
import { PublishStep } from "../steps/PublishStep";
import { PreviewPanel } from "../components/PreviewPanel";
import { StudioToolbar } from "../components/StudioToolbar";
import { cachedCover, keepPublishAttempt, newPublishAttempt } from "../publishAttempt";
import { postPublishPatch, scheduleIso, studioCreateFields } from "../studioApi";
import { STEP_META, STEP_SCHEMAS, type ContentType } from "../tokens";
import { INITIAL_FORM_STATE, type StudioFormState } from "../types";
import { canPublish, getStepErrors } from "../validation";

const form = (contentType: ContentType, patch: Partial<StudioFormState> = {}): StudioFormState => ({ ...INITIAL_FORM_STATE, contentType, ...patch });
const noop = () => {};
const withQuery = (node: React.ReactNode) => renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>);
const src = (path: string) => readFileSync(resolve(import.meta.dir, path), "utf8").split("\r\n").join("\n");

const detailsProps = { extractCoverPreview: { mutate: noop, isPending: false }, selectCustomCover: noop };
const video = { videoFile: {} as File, videoPreviewUrl: "blob:v", videoDurationSec: 90, videoWidth: 1080, videoHeight: 1920 };

/** Every step a studio shows, rendered with a selected file. */
function renderStudio(contentType: ContentType, patch: Partial<StudioFormState> = {}): string {
  const f = form(contentType, { ...video, ...patch });
  return STEP_SCHEMAS[contentType].map((step) => {
    switch (step) {
      case "details": return withQuery(<DetailsStep form={f} patch={noop} contentType={contentType} {...detailsProps} />);
      case "audience": return renderToStaticMarkup(<AudienceStep form={f} patch={noop} />);
      case "engage": return renderToStaticMarkup(<EngageStep form={f} patch={noop} />);
      case "enrich": return renderToStaticMarkup(<EnrichStep form={f} patch={noop} />);
      case "publish": return withQuery(<PublishStep form={f} patch={noop} contentType={contentType} />);
      default: return "";
    }
  }).join("\n");
}

describe("steps per studio (founder, 2026-10-21)", () => {
  test("reels ask Video → Details → Publish; long video and podcasts keep six steps", () => {
    expect(STEP_SCHEMAS.short).toEqual(["video", "details", "publish"]);
    expect(STEP_SCHEMAS.reel).toEqual(["video", "details", "publish"]);
    expect(STEP_SCHEMAS.long).toEqual(["video", "details", "audience", "engage", "enrich", "publish"]);
    expect(STEP_SCHEMAS.podcast).toEqual(["video", "details", "audience", "engage", "enrich", "publish"]);
  });

  test("the long-video steps have plain names", () => {
    expect(STEP_SCHEMAS.long.map((s) => STEP_META[s].label)).toEqual(["Video", "Details", "Audience", "Comments", "Extras", "Publish"]);
  });

  test("the toolbar says which step of how many, and names each step", () => {
    const html = renderToStaticMarkup(<StudioToolbar steps={STEP_SCHEMAS.reel} currentStep="details" currentStepIndex={1} form={form("reel")} onStepClick={noop} />);
    expect(html).toContain("Step 2 of 3");
    expect(html).toContain('aria-label="3. Publish"');
    expect(html).not.toContain("Audience");
  });
});

describe("topic is optional for reels", () => {
  const ready = { videoFile: {} as File, title: "A clip" };
  test("short and reel publish without a topic", () => {
    for (const type of ["short", "reel"] as const) {
      expect(getStepErrors("publish", form(type, ready)).map((e) => e.field)).not.toContain("category");
      expect(canPublish(form(type, ready), STEP_SCHEMAS[type])).toBe(true);
    }
  });
  test("long video and podcasts still need one", () => {
    for (const type of ["long", "podcast"] as const) {
      expect(getStepErrors("publish", form(type, ready)).map((e) => e.field)).toContain("category");
      expect(canPublish(form(type, ready), STEP_SCHEMAS[type])).toBe(false);
    }
  });
});

describe("the direct-create body", () => {
  test("share_to_postbook is always sent: true by default (the server's own default), false when turned off", () => {
    expect(INITIAL_FORM_STATE.crossPostPostbook).toBe(true);
    expect(studioCreateFields(form("long", { title: "t" })).share_to_postbook).toBe(true);
    expect(studioCreateFields(form("reel", { title: "t", crossPostPostbook: false })).share_to_postbook).toBe(false);
  });

  test("dead fields are gone from the body and the form", () => {
    const f = studioCreateFields(form("long", { title: "t" }));
    for (const key of ["license", "allow_embedding", "recording_date", "recording_location", "comment_moderation", "auto_chapters", "featured_places", "auto_concepts", "cross_post_posttube"]) {
      expect(key in f).toBe(false);
    }
    for (const key of ["license", "allowEmbedding", "recordingDate", "recordingLocation", "commentModeration", "autoChapters", "featuredPlaces", "autoConcepts", "crossPostPosttube", "coverResult"]) {
      expect(key in INITIAL_FORM_STATE).toBe(false);
    }
  });

  test("scheduleIso turns the picker's local wall clock into RFC3339, and nothing into nothing", () => {
    expect(scheduleIso("2026-11-02T09:15")).toBe(new Date("2026-11-02T09:15").toISOString());
    expect(scheduleIso(null)).toBeUndefined();
    expect(scheduleIso("")).toBeUndefined();
    expect(scheduleIso("not a date")).toBeUndefined();
  });
});

describe("the follow-up PATCH after publish", () => {
  test("an age-restricted long video sends age_restricted:true", () => {
    expect(postPublishPatch(form("long", { ageRestricted: true }))).toEqual({ age_restricted: true });
    expect(postPublishPatch(form("podcast", { ageRestricted: true }))).toEqual({ age_restricted: true });
  });
  test("nothing to send otherwise; reels never send it", () => {
    expect(postPublishPatch(form("long"))).toBeNull();
    expect(postPublishPatch(form("reel", { ageRestricted: true }))).toBeNull();
    expect(postPublishPatch(form("short", { ageRestricted: true }))).toBeNull();
  });
  test("the studio runs it for scheduled posts too, and a failure is a warning, not a failed publish", () => {
    const hook = src("../useUploadStudio.ts");
    expect(hook).not.toContain("!form.scheduleAt");
    expect(hook).toContain("if (isLongStudio && postId) {");
    const followUp = hook.slice(hook.indexOf("const followUpPatch = postId ? postPublishPatch(form) : null;"), hook.indexOf("const followUpFailures: FollowUpFailure[] = [];"));
    expect(followUp).toContain("await updatePost(postId, followUpPatch);");
    expect(followUp).toContain("warnings.push(");
  });
});

describe("one publish attempt, one post", () => {
  test("the key is made once per attempt", () => {
    let n = 0;
    const attempt = newPublishAttempt(() => `key-${++n}`);
    expect(attempt.key).toBe("key-1");
    expect(newPublishAttempt(() => `key-${++n}`).key).toBe("key-2");
    expect(newPublishAttempt().key).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("an unknown outcome keeps the attempt; a definite refusal ends it", () => {
    expect(keepPublishAttempt(new Error("Network Error"))).toBe(true);
    expect(keepPublishAttempt({ response: { status: 502 } })).toBe(true);
    expect(keepPublishAttempt({ response: { status: 409, data: { error: { code: "IDEMPOTENCY_IN_PROGRESS" } } } })).toBe(true);
    expect(keepPublishAttempt({ response: { status: 400, data: { error: { code: "TITLE_REQUIRED" } } } })).toBe(false);
    expect(keepPublishAttempt({ response: { status: 409, data: { error: { code: "IDEMPOTENCY_KEY_REUSED" } } } })).toBe(false);
  });

  test("a retry reuses the cover it already uploaded, unless the cover changed", () => {
    const attempt = newPublishAttempt(() => "k");
    expect(cachedCover(attempt, "blob:frame")).toBeNull();
    attempt.cover = { source: "blob:frame", mediaId: "m1" };
    expect(cachedCover(attempt, "blob:frame")).toBe("m1");
    expect(cachedCover(attempt, "blob:other")).toBeNull();
  });

  test("the create call carries the attempt's key, and the draft routes get RFC3339 times", () => {
    const hook = src("../useUploadStudio.ts");
    expect(hook).toContain("idempotencyKey: attempt.key,");
    expect(hook).toContain("const attempt = (publishAttemptRef.current ??= newPublishAttempt());");
    expect(hook).toContain("schedule_at: scheduleIso(form.scheduleAt),");
    expect(hook).toContain("const scheduleAt = scheduleIso(form.scheduleAt);");
    expect(hook).not.toContain("uploadMutation");
  });
});

describe("what each studio asks", () => {
  test("a reel's Publish page: Paid promotion and AI-generated, no kids, age or altered content", () => {
    const html = withQuery(<PublishStep form={form("reel", video)} patch={noop} contentType="reel" />);
    expect(html).toContain("Paid promotion");
    expect(html).toContain("AI-generated");
    expect(html).toContain("Allow comments");
    expect(html).toContain("Remixing");
    expect(html).toContain("Schedule publish");
    // Reels never reach the home Feed (founder, 25 Sep): no switch that does nothing.
    expect(html).not.toContain("Also show in the Feed");
    expect(html).not.toContain("Age-restricted");
    expect(html).not.toMatch(/made for kids/i);
    expect(html).not.toContain("Altered content");
    expect(html).not.toContain("Series");
    expect(html).not.toContain('id="upload-category" required');
  });

  test("a reel's Details: title, caption, cover, sound, location — no tags, trim or category", () => {
    const html = withQuery(<DetailsStep form={form("reel", video)} patch={noop} contentType="reel" {...detailsProps} />);
    expect(html).toContain('id="upload-title"');
    expect(html).toContain("Caption (optional)");
    expect(html).toContain("Cover");
    expect(html).toContain("Audio");
    expect(html).toContain('id="upload-location"');
    expect(html).not.toContain("Tag People");
    expect(html).not.toContain('id="upload-tags"');
    expect(html).not.toContain("Video tools");
  });

  test("a long video's Details: keyword Tags with an honest hint, no Tag People, no sound", () => {
    const html = withQuery(<DetailsStep form={form("long", { ...video, videoWidth: 1920, videoHeight: 1080 })} patch={noop} contentType="long" {...detailsProps} />);
    expect(html).toContain('id="upload-tags"');
    expect(html).toContain("Keywords that help people find this video");
    expect(html).not.toContain("Tag People");
    expect(html).not.toContain("Original audio volume");
    expect(html).not.toContain("Add sound");
  });

  test("the long Audience step has the 18+ restriction, kids and all three disclosures", () => {
    const html = renderToStaticMarkup(<AudienceStep form={form("long")} patch={noop} />);
    expect(html).toContain("Age-restricted (18+)");
    expect(html).toContain("Made for kids");
    expect(html).toContain("Altered content");
    expect(html).toContain("Paid promotion");
    expect(html).toContain("AI-generated");
  });

  test("the made-for-kids banner says what really happens", () => {
    const html = renderToStaticMarkup(<AudienceStep form={form("long", { isMadeForKids: true })} patch={noop} />);
    expect(html).toContain("do not show end screens or cards");
    expect(html).not.toMatch(/comments[^.]*(disabled|turned off)/i);
  });

  test("a disclosure turned on promises the viewer label", () => {
    const html = renderToStaticMarkup(<AudienceStep form={form("long", { aiGenerated: true })} patch={noop} />);
    expect(html).toContain("A disclosure label will be shown to viewers");
  });

  test("the Comments step: Allow likes (it really turns liking off), no moderation select", () => {
    const html = renderToStaticMarkup(<EngageStep form={form("long")} patch={noop} />);
    expect(html).toContain("Allow likes");
    expect(html).toContain("Who can comment");
    expect(html).not.toContain("Spark");
    expect(html).not.toContain("Comment moderation");
  });

  test("the Extras step: language, subtitles, chapters — no license, embedding or recording details", () => {
    const html = renderToStaticMarkup(<EnrichStep form={form("long")} patch={noop} />);
    expect(html).toContain("Language");
    expect(html).toContain("Subtitles");
    expect(html).toContain("Chapters");
    expect(html).not.toContain("License");
    expect(html).not.toContain("Embedding");
    expect(html).not.toContain("Recording");
  });

  test("no removed or dishonest wording anywhere in either studio", () => {
    for (const type of ["long", "podcast", "reel", "short"] as const) {
      const html = renderStudio(type);
      for (const gone of ["Show Spark Count", "License", "Allow Embedding", "Comment moderation", "Close friends", "Recording Date", "Recording Location", "Tag People"]) {
        expect(html).not.toContain(gone);
      }
    }
  });
});

describe("the preview", () => {
  test("a reel previews in a 9:16 phone frame; a long video in a 16:9 card with the channel line", () => {
    const reel = renderToStaticMarkup(<PreviewPanel form={form("reel", { ...video, title: "Beach day" })} contentType="reel" steps={STEP_SCHEMAS.reel} />);
    expect(reel).toContain('data-preview="vertical"');
    expect(reel).toContain("Beach day");
    expect(reel).toContain("These two items are required");
    const long = renderToStaticMarkup(<PreviewPanel form={form("long", { ...video, title: "Mountain walk" })} contentType="long" steps={STEP_SCHEMAS.long} channelName="Trail Notes" />);
    expect(long).toContain('data-preview="wide"');
    expect(long).toContain("Trail Notes");
    expect(long).toContain("These three items are required");
  });

  test("on a phone the preview folds into one labelled button", () => {
    const html = renderToStaticMarkup(<PreviewPanel form={form("long")} contentType="long" steps={STEP_SCHEMAS.long} />);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("data-collapsed");
  });
});

describe("the theme rule", () => {
  test("no hex colours and no text-muted text class in the studio's sources", () => {
    for (const file of ["../UploadStudio.tsx", "../primitives.tsx", "../steps/DetailsStep.tsx", "../steps/PublishStep.tsx", "../steps/EnrichStep.tsx", "../components/StudioSettings.tsx", "../components/PreviewPanel.tsx", "../components/StudioToolbar.tsx", "../upload.css", "../tokens.ts"]) {
      const text = src(file);
      expect(text.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b(?![\w-])/gi)).toBeNull();
      // The Tailwind class text-muted is a background token; text uses text-muted-foreground (the CSS var --text-muted is fine).
      expect(text).not.toMatch(/(?<![-\w])text-muted\b(?!-)/);
    }
  });
});
