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

export function PublishStep({ form, patch, showErrors, publishError }: PublishStepProps) {
  const categoryError = showErrors && !form.category;
  const scheduleError = showErrors && form.scheduleAt && new Date(form.scheduleAt) <= new Date();

  return (
    <div className="space-y-7">
      <div className="rounded-xl border border-brand-divider bg-brand-secondary p-4 shadow-sm">
        <p className="text-[13px] font-semibold text-brand-text">Ready to publish</p>
        <p className="mt-1 text-[12px] text-brand-text/60">
          Your video uploads and starts processing when you hit Publish — it becomes
          available to viewers automatically once processing finishes. Nothing is stored
          until you publish.
        </p>
        {publishError && (
          <p className="mt-2 text-[12px] text-rose-500 font-semibold">{publishError}</p>
        )}
      </div>
      {/* ── Visibility ── */}
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-text/10">
            <Globe className="h-4 w-4 text-brand-text" />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-brand-text">Visibility</h3>
            <p className="text-[11px] text-brand-text/50">Who can see this content</p>
          </div>
        </div>
        <div className="space-y-1 rounded-xl border border-brand-text/10 bg-brand-card p-2 shadow-sm">
          <RadioOption
            name="visibility"
            label="Public"
            description="Everyone can discover and watch"
            checked={form.visibility === "public"}
            onChange={() => patch({ visibility: "public" })}
          />
          <div className="border-t border-brand-secondary" />
          <RadioOption
            name="visibility"
            label="Circle Only"
            description="Close friends only"
            checked={form.visibility === "followers"}
            onChange={() => patch({ visibility: "followers" })}
          />
          <div className="border-t border-brand-secondary" />
          <RadioOption
            name="visibility"
            label="Unlisted"
            description="Link access — won't appear in feeds"
            checked={form.visibility === "unlisted"}
            onChange={() => patch({ visibility: "unlisted" })}
          />
          <div className="border-t border-brand-secondary" />
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
            categoryError ? "bg-rose-500/10" : "bg-brand-text/10"
          }`}>
            <Tag className={`h-4 w-4 ${categoryError ? "text-rose-500" : "text-brand-text"}`} />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-brand-text">
              Category <span className="text-rose-500 font-semibold">*</span>
            </h3>
            <p className="text-[11px] text-brand-text/50">Help viewers discover your content</p>
          </div>
        </div>
        <div className={`rounded-xl border bg-brand-card shadow-sm transition-colors ${
          categoryError ? "border-rose-500/40" : "border-brand-divider"
        }`}>
          <StudioSelect
            value={form.category}
            onChange={(v) => patch({ category: v })}
            options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            placeholder="Select a category"
          />
        </div>
        {categoryError && (
          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-rose-500 font-semibold">
            <AlertCircle className="h-3.5 w-3.5" />
            Please select a category before publishing
          </div>
        )}
      </div>

      {/* ── Schedule ── */}
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            scheduleError ? "bg-rose-500/10" : "bg-brand-text/10"
          }`}>
            <Calendar className={`h-4 w-4 ${scheduleError ? "text-rose-500" : "text-brand-text"}`} />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-brand-text">Schedule</h3>
            <p className="text-[11px] text-brand-text/50">Publish now or schedule for later</p>
          </div>
        </div>
        <div className={`rounded-xl border bg-brand-card p-4 shadow-sm transition-colors ${
          scheduleError ? "border-rose-500/40" : "border-brand-divider"
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
            <div className={`mt-3 flex items-center gap-2 rounded-xl border bg-brand-secondary p-3 ${
              scheduleError ? "border-rose-500/40" : "border-brand-divider"
            }`}>
              <Calendar className="h-4 w-4 text-brand-text/50" />
              <input
                type="datetime-local"
                value={form.scheduleAt}
                onChange={(e) => patch({ scheduleAt: e.target.value })}
                className="flex-1 bg-transparent text-[13px] text-brand-text outline-none"
              />
            </div>
          )}
        </div>
        {scheduleError && (
          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-rose-500 font-semibold">
            <AlertCircle className="h-3.5 w-3.5" />
            Scheduled time must be in the future
          </div>
        )}
      </div>

      {/* ── Cross-post to Feed ── */}
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-text/10">
            <Link2 className="h-4 w-4 text-brand-text" />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-brand-text">Cross-post</h3>
            <p className="text-[11px] text-brand-text/50">Also share to your Feed</p>
          </div>
        </div>
        <div className="rounded-xl border border-brand-text/10 bg-brand-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-brand-text">Publish to Feed</p>
              <p className="mt-0.5 text-[11px] text-brand-text/50">Share as a post on your Feed</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.crossPostPostbook}
              onClick={() => patch({ crossPostPostbook: !form.crossPostPostbook })}
              className={`relative inline-flex h-7 w-[52px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/20 ${
                form.crossPostPostbook ? "bg-brand-accent" : "bg-brand-text/20"
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
