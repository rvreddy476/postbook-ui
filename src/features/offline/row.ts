import { copyProgress, type CopyState } from "./copyState";
import type { StorageKind } from "./storage";

/*
  The Save offline row of the More menu, as data. Pure.

  The row exists only where private storage really works ("opfs" or
  "cache"): while that is still unknown, on the server, and in a browser
  with neither, there is no row — never a row that fails when pressed.
*/

export function offlineSupported(kind: StorageKind | "unknown"): boolean {
  return kind === "opfs" || kind === "cache";
}

/** Whether the surface can offer the row at all: storage works and the video has a media id to ask a grant for. */
export function offlineRowAvailable(input: { kind: StorageKind | "unknown"; hasMedia: boolean; signedIn: boolean }): boolean {
  return offlineSupported(input.kind) && input.hasMedia && input.signedIn;
}

export interface OfflineRowInfo {
  /** A stored copy exists: the row reads "Remove offline copy". */
  saved: boolean;
  /** A save is running: the row shows the ring, and pressing it stops the save. */
  saving: boolean;
  /** 0..1, or null while the size is unknown. */
  progress: number | null;
  hint: string;
}

export function percent(progress: number | null): string {
  return progress === null ? "" : `${Math.round(progress * 100)}%`;
}

export function offlineRowInfo(state: CopyState | null | undefined): OfflineRowInfo {
  if (!state) return { saved: false, saving: false, progress: 0, hint: "Watch without a connection, here in the app" };
  if (state.phase === "stored") return { saved: true, saving: false, progress: 1, hint: "Stored in the app on this device" };
  if (state.phase === "downloading") {
    const progress = copyProgress(state);
    return { saved: false, saving: true, progress, hint: `Saving${progress === null ? "" : ` ${percent(progress)}`} · press to stop` };
  }
  if (state.phase === "idle" && state.resumable && state.totalBytes) {
    return { saved: false, saving: false, progress: 0, hint: `Paused at ${percent(state.receivedBytes / state.totalBytes)} · press to continue` };
  }
  return { saved: false, saving: false, progress: 0, hint: "Watch without a connection, here in the app" };
}

/** What pressing the row does. */
export type OfflineRowAction = "save" | "cancel" | "remove";

export function offlineRowAction(info: Pick<OfflineRowInfo, "saved" | "saving">): OfflineRowAction {
  if (info.saved) return "remove";
  return info.saving ? "cancel" : "save";
}
