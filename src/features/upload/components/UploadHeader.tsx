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
  reel: "bg-[#F28B6D]/15 text-[#F28B6D] border-[#F28B6D]/30",
  short: "bg-[#E8527A]/15 text-[#E8527A] border-[#E8527A]/30",
  long: "bg-[#7C5CFC]/15 text-[#7C5CFC] border-[#7C5CFC]/30",
  podcast: "bg-[#E5A93D]/15 text-[#E5A93D] border-[#E5A93D]/30",
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
    <div className="flex items-center justify-between border-b border-[#E8E6E1] bg-white px-5 py-2.5">
      {/* Left: Close + title + badge */}
      <div className="flex items-center gap-3">
        <Link
          href="/reels"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E8E6E1] text-[#9E9E9E] hover:bg-[#F5F4F1] hover:text-[#1A1A1A] transition-colors"
        >
          <X className="h-4 w-4" />
        </Link>
        <h1 className="text-[16px] font-bold text-[#1A1A1A]">Upload Studio</h1>
        <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase ${badgeColor}`}>
          {config.label}
        </span>
      </div>

      {/* Right: Status + actions */}
      <div className="flex items-center gap-3">
        {checksPass && (
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#2BB5A0]">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            Checks passed
          </span>
        )}

        {draftSaved && (
          <span className="rounded-lg border border-[#E8E6E1] px-3 py-1.5 text-[12px] text-[#9E9E9E]">
            Draft saved
          </span>
        )}

        {hasDraft && onSaveDraft && !draftSaved && (
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={isSaving}
            className="rounded-lg border border-[#E8E6E1] px-3 py-1.5 text-[12px] font-medium text-[#6B6B6B] hover:bg-[#F5F4F1] disabled:opacity-40 transition-colors"
          >
            {isSaving ? "Saving..." : "Save Draft"}
          </button>
        )}

        <button
          type="button"
          onClick={onPublish}
          disabled={!checksPass || isPublishing}
          className="flex items-center gap-1.5 rounded-lg bg-[#E8527A] px-5 py-2 text-[13px] font-bold text-white hover:bg-[#D4426A] disabled:opacity-40 transition-colors"
        >
          {isPublishing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Publish
        </button>
      </div>
    </div>
  );
}
