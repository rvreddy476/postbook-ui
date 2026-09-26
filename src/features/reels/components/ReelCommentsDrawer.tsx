"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import CommentSection from "@/components/CommentSection";
import { formatCount } from "@/features/reels/model";

interface ReelCommentsDrawerProps {
  open: boolean;
  reelId: string;
  reelAuthorId: string;
  commentCount: number;
  focusCommentId?: string;
  onClose: () => void;
}

/*
  Comments beside the stage on desktop, as a bottom sheet on phones. The
  reel keeps playing underneath, as on Instagram. CommentSection brings its
  own loading, posting, replies, likes and edits.
*/
export function ReelCommentsDrawer({ open, reelId, reelAuthorId, commentCount, focusCommentId, onClose }: ReelCommentsDrawerProps) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={onClose}
          />
          <motion.aside
            data-comments-drawer="true"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="reel-comments-panel"
            aria-label="Reel comments"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-[13px] font-bold">Comments · {formatCount(commentCount)}</h3>
              <button type="button" onClick={onClose} aria-label="Close comments" className="flex h-7 w-7 items-center justify-center rounded-full text-brand-text/60 transition hover:bg-brand-secondary hover:text-brand-text">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <CommentSection key={reelId} postId={reelId} postAuthorId={reelAuthorId} commentsCount={commentCount} alwaysExpanded focusCommentId={focusCommentId} />
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
