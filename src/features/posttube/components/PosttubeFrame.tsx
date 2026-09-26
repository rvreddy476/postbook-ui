"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { VideoShell } from "@/features/video-shell";

/*
  Every PostTube route sits inside the shared VideoShell (header with
  Create, the collapsible left menu). No right column here: long video
  wants the width, and trending lives as a shelf inside the home grid.
  The one exception is the upload studio: features/upload renders the
  reels AppShell, which is itself a VideoShell, so wrapping it again would
  stack two headers.
*/
export function PosttubeFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/posttube/upload")) return <>{children}</>;
  return (
    <VideoShell app="tube">{children}</VideoShell>
  );
}
