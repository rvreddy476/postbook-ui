"use client";

import { useEffect } from "react";

import type { ReelItem } from "@/features/reels/model";
import { preloadHlsStart, preloadRung } from "./hlsPreload";
import type { QualityPref } from "./playerPrefs";

/** Waits this long after a swipe, so the reel on screen gets the network first. */
export const PRELOAD_DELAY_MS = 800;

/** What the stage preloads for the reel after the one on screen; null = nothing. */
export function preloadTarget(next: ReelItem | null | undefined, dataSaver: boolean): string | null {
  if (!next || dataSaver || next.locked || next.isProcessing) return null;
  return next.media.hlsUrl || null;
}

/** The preferred height for the preload's rung; null = Auto. */
export function preferredHeight(quality: QualityPref): number | null {
  if (quality === "auto") return null;
  const n = parseInt(quality, 10);
  return Number.isFinite(n) ? n : null;
}

/**
  Preloads the next reel's master, one child playlist and its first segment
  (hlsPreload.ts), so a swipe starts from memory (reels-46). Off under Data
  saver. Cancelled when the viewer moves on before it finishes.
*/
export function useNextReelPreload(next: ReelItem | null | undefined, quality: QualityPref, dataSaver: boolean): void {
  const target = preloadTarget(next, dataSaver);
  useEffect(() => {
    if (!target) return;
    const abort = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = setTimeout(() => {
      void preloadHlsStart(target, (heights) => preloadRung(preferredHeight(quality), heights), { signal: abort?.signal });
    }, PRELOAD_DELAY_MS);
    return () => {
      clearTimeout(timer);
      abort?.abort();
    };
  }, [target, quality]);
}
