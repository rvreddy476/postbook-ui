"use client";

import { useCallback, useEffect, useState } from "react";

import { DEFAULT_PREFS, loadPrefs, savePrefs, type PlayerPrefs, type PrefsPatch } from "@/features/reels/playback/playerPrefs";

/** React binding for the persisted playback preferences. */
export function usePlayerPrefs() {
  // Server and first client render agree on the defaults; the stored
  // choice is applied after mount so hydration never mismatches.
  const [prefs, setPrefs] = useState<PlayerPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  // A function patch reads the latest prefs, so rapid +/- presses never use a stale value.
  const update = useCallback((patch: PrefsPatch) => {
    setPrefs((prev) => {
      const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
      savePrefs(next);
      return next;
    });
  }, []);

  return { prefs, update };
}
