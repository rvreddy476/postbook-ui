/*
  Playback telemetry for the reels stage → POST /v1/analytics/events.

  The event names and payload fields are analytics-service's ingest contract
  (internal/service/ingest.go): the heartbeat is `watch_heartbeat`, every
  play event carries a per-play `session_id`, the surface is `reels`, and
  `play_end` carries the totals the display-view rule is computed from. The
  builders are pure so the payloads can be asserted; `sendEvents` is the only
  side effect and is best-effort.
*/

import api, { getCurrentUserId } from "@/lib/api";
import { peekAccessToken } from "@/lib/accessToken";

export const SURFACE = "reels";
export const HEARTBEAT_MS = 5000;

export type EndReason = "ended" | "swipe_next" | "paused" | "backgrounded" | "error";

export interface WatchState {
  sessionId: string;
  contentId: string;
  durationMs: number;
  position: number;
  watchedMsTotal: number;
  maxContinuousMs: number;
  loopCount: number;
  speed: number;
}

interface AnalyticsEvent {
  event_id: string;
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

function eventId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function base(w: WatchState): Record<string, unknown> {
  return {
    content_id: w.contentId,
    session_id: w.sessionId,
    surface: SURFACE,
    position: w.position,
    content_type: "flick",
  };
}

export function buildPlayStart(
  w: WatchState,
  opts: { startMethod: "autoplay" | "tap" | "resume"; isMuted: boolean; isAutoplay: boolean },
): AnalyticsEvent {
  return {
    event_id: eventId(),
    type: "play_start",
    timestamp: new Date().toISOString(),
    payload: {
      ...base(w),
      content_duration_ms: Math.max(1, Math.round(w.durationMs)),
      start_method: opts.startMethod,
      is_muted: opts.isMuted,
      is_autoplay: opts.isAutoplay,
    },
  };
}

export function buildHeartbeat(
  w: WatchState,
  opts: { incrementMs: number; playheadMs: number },
): AnalyticsEvent {
  const inc = Math.max(0, Math.min(Math.round(opts.incrementMs), Math.round(w.watchedMsTotal)));
  return {
    event_id: eventId(),
    type: "watch_heartbeat",
    timestamp: new Date().toISOString(),
    payload: {
      ...base(w),
      watched_ms_increment: inc,
      watched_ms_total: Math.round(w.watchedMsTotal),
      playhead_position_ms: Math.max(0, Math.round(opts.playheadMs)),
      playback_speed: w.speed,
      loop_count: Math.min(20, w.loopCount),
      content_duration_ms: Math.max(1, Math.round(w.durationMs)),
    },
  };
}

export function buildPlayEnd(w: WatchState, reason: EndReason): AnalyticsEvent {
  const total = Math.round(w.watchedMsTotal);
  return {
    event_id: eventId(),
    type: "play_end",
    timestamp: new Date().toISOString(),
    payload: {
      ...base(w),
      content_duration_ms: Math.max(1, Math.round(w.durationMs)),
      watched_ms_total: total,
      max_continuous_watch_ms: Math.min(total, Math.round(w.maxContinuousMs)),
      loop_count: Math.min(20, w.loopCount),
      end_reason: reason,
    },
  };
}

/** Fire-and-forget. A failed batch is dropped: telemetry never blocks playback. */
export async function sendEvents(events: AnalyticsEvent[]): Promise<void> {
  if (events.length === 0) return;
  try {
    await api.post("/v1/analytics/events", { events });
  } catch {
    /* best-effort */
  }
}

export interface KeepaliveDeps {
  fetch?: typeof fetch;
  token?: () => string | null;
  userId?: () => string | null;
  apiBase?: string;
}

/**
  play_end must outlive the page (tab closed, navigation, tab hidden and
  then discarded). sendBeacon cannot carry the Authorization header the
  ingest route needs, so this is `fetch(..., { keepalive: true })` with the
  same headers the API client would add (as webPush/signOut.ts does). With
  no token in memory it falls back to the API client, which refreshes one.
*/
export function sendEventsOnUnload(events: AnalyticsEvent[], deps: KeepaliveDeps = {}): void {
  if (events.length === 0) return;
  const doFetch = deps.fetch ?? (typeof fetch !== "undefined" ? fetch : undefined);
  const token = (deps.token ?? peekAccessToken)();
  if (!doFetch || !token) {
    void sendEvents(events);
    return;
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "Idempotency-Key": eventId(),
  };
  const userId = (deps.userId ?? getCurrentUserId)();
  if (userId) headers["X-User-Id"] = userId;
  const base = deps.apiBase ?? (process.env.NEXT_PUBLIC_API_BASE_URL || "");
  try {
    void doFetch(`${base}/v1/analytics/events`, { method: "POST", keepalive: true, headers, body: JSON.stringify({ events }) }).catch(() => undefined);
  } catch {
    /* best-effort */
  }
}
