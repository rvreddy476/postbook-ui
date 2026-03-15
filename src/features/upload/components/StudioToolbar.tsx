"use client";

import { Check, Loader2, AlertCircle } from "lucide-react";
import { STEP_META, type ContentType, type StepId } from "../tokens";
import type { StudioFormState } from "../types";
import { isStepComplete, getStepErrors } from "../validation";

interface StudioToolbarProps {
  contentType: ContentType;
  steps: readonly StepId[];
  currentStep: StepId;
  currentStepIndex: number;
  onStepClick: (step: StepId) => void;
  form: StudioFormState;
  /* publish */
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

export function StudioToolbar({
  contentType,
  steps,
  currentStep,
  currentStepIndex,
  onStepClick,
  form,
  showPublish,
  onPublish,
  isPublishing,
  checksPass,
  onSaveDraft,
  isSaving,
  hasDraft,
  draftSaved,
}: StudioToolbarProps) {

  return (
    <header className="border-b border-[#E8E6E1] bg-white px-4 py-1.5">
      <div className="flex items-center gap-2">
        {/* Step tabs */}
        <div className="flex items-center flex-1 min-w-0">
          {steps.map((stepId, idx) => {
            const meta = STEP_META[stepId];
            const isActive = stepId === currentStep;
            const complete = isStepComplete(stepId, form, idx, currentStepIndex);
            const hasErrors = getStepErrors(stepId, form).length > 0;
            const isPast = idx < currentStepIndex;

            return (
              <div key={stepId} className="flex items-center flex-1 last:flex-none">
                <button
                  type="button"
                  onClick={() => onStepClick(stepId)}
                  className={`relative flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-all ${
                    isActive ? "bg-[#7C5CFC]/8" : "hover:bg-[#F5F4F1]"
                  } cursor-pointer`}
                >
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold transition-all ${
                      isActive
                        ? "bg-[#7C5CFC] text-white"
                        : complete
                        ? "bg-[#2BB5A0] text-white"
                        : hasErrors && isPast
                        ? "bg-[#E8527A]/10 text-[#E8527A] ring-1 ring-[#E8527A]/30"
                        : "bg-[#F0EEE9] text-[#9E9E9E]"
                    }`}
                  >
                    {complete && !isActive ? (
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    ) : hasErrors && isPast ? (
                      <AlertCircle className="h-2.5 w-2.5" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span className={`text-[11px] font-semibold hidden sm:inline ${
                    isActive ? "text-[#7C5CFC]" : complete ? "text-[#2BB5A0]" : "text-[#6B6B6B]"
                  }`}>
                    {meta.label}
                  </span>
                  {isActive && (
                    <div className="absolute -bottom-[7px] left-2 right-2 h-[2px] rounded-full bg-[#7C5CFC]" />
                  )}
                </button>

                {idx < steps.length - 1 && (
                  <div className="flex-1 mx-0.5 hidden sm:block">
                    <div className={`h-[1.5px] rounded-full transition-colors ${
                      complete ? "bg-[#2BB5A0]" : "bg-[#E8E6E1]"
                    }`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {draftSaved && (
            <span className="flex items-center gap-1 text-[10px] text-[#2BB5A0]">
              <Check className="h-2.5 w-2.5" strokeWidth={2.5} />
              Saved
            </span>
          )}

          {hasDraft && onSaveDraft && !draftSaved && (
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={isSaving}
              className="rounded-md border border-[#E8E6E1] px-2.5 py-1 text-[11px] font-medium text-[#6B6B6B] hover:bg-[#F5F4F1] disabled:opacity-40 transition-colors"
            >
              {isSaving ? "Saving..." : "Save Draft"}
            </button>
          )}

          {showPublish && (
            <button
              type="button"
              onClick={onPublish}
              disabled={!checksPass || isPublishing}
              className="flex items-center gap-1 rounded-lg bg-[#7C5CFC] px-4 py-1.5 text-[11px] font-bold text-white hover:bg-[#6A4AE8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isPublishing && <Loader2 className="h-3 w-3 animate-spin" />}
              Publish
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
