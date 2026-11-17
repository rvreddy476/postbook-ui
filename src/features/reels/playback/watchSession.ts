import {
  buildHeartbeat,
  buildPlayEnd,
  buildPlayStart,
  HEARTBEAT_MS,
  type EndReason,
  type WatchState,
} from "./telemetry";

type AnalyticsEvent = ReturnType<typeof buildPlayStart>;

/*
  One reel watch, as a plain object the hook (useWatchTelemetry.ts) feeds
  with media events. Watched time comes from the media clock: each tick
  reads currentTime, a small forward step is watched time, a large step is
  a seek. Kept out of React so it can be driven in tests.

  - play_end goes once per session (swipe away / unmount, ended, tab
    hidden, page hide) and always by keepalive, so it survives the page.
  - Hidden tab: play_end ("backgrounded"), then nothing counts and no
    heartbeat goes until the tab is visible again; that starts a NEW
    session (new session_id, totals from zero) with its own play_start
    (V4-11 / reels-42).
  - Loops: the native `loop` wraps by seeking to 0, which fires `seeking`.
    A seek to near 0 from within MAX_STEP_MS of the end is a loop
    (V4-12 / reels-43). A wrap seen by the tick (no seeking event) counts too.
*/

export const MAX_STEP_MS = 2000; // anything larger is a seek, not watching
/** A seek that lands this close to 0 from near the end is the loop wrapping. */
export const LOOP_RESTART_MS = 1000;

export interface WatchSessionInit {
  contentId: string;
  durationMs: number;
  position: number;
  speed: number;
}

export interface WatchSessionDeps {
  /** `unload: true` = keepalive transport (telemetry.sendEventsOnUnload). */
  send: (events: AnalyticsEvent[], opts: { unload: boolean }) => void;
  now?: () => number;
  newSessionId: () => string;
}

export interface TickSample {
  paused: boolean;
  seeking: boolean;
  readyState: number;
  currentMs: number;
  speed: number;
}

export interface StartInfo {
  autoplay: boolean;
  muted: boolean;
  /** The element's duration once known (ms). */
  durationMs?: number;
}

export class WatchSession {
  state: WatchState;
  private started = false;
  private hidden = false;
  private last: number | null = null;
  private continuous = 0;
  private sinceHeartbeat = 0;
  private heartbeatAt: number;
  private endedNaturally = false;
  private readonly now: () => number;

  constructor(
    private readonly init: WatchSessionInit,
    private readonly deps: WatchSessionDeps,
  ) {
    this.now = deps.now ?? Date.now;
    this.state = this.freshState();
    this.heartbeatAt = this.now();
  }

  get isStarted(): boolean {
    return this.started;
  }

  private freshState(): WatchState {
    return {
      sessionId: this.deps.newSessionId(),
      contentId: this.init.contentId,
      durationMs: this.init.durationMs,
      position: this.init.position,
      watchedMsTotal: 0,
      maxContinuousMs: 0,
      loopCount: 0,
      speed: this.init.speed,
    };
  }

  /** The element is playing (the `playing` event). Starts the session once. */
  playing(info: StartInfo): void {
    if (this.started || this.hidden) return;
    this.started = true;
    if (!this.state.durationMs && info.durationMs) this.state.durationMs = Math.round(info.durationMs);
    this.heartbeatAt = this.now();
    this.deps.send(
      [buildPlayStart(this.state, { startMethod: info.autoplay ? "autoplay" : "tap", isMuted: info.muted, isAutoplay: info.autoplay })],
      { unload: false },
    );
  }

  seeking(currentMs: number): void {
    const last = this.last;
    const d = this.state.durationMs;
    if (this.started && last !== null && d > 0 && last >= d - MAX_STEP_MS && currentMs <= LOOP_RESTART_MS) this.state.loopCount += 1;
    this.continuous = 0;
    this.last = null;
  }

  pause(): void {
    this.continuous = 0;
    this.last = null;
  }

  ended(): void {
    this.endedNaturally = true;
  }

  /** The 250 ms tick. Counts only inside a started session. */
  tick(s: TickSample): void {
    if (!this.started || this.hidden) {
      this.last = null;
      return;
    }
    if (s.paused || s.seeking || s.readyState < 2) {
      if (s.paused) this.last = null;
      return;
    }
    const nowMs = s.currentMs;
    const last = this.last;
    this.last = nowMs;
    if (last === null) return;
    const step = nowMs - last;
    if (step < 0) {
      // Wrapped to the start without a seeking event: a loop when we were near the end.
      if (this.state.durationMs > 0 && last > this.state.durationMs - MAX_STEP_MS) this.state.loopCount += 1;
      this.continuous = 0;
      return;
    }
    if (step > MAX_STEP_MS) {
      this.continuous = 0;
      return;
    }
    this.state.watchedMsTotal += step;
    this.sinceHeartbeat += step;
    this.continuous += step;
    if (this.continuous > this.state.maxContinuousMs) this.state.maxContinuousMs = this.continuous;
    this.state.speed = s.speed;
    if (this.now() - this.heartbeatAt >= HEARTBEAT_MS && this.sinceHeartbeat > 0) {
      this.heartbeatAt = this.now();
      const inc = this.sinceHeartbeat;
      this.sinceHeartbeat = 0;
      this.deps.send([buildHeartbeat(this.state, { incrementMs: inc, playheadMs: nowMs })], { unload: false });
    }
  }

  /** Ends the session: one play_end, by keepalive. A second call does nothing. */
  end(reason?: EndReason): void {
    if (!this.started) return;
    this.started = false;
    this.last = null;
    this.continuous = 0;
    if (this.state.watchedMsTotal <= 0) return;
    const why = reason ?? (this.endedNaturally ? "ended" : "swipe_next");
    this.deps.send([buildPlayEnd(this.state, why)], { unload: true });
  }

  /** The tab went to the background. */
  hide(): void {
    if (this.hidden) return;
    this.end("backgrounded");
    this.hidden = true;
  }

  /** The tab is visible again: a new session, started now when the element is still playing. */
  show(playingNow: boolean, info: StartInfo): void {
    if (!this.hidden) return;
    this.hidden = false;
    this.state = this.freshState();
    this.sinceHeartbeat = 0;
    this.endedNaturally = false;
    if (playingNow) this.playing(info);
  }
}
