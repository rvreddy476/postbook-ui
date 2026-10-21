"use client";

import { useEffect, useRef } from "react";
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

/*
  The steps as one row of buttons. Wide: they share the row. Narrow: the
  row scrolls sideways (the current step is kept in view) under a
  "Step 2 of 3" line, so a phone never scrolls the page sideways.
*/
export function StudioToolbar({ steps, currentStep, currentStepIndex, onStepClick, form, disabled }: StudioToolbarProps) {
  const currentRef = useRef<HTMLButtonElement>(null);
  // Keep the current step in view inside the row only; the page itself does not move.
  useEffect(() => {
    const button = currentRef.current;
    const row = button?.closest("ol");
    if (!button || !row || row.scrollWidth <= row.clientWidth) return;
    const left = button.offsetLeft;
    const right = left + button.offsetWidth;
    if (left < row.scrollLeft || right > row.scrollLeft + row.clientWidth) row.scrollTo({ left: Math.max(0, left - 8) });
  }, [currentStep]);
  return <nav className="upload-steps" aria-label="Upload steps">
    <p className="upload-steps-count" aria-hidden="true">Step {currentStepIndex + 1} of {steps.length} · <strong>{STEP_META[currentStep].label}</strong></p>
    <ol>
      {steps.map((step, index) => {
        const complete = isStepComplete(step, form, index, currentStepIndex);
        const current = step === currentStep;
        return <li key={step}>
          <button type="button" ref={current ? currentRef : undefined} onClick={() => onStepClick(step)} disabled={disabled}
            aria-current={current ? "step" : undefined}
            aria-label={`${index + 1}. ${STEP_META[step].label}${complete ? ", complete" : ""}`}
            data-complete={complete || undefined}>
            <span className="upload-step-number" aria-hidden="true">{complete && !current ? <Check /> : index + 1}</span>
            <span>{STEP_META[step].label}</span>
          </button>
        </li>;
      })}
    </ol>
  </nav>;
}
