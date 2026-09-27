"use client";

import Link from "next/link";
import { History, Loader2, LogIn, PauseCircle, Play, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAuthUser } from "@/store/auth";
import { useClearWatchHistory, useDeleteWatchProgress, useWatchHistory } from "@/hooks/usePosttubeExtras";
import { useLoadMoreSentinel } from "@/features/posttube/components/HomePage";
import { ReelConfirmDialog } from "@/features/reels/components/ReelConfirmDialog";

import { formatClockMs, rowToVideo, timeAgo, type WatchProgress } from "../../model";
import { useHistoryPaused } from "../hooks/useHistoryPaused";
import { filterRecent } from "../recentSearch";
import "./library.css";

/*
  /posttube/history — Recent. GET /v1/videos/history?limit&cursor, every
  row. Remove = DELETE /v1/videos/:id/progress; Clear = DELETE
  /v1/videos/history. The search field filters the rows already loaded;
  "Pause recording" is a client preference (localStorage
  posttube_history_paused_v1) the watch page reads via isHistoryPaused().
*/

function RecentRow({ entry, onRemove, removing }: { entry: WatchProgress; onRemove: () => void; removing: boolean }) {
  const video = entry.post ? rowToVideo(entry.post) : null;
  const title = video?.title || "Untitled video";
  const pct = Math.round(entry.percent);
  const href = `/posttube/watch/${encodeURIComponent(entry.postId)}`;
  const meta = [
    video?.channel_name || null,
    entry.completed ? "Watched" : entry.durationMs > 0 ? `${formatClockMs(entry.positionMs)} of ${formatClockMs(entry.durationMs)}` : null,
    entry.lastWatchedAt ? timeAgo(entry.lastWatchedAt) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="tube-library__row is-static">
      <Link href={href} className="tube-library__thumb" tabIndex={-1} aria-hidden>
        {video?.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnail_url} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="tube-library__thumb-empty">No poster</span>
        )}
        {entry.durationMs > 0 ? <span className="tube-library__duration">{formatClockMs(entry.durationMs)}</span> : null}
        <span className={`tube-library__progress ${entry.completed ? "is-done" : ""}`}>
          <span style={{ width: `${Math.max(2, pct)}%` }} />
        </span>
      </Link>
      <div className="tube-library__body">
        <Link href={href} className="tube-library__row-title">
          {title}
        </Link>
        {meta ? <p className="tube-library__row-meta">{meta}</p> : null}
      </div>
      <div className="tube-library__row-actions">
        <button type="button" className="tube-library__icon-button is-danger" aria-label={`Remove from Recent: ${title}`} disabled={removing} onClick={onRemove}>
          {removing ? <Loader2 className="animate-spin" /> : <X />}
        </button>
      </div>
    </li>
  );
}

export function RecentScreen() {
  const user = useAuthUser();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const signedIn = mounted && !!user;

  const history = useWatchHistory(30);
  const remove = useDeleteWatchProgress();
  const clearAll = useClearWatchHistory();
  const [paused, setPaused] = useHistoryPaused();
  const [query, setQuery] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const rows = useMemo(() => history.data?.pages.flatMap((p) => p.items) ?? [], [history.data]);
  const shown = useMemo(() => filterRecent(rows, query), [rows, query]);
  const sentinelRef = useLoadMoreSentinel(!!history.hasNextPage && !history.isFetchingNextPage, () => void history.fetchNextPage());

  return (
    <section className="tube-library" aria-labelledby="tube-recent-title">
      <header className="tube-library__head">
        <span className="tube-library__glyph" aria-hidden>
          <History />
        </span>
        <div className="tube-library__titles">
          <h1 id="tube-recent-title" className="tube-library__title">
            Recent
          </h1>
          <p className="tube-library__meta">
            <span>Videos you watched, with where you left off.</span>
          </p>
        </div>
        <div className="tube-library__actions">
          <label className="tube-library__search">
            <Search aria-hidden />
            <input type="search" placeholder="Search Recent" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search Recent" />
          </label>
          <button
            type="button"
            role="switch"
            aria-checked={paused}
            className="tube-library__switch"
            onClick={() => setPaused(!paused)}
            title="While paused, videos you watch are not added to Recent"
          >
            <span>Pause recording</span>
            <span className="tube-library__switch-track" aria-hidden>
              <span className="tube-library__switch-knob" />
            </span>
          </button>
          {rows.length > 0 ? (
            <button type="button" className="tube-library__icon-button is-danger" aria-label="Clear all of Recent" onClick={() => setConfirmClear(true)}>
              <Trash2 />
            </button>
          ) : null}
        </div>
      </header>

      {paused ? (
        <p className="tube-library__note" role="status">
          <PauseCircle aria-hidden /> Recording is paused. Videos you watch now are not added, and nothing resumes where you left off.
        </p>
      ) : null}

      {!mounted || (signedIn && history.isPending) ? (
        <ul className="tube-library__list" aria-busy="true" aria-label="Loading">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="tube-library__skeleton" aria-hidden />
          ))}
        </ul>
      ) : !signedIn ? (
        <div className="tube-library__empty">
          <LogIn size={26} />
          <h2>Sign in to see Recent</h2>
          <p>Your watch history is kept with your account.</p>
          <Link href={`/login?next=${encodeURIComponent("/posttube/history")}`} className="tube-library__cta">
            Sign in
          </Link>
        </div>
      ) : history.isError ? (
        <div className="tube-library__empty" role="alert">
          <h2>Couldn&apos;t load Recent</h2>
          <p>Check your connection and try again.</p>
          <button type="button" className="tube-library__cta" onClick={() => void history.refetch()}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="tube-library__empty">
          <History size={26} />
          <h2>Nothing watched yet</h2>
          <p>Videos you watch will show up here so you can pick up where you left off.</p>
          <Link href="/posttube" className="tube-library__cta">
            <Play size={14} /> Watch
          </Link>
        </div>
      ) : shown.length === 0 ? (
        <div className="tube-library__empty" role="status">
          <Search size={26} />
          <h2>No match in what is loaded</h2>
          <p>{history.hasNextPage ? "Load more rows and search again, or try another word." : "Try another word."}</p>
          {history.hasNextPage ? (
            <button type="button" className="tube-library__cta" onClick={() => void history.fetchNextPage()} disabled={history.isFetchingNextPage}>
              {history.isFetchingNextPage ? "Loading…" : "Load more"}
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <ol className="tube-library__list" aria-label="Recent videos">
            {shown.map((e) => (
              <RecentRow
                key={e.postId}
                entry={e}
                removing={removingId === e.postId && remove.isPending}
                onRemove={() => {
                  setRemovingId(e.postId);
                  remove.mutate(e.postId, { onSettled: () => setRemovingId(null) });
                }}
              />
            ))}
          </ol>
          <div ref={sentinelRef} className="h-px" />
          {history.hasNextPage ? (
            <div className="tube-library__more">
              <button type="button" className="tube-library__button is-quiet" onClick={() => void history.fetchNextPage()} disabled={history.isFetchingNextPage}>
                {history.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </>
      )}

      <ReelConfirmDialog
        open={confirmClear}
        title="Clear all of Recent?"
        description="Every video is removed from Recent and nothing will resume where you left off. This cannot be undone."
        confirmLabel="Clear"
        danger
        pending={clearAll.isPending}
        onConfirm={() => clearAll.mutate(undefined, { onSuccess: () => setConfirmClear(false) })}
        onCancel={() => setConfirmClear(false)}
      />
    </section>
  );
}
