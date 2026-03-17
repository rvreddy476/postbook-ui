"use client";

import { Check, FileText, Users, MessageSquare, Wand2, Globe, Film } from "lucide-react";
import { STEP_META, type StepId } from "../tokens";

interface HorizontalStepsProps {
  steps: readonly StepId[];
  currentStep: StepId;
  currentStepIndex: number;
  onStepClick: (step: StepId) => void;
}

const STEP_ICONS: Record<StepId, typeof FileText> = {
  video: Film,
  details: FileText,
  audience: Users,
  engage: MessageSquare,
  enrich: Wand2,
  publish: Globe,
};

export function HorizontalSteps({ steps, currentStep, currentStepIndex, onStepClick }: HorizontalStepsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-[#E8E6E1] bg-brand-card px-6 py-0">
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
            className={`relative flex items-center gap-2 px-4 py-3 text-[13px] font-medium transition-colors ${
              isActive
                ? "text-[#7C5CFC]"
                : isDone
                ? "text-[#2BB5A0]"
                : "text-[#9E9E9E] hover:text-[#6B6B6B]"
            }`}
          >
            {/* Indicator */}
            {isDone ? (
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2BB5A0]">
                <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
              </div>
            ) : (
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-[#7C5CFC]" : "text-[#BFBFBF]"}`} />
            )}

            <span>{meta.label}</span>

            {/* Active underline */}
            {isActive && (
              <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-[#7C5CFC]" />
            )}
          </button>
        );
      })}

      {/* Completion indicator on right */}
      <div className="ml-auto flex items-center gap-2 text-[11px] text-[#9E9E9E]">
        <span>{currentStepIndex}/{steps.length}</span>
        <div className="h-1 w-16 rounded-full bg-[#E8E6E1] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#2BB5A0] transition-all duration-300"
            style={{ width: `${(currentStepIndex / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
