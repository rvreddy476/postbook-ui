"use client";

import { useCallback, useSyncExternalStore } from "react";

import { isHistoryPaused, setHistoryPaused, subscribeHistoryPaused } from "../historyPause";

function getServerSnapshot() {
  return false;
}

/** The Recent page's "Pause recording" switch, live across tabs. */
export function useHistoryPaused(): [boolean, (next: boolean) => void] {
  const paused = useSyncExternalStore(subscribeHistoryPaused, isHistoryPaused, getServerSnapshot);
  const set = useCallback((next: boolean) => {
    setHistoryPaused(next);
  }, []);
  return [paused, set];
}
