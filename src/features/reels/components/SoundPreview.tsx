"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";

import { soundServeHref } from "@/features/reels/sounds";

/** "idle": not playing. "playing": the sound is heard. "failed": it could not be loaded. */
export type SoundPreviewState = "idle" | "playing" | "failed";

export function soundPreviewLabel(state: SoundPreviewState): string {
  if (state === "failed") return "Preview unavailable";
  return state === "playing" ? "Pause" : "Preview";
}

/*
  The preview button: plays the sound alone, pauses it on a second press.
  The view only; useSoundPreview below owns the element. A sound that
  cannot be loaded disables the button and says so in its own label —
  nothing else is raised.
*/
export function SoundPreviewButton({ state, onToggle, className }: { state: SoundPreviewState; onToggle: () => void; className?: string }) {
  return (
    <button type="button" className={className} data-preview={state} aria-pressed={state === "playing"} disabled={state === "failed"} onClick={onToggle}>
      {state === "playing" ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}
      {soundPreviewLabel(state)}
    </button>
  );
}

/**
 * One sound, played alone. Nothing is fetched until the first press. The
 * element is returned for the caller to place anywhere in its tree; it is
 * stopped when the sound changes and when the caller goes away.
 */
export function useSoundPreview(soundId: string | null): { state: SoundPreviewState; toggle: () => void; element: ReactNode } {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [state, setState] = useState<SoundPreviewState>("idle");

  useEffect(() => {
    setState("idle");
    const audio = audioRef.current;
    return () => {
      audio?.pause();
    };
  }, [soundId]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    void audio.play().catch((err: unknown) => {
      // A pause that interrupted the start is not a failure.
      if ((err as { name?: string })?.name !== "AbortError") setState("failed");
    });
  }, []);

  const element = soundId ? (
    <audio
      ref={audioRef}
      src={soundServeHref(soundId)}
      preload="none"
      hidden
      aria-hidden
      onPlay={() => setState("playing")}
      onPause={() => setState((s) => (s === "failed" ? s : "idle"))}
      onEnded={() => setState("idle")}
      onError={() => setState("failed")}
    />
  ) : null;

  return { state, toggle, element };
}
