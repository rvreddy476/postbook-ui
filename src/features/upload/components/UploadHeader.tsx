"use client";

import { X, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { CONTENT_TYPE_META, type ContentType } from "../tokens";

interface UploadHeaderProps {
  contentType: ContentType;
  onPublish: () => void;
  isPublishing: boolean;
  onSaveDraft?: () => void;
  isSaving?: boolean;
  hasDraft?: boolean;
  checksPass?: boolean;
  draftSaved?: boolean;
}

const TYPE_BADGE_COLORS: Record<ContentType, string> = {
  reel: "bg-orange-500/15 text-orange-600 border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20",
  short: "bg-rose-500/15 text-rose-600 border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20",
  long: "bg-brand-text/15 text-brand-text border-brand-text/30",
  podcast: "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
};

export function UploadHeader({
  contentType,
  onPublish,
  isPublishing,
  onSaveDraft,
  isSaving,
  hasDraft,
  checksPass,
  draftSaved,
}: UploadHeaderProps) {
  const config = CONTENT_TYPE_META[contentType];
  const badgeColor = TYPE_BADGE_COLORS[contentType];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-text/10 bg-brand-card px-4 py-3 sm:px-5 sm:py-2.5">
      {/* Left: Close + title + badge */}
      <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
        <div className="flex items-center gap-3">
          <Link
            href="/reels"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-text/10 text-brand-text/50 hover:bg-brand-secondary hover:text-brand-text transition-colors"
          >
            <X className="h-4 w-4" />
          </Link>
          <h1 className="text-[15px] sm:text-[16px] font-bold text-brand-text">Upload Studio</h1>
          <span className={`rounded-md border px-2 py-0.5 text-[10px] sm:text-[11px] font-bold uppercase ${badgeColor}`}>
            {config.label}
          </span>
        </div>
      </div>

      {/* Right: Status + actions */}
      <div className="flex flex-wrap items-center justify-end gap-2.5 sm:gap-3 w-full sm:w-auto">
        {checksPass && (
          <span className="flex items-center gap-1.5 text-[11px] sm:text-[12px] font-medium text-emerald-500 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            Checks passed
          </span>
        )}

        {draftSaved && (
          <span className="rounded-lg border border-brand-text/10 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-[12px] text-brand-text/50">
            Draft saved
          </span>
        )}

        {hasDraft && onSaveDraft && !draftSaved && (
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={isSaving}
            className="rounded-lg border border-brand-text/10 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-[12px] font-medium text-brand-text/60 hover:bg-brand-secondary disabled:opacity-40 transition-colors"
          >
            {isSaving ? "Saving..." : "Save Draft"}
          </button>
        )}

        <button
          type="button"
          onClick={onPublish}
          disabled={!checksPass || isPublishing}
          className="flex items-center gap-1.5 rounded-lg bg-brand-accent px-4 py-1.5 sm:px-5 sm:py-2 text-[12px] sm:text-[13px] font-bold text-brand-bg hover:opacity-90 disabled:opacity-40 transition-all active:scale-[0.98]"
        >
          {isPublishing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Publish
        </button>
      </div>
    </div>
  );
}
