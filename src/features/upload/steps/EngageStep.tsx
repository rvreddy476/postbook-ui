"use client";

import { SectionHeader, ToggleRow, RadioOption, StudioSelect } from "../primitives";
import type { StudioFormState } from "../types";

interface EngageStepProps {
  form: StudioFormState;
  patch: (u: Partial<StudioFormState>) => void;
}

export function EngageStep({ form, patch }: EngageStepProps) {
  return (
    <div className="space-y-6">
      {/* ── Comments ── */}
      <div>
        <SectionHeader title="Comments" subtitle="Control who can comment and how comments are moderated" />
        <div className="space-y-1 rounded-xl border border-[#E8E6E1] p-4">
          <ToggleRow
            label="Allow Comments"
            description="Let viewers leave comments on this content"
            checked={form.commentsEnabled}
            onChange={(v) => patch({ commentsEnabled: v })}
          />
          {form.commentsEnabled && (
            <>
              <div className="border-t border-[#F0EEE9] my-1" />
              <div className="py-2">
                <p className="text-[12px] font-semibold text-[#6B6B6B] mb-2">Who can comment</p>
                <StudioSelect
                  value={form.commentAccess}
                  onChange={(v) => patch({ commentAccess: v as StudioFormState["commentAccess"] })}
                  options={[
                    { value: "everyone", label: "Everyone" },
                    { value: "followers", label: "Followers only" },
                    { value: "nobody", label: "Nobody" },
                  ]}
                />
              </div>
              <div className="border-t border-[#F0EEE9] my-1" />
              <div className="py-2">
                <p className="text-[12px] font-semibold text-[#6B6B6B] mb-2">Comment moderation</p>
                <StudioSelect
                  value={form.commentModeration}
                  onChange={(v) => patch({ commentModeration: v as StudioFormState["commentModeration"] })}
                  options={[
                    { value: "none", label: "No moderation" },
                    { value: "basic", label: "Basic — filter likely spam" },
                    { value: "strict", label: "Strict — hold potentially inappropriate" },
                    { value: "hold_all", label: "Hold all for review" },
                  ]}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Sparks (Likes) ── */}
      <div>
        <SectionHeader title="Sparks" subtitle="Allow viewers to react with Sparks" />
        <div className="rounded-xl border border-[#E8E6E1] p-4">
          <ToggleRow
            label="Show Spark Count"
            description="Display the number of sparks this content receives"
            checked={form.likesEnabled}
            onChange={(v) => patch({ likesEnabled: v })}
          />
        </div>
      </div>

      {/* ── Remixing ── */}
      <div>
        <SectionHeader title="Remixing" subtitle="Allow others to use your content in their own creations" />
        <div className="space-y-1 rounded-xl border border-[#E8E6E1] p-2">
          <RadioOption
            name="remix"
            label="Allow remixing"
            description="Others can use this video and audio in their remixes"
            checked={form.remixSetting === "allow"}
            onChange={() => patch({ remixSetting: "allow" })}
          />
          <RadioOption
            name="remix"
            label="Allow audio only"
            description="Others can use the audio but not the video"
            checked={form.remixSetting === "allow_audio_only"}
            onChange={() => patch({ remixSetting: "allow_audio_only" })}
          />
          <RadioOption
            name="remix"
            label="Disallow remixing"
            description="Your content cannot be remixed by others"
            checked={form.remixSetting === "disallow"}
            onChange={() => patch({ remixSetting: "disallow" })}
          />
        </div>
      </div>
    </div>
  );
}
