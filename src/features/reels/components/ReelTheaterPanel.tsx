"use client";

import CommentSection from "@/components/CommentSection";
import { ReelAuthorCard, type ReelAuthorCardProps } from "@/features/reels/components/ReelAuthorCard";
import { formatCount } from "@/features/reels/model";

export interface ReelTheaterPanelProps extends ReelAuthorCardProps {
  focusCommentId?: string;
}

/*
  The theater's right panel: the author card (ReelAuthorCard — the same
  one the comments column opens with), then "Comments · N" and
  CommentSection with its composer pinned at the bottom.
*/
export function ReelTheaterPanel({ focusCommentId, ...card }: ReelTheaterPanelProps) {
  const { reel } = card;
  return (
    <aside className="reel-theater-panel" aria-label="About this reel" data-reel-side-panel onClick={(e) => e.stopPropagation()}>
      <div className="reel-theater-panel__top">
        <ReelAuthorCard {...card} />
      </div>

      {!reel.commentsDisabled ? (
        <>
          <h3 className="reel-theater-panel__comments-head">Comments · {formatCount(reel.commentCount)}</h3>
          <div className="min-h-0 flex-1 overflow-hidden" data-comments-drawer="true">
            <CommentSection key={reel.id} postId={reel.id} postAuthorId={reel.authorId} commentsCount={reel.commentCount} alwaysExpanded focusCommentId={focusCommentId} />
          </div>
        </>
      ) : (
        <p className="reel-theater-panel__comments-off">Comments are off for this reel.</p>
      )}
    </aside>
  );
}
