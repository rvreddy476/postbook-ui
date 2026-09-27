"use client";

import type { ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";

import { clampSpeed, SPEED_MAX, SPEED_MIN, SPEED_STEP, speedChipLabel } from "@/features/reels/playback/playerPrefs";

/*
  The rows of the choice-pane menu: the More card on the reels stage and,
  since W1, the long-video player's settings menu and the watch page's More
  menu. One markup for all of them (reels-screen.css draws it under
  .reel-more-menu): a 40px row with a 20px icon slot and a 14/500 label; a
  choice row adds the current value and a chevron and opens a pane inside
  the same card; a switch row carries the 40×22 switch; an option row is a
  radio with the check in the icon slot; Back is the pane's first row.

  SpeedPanel is YouTube's slider panel as the reels drew it: the readout,
  − / + in 0.05 steps, preset chips with "Normal" under 1.0.

  Extracted from ReelMoreMenu.tsx unchanged; that file still renders the
  same tree through these.
*/

export function ChoiceMenuBack({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="reel-more-menu__row reel-more-menu__back" onClick={onClick}>
      <span className="reel-more-menu__icon"><ChevronLeft /></span>
      <span className="reel-more-menu__label">{label}</span>
    </button>
  );
}

export function ChoiceMenuRow({
  icon,
  label,
  hint,
  onClick,
  danger,
  disabled,
  dataRow,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  dataRow?: string;
}) {
  return (
    <button type="button" role="menuitem" disabled={disabled} onClick={onClick} data-row={dataRow} className={`reel-more-menu__row${danger ? " is-danger" : ""}`}>
      <span className="reel-more-menu__icon">{icon}</span>
      <span className="reel-more-menu__label">
        <span className="reel-more-menu__title">{label}</span>
        {hint ? <span className="reel-more-menu__hint">{hint}</span> : null}
      </span>
    </button>
  );
}

/** A row that opens a pane: label, the current value, a chevron. */
export function ChoiceMenuChoiceRow({
  icon,
  label,
  value,
  onClick,
  disabled,
  dataRow,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onClick: () => void;
  disabled?: boolean;
  dataRow?: string;
}) {
  return (
    <button type="button" role="menuitem" aria-haspopup="menu" disabled={disabled} onClick={onClick} data-row={dataRow} className="reel-more-menu__row">
      <span className="reel-more-menu__icon">{icon}</span>
      <span className="reel-more-menu__label">
        <span className="reel-more-menu__title">{label}</span>
      </span>
      <span className="reel-more-menu__value">
        {value}
        <ChevronRight />
      </span>
    </button>
  );
}

export function ChoiceMenuSwitchRow({
  icon,
  label,
  hint,
  on,
  onToggle,
  disabled,
  dataRow,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  dataRow?: string;
}) {
  return (
    <button type="button" role="menuitemcheckbox" aria-checked={on} disabled={disabled} onClick={onToggle} data-row={dataRow} className="reel-more-menu__row">
      <span className="reel-more-menu__icon">{icon}</span>
      <span className="reel-more-menu__label">
        <span className="reel-more-menu__title">{label}</span>
        {hint ? <span className="reel-more-menu__hint">{hint}</span> : null}
      </span>
      <span className="reel-more-menu__switch" data-on={on ? "" : undefined} aria-hidden>
        <span className="reel-more-menu__knob" />
      </span>
    </button>
  );
}

export function ChoiceMenuOption({ label, selected, onClick, hint }: { label: string; selected: boolean; onClick: () => void; hint?: string }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={selected} onClick={onClick} className="reel-more-menu__row">
      <span className="reel-more-menu__icon">{selected ? <Check /> : null}</span>
      <span className="reel-more-menu__label">
        {hint ? (
          <>
            <span className="reel-more-menu__title">{label}</span>
            <span className="reel-more-menu__hint">{hint}</span>
          </>
        ) : (
          label
        )}
      </span>
    </button>
  );
}

/** The speed pane's body: readout, − slider +, preset chips. */
export function SpeedPanel({ speed, presets, onChange }: { speed: number; presets: readonly number[]; onChange: (speed: number) => void }) {
  const set = (s: number) => onChange(clampSpeed(s));
  return (
    <div className="reel-speed-panel" role="group" aria-label="Playback speed">
      <div className="reel-speed-panel__readout" aria-live="polite">{speedChipLabel(speed)}x</div>
      <div className="reel-speed-panel__slider">
        <button type="button" aria-label="Slower" disabled={speed <= SPEED_MIN} onClick={() => set(speed - SPEED_STEP)}><Minus /></button>
        <input
          type="range"
          min={SPEED_MIN}
          max={SPEED_MAX}
          step={SPEED_STEP}
          value={speed}
          aria-label="Playback speed"
          aria-valuetext={`${speedChipLabel(speed)}x`}
          onChange={(e) => set(Number(e.target.value))}
        />
        <button type="button" aria-label="Faster" disabled={speed >= SPEED_MAX} onClick={() => set(speed + SPEED_STEP)}><Plus /></button>
      </div>
      <div className="reel-speed-panel__chips" role="radiogroup" aria-label="Preset speeds">
        {presets.map((s) => (
          <span key={s} className="reel-speed-panel__chip-wrap">
            <button type="button" role="radio" aria-checked={speed === s} className="reel-more-menu__chip" onClick={() => set(s)}>
              {speedChipLabel(s)}
            </button>
            {s === 1 ? <span className="reel-speed-panel__normal">Normal</span> : null}
          </span>
        ))}
      </div>
    </div>
  );
}
