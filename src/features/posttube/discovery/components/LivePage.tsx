"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { CalendarClock, Radio, UserRoundCheck } from "lucide-react";

import { useAuthUser } from "@/store/auth";
import { categoryLabel, hostScreenHref, type LiveCategory, type StreamRow } from "@/features/live/discovery";
import { ReminderButton } from "@/features/live/components/ReminderButton";
import { useLiveNow } from "@/hooks/useLiveV2";
import { formatCount } from "../../model";
import type { PostTubeVideo } from "../../types";
import { VideoCard } from "../../components/VideoCard";
import { VideoGridSkeleton } from "../../components/HomePage";
import { LiveStreamCard } from "../../live/LiveCards";
import { LiveHero } from "../../live/LiveHero";
import { LIVE_PAGE_ORIENTATION, landscapeLive, liveEmptyCopy, type LiveFilter } from "../../live/liveModel";
import { groupUpcomingByDay } from "../discoveryModel";
import { useLiveDiscovery } from "../hooks/useDiscovery";
import { EmptyState, ErrorState, LoadMore, TileSkeleton } from "./DiscoveryState";
import { PageHead } from "./PageHead";
import { PillRow } from "./Pills";
import type { ViewStatus } from "./TrendingPage";
import "../../components/tube.css";
import "../discovery.css";
import "../../live/live.css";

export { LiveStreamCard };

const FILTERS: readonly { value: LiveFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "following", label: "Following" },
];

