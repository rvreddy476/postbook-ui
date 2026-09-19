'use client';

import React from 'react';
import { motion } from 'framer-motion';

export type Segment = {
  id: string;
  label: React.ReactNode;
  /** Optional trailing count or badge, rendered muted beside the label. */
  badge?: React.ReactNode;
};

interface SegmentedControlProps {
  segments: Segment[];
  value: string;
  onChange: (id: string) => void;
  /** Unique across mounted instances — the sliding pill is matched by it. */
  layoutId: string;
  size?: 'sm' | 'md';
  className?: string;
  'aria-label'?: string;
}

/**
 * A pick-one-of-N control.
 *
 * Deliberately NOT the accent colour. The accent means "this is the action"
 * (Post, Sign in, Follow); if a tab strip uses it too, the real actions stop
 * standing out. So the track is a recessed neutral and the selection is a
 * RAISED white pill — the selection reads as a position you moved to rather
 * than a colour that was applied.
 *
 * The pill is one shared element that slides between segments via framer's
 * layout animation, so switching is continuous instead of one pill vanishing
 * and another appearing. The spring is critically damped (no overshoot),
 * which is right for a control that should feel precise rather than playful.
 *
 * Interruptible by construction: clicking mid-flight re-targets the same
 * element from wherever it currently is, carrying its velocity, instead of
 * snapping back and starting again.
 */
export default function SegmentedControl({
  segments,
  value,
  onChange,
  layoutId,
  size = 'md',
  className = '',
  'aria-label': ariaLabel,
}: SegmentedControlProps) {
  const pad = size === 'sm' ? 'p-0.5' : 'p-1';
  const seg = size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm';

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center rounded-full bg-brand-secondary ${pad} ${className}`}
    >
      {segments.map((s) => {
        const selected = s.id === value;
        return (
          <button
            key={s.id}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(s.id)}
            // The label sits above the sliding pill, so it never gets painted over.
            className={`relative rounded-full font-semibold transition-colors duration-200 ${seg} ${
              selected ? 'text-brand-text' : 'text-brand-text/55 hover:text-brand-text/80'
            }`}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 -z-0 rounded-full bg-brand-bg shadow-xs"
                // damping 1.0 equivalent: no overshoot. A segmented control
                // that bounces reads as imprecise.
                transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.9 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5 whitespace-nowrap">
              {s.label}
              {s.badge != null && (
                <span className="text-[11px] font-medium text-brand-text/45">{s.badge}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
