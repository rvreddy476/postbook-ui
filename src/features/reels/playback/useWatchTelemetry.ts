"use client";

import { useEffect, useRef, type RefObject } from "react";

import {
  buildHeartbeat,
  buildPlayEnd,
  buildPlayStart,
  HEARTBEAT_MS,
  sendEvents,
  sendEventsOnUnload,
  type EndReason,
  type WatchState,
} from "@/features/reels/playback/telemetry";

/*
  One watch session per (reel, activation). Watched time is measured from
  the media clock, not the wall clock: a 250ms tick reads currentTime, and a
  small forward step is watched time, a large backward step is a loop or a
  seek. This is what the display-view rule and the creator fund are computed
  from, so it must not count time the video spent paused or buffering.
*/

const TICK_MS = 250;
const MAX_STEP_MS = 2000; // anything larger is a seek, not watching

function newSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  // uuid v4 shape, so the server's uuid validation passes
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export interface WatchTelemetryOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  contentId: string;
  durationMs: number;
  position: number;
  active: boolean;
  speed: number;
  /** Read at play_start time. */
  isMutedRef: RefObject<boolean>;
  /** true when the play was not started by a viewer tap. */
  autoplayRef: RefObject<boolean>;
}

export function useWatchTelemetry(opts: WatchTelemetryOptions) {
  const { videoRef, contentId, durationMs, position, active, speed } = opts;
  const stateRef = useRef<WatchState | null>(null);
  const startedRef = useRef(false);
  const lastTimeRef = useRef<number | null>(null);
  const continuousRef = useRef(0);
  const sinceHeartbeatRef = useRef(0);
  const heartbeatAtRef = useRef(0);
  const endedNaturallyRef = useRef(false);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    const video = videoRef.current;
    if (!active || !video || !contentId) return;

    const state: WatchState = {
      sessionId: newSessionId(),
      contentId,
      durationMs: durationMs || Math.round((video.duration || 0) * 1000),
      position,
      watchedMsTotal: 0,
      maxContinuousMs: 0,
      loopCount: 0,
      speed: speedRef.current,
    };
    stateRef.current = state;
    startedRef.current = false;
    lastTimeRef.current = null;
    continuousRef.current = 0;
    sinceHeartbeatRef.current = 0;
    heartbeatAtRef.current = Date.now();
    endedNaturallyRef.current = false;

    const onPlaying = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      if (!state.durationMs && video.duration) state.durationMs = Math.round(video.duration * 1000);
      const auto = opts.autoplayRef.current === true;
      void sendEvents([
        buildPlayStart(state, {
          startMethod: auto ? "autoplay" : "tap",
          isMuted: opts.isMutedRef.current === true,
          isAutoplay: auto,
        }),
      ]);
    };
    const onSeeking = () => {
      continuousRef.current = 0;
      lastTimeRef.current = null;
    };
    const onPause = () => {
      continuousRef.current = 0;
      lastTimeRef.current = null;
    };
    const onEnded = () => {
      endedNaturallyRef.current = true;
    };
    video.addEventListener("playing", onPlaying);
    video.addEventListener("seeking", onSeeking);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);

    const tick = window.setInterval(() => {
      if (video.paused || video.seeking || video.readyState < 2) {
        lastTimeRef.current = video.paused ? null : lastTimeRef.current;
        return;
      }
      const nowMs = video.currentTime * 1000;
      const last = lastTimeRef.current;
      lastTimeRef.current = nowMs;
      if (last == null) return;
      const step = nowMs - last;
      if (step < 0) {
        // Wrapped to the start: a loop when we were near the end.
        if (state.durationMs > 0 && last > state.durationMs - MAX_STEP_MS) state.loopCount += 1;
        continuousRef.current = 0;
        return;
      }
      if (step > MAX_STEP_MS) {
        continuousRef.current = 0;
        return;
      }
      state.watchedMsTotal += step;
      sinceHeartbeatRef.current += step;
      continuousRef.current += step;
      if (continuousRef.current > state.maxContinuousMs) state.maxContinuousMs = continuousRef.current;
      state.speed = speedRef.current;

      if (Date.now() - heartbeatAtRef.current >= HEARTBEAT_MS && sinceHeartbeatRef.current > 0) {
        heartbeatAtRef.current = Date.now();
        const inc = sinceHeartbeatRef.current;
        sinceHeartbeatRef.current = 0;
        void sendEvents([buildHeartbeat(state, { incrementMs: inc, playheadMs: nowMs })]);
      }
    }, TICK_MS);

    const end = (reason: EndReason, onUnload = false) => {
      if (!startedRef.current || state.watchedMsTotal <= 0) return;
      startedRef.current = false;
      const evt = buildPlayEnd(state, reason);
      if (onUnload) sendEventsOnUnload([evt]);
      else void sendEvents([evt]);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") end("backgrounded");
    };
    const onPageHide = () => end("backgrounded", true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearInterval(tick);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      end(endedNaturallyRef.current ? "ended" : "swipe_next");
      stateRef.current = null;
    };
    // durationMs/position are fixed per reel; a change of reel remounts the player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, contentId]);
}
