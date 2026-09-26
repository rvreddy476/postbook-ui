"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import CommentSection from "@/components/CommentSection";
import { formatCount, type ReelItem } from "@/features/reels/model";

interface ReelCommentsDrawerProps {
  open: boolean;
  reel: ReelItem;
  focusCommentId?: string;
  onClose: () => void;
  /**
   * "column" (≥1024px): a full-height column beside the stage with a left
   * divider, no scrim. "sheet" (below): a bottom sheet over the stage
   * behind a scrim.
   */
  variant?: "column" | "sheet";
}

/*
  Comments. The thread scrolls inside; CommentSection brings the composer
  and keeps it pinned at the bottom (its own flex column). The reel keeps
  playing. CommentSection brings its own loading, posting, replies, likes
  and edits.
*/
export function ReelCommentsDrawer({ open, reel, focusCommentId, onClose, variant = "sheet" }: ReelCommentsDrawerProps) {
  const column = variant === "column";
  return (
    <AnimatePresence>
      {open ? (
        <>
          {!column ? <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="reel-comments-scrim" onClick={onClose} /> : null}
          <motion.aside
            data-comments-drawer="true"
            initial={column ? { x: 24, opacity: 0 } : { y: 40, opacity: 0 }}
            animate={{ x: 0, y: 0, opacity: 1 }}
            exit={column ? { x: 24, opacity: 0 } : { y: 40, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Reel comments"
            className={`reel-comments-panel is-${variant}`}
          >
            <div className="reel-comments-head">
              <h3 className="text-[14px] font-bold">Comments · {formatCount(reel.commentCount)}</h3>
              <button type="button" onClick={onClose} aria-label="Close comments" className="reel-comments-close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <CommentSection key={reel.id} postId={reel.id} postAuthorId={reel.authorId} commentsCount={reel.commentCount} alwaysExpanded focusCommentId={focusCommentId} />
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
