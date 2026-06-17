"use client";

import { SectionHeader, ToggleRow, InfoBanner, RadioOption } from "../primitives";
import type { StudioFormState } from "../types";

interface AudienceStepProps {
  form: StudioFormState;
  patch: (u: Partial<StudioFormState>) => void;
  showErrors?: boolean;
}

export function AudienceStep({ form, patch }: AudienceStepProps) {
  return (
    <div className="space-y-6">
      {/* ── Made for Kids (COPPA) ── */}
      <div>
        <SectionHeader
          title="Audience"
          subtitle="Is this content made for kids? (COPPA compliance)"
        />
        <div className="space-y-1 rounded-xl border border-brand-text/10 p-2">
          <RadioOption
            name="coppa"
            label="Yes, it's made for kids"
            description="Content designed primarily for children under 13"
            checked={form.isMadeForKids}
            onChange={() => patch({ isMadeForKids: true })}
          />
          <RadioOption
            name="coppa"
            label="No, it's not made for kids"
            description="Content intended for general or mature audiences"
            checked={!form.isMadeForKids}
            onChange={() => patch({ isMadeForKids: false })}
          />
        </div>
        {form.isMadeForKids && (
          <div className="mt-3">
            <InfoBanner variant="warning">
              Content set as "made for kids" has limited features — comments, notifications, and personalized ads are disabled per COPPA regulations.
            </InfoBanner>
          </div>
        )}
      </div>

      {/* ── Age Restriction ── */}
      <div>
        <SectionHeader
          title="Age Restriction"
          subtitle="Restrict this content to viewers over 18"
        />
        <div className="rounded-xl border border-brand-text/10 p-4">
          <ToggleRow
            label="Age-restricted (18+)"
            description="Only viewers who are signed in and over 18 will be able to watch"
            checked={form.ageRestricted}
            onChange={(v) => patch({ ageRestricted: v })}
          />
        </div>
      </div>

      {/* ── Disclosures ── */}
      <div>
        <SectionHeader
          title="Disclosures"
          subtitle="Transparency settings required by platform policies"
        />
        <div className="space-y-1 rounded-xl border border-brand-text/10 p-4">
          <ToggleRow
            label="Paid Promotion"
            description="This content contains paid promotion, sponsorship, or product placement"
            checked={form.paidPromotion}
            onChange={(v) => patch({ paidPromotion: v })}
          />
          <div className="border-t border-brand-secondary" />
          <ToggleRow
            label="Altered / AI-Generated Content"
            description="This content uses realistic AI-generated or altered elements that could be mistaken as real"
            checked={form.alteredContent}
            onChange={(v) => patch({ alteredContent: v })}
          />
        </div>
        {(form.paidPromotion || form.alteredContent) && (
          <div className="mt-3">
            <InfoBanner>
              A disclosure label will be shown to viewers when they watch this content.
            </InfoBanner>
          </div>
        )}
      </div>
    </div>
  );
}
