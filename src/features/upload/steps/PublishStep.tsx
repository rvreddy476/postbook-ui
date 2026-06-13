"use client";

import { Globe, Calendar, Link2, AlertCircle, Tag } from "lucide-react";
import { ToggleRow, RadioOption, StudioSelect } from "../primitives";
import { CATEGORIES } from "../tokens";
import type { StudioFormState } from "../types";

interface PublishStepProps {
  form: StudioFormState;
  patch: (u: Partial<StudioFormState>) => void;
  showErrors?: boolean;
  publishError?: string | null;
  retryProcessingCheck?: () => void;
  onReplaceVideo?: () => void;
}

export function PublishStep({ form, patch, showErrors, publishError, retryProcessingCheck, onReplaceVideo }: PublishStepProps) {
  const categoryError = showErrors && !form.category;
  const scheduleError = showErrors && form.scheduleAt && new Date(form.scheduleAt) <= new Date();

  return (
    <div className="space-y-7">
      <div className={`rounded-xl border p-4 shadow-sm ${
        form.processingStatus === "ready"
          ? "border-[#2BB5A0]/20 bg-[#2BB5A0]/5"
          : form.processingStatus === "failed"
            ? "border-[#E8527A]/20 bg-[#E8527A]/5"
            : "border-[#E5A93D]/20 bg-[#E5A93D]/5"
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-[#1A1A1A]">Processing status</p>
            <p className="mt-1 text-[12px] text-[#6B6B6B]">
              {form.processingStatus === "ready"
                ? "Video renditions are ready for publishing."
                : form.processingStatus === "failed"
                  ? form.processingError || "Processing failed for this upload."
                  : "Your video is still processing. Publishing stays disabled until renditions are ready."}
            </p>
            {form.subtitlesFile && form.subtitleUploadState === "uploading" && (
              <p className="mt-2 text-[12px] text-[#7C5CFC]">Subtitle upload is still in progress.</p>
            )}
            {form.subtitlesFile && form.subtitleUploadState === "error" && form.subtitleUploadError && (
              <p className="mt-2 text-[12px] text-[#E8527A]">{form.subtitleUploadError}</p>
            )}
            {publishError && (
              <p className="mt-2 text-[12px] text-[#E8527A]">{publishError}</p>
            )}
          </div>

          {form.processingStatus === "failed" && (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={retryProcessingCheck}
                className="rounded-lg border border-[#E8E6E1] bg-brand-card px-3 py-2 text-[12px] font-semibold text-[#6B6B6B] hover:bg-[#F5F4F1] transition-colors"
              >
                Check again
              </button>
              <button
                type="button"
                onClick={onReplaceVideo}
                className="rounded-lg bg-[#E8527A] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#D4426A] transition-colors"
              >
                Replace video
              </button>
            </div>
          )}
        </div>
      </div>
      {/* ── Visibility ── */}
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7C5CFC]/10">
            <Globe className="h-4 w-4 text-[#7C5CFC]" />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-[#1A1A1A]">Visibility</h3>
            <p className="text-[11px] text-[#9E9E9E]">Who can see this content</p>
          </div>
        </div>
        <div className="space-y-1 rounded-xl border border-[#E8E6E1] bg-brand-card p-2 shadow-sm">
          <RadioOption
            name="visibility"
            label="Public"
            description="Everyone can discover and watch"
            checked={form.visibility === "public"}
            onChange={() => patch({ visibility: "public" })}
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
            label="Private"
            description="Only you and people you choose"
            checked={form.visibility === "private"}
            onChange={() => patch({ visibility: "private" })}
          />
        </div>
      </div>

      {/* ── Category (required) ── */}
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            categoryError ? "bg-[#E8527A]/10" : "bg-[#7C5CFC]/10"
          }`}>
            <Tag className={`h-4 w-4 ${categoryError ? "text-[#E8527A]" : "text-[#7C5CFC]"}`} />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-[#1A1A1A]">
              Category <span className="text-[#E8527A]">*</span>
            </h3>
            <p className="text-[11px] text-[#9E9E9E]">Help viewers discover your content</p>
          </div>
        </div>
        <div className={`rounded-xl border bg-brand-card shadow-sm transition-colors ${
          categoryError ? "border-[#E8527A]/40" : "border-[#E8E6E1]"
        }`}>
          <StudioSelect
            value={form.category}
            onChange={(v) => patch({ category: v })}
            options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            placeholder="Select a category"
          />
        </div>
        {categoryError && (
          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-[#E8527A]">
            <AlertCircle className="h-3.5 w-3.5" />
            Please select a category before publishing
          </div>
        )}
      </div>

      {/* ── Schedule ── */}
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            scheduleError ? "bg-[#E8527A]/10" : "bg-[#7C5CFC]/10"
          }`}>
            <Calendar className={`h-4 w-4 ${scheduleError ? "text-[#E8527A]" : "text-[#7C5CFC]"}`} />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-[#1A1A1A]">Schedule</h3>
            <p className="text-[11px] text-[#9E9E9E]">Publish now or schedule for later</p>
          </div>
        </div>
        <div className={`rounded-xl border bg-brand-card p-4 shadow-sm transition-colors ${
          scheduleError ? "border-[#E8527A]/40" : "border-[#E8E6E1]"
        }`}>
          <ToggleRow
            label="Schedule publish"
            description="Auto-publish at a specific time"
            checked={!!form.scheduleAt}
            onChange={(v) =>
              patch({ scheduleAt: v ? new Date(Date.now() + 86400000).toISOString().slice(0, 16) : null })
            }
          />
          {form.scheduleAt && (
            <div className={`mt-3 flex items-center gap-2 rounded-xl border bg-[#FAFAF8] p-3 ${
              scheduleError ? "border-[#E8527A]/40" : "border-[#E8E6E1]"
            }`}>
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
        {scheduleError && (
          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-[#E8527A]">
            <AlertCircle className="h-3.5 w-3.5" />
            Scheduled time must be in the future
          </div>
        )}
      </div>

      {/* ── Cross-post to Feed ── */}
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7C5CFC]/10">
            <Link2 className="h-4 w-4 text-[#7C5CFC]" />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-[#1A1A1A]">Cross-post</h3>
            <p className="text-[11px] text-[#9E9E9E]">Also share to your Feed</p>
          </div>
        </div>
        <div className="rounded-xl border border-[#E8E6E1] bg-brand-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[#1A1A1A]">Publish to Feed</p>
              <p className="mt-0.5 text-[11px] text-[#9E9E9E]">Share as a post on your Feed</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.crossPostPostbook}
              onClick={() => patch({ crossPostPostbook: !form.crossPostPostbook })}
              className={`relative inline-flex h-7 w-[52px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8527A]/40 ${
                form.crossPostPostbook ? "bg-[#E8527A]" : "bg-[#D1D1D1]"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-brand-card shadow-md transition-transform duration-200 ${
                  form.crossPostPostbook ? "translate-x-[26px]" : "translate-x-[3px]"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
