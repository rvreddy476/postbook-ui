"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, BarChart3, Clapperboard, Clock3, Eye, Heart, Layers3, MessageCircle, Pencil, Radio, Upload, Users, Video } from "lucide-react";
import type { ReactNode } from "react";
import { formatCount, timeAgo } from "@/features/posttube/model";
import { watchHref, type HubCreatorInsights, type HubLibraryRow, type HubSummary } from "../hubApi";
import { VISIBILITY_LABEL, formatDelta, formatWatchTime, rowDate } from "../hubModel";
import { DayChart, LiveBars } from "./Charts";
import { HubHead } from "./HubFrame";
import { HubSkeleton, LibraryEmpty, OverviewEmpty } from "./HubEmpty";
import { HubThumbnail } from "./HubThumbnail";
import { FlagPills, VisibilityIcon } from "./Pills";

export interface OverviewResource<T> {
  data?: T;
  pending?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

/** Presentation is separate from queries so loading/error/empty states are testable. */
export function OverviewDashboard({ summary, library, insights }: {
  summary: OverviewResource<HubSummary>;
  library: OverviewResource<HubLibraryRow[]>;
  insights: OverviewResource<HubCreatorInsights>;
}) {
  const latest = library.data?.[0];
  const data = insights.data;
  const nothingYet = !summary.pending && !summary.error && summary.data &&
    summary.data.videos + summary.data.shorts + summary.data.live === 0 &&
    !library.pending && !library.error && library.data?.length === 0;
  const counts = [
    { label: "Videos", value: summary.data?.videos, icon: Video, href: "/posttube/hub/library?tab=videos" },
    { label: "Shorts", value: summary.data?.shorts, icon: Clapperboard, href: "/posttube/hub/library?tab=shorts" },
    { label: "Live", value: summary.data?.live, icon: Radio, href: "/posttube/hub/library?tab=live" },
    { label: "Collections", value: summary.data?.collections, icon: Layers3, href: "/posttube/hub/library?tab=collections" },
    { label: "Subscribers", value: summary.data?.followers, icon: Users, href: "/posttube/hub/insights" },
  ];

  return <div className="hub-overview">
    <HubHead title="Channel overview" sub="Content, audience and recent performance." actions={<>
      <Link href="/posttube/channel" className="hub-btn"><ArrowUpRight aria-hidden="true" /> View channel</Link>
      <Link href="/posttube/upload" className="hub-btn hub-btn-primary"><Upload aria-hidden="true" /> Upload video</Link>
    </>} />

    {nothingYet ? <div className="hub-card"><OverviewEmpty /></div> : null}

    <section aria-label="Channel totals" className="hub-overview-totals">
      {summary.error ? <OverviewError message="Channel totals couldn't load." onRetry={summary.onRetry} /> : null}
      <div className="hub-summary-grid" aria-busy={summary.pending || undefined}>
        {counts.map(({ label, value, icon: Icon, href }) => <Link key={label} href={href} className="hub-summary-card">
          <span className="hub-summary-icon"><Icon aria-hidden="true" /></span>
          <span className="hub-summary-copy"><span className="hub-summary-label">{label}</span>
            <span className="hub-summary-value">{summary.pending ? <span className="hub-skel hub-stat-skeleton" aria-label="Loading" /> : summary.error || value === undefined ? <span aria-label="Unavailable">—</span> : formatCount(value)}</span>
          </span>
          <ArrowUpRight className="hub-summary-arrow" aria-hidden="true" />
        </Link>)}
      </div>
    </section>

    <div className="hub-overview-panels">
      <section className="hub-card hub-overview-card" aria-labelledby="hub-latest-title">
        <SectionHeading id="hub-latest-title" title="Latest video" href="/posttube/hub/library" action="View library" />
        {library.pending ? <HubSkeleton rows={1} height={168} /> : library.error ? <OverviewError message="Your latest video couldn't load." onRetry={library.onRetry} /> : !latest ? <LibraryEmpty kind="videos" /> : <div className="hub-overview-latest">
          <Link href={watchHref(latest)} className="hub-thumb hub-overview-poster" aria-label={`Watch ${latest.title}`}><HubThumbnail row={latest} /></Link>
          <div className="hub-overview-video">
            <div className="hub-overview-meta">
              <span className="hub-vis-pill" data-vis={latest.visibility}><VisibilityIcon visibility={latest.visibility} /> {VISIBILITY_LABEL[latest.visibility]}</span>
              {rowDate(latest) ? <span>{timeAgo(rowDate(latest))}</span> : null}
            </div>
            <Link href={watchHref(latest)} className="hub-overview-video-title">{latest.title}</Link>
            {latest.flags.length ? <FlagPills flags={latest.flags} /> : null}
            <dl className="hub-overview-video-stats">
              <MiniStat icon={<Eye aria-hidden="true" />} label="views" value={latest.view_count} />
              <MiniStat icon={<MessageCircle aria-hidden="true" />} label="comments" value={latest.comment_count} />
              <MiniStat icon={<Heart aria-hidden="true" />} label="loves" value={latest.like_count} />
            </dl>
            <div className="hub-overview-video-actions">
              <Link href={`/posttube/hub/library?edit=${latest.id}`} className="hub-btn"><Pencil aria-hidden="true" /> Edit video</Link>
              <Link href={`/posttube/hub/insights/${latest.id}`} className="hub-btn"><BarChart3 aria-hidden="true" /> Insights</Link>
              <Link href={`/posttube/hub/conversations?post=${latest.id}`} className="hub-link hub-overview-discuss">Conversations <ArrowRight aria-hidden="true" /></Link>
            </div>
          </div>
        </div>}
      </section>

      <section className="hub-card hub-overview-card hub-overview-realtime" aria-labelledby="hub-realtime-title">
        <SectionHeading id="hub-realtime-title" title="Realtime" trailing={<span className="hub-period">Last 48 hours</span>} />
        {insights.pending ? <HubSkeleton rows={1} height={168} /> : insights.error || !data ? <OverviewError message="Realtime views couldn't load." onRetry={insights.onRetry} /> : <>
          <div className="hub-realtime-total">{formatCount(data.realtime.views_48h)} <span>views</span></div>
          <p className="hub-overview-caption">Views per hour across your channel</p>
          <div className="hub-realtime-chart"><LiveBars values={data.realtime.series_48h} /></div>
          <div className="hub-realtime-axis"><span>48 hours ago</span><span>Now</span></div>
          <Link href="/posttube/hub/insights" className="hub-link hub-realtime-link">Explore insights <ArrowRight aria-hidden="true" /></Link>
        </>}
      </section>
    </div>

    <section className="hub-card hub-overview-card hub-performance" aria-labelledby="hub-performance-title">
      <SectionHeading id="hub-performance-title" title="Channel performance" href="/posttube/hub/insights" action="View insights" trailing={<span className="hub-period">Last 28 days</span>} />
      {insights.pending ? <HubSkeleton rows={1} height={110} /> : insights.error || !data ? <OverviewError message="Channel performance couldn't load." onRetry={insights.onRetry} /> : <>
        <div className="hub-performance-grid">
          <PerformanceMetric icon={<Eye aria-hidden="true" />} label="Views" value={formatCount(data.views)} note="Across your content" />
          <PerformanceMetric icon={<Clock3 aria-hidden="true" />} label="Watch time" value={formatWatchTime(data.watch_time_ms)} note="Time spent watching" />
          <PerformanceMetric icon={<Users aria-hidden="true" />} label="Unique viewers" value={formatCount(data.unique_viewers)} note="Individual viewers" />
          <PerformanceMetric icon={<Users aria-hidden="true" />} label="Followers" value={formatDelta(data.followers_delta)} note={data.followers_delta === null ? "Not tracked yet" : "Net change in this period"} />
        </div>
        {data.views_by_day.length > 0 ? <div className="hub-performance-chart"><DayChart points={data.views_by_day} ariaLabel="Channel views by day, last 28 days" /></div> : null}
      </>}
    </section>
  </div>;
}

function SectionHeading({ id, title, href, action, trailing }: { id: string; title: string; href?: string; action?: string; trailing?: ReactNode }) {
  return <div className="hub-overview-section-head"><div><h2 id={id}>{title}</h2>{trailing}</div>{href ? <Link className="hub-link" href={href}>{action}<ArrowUpRight aria-hidden="true" /></Link> : null}</div>;
}

function OverviewError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="hub-overview-error" role="status"><span>{message}</span>{onRetry ? <button type="button" className="hub-btn" onClick={onRetry}>Try again</button> : null}</div>;
}

function MiniStat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return <div><dt>{icon}<span>{label}</span></dt><dd>{formatCount(value)}</dd></div>;
}

function PerformanceMetric({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
  return <div className="hub-performance-metric"><div className="hub-performance-label">{icon}<span>{label}</span></div><strong>{value}</strong><span className="hub-overview-caption">{note}</span></div>;
}
