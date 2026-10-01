"use client";

import { Check } from "lucide-react";
import { STEP_META, type StepId } from "../tokens";
import type { StudioFormState } from "../types";
import { isStepComplete } from "../validation";

interface StudioToolbarProps {
  steps: readonly StepId[];
  currentStep: StepId;
  currentStepIndex: number;
  onStepClick: (step: StepId) => void;
  form: StudioFormState;
  disabled?: boolean;
}

export function StudioToolbar({ steps, currentStep, currentStepIndex, onStepClick, form, disabled }: StudioToolbarProps) {
  return <nav className="upload-steps" aria-label="Upload steps">
    <ol style={{ "--upload-step-count": steps.length } as React.CSSProperties}>
      {steps.map((step, index) => {
        const complete = isStepComplete(step, form, index, currentStepIndex);
        return <li key={step}>
          <button type="button" onClick={() => onStepClick(step)} disabled={disabled}
            aria-current={step === currentStep ? "step" : undefined}
            aria-label={`${index + 1}. ${STEP_META[step].label}${complete ? ", complete" : ""}`}
            data-complete={complete || undefined}>
            <span className="upload-step-number">{complete && step !== currentStep ? <Check aria-hidden="true" /> : index + 1}</span>
            <span>{STEP_META[step].label}</span>
          </button>
        </li>;
      })}
    </ol>
  </nav>;
}
