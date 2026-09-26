"use client";

import { useSyncExternalStore } from "react";

/*
  A media query as state. The server snapshot is `false`, so the first
  client render matches the HTML; the real answer arrives on hydration.
  The stage uses it to mount ONE comments surface (column or sheet) rather
  than both with CSS hiding one, which would post and fetch twice.
*/
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined") return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => (typeof window === "undefined" ? false : window.matchMedia(query).matches),
    () => false,
  );
}

export const DESKTOP_QUERY = "(min-width: 1024px)";
export const COARSE_POINTER_QUERY = "(hover: none), (pointer: coarse)";
