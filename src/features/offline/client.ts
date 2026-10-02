"use client";

import api, { getCurrentUserId } from "@/lib/api";
import { mediaHref } from "@/features/reels/model";

import { browserDeviceId } from "./deviceId";
import { OfflineManager } from "./manager";
import { indexedDbMetaStore, indexedDbWorks } from "./metaStore";
import { browserSignInMarks, browserSignOutMarks } from "./signOut";
import { detectFileStore, type CachesLike, type DirHandle, type StorageKind } from "./storage";
import { createOfflineApi } from "./wire";

/*
  The browser wiring: one OfflineManager per tab, built on first use from
  whatever private storage this browser really has. Where it has none the
  promise resolves to null and the feature is simply absent.
*/

const CHANNEL = "postbook-offline-copies";

let pending: Promise<OfflineManager | null> | null = null;
let kind: StorageKind | "unknown" = "unknown";
const kindListeners = new Set<() => void>();

export function subscribeStorageKind(listener: () => void): () => void {
  kindListeners.add(listener);
  return () => kindListeners.delete(listener);
}

/** "unknown" until the first detection finishes (and on the server). */
export function storageKind(): StorageKind | "unknown" {
  return kind;
}

async function build(): Promise<OfflineManager | null> {
  if (typeof window === "undefined" || typeof navigator === "undefined") return null;
  const storage = navigator.storage as (StorageManager & { getDirectory?: () => Promise<unknown> }) | undefined;
  const handleProto = (globalThis as { FileSystemFileHandle?: { prototype?: object } }).FileSystemFileHandle?.prototype;
  const idb = typeof indexedDB !== "undefined" ? indexedDB : undefined;

  const files = await detectFileStore({
    getDirectory: storage?.getDirectory ? () => storage.getDirectory!() as Promise<DirHandle> : undefined,
    writableFiles: !!handleProto && "createWritable" in handleProto,
    caches: typeof caches !== "undefined" ? (caches as unknown as CachesLike) : undefined,
    indexedDbWorks: () => indexedDbWorks(idb),
  });
  if (!files || !idb) return null;

  let channel: BroadcastChannel | null = null;
  try {
    channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;
  } catch {
    channel = null;
  }

  const manager = new OfflineManager({
    files,
    meta: indexedDbMetaStore(idb),
    api: createOfflineApi(api, browserDeviceId),
    fetchFn: (url, init) => fetch(url, init),
    resolveUrl: mediaHref,
    now: Date.now,
    userId: getCurrentUserId,
    persist: storage?.persist ? () => storage.persist() : undefined,
    createObjectUrl: (blob) => URL.createObjectURL(blob),
    revokeObjectUrl: (url) => URL.revokeObjectURL(url),
    broadcast: channel ? () => channel!.postMessage("changed") : undefined,
    signOutMarks: browserSignOutMarks,
    signInMarks: browserSignInMarks,
  });
  if (channel) channel.onmessage = () => void manager.reload().catch(() => undefined);
  kind = files.kind;
  return manager;
}

/** The tab's manager, or null where private storage does not work. */
export function getOfflineManager(): Promise<OfflineManager | null> {
  pending ??= build()
    .catch(() => null)
    .then((manager) => {
      if (!manager) kind = "none";
      for (const l of kindListeners) l();
      return manager;
    });
  return pending;
}

/** What the browser says it has and has left, for the Offline page. null where it will not say. */
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e && typeof e.quota === "number" ? { usage: e.usage ?? 0, quota: e.quota } : null;
  } catch {
    return null;
  }
}
