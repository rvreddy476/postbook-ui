"use client";

import { useCallback, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { HeaderBar } from "@/features/reels/components/HeaderBar";
import { ExploreLauncher } from "./ExploreLauncher";
import { VideoSidebar } from "./VideoSidebar";
import { VideoShellContext, type VideoShellContextValue } from "./useVideoShell";
import {
  SIDEBAR_INITIAL,
  SIDEBAR_STORAGE_KEY,
  readStoredSidebar,
  sidebarReducer,
  writeStoredSidebar,
} from "./sidebarState";
import type { VideoApp } from "./nav";
import "./video-shell.css";

export type { VideoApp };

export interface VideoShellProps {
  app: VideoApp;
  /** Right column content (e.g. <TrendingCard/>). Hidden below 1200px. */
  aside?: ReactNode;
  /** When true the content area is full-bleed with no padding (the reels stage). */
  immersive?: boolean;
  children: ReactNode;
}

const SIDEBAR_ID = "video-shell-sidebar";

/*
  The one frame both video apps share: header on top, then
  [sidebar | main | aside]. The shell owns the sidebar's density and the
  Explore launcher; pages own only what goes in the middle and on the right.

  Sidebar state starts "expanded" on the server and is corrected once on
  the client from localStorage and the viewport — a deterministic first
  render, then a preference, rather than a hydration mismatch.
*/
export function VideoShell({ app, aside, immersive = false, children }: VideoShellProps) {
  const [sidebar, dispatch] = useReducer(sidebarReducer, SIDEBAR_INITIAL);
  const [exploreOpen, setExploreOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  // Hydrate from storage + viewport, then follow viewport changes.
  useEffect(() => {
    dispatch({ type: "hydrate", width: window.innerWidth, stored: readStoredSidebar() });
    const onResize = () => dispatch({ type: "viewport", width: window.innerWidth });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Persist only the column preference; a drawer is never remembered.
  useEffect(() => {
    if (!sidebar.hydrated || sidebar.drawer) return;
    writeStoredSidebar(sidebar.open);
  }, [sidebar.hydrated, sidebar.drawer, sidebar.open]);

  // Another tab changed the preference.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SIDEBAR_STORAGE_KEY) return;
      const stored = readStoredSidebar();
      if (stored != null) dispatch({ type: "set", open: stored });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Escape closes the drawer (the launcher handles its own).
  useEffect(() => {
    if (!sidebar.drawer || !sidebar.open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dispatch({ type: "set", open: false }); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sidebar.drawer, sidebar.open]);

  const toggleSidebar = useCallback(() => dispatch({ type: "toggle" }), []);
  const closeDrawer = useCallback(() => dispatch({ type: "set", open: false }), []);
  const openExplore = useCallback(() => setExploreOpen(true), []);
  const closeExplore = useCallback(() => setExploreOpen(false), []);

  const context = useMemo<VideoShellContextValue>(
    () => ({ sidebarOpen: sidebar.open, toggleSidebar, openExplore, inShell: true }),
    [sidebar.open, toggleSidebar, openExplore],
  );

  const mode = sidebar.drawer ? "drawer" : sidebar.open ? "expanded" : "rail";

  return (
    <VideoShellContext.Provider value={context}>
      <div
        className="video-shell"
        data-app={app}
        data-sidebar={mode}
        data-immersive={immersive ? "" : undefined}
        data-hydrated={sidebar.hydrated ? "" : undefined}
      >
        <HeaderBar />
        <div className="video-shell__body">
          {sidebar.drawer ? (
            <AnimatePresence>
              {sidebar.open ? (
                <>
                  <motion.div
                    key="scrim"
                    className="video-shell__scrim"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.18 }}
                    onClick={closeDrawer}
                    aria-hidden
                  />
                  <motion.div
                    key="drawer"
                    className="video-shell__drawer"
                    initial={{ x: reduceMotion ? 0 : -24, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: reduceMotion ? 0 : -24, opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.2, ease: "circOut" }}
                  >
                    <VideoSidebar app={app} expanded drawer id={SIDEBAR_ID} onNavigate={closeDrawer} />
                  </motion.div>
                </>
              ) : null}
            </AnimatePresence>
          ) : (
            <div className="video-shell__sidebar">
              <VideoSidebar app={app} expanded={sidebar.open} id={SIDEBAR_ID} />
            </div>
          )}

          <main className="video-shell__main" data-immersive={immersive ? "" : undefined}>
            {children}
          </main>

          {aside ? <aside className="video-shell__aside" aria-label="Related">{aside}</aside> : null}
        </div>
      </div>
      <ExploreLauncher open={exploreOpen} onClose={closeExplore} />
    </VideoShellContext.Provider>
  );
}
