"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Popover } from "@/features/reels/components/Popover";
import { SPEEDS, type PlayerPrefs, type Speed } from "@/features/reels/playback/playerPrefs";

interface ReelSettingsMenuProps {
  open: boolean;
  onClose: () => void;
  prefs: PlayerPrefs;
  onChange: (patch: Partial<PlayerPrefs>) => void;
  /** Heights the current manifest offers; empty = Auto only. */
  qualityHeights: number[];
  captionsAvailable: "unknown" | "yes" | "no";
}

type Pane = "root" | "quality" | "speed";

/*
  Quality, speed, captions and what happens at the end of a reel — the four
  things a viewer changes, in the two-level layout YouTube uses so the root
  pane stays four rows tall.
*/
export function ReelSettingsMenu({ open, onClose, prefs, onChange, qualityHeights, captionsAvailable }: ReelSettingsMenuProps) {
  const [pane, setPane] = useState<Pane>("root");
  const close = () => {
    setPane("root");
    onClose();
  };
  const rungs = Array.from(new Set(qualityHeights)).sort((a, b) => b - a);
  const qualityLabel = prefs.quality === "auto" ? "Auto" : prefs.quality;

  return (
    <Popover open={open} onClose={close} align="right" placement="down" label="Playback settings">
      {pane === "root" ? (
        <div className="py-1">
          <Row label="Quality" value={qualityLabel} onClick={() => setPane("quality")} />
          <Row label="Playback speed" value={prefs.speed === 1 ? "Normal" : `${prefs.speed}×`} onClick={() => setPane("speed")} />
          <ToggleRow
            label="Captions"
            hint={captionsAvailable === "no" ? "None for this reel" : undefined}
            on={prefs.captions}
            onToggle={() => onChange({ captions: !prefs.captions })}
          />
          <ToggleRow
            label="Auto-advance"
            hint={prefs.onEnd === "next" ? "Plays the next reel when this ends" : "Replays this reel"}
            on={prefs.onEnd === "next"}
            onToggle={() => onChange({ onEnd: prefs.onEnd === "next" ? "loop" : "next" })}
          />
        </div>
      ) : pane === "quality" ? (
        <div className="py-1">
          <Back label="Quality" onClick={() => setPane("root")} />
          <Option label="Auto" selected={prefs.quality === "auto"} onClick={() => onChange({ quality: "auto" })} />
          {rungs.map((h) => (
            <Option key={h} label={`${h}p`} selected={prefs.quality === `${h}p`} onClick={() => onChange({ quality: `${h}p` })} />
          ))}
          {rungs.length === 0 ? <p className="px-4 py-2 text-[11px] text-text-muted">Only Auto is available for this reel.</p> : null}
        </div>
      ) : (
        <div className="py-1">
          <Back label="Playback speed" onClick={() => setPane("root")} />
          {SPEEDS.map((s) => (
            <Option key={s} label={s === 1 ? "Normal" : `${s}×`} selected={prefs.speed === s} onClick={() => onChange({ speed: s as Speed })} />
          ))}
        </div>
      )}
    </Popover>
  );
}

function Row({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className="flex w-full items-center justify-between px-4 py-3 text-[13px] font-medium hover:bg-brand-secondary">
      <span>{label}</span>
      <span className="flex items-center gap-1 text-text-muted">
        {value} <ChevronRight className="h-4 w-4" />
      </span>
    </button>
  );
}

function ToggleRow({ label, hint, on, onToggle }: { label: string; hint?: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" role="menuitemcheckbox" aria-checked={on} onClick={onToggle} className="flex w-full items-center justify-between px-4 py-3 text-[13px] font-medium hover:bg-brand-secondary">
      <span className="min-w-0">
        <span className="block">{label}</span>
        {hint ? <span className="block text-[11px] font-normal text-text-muted">{hint}</span> : null}
      </span>
      <span className={`relative ml-3 h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-brand-accent" : "bg-brand-divider"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function Back({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 border-b border-border px-3 py-2.5 text-[13px] font-semibold hover:bg-brand-secondary">
      <ChevronLeft className="h-4 w-4" /> {label}
    </button>
  );
}

function Option({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={selected} onClick={onClick} className="flex w-full items-center justify-between px-4 py-2.5 text-[13px] hover:bg-brand-secondary">
      <span className={selected ? "font-semibold" : ""}>{label}</span>
      {selected ? <Check className="h-4 w-4 text-brand-accent" /> : null}
    </button>
  );
}
