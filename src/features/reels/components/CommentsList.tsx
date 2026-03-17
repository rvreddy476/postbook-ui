"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import type { ReelComment } from "@/features/reels/types";

interface CommentsListProps {
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

export function CommentsList({
  comments,
  focusCommentId,
  loading,
  hasNextPage,
  fetchingNextPage,
  onLoadMore,
}: CommentsListProps) {
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
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-divider border-t-slate-500" />
          <span className="text-[13px] text-brand-text/60">Loading comments...</span>
        </div>
      </div>
    );
  }

  if (!loading && comments.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6">
        <p className="text-[13px] font-medium text-brand-text/60">No comments yet</p>
        <p className="text-[12px] text-slate-300">Be the first to share your thoughts.</p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-full overflow-y-auto px-4 py-3 scrollbar-hide">
      <div style={{ height: totalSize, position: "relative", width: "100%" }}>
        {virtualItems.map((virtualRow) => {
          const comment = comments[virtualRow.index];
          if (!comment) return null;
          const highlight = highlightCommentId === comment.comment_id;

          return (
            <div
              key={comment.comment_id}
              className="absolute left-0 top-0 w-full px-1"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                height: `${virtualRow.size}px`,
              }}
            >
              <article
                className={`rounded-2xl px-3.5 py-3 transition-all duration-300 ${
                  highlight
                    ? "bg-[#D8103F]/5 shadow-[0_0_0_1px_rgba(124,58,237,0.15),0_0_20px_rgba(124,58,237,0.08)]"
                    : "hover:bg-brand-secondary"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-slate-800">{comment.author_name}</span>
                  <span className="text-[11px] text-slate-300">{formatRelativeTime(comment.created_at)}</span>
                </div>
                <p className="mt-0.5 text-[13px] leading-relaxed text-brand-highlight">{comment.text}</p>
              </article>
            </div>
          );
        })}
      </div>
      {fetchingNextPage ? (
        <div className="flex justify-center py-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-divider border-t-slate-400" />
        </div>
      ) : null}
    </div>
  );
}
