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
      return [];
    case "publish":
      return getPublishErrors(form);
    default:
      return [];
  }
}

function getVideoErrors(form: StudioFormState): FieldError[] {
  const errors: FieldError[] = [];
  if (!form.videoFile) {
    errors.push({ field: "videoFile", message: "Please select a video file to upload" });
  }
  if (form.uploadPhase === "error") {
    errors.push({ field: "upload", message: form.uploadError || "Upload failed" });
  }
  return errors;
}

function getDetailsErrors(form: StudioFormState): FieldError[] {
  const errors: FieldError[] = [];
  if (!form.title.trim()) {
    errors.push({ field: "title", message: "Title is required" });
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
  if (!form.category) {
    errors.push({ field: "category", message: "Please select a category" });
  }
  if (form.scheduleAt) {
    const scheduleDate = new Date(form.scheduleAt);
    if (scheduleDate <= new Date()) {
      errors.push({ field: "scheduleAt", message: "Schedule date must be in the future" });
    }
  }
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
      return form.uploadPhase === "done" || form.mediaId !== null;
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
      return form.category.length > 0;
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
