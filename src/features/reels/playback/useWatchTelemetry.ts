"use client";

import { useEffect, useRef, type RefObject } from "react";

import { sendEvents, sendEventsOnUnload } from "@/features/reels/playback/telemetry";
import { WatchSession } from "@/features/reels/playback/watchSession";

/*
  One watch session per (reel, activation), wired to the <video>. The
  counting rules live in watchSession.ts; this hook only feeds it the media
  events, the 250 ms tick, the tab's visibility and page hide.
*/

const TICK_MS = 250;

export function newSessionId(): string {
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
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    const video = videoRef.current;
    if (!active || !video || !contentId) return;

    const session = new WatchSession(
      {
        contentId,
        durationMs: durationMs || Math.round((video.duration || 0) * 1000),
        position,
        speed: speedRef.current,
      },
      {
        newSessionId,
        send: (events, { unload }) => {
          if (unload) sendEventsOnUnload(events);
          else void sendEvents(events);
        },
      },
    );
    const startInfo = () => ({
      autoplay: opts.autoplayRef.current === true,
      muted: opts.isMutedRef.current === true,
      durationMs: video.duration && Number.isFinite(video.duration) ? video.duration * 1000 : undefined,
    });

    const onPlaying = () => session.playing(startInfo());
    const onSeeking = () => session.seeking(video.currentTime * 1000);
    const onPause = () => session.pause();
    const onEnded = () => session.ended();
    video.addEventListener("playing", onPlaying);
    video.addEventListener("seeking", onSeeking);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);

    const tick = window.setInterval(() => {
      session.tick({
        paused: video.paused,
        seeking: video.seeking,
        readyState: video.readyState,
        currentMs: video.currentTime * 1000,
        speed: speedRef.current,
      });
    }, TICK_MS);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") session.hide();
      else session.show(!video.paused && !video.ended, startInfo());
    };
    const onPageHide = () => session.end("backgrounded");
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
      session.end();
    };
    // durationMs/position are fixed per reel; a change of reel remounts the player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, contentId]);
}
