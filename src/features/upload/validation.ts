import { validateChapterRows } from "@/features/posttube/hub/chaptersModel";

import type { StudioFormState } from "./types";
import type { StepId } from "./tokens";

export interface FieldError {
  field: string;
  message: string;
}

/** Returns validation errors for a given step. Empty array = step is valid. */
export function getStepErrors(step: StepId, form: StudioFormState): FieldError[] {
  switch (step) {
    case "video":
      return getVideoErrors(form);
    case "details":
      return getDetailsErrors(form);
    case "audience":
      return [];
    case "engage":
      return [];
    case "enrich":
      return getEnrichErrors(form);
    case "publish":
      return getPublishErrors(form);
    default:
      return [];
  }
}

/** Chapters written at upload: first at 0:00, ascending, titled, inside the video. */
export function getEnrichErrors(form: StudioFormState): FieldError[] {
  const durationMs = form.videoDurationSec ? form.videoDurationSec * 1000 : null;
  return validateChapterRows(form.chapterRows, durationMs).map((issue, i) => ({ field: `chapters-${i}`, message: issue.message }));
}

/** A series picked as "New series" needs a name; an episode number, when typed, is a whole number ≥ 1. */
export function getSeriesErrors(form: StudioFormState): FieldError[] {
  const errors: FieldError[] = [];
  if (form.seriesChoice.kind === "new" && !form.seriesChoice.title.trim()) {
    errors.push({ field: "seriesTitle", message: "Name the new series" });
  }
  if (form.seriesChoice.kind !== "none" && form.seriesEpisodeNum !== null && (!Number.isInteger(form.seriesEpisodeNum) || form.seriesEpisodeNum < 1)) {
    errors.push({ field: "seriesEpisode", message: "Episode number must be 1 or more" });
  }
  return errors;
}

function getVideoErrors(form: StudioFormState): FieldError[] {
  const errors: FieldError[] = [];
  if (!form.videoFile && !form.mediaId) {
    errors.push({ field: "videoFile", message: "Choose a video file before continuing to Details." });
  }
  if (form.uploadPhase === "error") {
    errors.push({ field: "upload", message: form.uploadError || "Upload failed" });
  }
  return errors;
}

function getDetailsErrors(form: StudioFormState): FieldError[] {
  const errors: FieldError[] = [];
  if (!form.title.trim()) {
    errors.push({ field: "title", message: "Add a title so viewers know what your video is about." });
  } else if (form.title.length > 100) {
    errors.push({ field: "title", message: "Title must be 100 characters or less" });
  }
  if (form.caption.length > 2200) {
    errors.push({ field: "caption", message: "Description must be 2200 characters or less" });
  }
  if (form.hashtags.length > 30) {
    errors.push({ field: "hashtags", message: "Maximum 30 hashtags allowed" });
  }
  return errors;
}

function getPublishErrors(form: StudioFormState): FieldError[] {
  const errors: FieldError[] = [];
  if (!form.videoFile && !form.mediaId) {
    errors.push({ field: "videoFile", message: "Please select a video to publish" });
  }
  if (!form.category.trim()) {
    errors.push({ field: "category", message: "Choose a topic to help viewers find your video." });
  }
  // NOTE: the video is uploaded and transcoded on Publish (not on selection),
  // so we no longer block publishing on processing being "ready". The post
  // becomes visible to viewers once server-side processing finishes.
  if (form.scheduleAt !== null) {
    const scheduleDate = new Date(form.scheduleAt);
    if (!Number.isFinite(scheduleDate.getTime()) || scheduleDate <= new Date()) {
      errors.push({ field: "scheduleAt", message: "Choose a valid date and time in the future, or turn scheduling off." });
    }
  }
  errors.push(...getSeriesErrors(form));
  return errors;
}

/**
 * Check if a step is complete (no errors + has been meaningfully filled).
 * Optional steps (audience, engage, enrich) require the user to have progressed
 * past them — pass `stepIndex` and `currentStepIndex` to enable this check.
 */
export function isStepComplete(
  step: StepId,
  form: StudioFormState,
  stepIndex?: number,
  currentStepIndex?: number,
): boolean {
  const errors = getStepErrors(step, form);
  if (errors.length > 0) return false;

  switch (step) {
    case "video":
      // File selected is enough — upload now happens on Publish, not on select.
      return form.videoFile !== null || form.mediaId !== null;
    case "details":
      return form.title.trim().length > 0;
    case "audience":
    case "engage":
    case "enrich":
      // Only mark complete if the user has moved past this step
      if (stepIndex != null && currentStepIndex != null) {
        return currentStepIndex > stepIndex;
      }
      return false;
    case "publish":
      return form.category.length > 0 && (form.videoFile !== null || form.mediaId !== null);
    default:
      return false;
  }
}

/** Check if all required steps pass for publishing. */
export function canPublish(form: StudioFormState, steps: readonly StepId[]): boolean {
  const lastIndex = steps.length - 1;
  return steps.every((step, i) => isStepComplete(step, form, i, lastIndex));
}

/** Get a summary of all errors across all steps. */
export function getAllErrors(form: StudioFormState, steps: readonly StepId[]): { step: StepId; errors: FieldError[] }[] {
  return steps
    .map((step) => ({ step, errors: getStepErrors(step, form) }))
    .filter((s) => s.errors.length > 0);
}
