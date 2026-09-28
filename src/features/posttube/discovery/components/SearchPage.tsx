"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, ListVideo, Play, Search, UserRound } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { formatCount, formatDuration, timeAgo } from "../../model";
import {
  SEARCH_LENGTHS,
  SEARCH_SORTS,
  SEARCH_TABS,
  SEARCH_WHENS,
  parseSearchFilters,
  searchHref,
  type ChannelResult,
  type CollectionResult,
  type SearchFilters,
  type VideoResult,
} from "../discoveryApi";
import { useTubeSearch } from "../hooks/useDiscovery";
import { EmptyState, ErrorState, RowSkeleton } from "./DiscoveryState";
import { PageHead } from "./PageHead";
import { PillRow } from "./Pills";
import type { ViewStatus } from "./TrendingPage";
import "../discovery.css";

/* ── Result rows ─────────────────────────────────────────── */

export function VideoResultRow({ video }: { video: VideoResult }) {
  const duration = video.durationSeconds > 0 ? formatDuration(video.durationSeconds) : "";
  const meta = [video.creatorName, video.viewCount > 0 ? `${formatCount(video.viewCount)} views` : "", video.publishedAt ? timeAgo(video.publishedAt) : ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link href={video.href} className="disco-row" data-kind="video">
      <span className="disco-row__thumb">
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt="" loading="lazy" />
        ) : (
          <span className="disco-row__thumb-empty" aria-hidden>
            <Play strokeWidth={1.75} />
          </span>
        )}
        {duration ? <span className="disco-row__duration">{duration}</span> : null}
      </span>
      <span className="disco-row__body">
        <p className="disco-row__title">{video.title}</p>
        <p className="disco-row__meta">{meta}</p>
      </span>
    </Link>
  );
}

export function ChannelResultRow({ channel }: { channel: ChannelResult }) {
  const meta = [channel.handle ? `@${channel.handle}` : "", `${formatCount(channel.followerCount)} subscribers`].filter(Boolean).join(" · ");
  return (
    <Link href={channel.href} className="disco-row" data-kind="channel">
      <span className="disco-row__avatar">{channel.avatarUrl ? <img src={channel.avatarUrl} alt="" loading="lazy" /> : <UserRound strokeWidth={1.75} aria-hidden />}</span>
      <span className="disco-row__body">
        <p className="disco-row__title">{channel.name}</p>
        <p className="disco-row__meta">{meta}</p>
      </span>
      <span className="disco-row__arrow" aria-hidden>
        <ChevronRight strokeWidth={1.75} />
      </span>
    </Link>
  );
}

export function CollectionResultRow({ collection }: { collection: CollectionResult }) {
  return (
    <Link href={collection.href} className="disco-row" data-kind="collection">
      <span className="disco-row__cover">
        {collection.coverUrl ? <img src={collection.coverUrl} alt="" loading="lazy" /> : <ListVideo strokeWidth={1.75} aria-hidden />}
        <span className="disco-row__cover-count">{collection.itemCount}</span>
      </span>
      <span className="disco-row__body">
        <p className="disco-row__title">{collection.title}</p>
        <p className="disco-row__meta">{collection.itemCount === 1 ? "1 video" : `${collection.itemCount} videos`}</p>
      </span>
      <span className="disco-row__arrow" aria-hidden>
        <ChevronRight strokeWidth={1.75} />
      </span>
    </Link>
  );
}

/* ── The screen ──────────────────────────────────────────── */

export interface SearchViewProps {
  filters: SearchFilters;
  onFiltersChange: (next: SearchFilters) => void;
  onSubmitQuery: (q: string) => void;
  status: ViewStatus;
  videos: VideoResult[];
  channels: ChannelResult[];
  collections: CollectionResult[];
  onRetry?: () => void;
}

