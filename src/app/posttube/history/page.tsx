"use client";

import { useState } from "react";
import Link from "next/link";
import { History, Loader2, Trash2 } from "lucide-react";

import { useAuthUser } from "@/store/auth";
import { useClearWatchHistory, useDeleteWatchProgress, useWatchHistory } from "@/hooks/usePosttubeExtras";
import { ConfirmDialog } from "@/features/posttube/components/ConfirmDialog";
import { useLoadMoreSentinel } from "@/features/posttube/components/HomePage";
import { formatClockMs, rowToVideo, timeAgo, type WatchProgress } from "@/features/posttube/model";

/*
  GET /v1/videos/history?limit&cursor — every row, completed ones included.
  Remove = DELETE /v1/videos/:id/progress; Clear all = DELETE /v1/videos/history.
*/

function HistoryRow({ entry, onRemove, removing }: { entry: WatchProgress; onRemove: () => void; removing: boolean }) {
  const video = entry.post ? rowToVideo(entry.post) : null;
  const title = video?.title ?? entry.postId;
  const channel = video?.channel_name ?? "";
  const poster = video?.thumbnail_url ?? "";
  const pct = Math.round(entry.percent);

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-brand-card p-3">
      <Link href={`/posttube/watch/${entry.postId}`} className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-lg bg-brand-secondary">
        {poster ? (
          <img src={poster} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[11px] text-muted-foreground">No poster</div>
        )}
        {entry.durationMs > 0 ? (
          <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-medium text-white">{formatClockMs(entry.durationMs)}</span>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/30">
          <div className={`h-full ${entry.completed ? "bg-success" : "bg-brand-accent"}`} style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/posttube/watch/${entry.postId}`} className="line-clamp-2 text-[14px] font-semibold leading-tight text-brand-text hover:text-primary-ink">
          {title}
        </Link>
        {channel ? <p className="mt-1 text-[12px] text-muted-foreground">{channel}</p> : null}
        <p className="mt-1 text-[12px] text-muted-foreground">
          {entry.completed ? "Watched" : `${formatClockMs(entry.positionMs)} of ${formatClockMs(entry.durationMs)} · ${pct}%`}
          {entry.lastWatchedAt ? ` · ${timeAgo(entry.lastWatchedAt)}` : ""}
        </p>
        <div className="mt-2 h-1.5 w-full max-w-[260px] overflow-hidden rounded-full bg-brand-secondary">
          <div className={`h-full rounded-full ${entry.completed ? "bg-success" : "bg-brand-accent"}`} style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={removing}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:bg-brand-secondary hover:text-danger disabled:opacity-50"
      >
        {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        Remove
      </button>
    </div>
  );
}

export default function PosttubeHistoryPage() {
  const user = useAuthUser();
  const history = useWatchHistory(30);
  const remove = useDeleteWatchProgress();
  const clearAll = useClearWatchHistory();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const rows = history.data?.pages.flatMap((p) => p.items) ?? [];
  const sentinelRef = useLoadMoreSentinel(!!history.hasNextPage && !history.isFetchingNextPage, () => void history.fetchNextPage());

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-secondary text-brand-text">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-brand-text">History</h1>
            <p className="text-[12px] text-muted-foreground">Videos you have watched, with where you left off.</p>
          </div>
        </div>
        {rows.length > 0 ? (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="rounded-full border border-border px-4 py-2 text-[12px] font-semibold text-brand-text hover:bg-brand-secondary"
          >
            Clear all history
          </button>
        ) : null}
      </div>

      {!user ? (
        <div className="py-16 text-center text-[13px] text-muted-foreground">Sign in to see your watch history.</div>
      ) : history.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : history.isError ? (
        <div className="py-16 text-center text-[13px] text-muted-foreground">Could not load your history right now.</div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <p className="text-[13px]">No watch history yet.</p>
          <Link href="/posttube" className="mt-2 inline-block text-[13px] font-semibold text-primary-ink hover:underline">
            Browse videos
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((e) => (
            <HistoryRow
              key={e.postId}
              entry={e}
              removing={removingId === e.postId && remove.isPending}
              onRemove={() => {
                setRemovingId(e.postId);
                remove.mutate(e.postId, { onSettled: () => setRemovingId(null) });
              }}
            />
          ))}
          <div ref={sentinelRef} className="h-px" />
          {history.hasNextPage ? (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={() => history.fetchNextPage()}
                disabled={history.isFetchingNextPage}
                className="rounded-full border border-border bg-brand-card px-5 py-2 text-[12px] font-semibold text-brand-text hover:bg-brand-secondary disabled:opacity-50"
              >
                {history.isFetchingNextPage ? "Loading..." : "Load more"}
              </button>
            </div>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Clear all watch history?"
        body="Every video is removed from your history and nothing will resume where you left off. This cannot be undone."
        confirmLabel="Clear history"
        danger
        pending={clearAll.isPending}
        onConfirm={() => clearAll.mutate(undefined, { onSuccess: () => setConfirmClear(false) })}
        onClose={() => setConfirmClear(false)}
      />
    </div>
  );
}
