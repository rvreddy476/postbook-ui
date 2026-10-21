"use client";

import { CommentSettings, LikeSetting, RemixSetting } from "../components/StudioSettings";
import type { StudioFormState } from "../types";

interface EngageStepProps {
  form: StudioFormState;
  patch: (u: Partial<StudioFormState>) => void;
  showErrors?: boolean;
}

/**
 * Long video and podcasts: comments, likes and remixing. Comment moderation
 * is not asked here any more; the Creator Hub sets it per video.
 */
export function EngageStep({ form, patch }: EngageStepProps) {
  return (
    <div className="upload-stack">
      <CommentSettings form={form} patch={patch} />
      <LikeSetting form={form} patch={patch} />
      <RemixSetting form={form} patch={patch} />
    </div>
  );
}