export interface LiveViewProps {
  /** Live now (the page-level state: loading and error cover the whole screen). */
  status: ViewStatus;
  signedIn: boolean;
  filter: LiveFilter;
  onFilter: (filter: LiveFilter) => void;
  /** The most-watched live stream, drawn by `renderHero`; never repeated in the grid. */
  hero: StreamRow | null;
  /** The live preview (it joins a room, so the page supplies it; without it the hero is a tile). */
  renderHero?: (row: StreamRow) => ReactNode;
  /** Live now without the hero. Every row is status "live". */
  live: StreamRow[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onRetry?: () => void;
  /** Scheduled rows still ahead; grouped by the viewer's local day here. */
  upcoming: StreamRow[];
  upcomingStatus?: ViewStatus;
  upcomingHasMore?: boolean;
  upcomingLoadingMore?: boolean;
  onUpcomingMore?: () => void;
  onUpcomingRetry?: () => void;
  /** Notify me / Reminder set under an upcoming tile (it mutates, so the page supplies it). */
  renderReminder?: (row: StreamRow) => ReactNode;
  /** Topic rails: one row of live streams per topic that has someone live. */
  rails?: ReactNode;
  /** Recordings that became videos (`GET /v1/posts/live-recordings`), as tube tiles. */
  past?: PostTubeVideo[];
  pastStatus?: ViewStatus;
  pastHasMore?: boolean;
  pastLoadingMore?: boolean;
  onPastMore?: () => void;
  onPastRetry?: () => void;
  /** slug → label, from the categories the PostTube pages already load. */
  topics?: ReadonlyArray<{ slug: string; label: string }>;
  /** The clock the day headings are measured from (tests pin it). */
  now?: number;
}

const noop = () => {};

/** The pure screen: hero, Live now, Upcoming events by day, topic rails, then Past streams. */
export function LiveView({
  status,
  signedIn,
  filter,
  onFilter,
  hero,
  renderHero,
  live,
  hasMore,
  loadingMore,
  onLoadMore,
  onRetry,
  upcoming,
  upcomingStatus = "ready",
  upcomingHasMore = false,
  upcomingLoadingMore = false,
  onUpcomingMore = noop,
  onUpcomingRetry,
  renderReminder,
  rails,
  past = [],
  pastStatus = "ready",
  pastHasMore = false,
  pastLoadingMore = false,
  onPastMore = noop,
  onPastRetry,
  topics = [],
  now,
}: LiveViewProps) {
  const days = useMemo(() => groupUpcomingByDay(upcoming, now), [upcoming, now]);
  const upcomingCount = days.reduce((n, d) => n + d.streams.length, 0);
  const following = filter === "following";
  const showPast = !following && (pastStatus !== "ready" || past.length > 0);
  const showUpcoming = upcomingStatus !== "ready" || upcomingCount > 0;
  const liveCount = live.length + (hero ? 1 : 0);
  const nothing = liveCount === 0 && !showUpcoming && !showPast;
  const empty = liveEmptyCopy({ filter, signedIn });
  const topicOf = (row: StreamRow) => categoryLabel(row.category, topics);
  return (
    <div className="disco-page" data-screen="live">
      <PageHead
        icon={<Radio strokeWidth={1.75} />}
        title="Live"
        sub="Broadcasts happening now, what is coming up, and the ones you missed"
        aside={
          signedIn ? (
            <Link href="/live/new" className="disco-pill">
              <Radio size={14} strokeWidth={2} aria-hidden />
              Go live
            </Link>
          ) : null
        }
      />
      <div className="tube-live-bar">
        <PillRow options={FILTERS} value={filter} onChange={onFilter} name="Show" />
      </div>
      {following && !signedIn ? (
        <EmptyState icon={<UserRoundCheck size={20} strokeWidth={1.75} />} title={empty.title} body={empty.body} actionHref={empty.actionHref} actionLabel={empty.actionLabel} />
      ) : status === "loading" ? (
        <TileSkeleton count={4} />
      ) : status === "error" ? (
        <ErrorState what="live streams" onRetry={onRetry} />
      ) : nothing ? (
        <EmptyState icon={<Radio size={20} strokeWidth={1.75} />} title={empty.title} body={empty.body} actionHref={empty.actionHref} actionLabel={empty.actionLabel} />
      ) : (
        <>
          {hero ? renderHero ? renderHero(hero) : <LiveStreamCard row={hero} topic={topicOf(hero)} /> : null}

          <section className="disco-section" aria-labelledby="disco-live-now" data-section="live">
            <div className="disco-section__head">
              <h2 id="disco-live-now" className="disco-section__title">
                Live now
              </h2>
              <span className="disco-section__count">{liveCount}</span>
            </div>
            {liveCount === 0 ? (
              <p className="disco-section__note">{following ? "Nobody you follow is live at the moment." : "Nobody is live at the moment."}</p>
            ) : live.length === 0 ? null : (
              <div className="disco-grid">
                {live.map((s) => (
                  <LiveStreamCard key={s.id} row={s} topic={topicOf(s)} />
                ))}
              </div>
            )}
            <LoadMore hasMore={hasMore} loading={loadingMore} onLoadMore={onLoadMore} />
          </section>

          {showUpcoming ? (
            <section className="disco-section" aria-labelledby="disco-upcoming" data-section="upcoming">
              <div className="disco-section__head">
                <h2 id="disco-upcoming" className="disco-section__title">
                  Upcoming events
                </h2>
                {upcomingStatus === "ready" ? <span className="disco-section__count">{upcomingCount}</span> : null}
              </div>
              {upcomingStatus === "loading" ? (
                <TileSkeleton count={4} />
              ) : upcomingStatus === "error" ? (
                <ErrorState what="upcoming streams" onRetry={onUpcomingRetry} />
              ) : (
                days.map((day) => (
                  <div key={day.key} className="disco-day" data-day={day.key}>
                    <h3 className="disco-day__title">{day.label}</h3>
                    <div className="disco-grid">
                      {day.streams.map((s) => (
                        <LiveStreamCard key={s.id} row={s} topic={topicOf(s)} now={now} action={renderReminder?.(s)} />
                      ))}
                    </div>
                  </div>
                ))
              )}
              <LoadMore hasMore={upcomingHasMore} loading={upcomingLoadingMore} onLoadMore={onUpcomingMore} />
            </section>
          ) : null}

          {following ? null : rails}

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

/** How many topic rails the page draws (the most watched topics first). */
export const MAX_TOPIC_RAILS = 4;

export interface TopicRailViewProps {
  category: LiveCategory;
  rows: StreamRow[];
}

/** One topic: its label, how many are live and watching, and a sideways row of its streams. */
export function TopicRailView({ category, rows }: TopicRailViewProps) {
  if (rows.length === 0) return null;
  const headId = `disco-live-topic-${category.slug}`;
  return (
    <section className="disco-section" aria-labelledby={headId} data-section="topic" data-topic={category.slug}>
      <div className="disco-section__head">
        <h2 id={headId} className="disco-section__title">
          {category.label}
        </h2>
        <span className="disco-section__count">
          {category.live_count} live{category.viewer_count > 0 ? ` · ${formatCount(category.viewer_count)} watching` : ""}
        </span>
        <Link href={`/posttube/topics/${encodeURIComponent(category.slug)}`} className="tube-live-section__more">
          Topic videos
        </Link>
      </div>
      <div className="tube-live-rail">
        {rows.map((s) => (
          <LiveStreamCard key={s.id} row={s} />
        ))}
      </div>
    </section>
  );
}

/** `GET /v1/livestream/streams?status=live&orientation=landscape&category=<slug>`, eight tiles. */
function TopicRail({ category }: { category: LiveCategory }) {
  const query = useLiveNow({ orientation: LIVE_PAGE_ORIENTATION, category: category.slug, sort: "viewers", limit: 8 });
  const rows = useMemo(() => landscapeLive(query.data?.pages.flatMap((p) => p.items) ?? []), [query.data]);
  return <TopicRailView category={category} rows={rows} />;
}

export function LivePage() {
  const user = useAuthUser();
  const signedIn = !!user;
  const [filter, setFilter] = useState<LiveFilter>("all");
  const d = useLiveDiscovery({ filter, signedIn });
  const status: ViewStatus = d.streams.isLoading ? "loading" : d.streams.isError ? "error" : "ready";
  const upcomingStatus: ViewStatus = d.scheduled.isLoading ? "loading" : d.scheduled.isError ? "error" : "ready";
  const pastStatus: ViewStatus = d.past.isLoading ? "loading" : d.past.isError ? "error" : "ready";
  return (
    <LiveView
      status={status}
      signedIn={signedIn}
      filter={filter}
      onFilter={setFilter}
      hero={d.hero}
      renderHero={(row) => <LiveHero key={row.id} row={row} topic={categoryLabel(row.category, d.topics)} />}
      live={d.live}
      hasMore={!!d.streams.hasNextPage}
      loadingMore={d.streams.isFetchingNextPage}
      onLoadMore={() => void d.streams.fetchNextPage()}
      onRetry={() => void d.streams.refetch()}
      upcoming={d.upcoming}
      upcomingStatus={upcomingStatus}
      upcomingHasMore={!!d.scheduled.hasNextPage}
      upcomingLoadingMore={d.scheduled.isFetchingNextPage}
      onUpcomingMore={() => void d.scheduled.fetchNextPage()}
      onUpcomingRetry={() => void d.scheduled.refetch()}
      renderReminder={(row) =>
        user && row.creator_user_id === user.id ? (
          <Link href={hostScreenHref(row.id)} className="tube-live-btn">
            <CalendarClock aria-hidden />
            Host screen
          </Link>
        ) : (
          <ReminderButton streamId={row.id} state={row} signedIn={signedIn} returnTo="/posttube/live" />
        )
      }
      rails={d.categories.slice(0, MAX_TOPIC_RAILS).map((c) => (
        <TopicRail key={c.slug} category={c} />
      ))}
      past={d.pastVideos}
      pastStatus={pastStatus}
      pastHasMore={!!d.past.hasNextPage}
      pastLoadingMore={d.past.isFetchingNextPage}
      onPastMore={() => void d.past.fetchNextPage()}
      onPastRetry={() => void d.past.refetch()}
      topics={d.topics}
    />
  );
}
