"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";

import { CommentComposer } from "@/features/reels/components/CommentComposer";
import { CommentList } from "@/features/reels/components/CommentList";
import type { ReelComment } from "@/features/reels/types";

interface CommentsBottomSheetProps {
  open: boolean;
  comments: ReelComment[];
  focusCommentId?: string;
  unreadCount?: number;
  loading?: boolean;
  hasNextPage?: boolean;
  fetchingNextPage?: boolean;
  composerFocusSignal?: number;
  submitPending?: boolean;
  onOpen: () => void;
  onClose: () => void;
  onLoadMore?: () => void;
  onSubmitComment: (text: string) => Promise<void> | void;
}

export function CommentsBottomSheet({
  open,
  comments,
  focusCommentId,
  unreadCount,
  loading,
  hasNextPage,
  fetchingNextPage,
  composerFocusSignal,
  submitPending,
  onOpen,
  onClose,
  onLoadMore,
  onSubmitComment,
}: CommentsBottomSheetProps) {
  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={onOpen}
          className="fixed right-4 top-1/2 z-40 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-brand-divider bg-brand-card text-slate-700 shadow-lg lg:hidden"
          aria-label="Open comments"
        >
          <MessageCircle className="h-5 w-5" />
          {unreadCount && unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </button>
      ) : null}

      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden"
              onClick={onClose}
            />
            <motion.section
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-50 flex h-[72dvh] flex-col overflow-hidden rounded-t-[28px] border-t border-brand-divider bg-brand-card lg:hidden"
            >
              <header className="flex items-center justify-between border-b border-brand-divider px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-10 rounded-full bg-slate-300" />
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-highlight">
                    Comments
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-brand-divider bg-brand-card text-brand-highlight"
                  aria-label="Close comments"
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
              />
            </motion.section>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
