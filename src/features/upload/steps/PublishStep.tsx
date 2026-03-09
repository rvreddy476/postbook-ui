"use client";

import { Globe, Lock, Users, EyeOff, Calendar, Link2 } from "lucide-react";
import { ToggleRow, RadioOption, StudioSelect } from "../primitives";
import { CATEGORIES } from "../tokens";
import type { StudioFormState } from "../types";

interface PublishStepProps {
  form: StudioFormState;
  patch: (u: Partial<StudioFormState>) => void;
}

export function PublishStep({ form, patch }: PublishStepProps) {
  return (
    <div className="space-y-8">
      {/* ── Visibility ── */}
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <Globe className="h-5 w-5 text-[#7C5CFC]" />
          <h3 className="text-[15px] font-bold text-[#1A1A1A]">Visibility</h3>
        </div>
        <div className="space-y-1">
          <RadioOption
            name="visibility"
            label="Private"
            description="Only you and people you choose"
            checked={form.visibility === "private"}
            onChange={() => patch({ visibility: "private" })}
          />
          <div className="border-t border-[#F0EEE9]" />
          <RadioOption
            name="visibility"
            label="Circle Only"
            description="Close friends only"
            checked={form.visibility === "followers"}
            onChange={() => patch({ visibility: "followers" })}
          />
          <div className="border-t border-[#F0EEE9]" />
          <RadioOption
            name="visibility"
            label="Unlisted"
            description="Link access — won't appear in feeds"
            checked={form.visibility === "unlisted"}
            onChange={() => patch({ visibility: "unlisted" })}
          />
          <div className="border-t border-[#F0EEE9]" />
          <RadioOption
            name="visibility"
            label="Public"
            description="Everyone can discover and watch"
            checked={form.visibility === "public"}
            onChange={() => patch({ visibility: "public" })}
          />
        </div>
      </div>

      {/* ── Schedule ── */}
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <Calendar className="h-5 w-5 text-[#7C5CFC]" />
          <h3 className="text-[15px] font-bold text-[#1A1A1A]">Schedule</h3>
        </div>
        <div className="rounded-xl border border-[#E8E6E1] p-4">
          <ToggleRow
            label="Schedule publish"
            description="Auto-publish at a specific time"
            checked={!!form.scheduleAt}
            onChange={(v) =>
              patch({ scheduleAt: v ? new Date(Date.now() + 86400000).toISOString().slice(0, 16) : null })
            }
          />
          {form.scheduleAt && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] p-3">
              <Calendar className="h-4 w-4 text-[#9E9E9E]" />
              <input
                type="datetime-local"
                value={form.scheduleAt}
                onChange={(e) => patch({ scheduleAt: e.target.value })}
                className="flex-1 bg-transparent text-[13px] text-[#1A1A1A] outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Cross-post ── */}
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <Link2 className="h-5 w-5 text-[#7C5CFC]" />
          <h3 className="text-[15px] font-bold text-[#1A1A1A]">Cross-post</h3>
        </div>
        <div className="space-y-1 rounded-xl border border-[#E8E6E1] p-4">
          <ToggleRow
            label="Postbook Feed"
            description="Share as a post on your Postbook feed"
            checked={form.crossPostPostbook}
            onChange={(v) => patch({ crossPostPostbook: v })}
          />
          <div className="border-t border-[#F0EEE9]" />
          <ToggleRow
            label="Posttube"
            description="Also publish to your Posttube channel"
            checked={form.crossPostPosttube}
            onChange={(v) => patch({ crossPostPosttube: v })}
          />
          <div className="border-t border-[#F0EEE9]" />
          <ToggleRow
            label="Show in Feed"
            description="Include in your followers' home feed"
            checked={form.publishToFeed}
            onChange={(v) => patch({ publishToFeed: v })}
          />
        </div>
      </div>

      {/* ── Category ── */}
      <div>
        <p className="mb-2 text-[12px] font-semibold text-[#6B6B6B]">Category</p>
        <StudioSelect
          value={form.category}
          onChange={(v) => patch({ category: v })}
          options={CATEGORIES.map((c) => ({ value: c, label: c }))}
          placeholder="Select a category"
        />
      </div>
    </div>
  );
}
