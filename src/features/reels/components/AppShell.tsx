"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { VideoShell } from "@/features/video-shell";
import { connectToHub } from "@/services/messageService";

interface AppShellProps {
  /** Kept for callers; the header names the app from the route now. */
  sectionLabel?: string;
  children: React.ReactNode;
}

/*
  The shell for the video-adjacent pages that are not the reels stage or a
  PostTube route: the upload studio, live start, channel settings. It is
  the same VideoShell those apps use (header with Create, the collapsible
  left menu, the trending column), so every video surface reads as one
  place. The app is the one the route belongs to; anything that is not
  /reels is treated as PostTube.
*/
export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  useEffect(() => {
    void connectToHub(() => {});
  }, []);
  const app = pathname?.startsWith("/reels") ? "reels" : "tube";
  return <VideoShell app={app}>{children}</VideoShell>;
}
