"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CalendarClock, Radio, Users } from "lucide-react";
import type { LiveStream } from "@/hooks/useLiveV2";
import { formatCount, mediaServeUrl, timeAgo } from "../../model";
import type { PostTubeVideo } from "../../types";
import { VideoCard } from "../../components/VideoCard";
import { VideoGridSkeleton } from "../../components/HomePage";
import { formatScheduled, groupUpcomingByDay } from "../discoveryModel";
import { useLiveDiscovery } from "../hooks/useDiscovery";
import { EmptyState, ErrorState, LoadMore, TileSkeleton } from "./DiscoveryState";
import { PageHead } from "./PageHead";
import type { ViewStatus } from "./TrendingPage";
import "../../components/tube.css";
import "../discovery.css";

export function LiveStreamCard({ stream, creatorName, now }: { stream: LiveStream; creatorName?: string; now?: number }) {
  const upcoming = stream.status === "scheduled";
  const cover = stream.cover_media_id ? mediaServeUrl(stream.cover_media_id) : "";
  const meta = [creatorName || "", upcoming ? "" : stream.started_at ? `started ${timeAgo(stream.started_at)}` : ""].filter(Boolean).join(" · ");
  return (
    <Link href={`/live/${stream.id}`} className="disco-live" data-status={stream.status}>
      <span className="disco-live__cover">
        {cover ? <img src={cover} alt="" loading="lazy" /> : <Radio strokeWidth={1.75} aria-hidden />}
        {upcoming ? (
          <span className="disco-live__badge is-upcoming">
            <CalendarClock size={12} strokeWidth={2} aria-hidden />
            {formatScheduled(stream.scheduled_at, now) || "Soon"}
          </span>
        ) : (
          <span className="disco-live__badge">
            <span className="disco-live__dot" aria-hidden />
            Live
          </span>
        )}
        {!upcoming && stream.viewer_peak > 0 ? (
          <span className="disco-live__viewers">
            <Users strokeWidth={2} aria-hidden />
            {formatCount(stream.viewer_peak)}
          </span>
        ) : null}
      </span>
      <span className="disco-live__body">
        <p className="disco-live__title">{stream.title || "Untitled stream"}</p>
        {meta ? <p className="disco-live__meta">{meta}</p> : null}
      </span>
    </Link>
  );
}

export interface LiveViewProps {
  /** Live now (the page-level state: loading and error cover the whole screen). */
  status: ViewStatus;
  live: LiveStream[];
  /** `?status=scheduled` rows; grouped by day here. */
  upcoming: LiveStream[];
  creatorNames: Record<string, string>;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onRetry?: () => void;
  upcomingHasMore?: boolean;
  upcomingLoadingMore?: boolean;
  onUpcomingMore?: () => void;
  /** Recordings that became videos (`GET /v1/posts/live-recordings`), as tube tiles. */
  past?: PostTubeVideo[];
  pastStatus?: ViewStatus;
  pastHasMore?: boolean;
  pastLoadingMore?: boolean;
  onPastMore?: () => void;
  onPastRetry?: () => void;
  /** The clock the day headings are measured from (tests pin it). */
  now?: number;
}

const noop = () => {};

