"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send } from "lucide-react";

import { Avatar } from "@/components/LetterAvatar";
import type { HoverAnchorProps } from "@/features/reels/hooks/useCreatorHoverCard";
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
  /**
   * "desktop" (default) sits beside the stage: the author avatar on top,
   * then 48px circles on the page background with counts under them.
   * "phone" floats over the video, white on the picture, as before.
   */
  variant?: "desktop" | "phone";
  /** Hover-card wiring for the avatar (desktop only; undefined on coarse pointers). */
  avatarAnchor?: HoverAnchorProps;
}

/*
  The action rail. Desktop: avatar (links to the profile, no follow
  affordance — that is the overlay's Follow pill and the hover card), Like,
  Comments, Save, Share, More; counts under the icons. Liked is the danger
  colour, saved the accent. Colour only through the theme tokens so it
  reads the same in light and dark.
*/
export function ReelRail({ reel, onLike, onComments, onShare, onSave, onMore, moreMenu, variant = "desktop", avatarAnchor }: ReelRailProps) {
  const profileHref = `/u/${reel.authorUsername || reel.authorId}`;
  return (
    <div className={`reel-action-rail is-${variant}`} onClick={(e) => e.stopPropagation()}>
      {variant === "desktop" ? (
        <Link href={profileHref} className="reel-rail-avatar" aria-label={`${reel.authorName}'s profile`} {...(avatarAnchor ?? {})}>
          <Avatar src={reel.authorAvatarUrl ?? ""} name={reel.authorName} seed={reel.authorId} size="lg" />
        </Link>
      ) : null}
      <RailButton
        label={reel.viewerLiked ? "Unlike" : "Like"}
        count={reel.likeCount}
        active={reel.viewerLiked}
        onClick={onLike}
        icon={<Heart size={variant === "desktop" ? 22 : 18} className={reel.viewerLiked ? "fill-current" : ""} />}
        activeClass="is-liked"
      />
      {!reel.commentsDisabled ? (
        <RailButton label="Comments" count={reel.commentCount} onClick={onComments} icon={<MessageCircle size={variant === "desktop" ? 22 : 18} />} />
      ) : null}
      <RailButton
        label={reel.viewerSaved ? "Unsave" : "Save"}
        active={reel.viewerSaved}
        onClick={onSave}
        icon={<Bookmark size={variant === "desktop" ? 22 : 18} className={reel.viewerSaved ? "fill-current" : ""} />}
        activeClass="is-saved"
      />
      {!reel.shareHidden ? (
        <RailButton label="Share" count={reel.shareCount} onClick={onShare} icon={<Send size={variant === "desktop" ? 22 : 18} />} />
      ) : null}
      <div className="relative">
        <RailButton label="More" onClick={onMore} icon={<MoreHorizontal size={variant === "desktop" ? 22 : 18} />} />
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
    <button type="button" aria-label={label} aria-pressed={active} onClick={onClick} className={`reel-action-button ${active ? activeClass : ""}`}>
      <span className="reel-action-icon">{icon}</span>
      {typeof count === "number" ? <span className="reel-action-count">{formatCount(count)}</span> : null}
    </button>
  );
}
