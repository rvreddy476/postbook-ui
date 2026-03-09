"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X, MessageCircle } from "lucide-react";

import { CommentComposer } from "@/features/reels/components/CommentComposer";
import { CommentsList } from "@/features/reels/components/CommentsList";
import type { ReelComment } from "@/features/reels/types";

interface CommentsDrawerProps {
  open: boolean;
  comments: ReelComment[];
  commentCount: number;
  focusCommentId?: string;
  loading?: boolean;
  hasNextPage?: boolean;
  fetchingNextPage?: boolean;
  submitPending?: boolean;
  composerFocusSignal?: number;
  onLoadMore?: () => void;
  onClose: () => void;
  onSubmitComment: (text: string) => Promise<void> | void;
}

export function CommentsDrawer({
  open,
  comments,
  commentCount,
  focusCommentId,
  loading,
  hasNextPage,
  fetchingNextPage,
  submitPending,
  composerFocusSignal,
  onLoadMore,
  onClose,
  onSubmitComment,
}: CommentsDrawerProps) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          {/* Backdrop */}
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/5 backdrop-blur-[1px]"
            onClick={onClose}
            aria-label="Close comments"
          />

          {/* Drawer panel */}
          <motion.aside
            initial={{ x: "100%", opacity: 0.9 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.9 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-0 right-0 top-0 z-50 flex w-[420px] flex-col bg-white shadow-[-8px_0_40px_rgba(0,0,0,0.06)]"
            data-comments-drawer="true"
          >
            {/* Header */}
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <MessageCircle className="h-4 w-4 text-slate-400" />
                <h2 className="text-[14px] font-semibold text-slate-800">
                  Comments
                  <span className="ml-1.5 text-[13px] font-normal text-slate-400">
                    {commentCount.toLocaleString()}
                  </span>
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
                aria-label="Close comments"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* Comment list */}
            <div className="min-h-0 flex-1">
              <CommentsList
                comments={comments}
                focusCommentId={focusCommentId}
                loading={loading}
                hasNextPage={hasNextPage}
                fetchingNextPage={fetchingNextPage}
                onLoadMore={onLoadMore}
              />
            </div>

            {/* Composer */}
            <CommentComposer
              onSubmit={onSubmitComment}
              pending={submitPending}
              focusSignal={composerFocusSignal}
              placeholder="Add a comment..."
            />
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
