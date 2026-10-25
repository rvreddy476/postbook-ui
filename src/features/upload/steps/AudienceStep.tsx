"use client";

import { AgeSetting, DisclosureSettings, KidsSetting } from "../components/StudioSettings";
import type { StudioFormState } from "../types";

interface AudienceStepProps {
  form: StudioFormState;
  patch: (u: Partial<StudioFormState>) => void;
  showErrors?: boolean;
}

/** Long video and podcasts: who it is for, the 18+ restriction, and disclosures. */
export function AudienceStep({ form, patch }: AudienceStepProps) {
  return (
    <div className="upload-stack">
      <KidsSetting form={form} patch={patch} />
      <AgeSetting form={form} patch={patch} />
      <DisclosureSettings form={form} patch={patch} includeAltered />
    </div>
  );
}
