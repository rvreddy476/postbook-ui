import api from "@/lib/api";

/**
 * Video view telemetry → analytics-service ingest (`POST /v1/analytics/events`).
 *
 * This is the pipeline that produces the *counted/display* view number (and feeds
 * monetization), distinct from the raw `/v1/reels/:id/view` counter. The
 * analytics `VideoViewConsumer` applies the display-view rules (IsDisplayView):
 *   - reel:       watched >= 3s OR >= 25%  (or 1 loop if < 3s)
 *   - long_video: watched >= 30s          (or >= 50% if < 60s)
 * …deduped per session per 24h, then increments Redis `post:views:{id}.display`,
 * which is what the feed/UI reads as `view_count`.
 */

const SESSION_KEY = "vc_view_session";

/** Stable per-tab session id used for view de-duplication. */
function viewSessionId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return `s_${Date.now()}`;
  }
}

export interface VideoPlayEndParams {
  contentId: string;
  creatorId?: string;
  // Canonical short-form type is "flick" (matches post content_type, RPM rates,
  // and creator-fund settlement). "reel" would record a view but never earn.
  contentType: "flick" | "long_video";
  contentDurationMs: number;
  watchedMsTotal: number;
  loopCount?: number;
  endReason?: "swipe_next" | "back" | "ended" | "background" | "error";
  surface?: string;
}

/** Emit a play_end telemetry event. Best-effort — never throws. */
export async function sendVideoPlayEnd(p: VideoPlayEndParams): Promise<void> {
  if (!p.contentId || p.watchedMsTotal <= 0) return;
  const percent =
    p.contentDurationMs > 0
      ? Math.min(100, (p.watchedMsTotal / p.contentDurationMs) * 100)
      : 0;
  const sid = viewSessionId();
  try {
    await api.post(
      "/v1/analytics/events",
      {
        events: [
          {
            type: "play_end",
            payload: {
              content_id: p.contentId,
              creator_id: p.creatorId ?? "",
              session_id: sid,
              content_type: p.contentType,
              content_duration_ms: Math.round(p.contentDurationMs),
              watched_ms_total: Math.round(p.watchedMsTotal),
              percent_viewed: percent,
              loop_count: p.loopCount ?? 0,
              end_reason: p.endReason ?? "ended",
              surface: p.surface ?? "feed",
            },
            timestamp: new Date().toISOString(),
          },
        ],
      },
      { headers: { "X-Session-Id": sid } },
    );
  } catch {
    /* telemetry is best-effort */
  }
}
