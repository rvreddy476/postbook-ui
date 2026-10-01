"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { MonitorPlay } from "lucide-react";

import { useAuthUser } from "@/store/auth";
import { useUserStreams } from "@/hooks/useLiveV2";
import { hostScreenHref, liveOnly, upcomingOnly, type StreamRow } from "@/features/live/discovery";
import { ReminderButton } from "@/features/live/components/ReminderButton";
import { LoadMore } from "../discovery/components/DiscoveryState";
import { LiveStreamCard } from "./LiveCards";

import "../discovery/discovery.css";
import "./live.css";

/**
 * The LIVE ring on a channel avatar. With `href` (the creator is live:
 * status === "live") the avatar is ringed, tagged LIVE and opens the
 * stream; without it the avatar is drawn as it always was.
 */
export function LiveRing({ href, name, children }: { href?: string; name: string; children: ReactNode }) {
  if (!href) return <>{children}</>;
  return (
    <Link href={href} className="tube-live-ring is-live" aria-label={`${name} is live. Watch now`} data-live="true">
      {children}
      <span className="tube-live-ring__tag" aria-hidden>
        LIVE
      </span>
    </Link>
  );
}

/** The channel's stream that is live right now (`GET /users/:userId/streams?status=live`), or null. */
export function useChannelLiveNow(ownerId: string | undefined, enabled = true) {
  const query = useUserStreams(ownerId, "live", { enabled, refetchMs: 60_000, limit: 4 });
  const rows = useMemo(() => liveOnly(query.data?.pages.flatMap((p) => p.items) ?? []), [query.data]);
  return { rows, live: rows[0] ?? null };
}

export interface ChannelLiveViewProps {
  live: StreamRow[];
  upcoming: StreamRow[];
  renderReminder?: (row: StreamRow) => ReactNode;
  upcomingHasMore?: boolean;
  upcomingLoadingMore?: boolean;
  onUpcomingMore?: () => void;
  now?: number;
}

/** Live now and Upcoming on a channel's Live tab; nothing at all when the channel has neither. */
export function ChannelLiveView({ live, upcoming, renderReminder, upcomingHasMore = false, upcomingLoadingMore = false, onUpcomingMore, now }: ChannelLiveViewProps) {
  if (live.length === 0 && upcoming.length === 0) return null;
  return (
    <>
      {live.length > 0 ? (
        <section className="disco-section" aria-labelledby="tube-chan-live-now" data-section="live">
          <h2 id="tube-chan-live-now" className="disco-section__title">
            Live now
          </h2>
          <div className="disco-grid">
            {live.map((s) => (
              <LiveStreamCard key={s.id} row={s} />
            ))}
          </div>
        </section>
      ) : null}
      {upcoming.length > 0 ? (
        <section className="disco-section" aria-labelledby="tube-chan-live-upcoming" data-section="upcoming">
          <h2 id="tube-chan-live-upcoming" className="disco-section__title">
            Upcoming
          </h2>
          <div className="disco-grid">
            {upcoming.map((s) => (
              <LiveStreamCard key={s.id} row={s} now={now} action={renderReminder?.(s)} />
            ))}
          </div>
          <LoadMore hasMore={upcomingHasMore} loading={upcomingLoadingMore} onLoadMore={() => onUpcomingMore?.()} />
        </section>
      ) : null}
    </>
  );
}

/**
 * The top of the channel's Live tab: the creator's live stream and their
 * scheduled ones (`GET /v1/livestream/users/:userId/streams?status=live|upcoming`).
 * A failed or empty read draws nothing; the recordings under it still show.
 */
export function ChannelLiveSections({ ownerId, isOwner, query }: { ownerId: string; isOwner: boolean; query: string }) {
  const user = useAuthUser();
  const { rows: liveRows } = useChannelLiveNow(ownerId);
  const upcomingQuery = useUserStreams(ownerId, "upcoming", { limit: 12 });
  const upcomingRows = useMemo(() => upcomingOnly(upcomingQuery.data?.pages.flatMap((p) => p.items) ?? []), [upcomingQuery.data]);
  const q = query.trim().toLowerCase();
  const match = (r: StreamRow) => !q || r.title.toLowerCase().includes(q);
  return (
    <ChannelLiveView
      live={liveRows.filter(match)}
      upcoming={upcomingRows.filter(match)}
      upcomingHasMore={!!upcomingQuery.hasNextPage}
      upcomingLoadingMore={upcomingQuery.isFetchingNextPage}
      onUpcomingMore={() => void upcomingQuery.fetchNextPage()}
      renderReminder={(row) =>
        isOwner ? (
          <Link href={hostScreenHref(row.id)} className="tube-live-btn">
            <MonitorPlay aria-hidden />
            Host screen
          </Link>
        ) : (
          <ReminderButton streamId={row.id} state={row} signedIn={!!user} returnTo={`/posttube/live/${row.id}`} />
        )
      }
    />
  );
}