function SearchBox({ initial, onSubmit }: { initial: string; onSubmit: (q: string) => void }) {
  const [q, setQ] = useState(initial);
  useEffect(() => setQ(initial), [initial]);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(q.trim());
  };
  return (
    <form role="search" className="disco-search" onSubmit={submit}>
      <Search strokeWidth={1.75} aria-hidden />
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search videos, channels, collections" aria-label="Search" enterKeyHint="search" />
      <button type="submit" className="disco-search__go">
        Search
      </button>
    </form>
  );
}

/** The pure screen: the query and every filter live in the URL; the page reads them and hands them here. */
export function SearchView({ filters, onFiltersChange, onSubmitQuery, status, videos, channels, collections, onRetry }: SearchViewProps) {
  const q = filters.q;
  const set = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => onFiltersChange({ ...filters, [key]: value });
  const list = filters.tab === "videos" ? videos : filters.tab === "channels" ? channels : collections;

  return (
    <div className="disco-page" data-screen="search">
      <PageHead icon={<Search strokeWidth={1.75} />} title={q ? `Results for “${q}”` : "Search"} sub={q ? undefined : "Find videos, channels and collections"} />
      <SearchBox initial={q} onSubmit={onSubmitQuery} />
      <div className="disco-filterbar">
        <div className="disco-filterbar__row">
          <PillRow name="Show" options={SEARCH_TABS} value={filters.tab} onChange={(v) => set("tab", v)} />
        </div>
        {filters.tab === "videos" ? (
          <>
            <div className="disco-filterbar__divider" />
            <div className="disco-filterbar__row">
              <PillRow name="Length" label="Length" options={SEARCH_LENGTHS} value={filters.length} onChange={(v) => set("length", v)} />
            </div>
            <div className="disco-filterbar__row">
              <PillRow name="When" label="When" options={SEARCH_WHENS} value={filters.when} onChange={(v) => set("when", v)} />
            </div>
            <div className="disco-filterbar__row">
              <PillRow name="Sort" label="Sort" options={SEARCH_SORTS} value={filters.sort} onChange={(v) => set("sort", v)} />
            </div>
          </>
        ) : null}
      </div>

      {!q ? (
        <EmptyState icon={<Search size={20} strokeWidth={1.75} />} title="Type something to search" body="Titles, creators, topics — or a collection you remember." />
      ) : status === "loading" ? (
        <RowSkeleton />
      ) : status === "error" ? (
        <ErrorState what="results" onRetry={onRetry} />
      ) : list.length === 0 ? (
        <EmptyState
          title={`No ${filters.tab} for “${q}”`}
          body={filters.tab === "videos" && (filters.length !== "any" || filters.when !== "any") ? "Try clearing the length or date filter." : "Check the spelling or try another word."}
        />
      ) : (
        <div className="disco-rows" aria-live="polite">
          {filters.tab === "videos"
            ? videos.map((v) => <VideoResultRow key={v.id} video={v} />)
            : filters.tab === "channels"
              ? channels.map((c) => <ChannelResultRow key={c.id} channel={c} />)
              : collections.map((c) => <CollectionResultRow key={c.id} collection={c} />)}
        </div>
      )}
    </div>
  );
}

/** Reads `?q=&tab=&len=&when=&sort=`, fetches the showing tab, writes every change back to the URL. */
export function SearchPage() {
  const router = useRouter();
  const params = useSearchParams();
  const filters = parseSearchFilters((k) => params.get(k));
  const { videos, channels, collections } = useTubeSearch(filters);

  const navigate = useCallback((next: SearchFilters) => router.replace(searchHref(next)), [router]);
  const onSubmitQuery = useCallback((q: string) => router.push(searchHref({ ...filters, q })), [router, filters]);

  const active = filters.tab === "videos" ? videos : filters.tab === "channels" ? channels : collections;
  const status: ViewStatus = !filters.q ? "ready" : active.isLoading ? "loading" : active.isError ? "error" : "ready";

  return (
    <SearchView
      filters={filters}
      onFiltersChange={navigate}
      onSubmitQuery={onSubmitQuery}
      status={status}
      videos={videos.data ?? []}
      channels={channels.data ?? []}
      collections={collections.data ?? []}
      onRetry={() => void active.refetch()}
    />
  );
}
