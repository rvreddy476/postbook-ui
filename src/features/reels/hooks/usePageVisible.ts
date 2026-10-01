"use client";

import { useSyncExternalStore } from "react";

/*
  Whether the tab is in the foreground (document.visibilityState). The live
  stage leaves its room while the tab is hidden and joins again when the
  viewer comes back. The server snapshot is `true`, so the first client
  render matches the HTML.
*/
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof document === "undefined") return () => {};
      document.addEventListener("visibilitychange", onChange);
      return () => document.removeEventListener("visibilitychange", onChange);
    },
    () => (typeof document === "undefined" ? true : document.visibilityState !== "hidden"),
    () => true,
  );
}
