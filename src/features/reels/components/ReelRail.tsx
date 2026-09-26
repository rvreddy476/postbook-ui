"use client";

import type { ReactNode } from "react";
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send } from "lucide-react";

import { formatCount, type ReelItem } from "@/features/reels/model";

interface ReelRailProps {
  reel: ReelItem;
  onLike: () => void;
  onComments: () => void;
  onShare: () => void;
  onSave: () => void;
  onMore: () => void;
  /** The more-menu popover is rendered by the parent inside this slot. */
  moreMenu?: ReactNode;
}

/*
  The action rail. On phones it floats over the stage (white on the video);
  from md up it sits beside the stage on the page background and takes the
  theme's colours, so it reads correctly in light and dark mode.
*/
export function ReelRail({ reel, onLike, onComments, onShare, onSave, onMore, moreMenu }: ReelRailProps) {
  return (
    <div className="reel-action-rail" onClick={(e) => e.stopPropagation()}>
      <RailButton
        label={reel.viewerLiked ? "Unlike" : "Like"}
        count={reel.likeCount}
        active={reel.viewerLiked}
        onClick={onLike}
        icon={<Heart size={18} className={reel.viewerLiked ? "fill-current" : ""} />}
        activeClass="text-danger md:text-danger"
      />
      {!reel.commentsDisabled ? (
        <RailButton label="Comments" count={reel.commentCount} onClick={onComments} icon={<MessageCircle size={18} />} />
      ) : null}
      {!reel.shareHidden ? (
        <RailButton label="Share" count={reel.shareCount} onClick={onShare} icon={<Send size={18} />} />
      ) : null}
      <RailButton
        label={reel.viewerSaved ? "Unsave" : "Save"}
        active={reel.viewerSaved}
        onClick={onSave}
        icon={<Bookmark size={18} className={reel.viewerSaved ? "fill-current" : ""} />}
      />
      <div className="relative">
        <RailButton label="More" onClick={onMore} icon={<MoreHorizontal size={18} />} />
        {moreMenu}
      </div>
    </div>
  );
}

function RailButton({
  label,
  count,
  icon,
  onClick,
  active,
  activeClass = "",
}: {
  label: string;
  count?: number;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
  activeClass?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`reel-action-button ${active ? activeClass : ''}`}
    >
      <span
        className="reel-action-icon"
      >
        {icon}
      </span>
      {typeof count === "number" ? (
        <span className="reel-action-count">
          {formatCount(count)}
        </span>
      ) : null}
    </button>
  );
}
