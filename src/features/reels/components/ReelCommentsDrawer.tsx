"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import CommentSection from "@/components/CommentSection";
import { ReelAuthorCard, type ReelAuthorCardProps } from "@/features/reels/components/ReelAuthorCard";
import { formatCount, type ReelItem } from "@/features/reels/model";

interface ReelCommentsDrawerProps {
  open: boolean;
  reel: ReelItem;
  focusCommentId?: string;
  onClose: () => void;
  /**
   * "column" (≥1024px): TikTok's card — COMMENTS_COLUMN_WIDTH wide with a
   * 16px margin (stage.ts), rounded, beside the stage, no scrim. "sheet"
   * (below): a bottom sheet over the stage behind a scrim.
   */
  variant?: "column" | "sheet";
  /**
   * The author card above the thread (column only): avatar, name, Follow,
   * the description and the counts row. Omitted on the phone sheet, which
   * is the thread alone.
   */
  author?: Omit<ReelAuthorCardProps, "reel">;
}

/*
  Comments. In the column the author card sits on top, then a divider,
  then "Comments N" with ✕, then the thread. The thread scrolls inside;
  CommentSection brings the composer and keeps it pinned at the bottom
  (its own flex column). The reel keeps playing.
*/
export function ReelCommentsDrawer({ open, reel, focusCommentId, onClose, variant = "sheet", author }: ReelCommentsDrawerProps) {
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
            {column && author ? (
              <div className="reel-comments-panel__author">
                <ReelAuthorCard reel={reel} {...author} />
              </div>
            ) : null}
            <div className="reel-comments-head">
              <h3 className="reel-comments-head__title">
                Comments
                <span className="reel-comments-head__count" aria-label={`${formatCount(reel.commentCount)} comments`}>
                  {formatCount(reel.commentCount)}
                </span>
              </h3>
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
