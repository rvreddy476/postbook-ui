"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";

import { TubePlayer, type TubePlayerProps } from "../components/TubePlayer";

/*
  The one player of the tube zone, kept alive across route changes.

  The host lives in app/posttube/layout.tsx, so it survives every
  navigation inside /posttube. It owns the <TubePlayer>, rendered through a
  portal into a fixed box on <body>. The watch page renders a <TubeStage>
  — an empty 16:9 placeholder — and hands the host the player's props; the
  host lays its box over the placeholder (tracking scroll and resize,
  clipped to the shell's main so it never draws over the header). When
  the page goes away with the miniplayer on, the box docks bottom-right at
  320px and keeps playing; the dock's expand link returns to the watch
  page, where the stage takes the player back without a reload. Without
  the miniplayer on, leaving the page unmounts the player as before.

  A page that re-keys on the video id unregisters and registers in the
  same commit, so the player is never docked between two videos.
*/

export const MINI_DOCK_WIDTH = 320;

interface StageSpec {
  props: TubePlayerProps;
  /** Where the dock's expand link goes. */
  returnHref: string;
}

interface HostApi {
  register: (spec: StageSpec, el: HTMLElement) => void;
  update: (spec: StageSpec) => void;
  unregister: (keepDocked: boolean) => void;
  /** The I key / control on the page: dock now (the stage stays registered) or come back over the stage. */
  dock: (on: boolean) => void;
  closeDock: () => void;
}

/* Two contexts: the api never changes identity (the stage's register effect
   keys on it), the state does. */
const HostContext = createContext<HostApi | null>(null);
const HostStateContext = createContext<{ docked: boolean }>({ docked: false });

function mainOf(el: HTMLElement | null): HTMLElement | null {
  return (el?.closest(".video-shell__main") as HTMLElement | null) ?? null;
}

export function TubePlayerHost({ children }: { children: ReactNode }) {
  const [spec, setSpec] = useState<StageSpec | null>(null);
  const [stageEl, setStageEl] = useState<HTMLElement | null>(null);
  const [docked, setDocked] = useState(false);
  const [mounted, setMounted] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<{ keep: boolean } | null>(null);

  useEffect(() => setMounted(true), []);

  const register = useCallback((next: StageSpec, el: HTMLElement) => {
    pendingRef.current = null;
    setSpec(next);
    setStageEl(el);
    setDocked(false);
  }, []);

  const update = useCallback((next: StageSpec) => {
    setSpec(next);
  }, []);

  const unregister = useCallback((keepDocked: boolean) => {
    // Decided after the commit: a re-keyed stage registers again before this runs.
    pendingRef.current = { keep: keepDocked };
    queueMicrotask(() => {
      const pending = pendingRef.current;
      if (!pending) return;
      pendingRef.current = null;
      setStageEl(null);
      if (pending.keep) setDocked(true);
      else setSpec(null);
    });
  }, []);

  const dock = useCallback((on: boolean) => setDocked(on), []);

  const closeDock = useCallback(() => {
    setDocked(false);
    setSpec(null);
    setStageEl(null);
  }, []);

  /* ── lay the box over the stage ────────────────────────── */
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box || !stageEl || docked) return;
    const main = mainOf(stageEl);
    const place = () => {
      const r = stageEl.getBoundingClientRect();
      box.style.left = `${r.left}px`;
      box.style.top = `${r.top}px`;
      box.style.width = `${r.width}px`;
      box.style.height = `${r.height}px`;
      if (main) {
        const m = main.getBoundingClientRect();
        const clipTop = Math.max(0, m.top - r.top);
        const clipBottom = Math.max(0, r.bottom - m.bottom);
        box.style.clipPath = clipTop > 0 || clipBottom > 0 ? `inset(${clipTop}px 0 ${clipBottom}px 0)` : "";
      } else {
        box.style.clipPath = "";
      }
    };
    place();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    ro?.observe(stageEl);
    if (main) ro?.observe(main);
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, { capture: true, passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, { capture: true });
    };
  }, [stageEl, docked, spec]);

  const api = useMemo<HostApi>(() => ({ register, update, unregister, dock, closeDock }), [register, update, unregister, dock, closeDock]);
  const state = useMemo(() => ({ docked }), [docked]);

  const showBox = !!spec && (docked || !!stageEl);
  const box = showBox ? (
    <div
      ref={boxRef}
      className={`tube-player-box ${docked ? "is-docked" : "is-stage"}`}
      data-tube-player-box
      style={docked ? undefined : { position: "fixed" }}
    >
      {docked ? (
        <div className="tube-player-box__dock-bar">
          <Link href={spec.returnHref} className="tube-player-box__dock-button" aria-label="Back to the watch page">
            <Maximize2 className="h-4 w-4" />
          </Link>
          <button type="button" onClick={closeDock} className="tube-player-box__dock-button" aria-label="Close miniplayer">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      <TubePlayer {...spec.props} miniplayer={docked || spec.props.miniplayer} />
    </div>
  ) : null;

  return (
    <HostContext.Provider value={api}>
      <HostStateContext.Provider value={state}>
        {children}
        {mounted && box ? createPortal(box, document.body) : null}
      </HostStateContext.Provider>
    </HostContext.Provider>
  );
}

export interface TubeStageProps extends TubePlayerProps {
  /** Keep the player docked when this page goes away. */
  miniplayerOn: boolean;
  returnHref: string;
}

/**
 * The watch page's player slot. With a host above it, the host draws the
 * player over this placeholder; without one (tests, a stray mount) it
 * renders the player inline.
 */
export function TubeStage({ miniplayerOn, returnHref, ...props }: TubeStageProps) {
  const host = useContext(HostContext);
  const { docked } = useContext(HostStateContext);
  const ref = useRef<HTMLDivElement>(null);
  const specRef = useRef<StageSpec>({ props, returnHref });
  specRef.current = { props, returnHref };
  const keepRef = useRef(miniplayerOn);
  keepRef.current = miniplayerOn;

  useLayoutEffect(() => {
    if (!host || !ref.current) return;
    host.register(specRef.current, ref.current);
    return () => host.unregister(keepRef.current);
    // register once per mount; props flow through update below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  useLayoutEffect(() => {
    host?.update({ props, returnHref });
  });

  useEffect(() => {
    host?.dock(miniplayerOn);
  }, [host, miniplayerOn]);

  if (!host) return <TubePlayer {...props} />;
  return (
    <div ref={ref} className="tube-stage" data-tube-stage data-docked={docked ? "" : undefined}>
      {docked ? (
        <button type="button" className="tube-stage__note" onClick={() => host.dock(false)}>
          Playing in the miniplayer · bring it back
        </button>
      ) : null}
    </div>
  );
}

/** Whether the host has the player docked (the page hides its own dock button state on it). */
export function useTubeDock(): { docked: boolean; close: () => void } {
  const host = useContext(HostContext);
  const { docked } = useContext(HostStateContext);
  return { docked, close: host?.closeDock ?? (() => undefined) };
}
