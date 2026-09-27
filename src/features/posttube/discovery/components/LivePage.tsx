"use client";

import Link from "next/link";
import { CalendarClock, Radio, Users } from "lucide-react";
import type { LiveStream } from "@/hooks/useLiveV2";
import { formatCount, mediaServeUrl, timeAgo } from "../../model";
import { PAST_STREAMS_AVAILABLE } from "../discoveryApi";
import { formatScheduled } from "../discoveryModel";
import { useLiveDiscovery } from "../hooks/useDiscovery";
import { EmptyState, ErrorState, LoadMore, TileSkeleton } from "./DiscoveryState";
import { PageHead } from "./PageHead";
import type { ViewStatus } from "./TrendingPage";
import "../discovery.css";

export function LiveStreamCard({ stream, creatorName }: { stream: LiveStream; creatorName?: string }) {
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
            {formatScheduled(stream.scheduled_at) || "Soon"}
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
  status: ViewStatus;
  live: LiveStream[];
  upcoming: LiveStream[];
  creatorNames: Record<string, string>;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onRetry?: () => void;
}

/** The pure screen: Live now, then Upcoming. Past streams wait on the VOD route (see discoveryApi.PAST_STREAMS_ROUTE). */
export function LiveView({ status, live, upcoming, creatorNames, hasMore, loadingMore, onLoadMore, onRetry }: LiveViewProps) {
  const nothing = live.length === 0 && upcoming.length === 0;
  return (
    <div className="disco-page" data-screen="live">
      <PageHead
        icon={<Radio strokeWidth={1.75} />}
        title="Live"
        sub="Broadcasts happening now, and what is coming up"
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
          <section className="disco-section" aria-labelledby="disco-upcoming">
            <div className="disco-section__head">
              <h2 id="disco-upcoming" className="disco-section__title">
                Upcoming
              </h2>
              <span className="disco-section__count">{upcoming.length}</span>
            </div>
            {upcoming.length === 0 ? (
              <p className="disco-section__note">Nothing scheduled yet.</p>
            ) : (
              <div className="disco-grid">
                {upcoming.map((s) => (
                  <LiveStreamCard key={s.id} stream={s} creatorName={creatorNames[s.creator_user_id]} />
                ))}
              </div>
            )}
          </section>
          {/*
            TODO(live VOD): "Past streams" — the plan pins these as long_video posts with
            source = "live" (post-service consumes live.stream.vod_ready). Mount a third
            section here on discoveryApi.getPastStreams once GET /v1/feed/videos?source=live
            exists; PAST_STREAMS_AVAILABLE flips in the adapter, nothing else changes.
          */}
          {PAST_STREAMS_AVAILABLE ? null : null}
        </>
      )}
    </div>
  );
}

export function LivePage() {
  const { streams, live, upcoming, creatorNames } = useLiveDiscovery(24);
  const status: ViewStatus = streams.isLoading ? "loading" : streams.isError ? "error" : "ready";
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
    />
  );
}
