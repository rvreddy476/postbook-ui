"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import CommentSection, { type CommentCreatorTools } from "@/components/CommentSection";
import type { CommentSort } from "@/hooks/usePostComments";
import { formatCount } from "@/features/reels/model";

/*
  Comments in the right column, opened from the rail like the Reels
  comments column: from 1024px a 380px column flush right under the header
  (watch.css), below it the Reels bottom sheet (.reel-comments-panel
  .is-sheet). The head carries "Comments N", the Top / Newest sort pill
  and ✕; the thread is CommentSection (replies, emoji reactions,
  mentions, the composer pinned at the bottom) with the creator's heart
  and pin on rows; Up next sits under the thread in the column.
*/

export interface WatchCommentsProps {
  open: boolean;
  onClose: () => void;
  /** ≥1024px: the column; below: the sheet. */
  wide: boolean;
  postId: string;
  authorId: string;
  count: number;
  commentsOff?: boolean;
  sort: CommentSort;
  onSort: (sort: CommentSort) => void;
  creatorTools: CommentCreatorTools;
  /** Rendered under the thread in the column only. */
  upNext?: ReactNode;
}

export function WatchComments({ open, onClose, wide, postId, authorId, count, commentsOff = false, sort, onSort, creatorTools, upNext }: WatchCommentsProps) {
  const head = (
    <div className="reel-comments-head">
      <h3 className="reel-comments-head__title">
        Comments
        <span className="reel-comments-head__count" aria-label={`${formatCount(count)} comments`}>
          {formatCount(count)}
        </span>
      </h3>
      <div className="flex items-center gap-2">
        {!commentsOff ? (
          <div className="tube-comments__sort" role="group" aria-label="Sort comments">
            <button type="button" className="tube-comments__pill" aria-pressed={sort === "top"} onClick={() => onSort("top")}>
              Top
            </button>
            <button type="button" className="tube-comments__pill" aria-pressed={sort === "newest"} onClick={() => onSort("newest")}>
              Newest
            </button>
          </div>
        ) : null}
        <button type="button" onClick={onClose} aria-label="Close comments" className="reel-comments-close">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
  const thread = commentsOff ? (
    <p className="tube-comments__off">Comments are off for this video.</p>
  ) : (
    <CommentSection key={`${postId}:${sort}`} postId={postId} postAuthorId={authorId} commentsCount={count} alwaysExpanded sort={sort} creatorTools={creatorTools} />
  );

  return (
    <AnimatePresence>
      {open ? (
        wide ? (
          <motion.aside
            key="column"
            data-comments-column
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 24, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            aria-label="Comments"
            className="tube-comments-column"
          >
            <div className="reel-comments-panel is-column">
              {head}
              <div className="tube-comments__thread">{thread}</div>
              {upNext ? <div className="tube-comments__upnext">{upNext}</div> : null}
            </div>
          </motion.aside>
        ) : (
          <>
            <motion.div key="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="reel-comments-scrim" onClick={onClose} />
            <motion.aside
              key="sheet"
              data-comments-sheet
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              aria-label="Comments"
              className="reel-comments-panel is-sheet"
            >
              {head}
              <div className="min-h-0 flex-1 overflow-hidden">{thread}</div>
            </motion.aside>
          </>
        )
      ) : null}
    </AnimatePresence>
  );
}
