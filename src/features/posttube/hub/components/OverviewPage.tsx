"use client";

import Link from "next/link";
import { Pencil, Upload } from "lucide-react";

import { formatCount, formatDuration, timeAgo } from "@/features/posttube/model";
import { watchHref } from "../hubApi";
import { VISIBILITY_LABEL, formatDelta, formatWatchTime, rowDate } from "../hubModel";
import { useCreatorInsights, useHubLibrary, useHubSummary } from "../hooks/useHub";
import { LiveBars, Sparkline } from "./Charts";
import { HubHead } from "./HubFrame";
import { HubError, HubSkeleton, OverviewEmpty } from "./HubEmpty";
import { FlagPills, VisibilityIcon } from "./Pills";

/**
  Overview: the latest video, five count tiles from /v1/posts/me/summary,
  the 48 h live counter, and a 28-day insights teaser.
*/
export function OverviewPage() {
  const summary = useHubSummary();
  const library = useHubLibrary("videos");
  const insights = useCreatorInsights("28d");
  const latest = library.rows[0] ?? null;
  const rt = insights.data?.realtime;

  const nothingYet = !library.isPending && library.rows.length === 0 && (summary.data ? summary.data.videos + summary.data.shorts + summary.data.live === 0 : true);

  return (
    <>
      <HubHead
        title="Overview"
        sub="Your channel at a glance."
        actions={
          <Link href="/posttube/upload" className="hub-btn hub-btn-primary">
            <Upload /> Upload
          </Link>
        }
      />

      {nothingYet ? (
        <div className="hub-card">
          <OverviewEmpty />
        </div>
      ) : null}

      <div className="hub-grid hub-grid-tiles" style={{ marginBottom: 12 }}>
        {(
          [
            ["Videos", summary.data?.videos],
            ["Shorts", summary.data?.shorts],
            ["Live", summary.data?.live],
            ["Collections", summary.data?.collections],
            ["Followers", summary.data?.followers],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="hub-tile">
            <div className="hub-tile-label">{label}</div>
            <div className="hub-tile-value">{summary.isPending ? <span className="hub-skel" style={{ display: "inline-block", width: 40, height: 20 }} /> : summary.isError ? "—" : formatCount(value ?? 0)}</div>
          </div>
        ))}
      </div>

      <div className="hub-grid hub-grid-2">
        <section className="hub-card hub-card-pad">
          <div className="hub-section-head" style={{ marginBottom: 10 }}>
            <span className="hub-section-title">Latest video</span>
            <Link href="/posttube/hub/library" className="hub-link">
              Library
            </Link>
          </div>
          {library.isPending ? (
            <HubSkeleton rows={1} height={90} />
          ) : library.isError ? (
            <HubError />
          ) : !latest ? (
            <div className="hub-hint">No videos yet.</div>
          ) : (
            <div className="hub-latest">
              <Link href={watchHref(latest)} className="hub-thumb" aria-label={latest.title}>
                {latest.thumbnail_url ? <img src={latest.thumbnail_url} alt="" /> : null}
                {latest.duration_seconds > 0 ? <span className="hub-thumb-dur">{formatDuration(latest.duration_seconds)}</span> : null}
              </Link>
              <div style={{ minWidth: 0 }}>
                <Link href={watchHref(latest)} className="hub-link" style={{ fontSize: 13, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {latest.title}
                </Link>
                <div className="hub-row hub-row-wrap" style={{ marginTop: 4, fontSize: 11, color: "rgb(var(--text-muted))" }}>
                  <span className="hub-vis-pill" data-vis={latest.visibility} style={{ cursor: "default" }}>
                    <VisibilityIcon visibility={latest.visibility} /> {VISIBILITY_LABEL[latest.visibility]}
                  </span>
                  <span>{timeAgo(rowDate(latest))}</span>
                  <FlagPills flags={latest.flags} />
                </div>
                <div className="hub-row" style={{ marginTop: 8, gap: 14, fontSize: 12 }}>
                  <span>
                    <strong>{formatCount(latest.view_count)}</strong> <span className="hub-hint">views</span>
                  </span>
                  <span>
                    <strong>{formatCount(latest.comment_count)}</strong> <span className="hub-hint">comments</span>
                  </span>
                  <span>
                    <strong>{formatCount(latest.like_count)}</strong> <span className="hub-hint">loves</span>
                  </span>
                </div>
                <div className="hub-row" style={{ marginTop: 10 }}>
                  <Link href={`/posttube/hub/library?edit=${latest.id}`} className="hub-btn hub-btn-sm">
                    <Pencil /> Edit
                  </Link>
                  <Link href={`/posttube/hub/insights/${latest.id}`} className="hub-btn hub-btn-sm">
                    Insights
                  </Link>
                  <Link href={`/posttube/hub/conversations?post=${latest.id}`} className="hub-btn hub-btn-sm">
                    Conversations
                  </Link>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="hub-card hub-card-pad">
          <div className="hub-section-head" style={{ marginBottom: 6 }}>
            <span className="hub-section-title">Live views · last 48 h</span>
            <Link href="/posttube/hub/insights" className="hub-link">
              Insights
            </Link>
          </div>
          {insights.isPending ? (
            <HubSkeleton rows={1} height={70} />
          ) : insights.isError ? (
            <div className="hub-hint">Live views are not available right now.</div>
          ) : (
            <>
              <div className="hub-tile-value" aria-live="polite">
                {formatCount(rt?.views_48h ?? 0)}
              </div>
              <div className="hub-tile-sub" style={{ marginBottom: 6 }}>
                views in the last 48 hours, per hour below
              </div>
              <LiveBars values={rt?.series_48h ?? []} />
            </>
          )}
        </section>
      </div>

      <section className="hub-section">
        <div className="hub-section-head">
          <span className="hub-section-title">Insights · last 28 days</span>
          <Link href="/posttube/hub/insights" className="hub-link">
            See all
          </Link>
        </div>
        {insights.isPending ? (
          <HubSkeleton rows={1} height={64} />
        ) : insights.isError ? (
          <div className="hub-note">Insights are not available right now.</div>
        ) : (
          <div className="hub-grid hub-grid-tiles">
            <div className="hub-tile">
              <div className="hub-tile-label">Views</div>
              <div className="hub-tile-value">{formatCount(insights.data.views)}</div>
              <div className="hub-tile-sub">
                <Sparkline values={insights.data.views_by_day.length ? insights.data.views_by_day.map((p) => p.views) : insights.data.realtime.series_48h} width={96} height={20} />
              </div>
            </div>
            <div className="hub-tile">
              <div className="hub-tile-label">Watch time</div>
              <div className="hub-tile-value">{formatWatchTime(insights.data.watch_time_ms)}</div>
            </div>
            <div className="hub-tile">
              <div className="hub-tile-label">Unique viewers</div>
              <div className="hub-tile-value">{formatCount(insights.data.unique_viewers)}</div>
            </div>
            <div className="hub-tile">
              <div className="hub-tile-label">Followers</div>
              <div className={`hub-tile-value ${(insights.data.followers_delta ?? 0) > 0 ? "hub-tile-up" : (insights.data.followers_delta ?? 0) < 0 ? "hub-tile-down" : ""}`}>{formatDelta(insights.data.followers_delta)}</div>
              <div className="hub-tile-sub">{insights.data.followers_delta === null ? "not tracked yet" : "in the period"}</div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
