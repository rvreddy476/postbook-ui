"use client";

import type { ReactNode } from "react";
import { FolderPlus, ListVideo, MoreHorizontal, ThumbsDown } from "lucide-react";

import { RailHeart } from "@/features/reels/components/ReelRailIcons";
import { formatCount } from "@/features/reels/model";

/*
  The action row under the creator row (the RUTUBE watch layout): one
  pill with Like and its count, a divider, and Dislike (private, never
  lit together with Like); Watch later (lit when saved) and Add to
  collection as labelled pills;
  the ⋯ circle opening the More menu under it (Share, Keep, Not
  interested, Don't recommend, Report, Block; the owner's Audio tracks,
  Edit, Delete). 36px high, 13px labels.
*/

export const WATCH_ACTION_ORDER = ["love", "pass", "queue", "add", "more"] as const;

export interface WatchActionsProps {
  loved: boolean;
  likeCount: number;
  passed: boolean;
  queued: boolean;
  onLove: () => void;
  onPass: () => void;
  onQueue: () => void;
  onAdd: () => void;
  onMore: () => void;
  moreOpen?: boolean;
  /** The More popover, rendered by the page under the ⋯ button. */
  moreMenu?: ReactNode;
}

export function WatchActions({ loved, likeCount, passed, queued, onLove, onPass, onQueue, onAdd, onMore, moreOpen = false, moreMenu }: WatchActionsProps) {
  return (
    <div className="tube-actions" role="toolbar" aria-label="Video actions">
      <div className="tube-actions__vote">
        <button type="button" className={`tube-actions__btn is-love${loved ? " is-on" : ""}`} aria-pressed={loved} aria-label={loved ? "Remove like" : "Like"} title="Like" onClick={onLove} data-action="love">
          <RailHeart size={16} />
          <span className="tube-actions__count">{formatCount(likeCount)}</span>
        </button>
        <span className="tube-actions__divider" aria-hidden />
        <button type="button" className={`tube-actions__btn is-pass${passed ? " is-on" : ""}`} aria-pressed={passed} aria-label={passed ? "Remove dislike" : "Dislike"} title="Dislike" onClick={onPass} data-action="pass">
          <ThumbsDown size={17} className={passed ? "fill-current" : ""} />
        </button>
      </div>
      <button type="button" className={`tube-actions__pill${queued ? " is-on" : ""}`} aria-pressed={queued} onClick={onQueue} data-action="queue">
        <ListVideo size={17} />
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
