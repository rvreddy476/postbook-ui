"use client";

import { Check, FileText, Users, MessageSquare, Wand2, Globe, Film } from "lucide-react";
import { STEP_META, type StepId } from "../tokens";

interface LeftStepsProps {
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

export function LeftSteps({ steps, currentStep, currentStepIndex, onStepClick }: LeftStepsProps) {
  const totalSteps = steps.length;
  const completedCount = currentStepIndex;

  return (
    <div className="flex w-[220px] shrink-0 flex-col border-r border-brand-text/10 bg-brand-card">
      {/* Step list */}
      <div className="flex-1 p-4 space-y-1">
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
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                isActive
                  ? "bg-brand-secondary"
                  : "hover:bg-brand-secondary"
              }`}
            >
              {/* Step indicator */}
              {isDone ? (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2BB5A0]">
                  <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                </div>
              ) : isActive ? (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-text/10 border border-brand-text/30">
                  <Icon className="h-3.5 w-3.5 text-brand-text" />
                </div>
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-text/10">
                  <Icon className="h-3.5 w-3.5 text-brand-text/30" />
                </div>
              )}

              <div className="min-w-0">
                <p className={`text-[13px] font-semibold ${isActive ? "text-brand-text" : isDone ? "text-brand-text/60" : "text-brand-text/50"}`}>
                  {meta.label}
                </p>
                <p className={`text-[11px] ${isActive ? "text-brand-text" : "text-brand-text/30"}`}>
                  Step {idx + 1} of {totalSteps}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom: Completion */}
      <div className="border-t border-brand-text/10 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-brand-text/50">Completion</span>
          <span className="text-[11px] font-bold text-brand-text">{completedCount}/{totalSteps}</span>
        </div>
        <div className="h-1.5 rounded-full bg-brand-text/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#2BB5A0] transition-all duration-300"
            style={{ width: `${(completedCount / totalSteps) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
