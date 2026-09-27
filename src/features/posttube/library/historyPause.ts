/*
  "Pause recording" for Recent. A client preference: while paused, the
  watch page must not write progress rows (POST /v1/videos/:id/progress),
  so nothing new lands in GET /v1/videos/history. Nothing already recorded
  is touched.

  Storage: localStorage[`posttube_history_paused_v1`] = "1" | absent.
  The watch lane reads `isHistoryPaused()` before each progress write; the
  Recent page toggles it with `setHistoryPaused()`. Both are safe on the
  server and with storage blocked (they fall back to "not paused").
*/

export const HISTORY_PAUSE_KEY = "posttube_history_paused_v1";
export const HISTORY_PAUSE_EVENT = "posttube:history-pause-changed";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function storage(explicit?: StorageLike | null): StorageLike | null {
  if (explicit !== undefined) return explicit;
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** True while the viewer asked Recent to stop recording. */
export function isHistoryPaused(store?: StorageLike | null): boolean {
  const s = storage(store);
  if (!s) return false;
  try {
    return s.getItem(HISTORY_PAUSE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setHistoryPaused(paused: boolean, store?: StorageLike | null): boolean {
  const s = storage(store);
  if (!s) return false;
  try {
    if (paused) s.setItem(HISTORY_PAUSE_KEY, "1");
    else s.removeItem(HISTORY_PAUSE_KEY);
  } catch {
    return false;
  }
  try {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(HISTORY_PAUSE_EVENT));
  } catch {
    // no window: nothing listens
  }
  return true;
}

/** Subscribes to changes from this tab and from other tabs (the `storage` event). */
export function subscribeHistoryPaused(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === HISTORY_PAUSE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(HISTORY_PAUSE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(HISTORY_PAUSE_EVENT, onChange);
  };
}
