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
    <header className="border-b border-brand-divider bg-brand-card px-4 py-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Step tabs */}
        <div className="flex items-center flex-1 overflow-x-auto py-1 -my-1 scrollbar-none">
          <div className="flex items-center gap-1 min-w-max">
            {steps.map((stepId, idx) => {
              const meta = STEP_META[stepId];
              const isActive = stepId === currentStep;
              const complete = isStepComplete(stepId, form, idx, currentStepIndex);
              const hasErrors = getStepErrors(stepId, form).length > 0;
              const isPast = idx < currentStepIndex;

              return (
                <div key={stepId} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => onStepClick(stepId)}
                    className={`relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition-all ${
                      isActive ? "bg-brand-text/10" : "hover:bg-brand-secondary"
                    } cursor-pointer`}
                  >
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold transition-all ${
                        isActive
                          ? "bg-brand-text text-brand-bg"
                          : complete
                          ? "bg-emerald-500 text-white"
                          : hasErrors && isPast
                          ? "bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/30"
                          : "bg-brand-secondary text-brand-text/50"
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
                      isActive ? "text-brand-text" : complete ? "text-emerald-500" : "text-brand-text/60"
                    }`}>
                      {meta.label}
                    </span>
                    {isActive && (
                      <div className="absolute -bottom-[9px] left-2 right-2 h-[2px] rounded-full bg-brand-text" />
                    )}
                  </button>

                  {idx < steps.length - 1 && (
                    <div className="w-8 mx-1 hidden sm:block">
                      <div className={`h-[1.5px] rounded-full transition-colors ${
                        complete ? "bg-emerald-500" : "bg-brand-divider"
                      }`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 shrink-0">
          {draftSaved && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-semibold mr-1">
              <Check className="h-3 w-3" strokeWidth={3} />
              Saved
            </span>
          )}

          {hasDraft && onSaveDraft && !draftSaved && (
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={isSaving}
              className="rounded-xl border border-brand-divider px-3.5 py-2 text-[11px] font-semibold text-brand-text/60 bg-brand-card hover:bg-brand-secondary disabled:opacity-40 transition-colors"
            >
              {isSaving ? "Saving..." : "Save Draft"}
            </button>
          )}

          {showPublish && (
            <button
              type="button"
              onClick={onPublish}
              disabled={!checksPass || isPublishing}
              className="flex items-center gap-1.5 rounded-xl bg-brand-accent px-4 py-2 text-[11px] font-bold text-brand-bg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
