"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { getOfflineManager, storageKind, subscribeStorageKind } from "./client";
import type { CopyView, OfflineManager, OfflineSnapshot, OfflineSource } from "./manager";
import { offlineRowAction, offlineRowAvailable, offlineRowInfo, type OfflineRowInfo } from "./row";
import { registerOfflineShellInBrowser } from "./serviceWorker";
import type { StorageKind } from "./storage";
import type { OfflineSurface } from "./wire";

const EMPTY: OfflineSnapshot = { ready: false, copies: [], byId: {}, usedBytes: 0 };
const noSubscribe = () => () => undefined;

/** "unknown" on the server and until detection finishes; then what this browser has. */
export function useStorageKind(): StorageKind | "unknown" {
  const kind = useSyncExternalStore(subscribeStorageKind, storageKind, () => "unknown" as const);
  useEffect(() => {
    void getOfflineManager();
  }, []);
  return kind;
}

/** The tab's manager once it exists; null before that and where storage does not work. */
export function useOfflineManager(): OfflineManager | null {
  const [manager, setManager] = useState<OfflineManager | null>(null);
  useEffect(() => {
    let alive = true;
    void getOfflineManager().then((m) => {
      if (!alive || !m) return;
      setManager(m);
      void m.init().catch(() => undefined);
    });
    return () => {
      alive = false;
    };
  }, []);
  return manager;
}

export function useOfflineSnapshot(manager: OfflineManager | null): OfflineSnapshot {
  return useSyncExternalStore(manager ? manager.subscribe : noSubscribe, manager ? manager.getSnapshot : () => EMPTY, () => EMPTY);
}

export interface OfflineNotice {
  type: "success" | "error" | "info";
  title: string;
  description?: string;
}

export interface OfflineRow extends OfflineRowInfo {
  /** The row may be offered (storage works, signed in, a video to save). The post's own rule (allowed, or yours) is the row model's. */
  available: boolean;
  /** Save, stop or remove — whichever the row currently means. */
  run: () => void;
}

/**
  The Save offline row for one video: its state, and the one action it
  performs. The surface says how to tell the viewer what happened.
*/
export function useOfflineRow(input: { postId: string | null | undefined; surface: OfflineSurface; hasMedia: boolean; signedIn: boolean; notify: (notice: OfflineNotice) => void }): OfflineRow {
  const { postId, surface, hasMedia, signedIn, notify } = input;
  const kind = useStorageKind();
  const manager = useOfflineManager();
  const snapshot = useOfflineSnapshot(manager);
  const view: CopyView | undefined = postId ? snapshot.byId[postId] : undefined;
  const info = useMemo(() => offlineRowInfo(view?.state), [view?.state]);
  const available = offlineRowAvailable({ kind, hasMedia, signedIn }) && !!postId;

  const run = useCallback(() => {
    if (!manager || !postId) return;
    const action = offlineRowAction(info);
    if (action === "cancel") {
      manager.cancel(postId);
      return;
    }
    if (action === "remove") {
      void manager.remove(postId).then(
        () => notify({ type: "info", title: "Offline copy removed" }),
        () => notify({ type: "error", title: "Could not remove the offline copy" }),
      );
      return;
    }
    notify({ type: "info", title: "Saving offline", description: "It will be on the Offline page when it is ready." });
    void manager.save(postId, surface).then((result) => {
      if (result.ok) {
        // There is now something to watch with no network: let the Offline page open without one.
        registerOfflineShellInBrowser();
        notify({ type: "success", title: "Saved offline", description: "Watch it from the Offline page, in the app." });
      }
      else if (!result.cancelled) notify({ type: "error", title: "Not saved offline", description: result.message });
    });
  }, [manager, postId, surface, info, notify]);

  return { ...info, available, run };
}

/**
  The stored copy of a video as object URLs, for the player on this page;
  null when there is none (or it is not complete, expired, or another
  account's). The URLs are revoked when the page lets go of them.
*/
export function useOfflineSource(postId: string | null | undefined): OfflineSource | null {
  const manager = useOfflineManager();
  const snapshot = useOfflineSnapshot(manager);
  const stored = !!postId && snapshot.byId[postId]?.state.phase === "stored";
  const [held, setHeld] = useState<{ postId: string; source: OfflineSource } | null>(null);

  useEffect(() => {
    if (!manager || !postId || !stored) {
      setHeld(null);
      return;
    }
    let alive = true;
    let opened: OfflineSource | null = null;
    void manager.open(postId).then(
      (s) => {
        if (!alive) {
          s?.release();
          return;
        }
        opened = s;
        setHeld(s ? { postId, source: s } : null);
      },
      () => undefined,
    );
    return () => {
      alive = false;
      opened?.release();
      setHeld(null);
    };
  }, [manager, postId, stored]);

  // Never the previous video's copy: on the render where the id changes, the old URLs are already on their way out.
  return held && held.postId === postId ? held.source : null;
}
