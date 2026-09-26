"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import CommentSection from "@/components/CommentSection";
import { Avatar } from "@/components/LetterAvatar";
import { formatCount, type ReelItem } from "@/features/reels/model";

interface ReelCommentsDrawerProps {
  open: boolean;
  reel: ReelItem;
  focusCommentId?: string;
  onClose: () => void;
}

/*
  Comments. On phones a bottom sheet over the stage. From md up the panel
  takes the creator column's slot to the LEFT of the stage, so opening it
  slides the reel to the right and the thread opens where the creator card
  was — the reel keeps playing. CommentSection brings its own loading,
  posting, replies, likes and edits.
*/
export function ReelCommentsDrawer({ open, reel, focusCommentId, onClose }: ReelCommentsDrawerProps) {
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
            aria-label="Reel comments"
            className="reel-comments-panel fixed inset-x-0 bottom-0 z-40 flex h-[72vh] flex-col rounded-t-2xl border border-border bg-brand-card text-brand-text shadow-2xl md:static md:h-full md:w-[min(520px,38vw)] md:shrink-0 md:rounded-2xl md:shadow-none"
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Avatar src={reel.authorAvatarUrl ?? ""} name={reel.authorName} seed={reel.authorId} size="sm" />
              <div className="min-w-0 flex-1">
                <h3 className="text-[13px] font-bold">Comments · {formatCount(reel.commentCount)}</h3>
                <p className="truncate text-[11px] text-brand-text/60">{reel.authorUsername ? `@${reel.authorUsername}` : reel.authorName}</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close comments" className="flex h-7 w-7 items-center justify-center rounded-full text-brand-text/60 transition hover:bg-brand-secondary hover:text-brand-text">
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
