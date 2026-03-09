"use client";

import { MessageCircle, X } from "lucide-react";

import { CommentComposer } from "@/features/reels/components/CommentComposer";
import { CommentList } from "@/features/reels/components/CommentList";
import type { ReelComment } from "@/features/reels/types";
import { uiTokens } from "@/ui/tokens";

interface CommentsSidePanelProps {
  open: boolean;
  comments: ReelComment[];
  focusCommentId?: string;
  unreadCount?: number;
  loading?: boolean;
  hasNextPage?: boolean;
  fetchingNextPage?: boolean;
  composerFocusSignal?: number;
  submitPending?: boolean;
  onLoadMore?: () => void;
  onClose: () => void;
  onOpen: () => void;
  onSubmitComment: (text: string) => Promise<void> | void;
}

export function CommentsSidePanel({
  open,
  comments,
  focusCommentId,
  unreadCount,
  loading,
  hasNextPage,
  fetchingNextPage,
  composerFocusSignal,
  submitPending,
  onLoadMore,
  onClose,
  onOpen,
  onSubmitComment,
}: CommentsSidePanelProps) {
  if (!open) {
    return (
      <div className="flex h-full items-center justify-end pr-2">
        <button
          type="button"
          onClick={onOpen}
          className="relative flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg transition hover:bg-slate-50"
          aria-label="Open comments panel"
        >
          <MessageCircle className="h-5 w-5" />
          {unreadCount && unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </button>
      </div>
    );
  }

  return (
    <section
      className="flex h-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
      style={{ backdropFilter: `blur(${uiTokens.blur.strong}px)` }}
    >
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Live Comments</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{comments.length}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
          aria-label="Close comments panel"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1">
        <CommentList
          comments={comments}
          loading={loading}
          hasNextPage={hasNextPage}
          fetchingNextPage={fetchingNextPage}
          onLoadMore={onLoadMore}
          focusCommentId={focusCommentId}
        />
      </div>
      <CommentComposer
        onSubmit={onSubmitComment}
        pending={submitPending}
        focusSignal={composerFocusSignal}
        placeholder="Speak to the reel..."
      />
    </section>
  );
}
