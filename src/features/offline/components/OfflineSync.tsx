"use client";

import { useEffect } from "react";

import { useGlobalToast } from "@/contexts/ToastContext";

import { useOfflineManager } from "../hooks";
import { removalNotice } from "../schedule";

/*
  Keeps the stored copies honest while a video app is open: on start, and
  every time the tab regains the network, it asks the server which copies
  are still allowed and deletes the rest (and anything past its expiry),
  with one quiet notice. While the tab stays open it wakes again when the
  next expiry or recheck comes due. Draws nothing.

  The sweep runs at most once per 30 seconds however the events arrive.
*/

const MIN_GAP_MS = 30_000;

/** The toast, where a provider exists; silence where there is none (a bare render in a test). */
function useQuietToast(): ((opts: { type: "info"; title: string }) => unknown) | null {
  try {
    return useGlobalToast();
  } catch {
    return null;
  }
}

export function OfflineSync() {
  const manager = useOfflineManager();
  const toast = useQuietToast();

  useEffect(() => {
    if (!manager) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last = 0;

    const sweep = async (force: boolean) => {
      const now = Date.now();
      if (force && now - last < MIN_GAP_MS) return;
      last = now;
      const removed = await manager.sync({ force }).catch(() => []);
      if (!alive) return;
      const notice = removalNotice(removed);
      if (notice) toast?.({ type: "info", title: notice });
      if (timer) clearTimeout(timer);
      const delay = manager.nextWake();
      if (delay !== null) timer = setTimeout(() => void sweep(false), delay);
    };

    const onOnline = () => void sweep(true);
    void sweep(true);
    window.addEventListener("online", onOnline);
    return () => {
      alive = false;
      window.removeEventListener("online", onOnline);
      if (timer) clearTimeout(timer);
    };
  }, [manager, toast]);

  return null;
}
