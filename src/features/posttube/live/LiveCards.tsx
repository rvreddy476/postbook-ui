import Link from "next/link";
import { CalendarClock, Radio, Users } from "lucide-react";
import type { ReactNode } from "react";

import { creatorName, formatLocalDateTime, isLive, liveWatchHref, reminderCountLabel, type StreamRow } from "@/features/live/discovery";
import { FoundingBadge } from "@/features/live/components/FoundingBadge";
import { formatCount, mediaServeUrl, timeAgo } from "../model";
import { formatScheduled } from "../discovery/discoveryModel";

import "../discovery/discovery.css";
import "./live.css";

/** The red LIVE chip. Rendered only for status === "live"; any other row gets nothing. */
export function LiveChip({ row }: { row: Pick<StreamRow, "status"> }) {
  if (!isLive(row)) return null;
  return (
    <span className="tube-live-chip is-live" data-live="true">
      <span className="tube-live-chip__dot" aria-hidden />
      Live
    </span>
  );
}

export function ViewersChip({ count }: { count: number }) {
  return (
    <span className="tube-live-chip" aria-label={`${count.toLocaleString()} watching`}>
      <Users strokeWidth={2} aria-hidden />
      <span aria-hidden>{formatCount(count)}</span>
    </span>
  );
}

/** Name (never an id) and the Founding creator mark. Plain text: the tile around it is the link. */
export function CreatorLine({ row }: { row: Pick<StreamRow, "creator"> }) {
  return (
    <span className="tube-live-creator">
      <span className="tube-live-creator__name">{creatorName(row.creator)}</span>
      <FoundingBadge badges={row.creator.badges} compact />
    </span>
  );
}

export interface LiveStreamCardProps {
  row: StreamRow;
  /** The topic's label when the row has a category. */
  topic?: string;
  /** The clock "Today · 18:30" is measured from (tests pin it). */
  now?: number;
  /** Under an upcoming tile: Notify me / Reminder set. */
  action?: ReactNode;
}

/**
 * One stream tile. Live rows show the LIVE chip and the CURRENT audience
 * (never the peak); scheduled rows show when, in the viewer's zone, and
 * carry the reminder action under the link.
 */
export function LiveStreamCard({ row, topic, now, action }: LiveStreamCardProps) {
  const upcoming = row.status === "scheduled";
  const cover = row.cover_media_id ? mediaServeUrl(row.cover_media_id) : "";
  const when = formatScheduled(row.scheduled_at, now);
  const meta = [topic || "", isLive(row) && row.started_at ? `started ${timeAgo(row.started_at)}` : ""].filter(Boolean).join(" · ");
  const reminders = reminderCountLabel(row.reminder_count);
  return (
    <article className="tube-live-card" data-status={row.status} data-stream={row.id}>
      <Link href={liveWatchHref(row)} className="disco-live">
        <span className="disco-live__cover">
          {cover ? <img src={cover} alt="" loading="lazy" /> : <Radio strokeWidth={1.75} aria-hidden />}
          {upcoming ? (
            <span className="disco-live__badge is-upcoming">
              <CalendarClock size={12} strokeWidth={2} aria-hidden />
              {when || "Soon"}
            </span>
          ) : isLive(row) ? (
            <span className="disco-live__badge">
              <span className="disco-live__dot" aria-hidden />
              Live
            </span>
          ) : null}
          {isLive(row) ? (
            <span className="disco-live__viewers" aria-label={`${row.viewer_count.toLocaleString()} watching`}>
              <Users strokeWidth={2} aria-hidden />
              {formatCount(row.viewer_count)}
            </span>
          ) : null}
        </span>
        <span className="disco-live__body">
          <p className="disco-live__title">{row.title || "Untitled stream"}</p>
          <CreatorLine row={row} />
          {meta ? <p className="disco-live__meta">{meta}</p> : null}
        </span>
      </Link>
      {upcoming ? (
        <div className="tube-live-card__foot">
          <p className="tube-live-card__when">
            <strong>{formatLocalDateTime(row.scheduled_at) || "Time to be announced"}</strong>
            {reminders}
          </p>
          {action}
        </div>
      ) : null}
    </article>
  );
}
