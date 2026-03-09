"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import CommentSection from "@/components/CommentSection";

interface ReelCommentsPanelProps {
  open: boolean;
  reelId: string;
  reelAuthorId: string;
  commentCount: number;
  focusCommentId?: string;
  onClose: () => void;
}

export function ReelCommentsPanel({
  open,
  reelId,
  reelAuthorId,
  commentCount,
  focusCommentId,
  onClose,
}: ReelCommentsPanelProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 380, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="overflow-hidden"
          data-comments-drawer="true"
        >
          <div className="flex w-[380px] flex-col rounded-2xl border border-[#E8E8EE] bg-white shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E8E8EE] px-4 py-3">
              <h3 className="text-[13px] font-bold text-slate-900">
                Comments ({commentCount})
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close comments"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Full engagement comment section (like, dislike, reply, edit, delete) */}
            <div className="max-h-[480px] overflow-y-auto">
              <CommentSection
                postId={reelId}
                postAuthorId={reelAuthorId}
                commentsCount={commentCount}
                alwaysExpanded
                focusCommentId={focusCommentId}
              />
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
