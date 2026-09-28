"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { formatCount, formatDuration, timeAgo } from "../../model";
import type { PostTubeVideo } from "../../types";
import { collectionWatchHref } from "../collectionNav";
import type { UpNextChip, UpNextPill } from "../upNext";

/*
  Up next, the right column of the RUTUBE watch layout: rows with a
  168×94 thumb (duration pill), a two-line 14px title, the channel and
  "views · age" on two 12px lines, under the pills All / <topic> /
  Fresh / Seen. When a collection is in play
  (?list=), the rows are the collection in its order with the playing one
  marked, and the pills are replaced by "Playing from <title>" with prev
  and next.
*/

export interface UpNextRow {
  video: PostTubeVideo;
  href: string;
  /** 1-based position inside a collection. */
  position?: number;
  current?: boolean;
}

export interface UpNextProps {
  rows: UpNextRow[];
  loading?: boolean;
  hasMore?: boolean;
  fetchingMore?: boolean;
  onMore?: () => void;
  /** Related mode: the pills. */
  pills?: UpNextPill[];
  chip?: UpNextChip;
  onChip?: (chip: UpNextChip) => void;
  /** Collection mode. */
  collection?: { id: string; title: string; index: number; count: number; prev: string | null; next: string | null } | null;
}

export function UpNext({ rows, loading = false, hasMore = false, fetchingMore = false, onMore, pills = [], chip = "all", onChip, collection = null }: UpNextProps) {
  return (
    <section className="tube-upnext" aria-label="Up next" data-upnext>
      <div className="tube-upnext__head">
        <h2 className="tube-upnext__title">Up next</h2>
      </div>
      {collection ? (
        <div className="tube-collection-bar" data-collection-bar>
          <span className="tube-collection-bar__title">
            Playing from{" "}
            <Link href={`/posttube/playlists/${encodeURIComponent(collection.id)}`}>
              <strong>{collection.title}</strong>
            </Link>
          </span>
          {collection.index >= 0 ? (
            <span className="tube-collection-bar__count">
              {collection.index + 1} / {collection.count}
            </span>
          ) : null}
          <Link
            href={collection.prev ? collectionWatchHref(collection.prev, collection.id) : "#"}
            aria-disabled={collection.prev ? undefined : "true"}
            aria-label="Previous in collection"
            className="tube-collection-bar__nav"
          >
            <ChevronLeft size={16} />
          </Link>
          <Link
            href={collection.next ? collectionWatchHref(collection.next, collection.id) : "#"}
            aria-disabled={collection.next ? undefined : "true"}
            aria-label="Next in collection"
            className="tube-collection-bar__nav"
          >
            <ChevronRight size={16} />
          </Link>
        </div>
      ) : pills.length > 0 ? (
        <div className="tube-upnext__pills" role="group" aria-label="Up next filters">
          {pills.map((p) => (
            <button key={p.id} type="button" className="tube-upnext__pill" aria-pressed={chip === p.id} onClick={() => onChip?.(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="tube-upnext__list" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="tube-upnext__bone">
              <span />
              <span />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="tube-upnext__empty">{collection ? "This collection is empty." : "Nothing to suggest yet."}</p>
      ) : (
        <ol className="tube-upnext__list">
          {rows.map((r) => (
            <li key={r.video.id}>
              <Link href={r.href} className="tube-upnext__row" aria-current={r.current ? "page" : undefined}>
                <span className="tube-upnext__thumb">
                  {r.video.thumbnail_url ? <img src={r.video.thumbnail_url} alt="" loading="lazy" /> : null}
                  {typeof r.position === "number" ? <span className="tube-upnext__pos">{r.position}</span> : null}
                  {r.video.duration_seconds > 0 ? <span className="tube-upnext__duration">{formatDuration(r.video.duration_seconds)}</span> : null}
                </span>
                <span className="tube-upnext__text">
                  <p className="tube-upnext__name">{r.video.title}</p>
                  <p className="tube-upnext__meta">{r.video.channel_name}</p>
                  <p className="tube-upnext__meta">
                    {[r.video.view_count > 0 ? `${formatCount(r.video.view_count)} views` : "", r.video.published_at ? timeAgo(r.video.published_at) : ""].filter(Boolean).join(" · ")}
                  </p>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      {!collection && hasMore && onMore ? (
        <button type="button" className="tube-upnext__more" disabled={fetchingMore} onClick={onMore}>
          {fetchingMore ? "Loading…" : "Show more"}
        </button>
      ) : null}
    </section>
  );
}
