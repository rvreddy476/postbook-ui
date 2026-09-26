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
    <div className="pointer-events-auto flex flex-col items-center gap-4 md:gap-5" onClick={(e) => e.stopPropagation()}>
      <RailButton
        label={reel.viewerLiked ? "Unlike" : "Like"}
        count={reel.likeCount}
        active={reel.viewerLiked}
        onClick={onLike}
        icon={<Heart className={`h-6 w-6 ${reel.viewerLiked ? "fill-current" : ""}`} />}
        activeClass="text-danger md:text-danger"
      />
      {!reel.commentsDisabled ? (
        <RailButton label="Comments" count={reel.commentCount} onClick={onComments} icon={<MessageCircle className="h-6 w-6" />} />
      ) : null}
      {!reel.shareHidden ? (
        <RailButton label="Share" count={reel.shareCount} onClick={onShare} icon={<Send className="h-6 w-6" />} />
      ) : null}
      <RailButton
        label={reel.viewerSaved ? "Unsave" : "Save"}
        active={reel.viewerSaved}
        onClick={onSave}
        icon={<Bookmark className={`h-6 w-6 ${reel.viewerSaved ? "fill-current" : ""}`} />}
      />
      <div className="relative">
        <RailButton label="More" onClick={onMore} icon={<MoreHorizontal className="h-6 w-6" />} />
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
      className="group flex flex-col items-center gap-1"
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition group-hover:bg-white/25 group-active:scale-90 md:bg-brand-secondary md:text-brand-text md:backdrop-blur-none md:group-hover:bg-brand-divider ${
          active ? activeClass : ""
        }`}
      >
        {icon}
      </span>
      {typeof count === "number" ? (
        <span className="text-[11px] font-semibold tabular-nums text-white drop-shadow md:text-brand-text md:drop-shadow-none">
          {formatCount(count)}
        </span>
      ) : null}
    </button>
  );
}
