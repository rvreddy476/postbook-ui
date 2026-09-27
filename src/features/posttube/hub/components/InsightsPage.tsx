"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";

import { formatCount } from "@/features/posttube/model";
import { INSIGHTS_PERIODS, watchHref, type InsightsPeriod } from "../hubApi";
import { PERIOD_LABEL, formatDelta, formatMs, formatWatchTime, surfaceLabel } from "../hubModel";
import { useContentInsights, useCreatorInsights, useHubLibrary, useHubPost } from "../hooks/useHub";
import { DayChart, HourChart, RetentionCurve } from "./Charts";
import { HubHead } from "./HubFrame";
import { HubError, HubSkeleton, InsightsEmpty } from "./HubEmpty";
import { PillGroup } from "./Pills";

function readPeriod(v: string | null): InsightsPeriod {
  return (INSIGHTS_PERIODS as readonly string[]).includes(v ?? "") ? (v as InsightsPeriod) : "28d";
}

function usePeriodParam(): [InsightsPeriod, (p: InsightsPeriod) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const period = readPeriod(params.get("period"));
  const set = (p: InsightsPeriod) => {
    const next = new URLSearchParams(params.toString());
    if (p === "28d") next.delete("period");
    else next.set("period", p);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return [period, set];
}

const PERIOD_OPTIONS = INSIGHTS_PERIODS.map((p) => ({ id: p, label: PERIOD_LABEL[p] }));

/** /posttube/hub/insights?period=7d|28d|90d|365d */
export function InsightsPage() {
  const [period, setPeriod] = usePeriodParam();
  const insights = useCreatorInsights(period);
  const library = useHubLibrary("videos");
  const titles = useMemo(() => new Map(library.rows.map((r) => [r.id, r])), [library.rows]);

  const d = insights.data;
  const hasDays = (d?.views_by_day.length ?? 0) > 0;

  return (
    <>
      <HubHead title="Insights" sub="How your channel is doing." actions={<PillGroup label="Period" value={period} options={PERIOD_OPTIONS} onChange={setPeriod} />} />

      {insights.isPending ? (
        <HubSkeleton rows={4} height={64} />
      ) : insights.isError || !d ? (
        <HubError message="Insights are not available right now." />
      ) : (
        <>
          <div className="hub-grid hub-grid-tiles" style={{ marginBottom: 12 }}>
            <div className="hub-tile">
              <div className="hub-tile-label">Views</div>
              <div className="hub-tile-value">{formatCount(d.views)}</div>
            </div>
            <div className="hub-tile">
              <div className="hub-tile-label">Watch time</div>
              <div className="hub-tile-value">{formatWatchTime(d.watch_time_ms)}</div>
            </div>
            <div className="hub-tile">
              <div className="hub-tile-label">Unique viewers</div>
              <div className="hub-tile-value">{formatCount(d.unique_viewers)}</div>
            </div>
            <div className="hub-tile">
              <div className="hub-tile-label">Followers</div>
              <div className={`hub-tile-value ${(d.followers_delta ?? 0) > 0 ? "hub-tile-up" : (d.followers_delta ?? 0) < 0 ? "hub-tile-down" : ""}`}>{formatDelta(d.followers_delta)}</div>
              <div className="hub-tile-sub">{d.followers_delta === null ? "not tracked yet" : PERIOD_LABEL[period].toLowerCase()}</div>
            </div>
          </div>

          <section className="hub-card hub-card-pad">
            <div className="hub-section-head">
              <span className="hub-section-title">{hasDays ? "Views by day" : "Views per hour · last 48 h"}</span>
              <span className="hub-hint">{hasDays ? PERIOD_LABEL[period] : "daily series not available for this period yet"}</span>
            </div>
            {d.views === 0 && !d.realtime.series_48h.some((v) => v > 0) ? <InsightsEmpty /> : hasDays ? <DayChart points={d.views_by_day} /> : <HourChart values={d.realtime.series_48h} />}
          </section>

          <section className="hub-section">
            <div className="hub-section-head">
              <span className="hub-section-title">Top content</span>
              <Link href="/posttube/hub/library" className="hub-link">
                Library
              </Link>
            </div>
            <div className="hub-card hub-card-pad">
              {d.top_content.length === 0 ? (
                <div className="hub-hint">Nothing was watched in this period.</div>
              ) : (
                <ol className="hub-list">
                  {d.top_content.map((t, i) => {
                    const row = titles.get(t.content_id);
                    const max = d.top_content[0]?.views || 1;
                    return (
                      <li key={t.content_id}>
                        <span className="num" style={{ width: 18 }}>
                          {i + 1}
                        </span>
                        <span className="grow">
                          <Link href={`/posttube/hub/insights/${t.content_id}`} className="hub-link">
                            {row?.title ?? t.content_id.slice(0, 8)}
                          </Link>
                        </span>
                        <span className="hub-bar" aria-hidden="true">
                          <span style={{ width: `${Math.max(2, Math.round((t.views / max) * 100))}%` }} />
                        </span>
                        <span className="num" style={{ width: 64, textAlign: "right" }}>
                          {formatCount(t.views)}
                        </span>
                        <span className="num" style={{ width: 64, textAlign: "right" }}>
                          {formatWatchTime(t.watch_time_ms)}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}

/** /posttube/hub/insights/[postId]?period= */
export function ContentInsightsPage({ postId }: { postId: string }) {
  const [period, setPeriod] = usePeriodParam();
  const post = useHubPost(postId);
  const insights = useContentInsights(postId, period);
  const d = insights.data;
  const title = post.data?.title || "Untitled";

  return (
    <>
      <div className="hub-row" style={{ marginBottom: 8 }}>
        <Link href="/posttube/hub/insights" className="hub-btn hub-btn-sm">
          <ArrowLeft /> Insights
        </Link>
      </div>
      <HubHead
        title={post.isPending ? "…" : title}
        sub={
          post.data ? (
            <Link href={watchHref({ id: post.data.id, content_type: post.data.content_type })} className="hub-link">
              Open the video
            </Link>
          ) : null
        }
        actions={<PillGroup label="Period" value={period} options={PERIOD_OPTIONS} onChange={setPeriod} />}
      />

      {insights.isPending ? (
        <HubSkeleton rows={4} height={64} />
      ) : insights.isError || !d ? (
        <HubError message="No insights for this video yet." />
      ) : (
        <>
          <div className="hub-grid hub-grid-tiles" style={{ marginBottom: 12 }}>
            <div className="hub-tile">
              <div className="hub-tile-label">Views</div>
              <div className="hub-tile-value">{formatCount(d.views)}</div>
            </div>
            <div className="hub-tile">
              <div className="hub-tile-label">Average watched</div>
              <div className="hub-tile-value">{formatMs(d.average_view_duration_ms)}</div>
              <div className="hub-tile-sub">per view</div>
            </div>
            <div className="hub-tile">
              <div className="hub-tile-label">Watched to</div>
              <div className="hub-tile-value">{Math.round(d.average_percent_viewed)}%</div>
              <div className="hub-tile-sub">of the video, on average</div>
            </div>
            <div className="hub-tile">
              <div className="hub-tile-label">Surfaces</div>
              <div className="hub-tile-value">{d.traffic.length}</div>
              <div className="hub-tile-sub">places it was found</div>
            </div>
          </div>

          <div className="hub-grid hub-grid-2">
            <section className="hub-card hub-card-pad">
              <div className="hub-section-head">
                <span className="hub-section-title">Views by day</span>
                <span className="hub-hint">{PERIOD_LABEL[period]}</span>
              </div>
              {d.views_by_day.length === 0 ? <InsightsEmpty /> : <DayChart points={d.views_by_day} />}
            </section>
            <section className="hub-card hub-card-pad">
              <div className="hub-section-head">
                <span className="hub-section-title">Still watching</span>
                <span className="hub-hint">share of viewers at each point</span>
              </div>
              {d.retention.length === 0 ? <div className="hub-hint">The retention curve appears after enough views.</div> : <RetentionCurve points={d.retention} />}
            </section>
          </div>

          <section className="hub-section">
            <div className="hub-section-head">
              <span className="hub-section-title">Where viewers came from</span>
            </div>
            <div className="hub-card hub-card-pad">
              {d.traffic.length === 0 ? (
                <div className="hub-hint">No traffic recorded in this period.</div>
              ) : (
                <ul className="hub-list">
                  {d.traffic.map((t) => {
                    const total = d.traffic.reduce((s, x) => s + x.views, 0) || 1;
                    return (
                      <li key={t.surface}>
                        <span className="grow">{surfaceLabel(t.surface)}</span>
                        <span className="hub-bar" aria-hidden="true">
                          <span style={{ width: `${Math.max(2, Math.round((t.views / total) * 100))}%` }} />
                        </span>
                        <span className="num" style={{ width: 48, textAlign: "right" }}>
                          {Math.round((t.views / total) * 100)}%
                        </span>
                        <span className="num" style={{ width: 64, textAlign: "right" }}>
                          {formatCount(t.views)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
