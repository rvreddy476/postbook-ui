"use client";

import { useCallback, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Menu } from "lucide-react";
import { HeaderBar } from "@/features/reels/components/HeaderBar";
import { OfflineSync } from "@/features/offline/components/OfflineSync";
import { ExploreLauncher } from "./ExploreLauncher";
import { VideoSidebar } from "./VideoSidebar";
import { VideoTopCluster } from "./VideoTopCluster";
import { VideoShellContext, type VideoShellContextValue } from "./useVideoShell";
import {
  SIDEBAR_INITIAL,
  SIDEBAR_STORAGE_KEY,
  readStoredSidebar,
  sidebarReducer,
  writeStoredSidebar,
} from "./sidebarState";
import { SIDEBAR_PANEL_INITIAL, sidebarPanelReducer } from "./sidebarPanel";
import type { VideoApp, VideoChrome } from "./nav";
import "./video-shell.css";

export type { VideoApp, VideoChrome };

export interface VideoNavigationProps {
  expanded: boolean;
  drawer?: boolean;
  id: string;
  onNavigate?: () => void;
}

export interface VideoShellProps {
  app: VideoApp | "workspace";
  /** Optional app-specific header; video apps retain the default. */
  header?: ReactNode;
  /**
   * "header" (default): the app header on top, the menu below it — what
   * PostTube uses. "sidebar": no header; search sits at the top of the menu,
   * the main area starts at the top of the viewport, and Create /
   * notifications / account float over its top-right — TikTok's frame.
   */
  chrome?: VideoChrome;
  /** Right column content (e.g. <TrendingCard/>). Hidden below 1200px. */
  aside?: ReactNode;
  /** When true the content area is full-bleed with no padding (the reels stage). */
  immersive?: boolean;
  /** Sidebar chrome only: collapse the corner search to its icon (the reels page sets it while comments are open). */
  compactSearch?: boolean;
  /** A workspace can replace the app menu without adding a second sidebar. */
  navigation?: (props: VideoNavigationProps) => ReactNode;
  children: ReactNode;
}

const SIDEBAR_ID = "video-shell-sidebar";

/*
  The one frame both video apps share: [sidebar | main | aside], with the
  header on top under the "header" chrome. The shell owns the sidebar's
  density, which face it shows (nav list or the More panel) and the
  Explore launcher; pages own only what goes in the middle and on the right.

  Sidebar state starts "expanded" on the server and is corrected once on
  the client from localStorage and the viewport — a deterministic first
  render, then a preference, rather than a hydration mismatch.
*/
export function VideoShell({ app, header, chrome = "header", aside, immersive = false, compactSearch = false, navigation, children }: VideoShellProps) {
  const [sidebar, dispatch] = useReducer(sidebarReducer, SIDEBAR_INITIAL);
  const [panel, dispatchPanel] = useReducer(sidebarPanelReducer, SIDEBAR_PANEL_INITIAL);
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

  // The More panel needs the expanded column: a rail or a closed drawer drops it.
  useEffect(() => {
    if (!sidebar.open) dispatchPanel({ type: "collapse" });
  }, [sidebar.open]);

  // Escape closes the More panel, else the drawer (the launcher handles its own).
  const drawerOpen = sidebar.drawer && sidebar.open;
  const moreOpen = panel === "more";
  useEffect(() => {
    if (!drawerOpen && !moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (moreOpen) dispatchPanel({ type: "escape" });
      else dispatch({ type: "set", open: false });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen, moreOpen]);

  const toggleSidebar = useCallback(() => dispatch({ type: "toggle" }), []);
  const closeDrawer = useCallback(() => dispatch({ type: "set", open: false }), []);
  const openExplore = useCallback(() => setExploreOpen(true), []);
  const closeExplore = useCallback(() => setExploreOpen(false), []);
  const openMore = useCallback(() => {
    dispatch({ type: "set", open: true });
    dispatchPanel({ type: "open-more" });
  }, []);
  const closeMore = useCallback(() => dispatchPanel({ type: "close-more" }), []);

  const context = useMemo<VideoShellContextValue>(
    () => ({ sidebarOpen: sidebar.open, toggleSidebar, openExplore, inShell: true, chrome, panel, openMore, closeMore }),
    [sidebar.open, toggleSidebar, openExplore, chrome, panel, openMore, closeMore],
  );

  const mode = sidebar.drawer ? "drawer" : sidebar.open ? "expanded" : "rail";

  return (
    <VideoShellContext.Provider value={context}>
      {/* Offline copies: checked on start and whenever the network returns; draws nothing. */}
      <OfflineSync />
      <div
        className="video-shell"
        data-app={app}
        data-chrome={chrome}
        data-sidebar={mode}
        data-immersive={immersive ? "" : undefined}
        data-search={compactSearch ? "gap" : undefined}
        data-hydrated={sidebar.hydrated ? "" : undefined}
      >
        {chrome === "header" ? (header ?? <HeaderBar />) : null}
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
                    {navigation ? navigation({ expanded: true, drawer: true, id: SIDEBAR_ID, onNavigate: closeDrawer }) : <VideoSidebar app={app === "workspace" ? "tube" : app} chrome={chrome} expanded drawer id={SIDEBAR_ID} onNavigate={closeDrawer} />}
                  </motion.div>
                </>
              ) : null}
            </AnimatePresence>
          ) : (
            <div className="video-shell__sidebar">
              {navigation ? navigation({ expanded: sidebar.open, id: SIDEBAR_ID }) : <VideoSidebar app={app === "workspace" ? "tube" : app} chrome={chrome} expanded={sidebar.open} id={SIDEBAR_ID} />}
            </div>
          )}

          <main className="video-shell__main" data-immersive={immersive ? "" : undefined}>
            {children}
          </main>

          {aside ? <aside className="video-shell__aside" aria-label="Related">{aside}</aside> : null}

          {chrome === "sidebar" ? (
            <>
              {/* No header on a phone either: the menu opens from a floating button. */}
              {sidebar.drawer ? (
                <button
                  type="button"
                  className="video-shell__drawer-toggle"
                  onClick={toggleSidebar}
                  aria-label="Menu"
                  aria-expanded={sidebar.open}
                  aria-controls={SIDEBAR_ID}
                >
                  <Menu size={22} strokeWidth={1.75} aria-hidden />
                </button>
              ) : null}
              <VideoTopCluster compact={compactSearch} />
            </>
          ) : null}
        </div>
      </div>
      <ExploreLauncher open={exploreOpen} onClose={closeExplore} />
    </VideoShellContext.Provider>
  );
}
