"use client";

import type { ReactNode } from "react";
import { Bookmark, FolderPlus, MoreHorizontal, Share2, ThumbsDown, ThumbsUp } from "lucide-react";

import { formatCount } from "@/features/reels/model";

/*
  The action row under the creator row (the RUTUBE watch layout): one
  pill with Like and its count, a divider, and Dislike (private, never
  lit together with Like); Watch later (lit when saved) and Add to
  collection as labelled pills;
  Share (2026-10-19, as YouTube has it on the row); the ⋯ circle opening the More menu under it (Share, Keep, Not
  interested, Don't recommend, Report, Block; the owner's Audio tracks,
  Edit, Delete). 36px high, 13px labels.
*/

export const WATCH_ACTION_ORDER = ["love", "pass", "share", "queue", "add", "more"] as const;

export interface WatchActionsProps {
  loved: boolean;
  /** null = the creator hid the count: the button reads "Like" with no number. */
  likeCount: number | null;
  passed: boolean;
  queued: boolean;
  onLove: () => void;
  onPass: () => void;
  onQueue: () => void;
  onAdd: () => void;
  /** Share (founder, 2026-10-19: Like, Dislike and Share on the row, as on YouTube); absent when the creator turned sharing off. */
  onShare?: () => void;
  onMore: () => void;
  moreOpen?: boolean;
  /** The More popover, rendered by the page under the ⋯ button. */
  moreMenu?: ReactNode;
}

export function WatchActions({ loved, likeCount, passed, queued, onLove, onPass, onQueue, onAdd, onShare, onMore, moreOpen = false, moreMenu }: WatchActionsProps) {
  return (
    <div className="tube-actions" role="toolbar" aria-label="Video actions">
      <div className="tube-actions__vote">
        <button type="button" className={`tube-actions__btn is-love${loved ? " is-on" : ""}`} aria-pressed={loved} aria-label={loved ? "Remove like" : "Like"} title="Like" onClick={onLove} data-action="love">
          {/* Thumbs up and down (2026-10-19), an outline until chosen, then filled. */}
          <ThumbsUp size={17} className={loved ? "fill-current" : ""} />
          {/* No likes yet (or the count hidden) reads "Like", not a lonely 0. */}
          {!likeCount ? <span className="tube-actions__count">Like</span> : <span className="tube-actions__count">{formatCount(likeCount)}</span>}
        </button>
        <span className="tube-actions__divider" aria-hidden />
        <button type="button" className={`tube-actions__btn is-pass${passed ? " is-on" : ""}`} aria-pressed={passed} aria-label={passed ? "Remove dislike" : "Dislike"} title="Dislike" onClick={onPass} data-action="pass">
          <ThumbsDown size={17} className={passed ? "fill-current" : ""} />
        </button>
      </div>
      {onShare ? (
        <button type="button" className="tube-actions__pill" onClick={onShare} data-action="share">
          <Share2 size={17} />
          Share
        </button>
      ) : null}
      <button type="button" className={`tube-actions__pill${queued ? " is-on" : ""}`} aria-pressed={queued} onClick={onQueue} data-action="queue">
        <Bookmark size={17} className={queued ? "fill-current" : ""} />
        Watch later
      </button>
      <button type="button" className="tube-actions__pill" onClick={onAdd} data-action="add">
        <FolderPlus size={17} />
        Add to collection
      </button>
      <div className="tube-actions__more">
        <button type="button" className={`tube-actions__pill is-icon${moreOpen ? " is-on" : ""}`} aria-label="More" aria-expanded={moreOpen} title="More" onClick={onMore} data-action="more">
          <MoreHorizontal size={18} />
        </button>
        {moreMenu}
      </div>
    </div>
  );
}
