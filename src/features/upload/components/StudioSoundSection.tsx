"use client";

import { Music, Volume2, X } from "lucide-react";

import { SoundPreviewButton, useSoundPreview, type SoundPreviewState } from "@/features/reels/components/SoundPreview";

import type { StudioFormState } from "../types";

type AudioForm = Pick<StudioFormState, "audioTrack" | "originalAudioVolume" | "overlayAudioVolume">;

interface StudioSoundViewProps {
  form: AudioForm;
  patch: (u: Partial<StudioFormState>) => void;
  /** One line when the asked-for sound cannot be used. */
  notice?: string | null;
  onRemove: () => void;
  preview: SoundPreviewState;
  onTogglePreview: () => void;
}

/*
  The Audio section's body. With a sound chosen: its name and creator, a
  preview that plays it alone, Remove, and the two levels — the reel's own
  audio and the sound. With none: the reel uses its own audio, and only
  that level is shown. A sound that could not be loaded is one plain line;
  the studio carries on as if none was chosen.
*/
export function StudioSoundView({ form, patch, notice, onRemove, preview, onTogglePreview }: StudioSoundViewProps) {
  const track = form.audioTrack;
  return (
    <div className="space-y-4" data-studio-sound={track ? "chosen" : "none"}>
      {notice ? (
        <p role="status" className="text-[12px] text-brand-text/60" data-studio-sound-notice>
          {notice}
        </p>
      ) : null}
      <div className="flex items-center gap-3 rounded-xl bg-brand-secondary border border-brand-text/10 px-4 py-3">
        <Music className="h-4 w-4 shrink-0 text-brand-text/50" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-brand-text/80">{track ? track.title : "Original audio will be used"}</p>
          {track ? <p className="truncate text-[11px] text-brand-text/50">{track.artist ? `Sound · ${track.artist}` : "Sound"}</p> : null}
        </div>
        {track ? (
          <>
            <SoundPreviewButton
              state={preview}
              onToggle={onTogglePreview}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-text/10 px-3 py-1.5 text-[12px] font-semibold text-brand-text/70 transition-colors hover:bg-brand-card disabled:opacity-50"
            />
            <button
              type="button"
              onClick={onRemove}
              data-action="remove-sound"
              className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-brand-text/60 transition-colors hover:bg-brand-card hover:text-brand-text"
            >
              <X className="h-3.5 w-3.5" />
              Remove
            </button>
          </>
        ) : null}
      </div>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Volume2 className="h-3.5 w-3.5 text-brand-text/50" />
          <span className="text-[12px] text-brand-text/60">Original Audio</span>
          <span className="ml-auto text-[11px] font-mono text-brand-text/50">{Math.round(form.originalAudioVolume * 100)}%</span>
        </div>
        <input
          type="range" min={0} max={1} step={0.05}
          aria-label="Original audio volume"
          value={form.originalAudioVolume}
          onChange={(e) => patch({ originalAudioVolume: Number(e.target.value) })}
          className="w-full accent-brand-text"
        />
      </div>
      {track && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Volume2 className="h-3.5 w-3.5 text-brand-text/50" />
            <span className="text-[12px] text-brand-text/60">Sound</span>
            <span className="ml-auto text-[11px] font-mono text-brand-text/50">{Math.round(form.overlayAudioVolume * 100)}%</span>
          </div>
          <input
            type="range" min={0} max={1} step={0.05}
            aria-label="Sound volume"
            value={form.overlayAudioVolume}
            onChange={(e) => patch({ overlayAudioVolume: Number(e.target.value) })}
            className="w-full accent-brand-text"
          />
        </div>
      )}
    </div>
  );
}

/** The section with its own preview player. */
export function StudioSoundSection(props: Omit<StudioSoundViewProps, "preview" | "onTogglePreview">) {
  const preview = useSoundPreview(props.form.audioTrack?.id ?? null);
  return (
    <>
      <StudioSoundView {...props} preview={preview.state} onTogglePreview={preview.toggle} />
      {preview.element}
    </>
  );
}
