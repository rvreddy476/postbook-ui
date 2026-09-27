import type { PublishDefaults } from "@/features/posttube/hub/publishDefaults";
import type { LicenseType } from "@/features/reels/types";

import type { ContentType } from "./tokens";
import { INITIAL_FORM_STATE, type StudioFormState } from "./types";

/*
  Creator Hub → Preferences prefill a new long-video draft: visibility,
  topic, comments, language and license. A field is filled only while it
  still holds the studio's initial value — whatever the draft (or the
  creator) already set is never overwritten. Reels and flicks keep their
  own studio defaults: the preferences are for videos.
*/

/** The studios the preferences apply to. */
export function takesPublishDefaults(contentType: ContentType): boolean {
  return contentType === "long" || contentType === "podcast";
}

const LICENSE_FROM_DEFAULT: Record<PublishDefaults["license"], LicenseType> = {
  standard: "standard",
  "cc-by": "creative_commons",
};

/**
 * The patch that applies `defaults` to `form`: only the keys that are
 * still at INITIAL_FORM_STATE and that the defaults actually change.
 * `comments:false` turns comments off (sent as comments_enabled:false →
 * the post's no_comments). An empty topic or language leaves the field
 * alone. Returns {} when there is nothing to do.
 */
export function mergePublishDefaults(form: StudioFormState, defaults: PublishDefaults): Partial<StudioFormState> {
  const patch: Partial<StudioFormState> = {};
  const untouched = <K extends keyof StudioFormState>(key: K) => form[key] === INITIAL_FORM_STATE[key];

  if (untouched("visibility") && defaults.visibility !== form.visibility) patch.visibility = defaults.visibility;
  if (untouched("category") && defaults.topic) patch.category = defaults.topic;
  if (untouched("commentsEnabled") && defaults.comments === false) patch.commentsEnabled = false;
  if (untouched("language") && defaults.language && defaults.language !== form.language) patch.language = defaults.language;
  const license = LICENSE_FROM_DEFAULT[defaults.license];
  if (untouched("license") && license && license !== form.license) patch.license = license;

  return patch;
}

/** A fresh form for a studio, with the preferences applied when they belong to it. */
export function freshStudioForm(contentType: ContentType, currentStep: StudioFormState["currentStep"], defaults: PublishDefaults | null): StudioFormState {
  const base: StudioFormState = { ...INITIAL_FORM_STATE, contentType, currentStep };
  if (!defaults || !takesPublishDefaults(contentType)) return base;
  return { ...base, ...mergePublishDefaults(base, defaults) };
}