/** The pure screen: Live now, Upcoming by day, then Past streams. */
export function LiveView({
  status,
  live,
  upcoming,
  creatorNames,
  hasMore,
  loadingMore,
  onLoadMore,
  onRetry,
  upcomingHasMore = false,
  upcomingLoadingMore = false,
  onUpcomingMore = noop,
  past = [],
  pastStatus = "ready",
  pastHasMore = false,
  pastLoadingMore = false,
  onPastMore = noop,
  onPastRetry,
  now,
}: LiveViewProps) {
  const days = useMemo(() => groupUpcomingByDay(upcoming, now), [upcoming, now]);
  const upcomingCount = days.reduce((n, d) => n + d.streams.length, 0);
  const showPast = pastStatus !== "ready" || past.length > 0;
  const nothing = live.length === 0 && upcomingCount === 0 && !showPast;
  return (
    <div className="disco-page" data-screen="live">
      <PageHead
        icon={<Radio strokeWidth={1.75} />}
        title="Live"
        sub="Broadcasts happening now, what is coming up, and the ones you missed"
        aside={
          <Link href="/live/new" className="disco-pill">
            <Radio size={14} strokeWidth={2} aria-hidden />
            Go live
          </Link>
        }
      />
      {status === "loading" ? (
        <TileSkeleton count={4} />
      ) : status === "error" ? (
        <ErrorState what="live streams" onRetry={onRetry} />
      ) : nothing ? (
        <EmptyState icon={<Radio size={20} strokeWidth={1.75} />} title="Nobody is live right now" body="Streams show here the moment they start. You could be first." actionHref="/live/new" actionLabel="Go live" />
      ) : (
        <>
          <section className="disco-section" aria-labelledby="disco-live-now">
            <div className="disco-section__head">
              <h2 id="disco-live-now" className="disco-section__title">
                Live now
              </h2>
              <span className="disco-section__count">{live.length}</span>
            </div>
            {live.length === 0 ? (
              <p className="disco-section__note">Nobody is live at the moment.</p>
            ) : (
              <div className="disco-grid">
                {live.map((s) => (
                  <LiveStreamCard key={s.id} stream={s} creatorName={creatorNames[s.creator_user_id]} />
                ))}
              </div>
            )}
            <LoadMore hasMore={hasMore} loading={loadingMore} onLoadMore={onLoadMore} />
          </section>

          <section className="disco-section" aria-labelledby="disco-upcoming" data-section="upcoming">
            <div className="disco-section__head">
              <h2 id="disco-upcoming" className="disco-section__title">
                Upcoming
              </h2>
              <span className="disco-section__count">{upcomingCount}</span>
            </div>
            {days.length === 0 ? (
              <p className="disco-section__note">Nothing scheduled yet.</p>
            ) : (
              days.map((day) => (
                <div key={day.key} className="disco-day" data-day={day.key}>
                  <h3 className="disco-day__title">{day.label}</h3>
                  <div className="disco-grid">
                    {day.streams.map((s) => (
                      <LiveStreamCard key={s.id} stream={s} creatorName={creatorNames[s.creator_user_id]} now={now} />
                    ))}
                  </div>
                </div>
              ))
            )}
            <LoadMore hasMore={upcomingHasMore} loading={upcomingLoadingMore} onLoadMore={onUpcomingMore} />
          </section>

          {showPast ? (
            <section className="disco-section" aria-labelledby="disco-past" data-section="past">
              <div className="disco-section__head">
                <h2 id="disco-past" className="disco-section__title">
                  Past streams
                </h2>
              </div>
              {pastStatus === "loading" ? (
                <VideoGridSkeleton count={4} />
              ) : pastStatus === "error" ? (
                <ErrorState what="past streams" onRetry={onPastRetry} />
              ) : (
                <>
                  <div className="tube-grid">
                    {past.map((v) => (
                      <VideoCard key={v.id} video={v} />
                    ))}
                  </div>
                  <LoadMore hasMore={pastHasMore} loading={pastLoadingMore} onLoadMore={onPastMore} />
                </>
              )}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

export function LivePage() {
  const { streams, scheduled, past, live, upcoming, pastVideos, creatorNames } = useLiveDiscovery(24);
  const status: ViewStatus = streams.isLoading ? "loading" : streams.isError ? "error" : "ready";
  const pastStatus: ViewStatus = past.isLoading ? "loading" : past.isError ? "error" : "ready";
  return (
    <LiveView
      status={status}
      live={live}
      upcoming={upcoming}
      creatorNames={creatorNames}
      hasMore={!!streams.hasNextPage}
      loadingMore={streams.isFetchingNextPage}
      onLoadMore={() => void streams.fetchNextPage()}
      onRetry={() => void streams.refetch()}
      upcomingHasMore={!!scheduled.hasNextPage}
      upcomingLoadingMore={scheduled.isFetchingNextPage}
      onUpcomingMore={() => void scheduled.fetchNextPage()}
      past={pastVideos}
      pastStatus={pastStatus}
      pastHasMore={!!past.hasNextPage}
      pastLoadingMore={past.isFetchingNextPage}
      onPastMore={() => void past.fetchNextPage()}
      onPastRetry={() => void past.refetch()}
    />
  );
}
