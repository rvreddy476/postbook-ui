"use client";

import { useCallback, useRef, useState, type Ref } from "react";
import { Music, Plus, RefreshCw, Volume2, X } from "lucide-react";

import { SoundPreviewButton, useSoundPreview, type SoundPreviewState } from "@/features/reels/components/SoundPreview";
import type { SoundInfo } from "@/features/reels/sounds";

import type { StudioFormState } from "../types";
import { SoundPickerSheet } from "./SoundPickerSheet";

type AudioForm = Pick<StudioFormState, "audioTrack" | "originalAudioVolume" | "overlayAudioVolume">;

interface StudioSoundViewProps {
  form: AudioForm;
  patch: (u: Partial<StudioFormState>) => void;
  /** One line when the asked-for sound cannot be used. */
  notice?: string | null;
  onRemove: () => void;
  preview: SoundPreviewState;
  onTogglePreview: () => void;
  /** Opens the sound picker; absent = no Add / Change button. */
  onOpenPicker?: () => void;
  /** The Add / Change button, so focus can come back to it when the picker closes. */
  pickerButtonRef?: Ref<HTMLButtonElement>;
  /** Whether the picker is open (the button's aria-expanded). */
  pickerOpen?: boolean;
}

/*
  The Audio section's body. With a sound chosen: its name and creator, a
  preview that plays it alone, Change, Remove, and the two levels — the
  reel's own audio and the sound. With none: the reel uses its own audio,
  Add sound, and only that level is shown. A sound that could not be loaded
  is one plain line; the studio carries on as if none was chosen.
*/
export function StudioSoundView({ form, patch, notice, onRemove, preview, onTogglePreview, onOpenPicker, pickerButtonRef, pickerOpen = false }: StudioSoundViewProps) {
  const track = form.audioTrack;
  const pickerButton = onOpenPicker ? (
    <button
      ref={pickerButtonRef}
      type="button"
      onClick={onOpenPicker}
      aria-haspopup="dialog"
      aria-expanded={pickerOpen}
      data-action={track ? "change-sound" : "add-sound"}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-text/10 px-3 py-1.5 text-[12px] font-semibold text-brand-text/70 transition-colors hover:bg-brand-card hover:text-brand-text"
    >
      {track ? <RefreshCw className="h-3.5 w-3.5" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
      {track ? "Change sound" : "Add sound"}
    </button>
  ) : null;
  return (
    <div className="space-y-4" data-studio-sound={track ? "chosen" : "none"}>
      {notice ? (
        <p role="status" className="text-[12px] text-brand-text/60" data-studio-sound-notice>
          {notice}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-brand-secondary border border-brand-text/10 px-4 py-3">
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
            {pickerButton}
            <button
              type="button"
              onClick={onRemove}
              data-action="remove-sound"
              aria-label="Remove sound"
              className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-brand-text/60 transition-colors hover:bg-brand-card hover:text-brand-text"
            >
              <X className="h-3.5 w-3.5" />
              Remove
            </button>
          </>
        ) : (
          pickerButton
        )}
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

type StudioSoundSectionProps = Omit<StudioSoundViewProps, "preview" | "onTogglePreview" | "onOpenPicker" | "pickerButtonRef" | "pickerOpen"> & {
  /** Put a sound picked in the studio on the reel; absent = no picker (long video). */
  onChoose?: (sound: SoundInfo) => void;
};

/** The section with its own preview player, and the sound picker when the studio takes sounds. */
export function StudioSoundSection({ onChoose, ...props }: StudioSoundSectionProps) {
  const preview = useSoundPreview(props.form.audioTrack?.id ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerButtonRef = useRef<HTMLButtonElement>(null);

  const openPicker = useCallback(() => {
    // One sound at a time: the chosen sound's preview stops while the picker plays its own.
    if (preview.state === "playing") preview.toggle();
    setPickerOpen(true);
  }, [preview]);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    // Focus goes back to the button that opened the picker (Add becomes Change on the same element).
    requestAnimationFrame(() => pickerButtonRef.current?.focus());
  }, []);

  return (
    <>
      <StudioSoundView
        {...props}
        preview={preview.state}
        onTogglePreview={preview.toggle}
        onOpenPicker={onChoose ? openPicker : undefined}
        pickerButtonRef={pickerButtonRef}
        pickerOpen={pickerOpen}
      />
      {preview.element}
      {onChoose && pickerOpen ? <SoundPickerSheet onClose={closePicker} onChoose={onChoose} chosenTrackId={props.form.audioTrack?.id ?? null} /> : null}
    </>
  );
}
