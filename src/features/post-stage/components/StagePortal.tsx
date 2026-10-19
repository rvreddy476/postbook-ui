"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/*
  Sheets render into <body>: the feed sits inside an animated (transformed)
  wrapper, and a transformed ancestor would turn a position:fixed sheet into
  one positioned against the wrapper instead of the window.
*/
export function StagePortal({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  return host ? createPortal(children, host) : null;
}
