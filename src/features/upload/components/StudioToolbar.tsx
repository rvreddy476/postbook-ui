"use client";

import { X, Check, FileText, Users, MessageSquare, Wand2, Globe, Loader2, Film } from "lucide-react";
import Link from "next/link";
import { CONTENT_TYPE_META, STEP_META, type ContentType, type StepId } from "../tokens";

interface StudioToolbarProps {
  contentType: ContentType;
  steps: readonly StepId[];
  currentStep: StepId;
  currentStepIndex: number;
  onStepClick: (step: StepId) => void;
  /* publish — only rendered when showPublish is true */
  showPublish: boolean;
  onPublish: () => void;
  isPublishing: boolean;
  checksPass: boolean;
  /* draft */
  onSaveDraft?: () => void;
  isSaving?: boolean;
  hasDraft?: boolean;
  draftSaved?: boolean;
}

const TYPE_BADGE_COLORS: Record<ContentType, string> = {
  reel: "bg-[#F28B6D]/15 text-[#F28B6D] border-[#F28B6D]/30",
  short: "bg-[#E8527A]/15 text-[#E8527A] border-[#E8527A]/30",
  long: "bg-[#7C5CFC]/15 text-[#7C5CFC] border-[#7C5CFC]/30",
  podcast: "bg-[#E5A93D]/15 text-[#E5A93D] border-[#E5A93D]/30",
};

const STEP_ICONS: Record<StepId, typeof FileText> = {
  video: Film,
  details: FileText,
  audience: Users,
  engage: MessageSquare,
  enrich: Wand2,
  publish: Globe,
};

export function StudioToolbar({
  contentType,
  steps,
  currentStep,
  currentStepIndex,
  onStepClick,
  showPublish,
  onPublish,
  isPublishing,
  checksPass,
  onSaveDraft,
  isSaving,
  hasDraft,
  draftSaved,
}: StudioToolbarProps) {
  const config = CONTENT_TYPE_META[contentType];
  const badgeColor = TYPE_BADGE_COLORS[contentType];

  return (
    <div className="flex items-center border-b border-[#E8E6E1] bg-white px-4 py-0">
      {/* ── Left: Close + title + badge ── */}
      <div className="flex items-center gap-2.5 shrink-0 pr-5 border-r border-[#E8E6E1] py-2.5">
        <Link
          href="/reels"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E8E6E1] text-[#9E9E9E] hover:bg-[#F5F4F1] hover:text-[#1A1A1A] transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </Link>
        <h1 className="text-[15px] font-bold text-[#1A1A1A]">Upload Studio</h1>
        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${badgeColor}`}>
          {config.label}
        </span>
      </div>

      {/* ── Center: Step tabs ── */}
      <div className="flex items-center gap-0.5 pl-2">
        {steps.map((stepId, idx) => {
          const meta = STEP_META[stepId];
          const Icon = STEP_ICONS[stepId];
          const isActive = stepId === currentStep;
          const isDone = idx < currentStepIndex;

          return (
            <button
              key={stepId}
              type="button"
              onClick={() => onStepClick(stepId)}
              className={`relative flex items-center gap-1.5 px-3 py-3 text-[12px] font-medium transition-colors ${
                isActive
                  ? "text-[#7C5CFC]"
                  : isDone
                  ? "text-[#2BB5A0]"
                  : "text-[#9E9E9E] hover:text-[#6B6B6B]"
              }`}
            >
              {isDone ? (
                <div className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-[#2BB5A0]">
                  <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                </div>
              ) : (
                <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-[#7C5CFC]" : "text-[#BFBFBF]"}`} />
              )}
              <span>{meta.label}</span>
              {isActive && (
                <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-[#7C5CFC]" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Right: Status + actions ── */}
      <div className="ml-auto flex items-center gap-2.5 shrink-0">
        {checksPass && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-[#2BB5A0]">
            <Check className="h-3 w-3" strokeWidth={2.5} />
            Checks passed
          </span>
        )}

        {draftSaved && (
          <span className="text-[11px] text-[#9E9E9E]">Draft saved</span>
        )}

        {hasDraft && onSaveDraft && !draftSaved && (
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={isSaving}
            className="rounded-lg border border-[#E8E6E1] px-2.5 py-1 text-[11px] font-medium text-[#6B6B6B] hover:bg-[#F5F4F1] disabled:opacity-40 transition-colors"
          >
            {isSaving ? "Saving..." : "Save Draft"}
          </button>
        )}

        {showPublish && (
          <button
            type="button"
            onClick={onPublish}
            disabled={!checksPass || isPublishing}
            className="flex items-center gap-1.5 rounded-lg bg-[#E8527A] px-4 py-1.5 text-[12px] font-bold text-white hover:bg-[#D4426A] disabled:opacity-40 transition-colors"
          >
            {isPublishing && <Loader2 className="h-3 w-3 animate-spin" />}
            Publish
          </button>
        )}
      </div>
    </div>
  );
}
