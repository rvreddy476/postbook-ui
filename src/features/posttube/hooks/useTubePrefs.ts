"use client";

import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_TUBE_PREFS,
  parseTubePrefs,
  readAutoplayNextPref,
  TUBE_PREFS_KEY,
  writeAutoplayNextPref,
  type TubePlayerPrefs,
} from "../model";

/** Quality / speed / captions / volume, in localStorage under `posttube_player_prefs_v1`. */
export function useTubePrefs() {
  // Server and first client render agree on the defaults; the stored
  // choice is applied after mount so hydration never mismatches.
  const [prefs, setPrefs] = useState<TubePlayerPrefs>(DEFAULT_TUBE_PREFS);

  useEffect(() => {
    try {
      setPrefs(parseTubePrefs(window.localStorage.getItem(TUBE_PREFS_KEY)));
    } catch {
      /* private mode */
    }
  }, []);

  const update = useCallback((patch: Partial<TubePlayerPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(TUBE_PREFS_KEY, JSON.stringify(next));
      } catch {
        /* quota */
      }
      return next;
    });
  }, []);

  return { prefs, update };
}

/** "Autoplay next episode", in localStorage under `posttube_autoplay_next_v1`; default on. */
export function useAutoplayNextPref() {
  const [on, setOn] = useState(true);

  useEffect(() => {
    setOn(readAutoplayNextPref(typeof window !== "undefined" ? window.localStorage : null));
  }, []);

  const update = useCallback((next: boolean) => {
    setOn(next);
    writeAutoplayNextPref(typeof window !== "undefined" ? window.localStorage : null, next);
  }, []);

  return { on, update };
}
