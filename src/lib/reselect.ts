"use client";

import { useEffect, useRef } from "react";

/*
  "Tap the tab you are already on to refresh" (TikTok, YouTube). The side
  menu announces a click on the item that is already current; a screen that
  can refresh listens for its own href. A click on any other item is a normal
  navigation and announces nothing.
*/

const EVENT = "app:reselect";

export function announceReselect(href: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: href }));
}

/** Calls `onReselect` when the menu item for `href` is clicked while already current. */
export function useReselect(href: string, onReselect: () => void): void {
  const latest = useRef(onReselect);
  latest.current = onReselect;
  useEffect(() => {
    const listener = (e: Event) => {
      if ((e as CustomEvent<string>).detail === href) latest.current();
    };
    window.addEventListener(EVENT, listener);
    return () => window.removeEventListener(EVENT, listener);
  }, [href]);
}
