"use client";

import CommentSection, { type CommentCreatorTools } from "@/components/CommentSection";
import type { CommentSort } from "@/hooks/usePostComments";
import { formatCount } from "@/features/reels/model";

/*
  Comments inline under the about card (the RUTUBE watch layout), not a
  column or a sheet: "Comments N" with the Top / Newest sort, then
  CommentSection (replies, emoji reactions, mentions, the creator's heart
  and pin) with its composer moved above the thread by watch.css, so the
  page never scrolls inside a box.
*/

export interface WatchCommentsProps {
  postId: string;
  authorId: string;
  count: number;
  commentsOff?: boolean;
  sort: CommentSort;
  onSort: (sort: CommentSort) => void;
  creatorTools: CommentCreatorTools;
}

export function WatchComments({ postId, authorId, count, commentsOff = false, sort, onSort, creatorTools }: WatchCommentsProps) {
  return (
    <section className="tube-comments" aria-label="Comments" data-comments>
      <div className="tube-comments__head">
        <h2 className="tube-comments__title">
          Comments <span className="tube-comments__count">{formatCount(count)}</span>
        </h2>
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
      </div>
      {commentsOff ? (
        <p className="tube-comments__off">Comments are off for this video.</p>
      ) : (
        <div className="tube-comments__body">
          <CommentSection key={`${postId}:${sort}`} postId={postId} postAuthorId={authorId} commentsCount={count} alwaysExpanded sort={sort} creatorTools={creatorTools} />
        </div>
      )}
    </section>
  );
}
