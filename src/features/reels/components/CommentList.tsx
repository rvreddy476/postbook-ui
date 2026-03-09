"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import type { ReelComment } from "@/features/reels/types";

interface CommentListProps {
  comments: ReelComment[];
  focusCommentId?: string;
  loading?: boolean;
  hasNextPage?: boolean;
  fetchingNextPage?: boolean;
  onLoadMore?: () => void;
}

function formatRelativeTime(timestamp: string) {
  const time = new Date(timestamp).getTime();
  const diff = Date.now() - time;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(timestamp).toLocaleDateString();
}

export function CommentList({
  comments,
  focusCommentId,
  loading,
  hasNextPage,
  fetchingNextPage,
  onLoadMore,
}: CommentListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [highlightCommentId, setHighlightCommentId] = useState<string | undefined>(focusCommentId);

  const virtualizer = useVirtualizer({
    count: comments.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 78,
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const focusIndex = useMemo(() => {
    if (!focusCommentId) return -1;
    return comments.findIndex((comment) => comment.comment_id === focusCommentId);
  }, [comments, focusCommentId]);

  useEffect(() => {
    if (!focusCommentId || focusIndex < 0) return;
    setHighlightCommentId(focusCommentId);
    virtualizer.scrollToIndex(focusIndex, { align: "center" });
    const timer = setTimeout(() => setHighlightCommentId(undefined), 2000);
    return () => clearTimeout(timer);
  }, [focusCommentId, focusIndex, virtualizer]);

  useEffect(() => {
    if (!onLoadMore || !hasNextPage || fetchingNextPage || comments.length === 0) return;
    const lastVirtualItem = virtualItems[virtualItems.length - 1];
    if (lastVirtualItem && lastVirtualItem.index >= comments.length - 10) {
      onLoadMore();
    }
  }, [comments.length, fetchingNextPage, hasNextPage, onLoadMore, virtualItems]);

  if (loading && comments.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-slate-500">Loading comments...</span>
      </div>
    );
  }

  if (!loading && comments.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-slate-400">No comments yet.</span>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-full overflow-y-auto px-4 pb-2">
      <div style={{ height: totalSize, position: "relative", width: "100%" }}>
        {virtualItems.map((virtualRow) => {
          const comment = comments[virtualRow.index];
          if (!comment) return null;
          const highlight = highlightCommentId === comment.comment_id;

          return (
            <div
              key={comment.comment_id}
              className="absolute left-0 top-0 w-full"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                height: `${virtualRow.size}px`,
              }}
            >
              <article
                className={`rounded-2xl px-3 py-2 transition ${
                  highlight ? "bg-blue-50 shadow-[0_0_24px_rgba(37,99,235,0.2)]" : "border border-slate-100 bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">{comment.author_name}</span>
                  <span className="text-[11px] text-slate-400">{formatRelativeTime(comment.created_at)}</span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">{comment.text}</p>
              </article>
            </div>
          );
        })}
      </div>
      {fetchingNextPage ? <p className="py-2 text-center text-xs text-slate-500">Loading more...</p> : null}
    </div>
  );
}
