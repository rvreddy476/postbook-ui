"use client";

import { createContext, useContext } from "react";

import type { VideoChrome } from "./nav";
import type { SidebarPanel } from "./sidebarPanel";

export interface VideoShellContextValue {
  /** Expanded column on a wide screen; the drawer visible on a narrow one. */
  sidebarOpen: boolean;
  toggleSidebar(): void;
  openExplore(): void;
  /** True only under a <VideoShell>. The header uses it to show the hamburger. */
  inShell: boolean;
  /** Which frame the shell draws; "header" outside a shell. */
  chrome: VideoChrome;
  /** What the expanded sidebar shows: the nav list or the More panel. */
  panel: SidebarPanel;
  /** Show the More panel (expanding the column first when it is a rail). */
  openMore(): void;
  closeMore(): void;
}

const NOOP = () => {};

/** What a caller sees outside the shell: nothing open, nothing to do. */
export const VIDEO_SHELL_DEFAULT: VideoShellContextValue = {
  sidebarOpen: false,
  toggleSidebar: NOOP,
  openExplore: NOOP,
  inShell: false,
  chrome: "header",
  panel: "nav",
  openMore: NOOP,
  closeMore: NOOP,
};

export const VideoShellContext = createContext<VideoShellContextValue>(VIDEO_SHELL_DEFAULT);

/**
 * The shell's controls. Safe anywhere: outside a VideoShell the toggles are
 * no-ops and `inShell` is false, so HeaderBar keeps working on every other
 * page that mounts it without the shell.
 */
export function useVideoShell(): VideoShellContextValue {
  return useContext(VideoShellContext);
}
