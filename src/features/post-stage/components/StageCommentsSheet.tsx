"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

import CommentSection from "@/components/CommentSection";
import { commentCreatorTools } from "@/components/comments/creatorTools";
import { formatCount } from "@/features/reels/model";
import { StagePortal } from "@/features/post-stage/components/StagePortal";

/*
  Comments for the post on screen, as a sheet — never inline under the
  post. A bottom sheet behind a scrim on a phone; a column at the right
  edge of the stage on a desktop (the CSS decides, post-stage.css), where
  the frame moves left to make room. CommentSection brings the thread and
  keeps its composer pinned at the bottom.
*/
export function StageCommentsSheet({
  open,
  postId,
  authorId,
  count,
  focusCommentId,
  onClose,
  detail = false,
}: {
  open: boolean;
  postId: string;
  authorId: string;
  count: number;
  focusCommentId?: string;
  onClose: () => void;
  /** On the post page: the desktop column stops above the comment bar. */
  detail?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <StagePortal>
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="scrim"
            className="ps-comments-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            key="sheet"
            role="dialog"
            aria-label="Comments"
            data-comments-drawer="true"
            className="ps-comments"
            data-detail={detail ? "" : undefined}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 32 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
          >
            <div className="ps-comments__head">
              <h2 className="ps-comments__title">
                Comments <span className="ps-comments__count">{formatCount(count)}</span>
              </h2>
              <button type="button" className="ps-comments__close" aria-label="Close comments" onClick={onClose}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="ps-comments__body">
              <CommentSection
                key={postId}
                postId={postId}
                postAuthorId={authorId}
                commentsCount={count}
                alwaysExpanded
                focusCommentId={focusCommentId}
                creatorTools={commentCreatorTools}
              />
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
    </StagePortal>
  );
}
