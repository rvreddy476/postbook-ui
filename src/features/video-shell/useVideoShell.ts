"use client";

import { createContext, useContext } from "react";

export interface VideoShellContextValue {
  /** Expanded column on a wide screen; the drawer visible on a narrow one. */
  sidebarOpen: boolean;
  toggleSidebar(): void;
  openExplore(): void;
  /** True only under a <VideoShell>. The header uses it to show the hamburger. */
  inShell: boolean;
}

const NOOP = () => {};

/** What a caller sees outside the shell: nothing open, nothing to do. */
export const VIDEO_SHELL_DEFAULT: VideoShellContextValue = {
  sidebarOpen: false,
  toggleSidebar: NOOP,
  openExplore: NOOP,
  inShell: false,
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
