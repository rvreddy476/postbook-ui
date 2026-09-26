"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send } from "lucide-react";

import { Avatar } from "@/components/LetterAvatar";
import { authorAction } from "@/features/reels/menu";
import { formatCount, type ReelItem } from "@/features/reels/model";

interface ReelRailProps {
  reel: ReelItem;
  isOwn: boolean;
  /** undefined = relationship unknown (no badge yet) */
  following: boolean | undefined;
  followPending: boolean;
  onToggleFollow: () => void;
  /**
   * Channel subscription for a reel posted through a Tube channel;
   * undefined = unknown (no badge yet). Only read when channelHandle is set.
   */
  subscribed?: boolean | undefined;
  subscribePending?: boolean;
  onToggleSubscribe?: () => void;
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
}

/*
  The action rail. The author's avatar on top (a link to the profile) with
  the Follow badge attached to its bottom edge, where TikTok puts its "+";
  it follows — or subscribes, for a reel posted through a channel — and
  disappears once the viewer follows, as TikTok's does. Then Like,
  Comments, Save, Share, More; counts under the icons. Liked is the danger
  colour, saved the accent. Colour only through the theme tokens so it
  reads the same in light and dark.
*/
export function ReelRail({
  reel,
  isOwn,
  following,
  followPending,
  onToggleFollow,
  subscribed,
  subscribePending,
  onToggleSubscribe,
  onLike,
  onComments,
  onShare,
  onSave,
  onMore,
  moreMenu,
  variant = "desktop",
}: ReelRailProps) {
  const profileHref = `/u/${reel.authorUsername || reel.authorId}`;
  const action = authorAction(reel, isOwn);
  const badge =
    action === "subscribe" && subscribed === false
      ? { label: `Subscribe to ${reel.authorName}'s channel`, pending: Boolean(subscribePending), onClick: () => onToggleSubscribe?.() }
      : action === "follow" && following === false
        ? { label: `Follow ${reel.authorName}`, pending: followPending, onClick: onToggleFollow }
        : null;
  const iconSize = variant === "desktop" ? 22 : 18;

  return (
    <div className={`reel-action-rail is-${variant}`} onClick={(e) => e.stopPropagation()}>
      <div className="reel-rail-avatar-wrap">
        <Link href={profileHref} className="reel-rail-avatar" aria-label={`${reel.authorName}'s profile`}>
          <Avatar src={reel.authorAvatarUrl ?? ""} name={reel.authorName} seed={reel.authorId} size={variant === "desktop" ? "lg" : "md"} />
        </Link>
        {badge ? (
          <button type="button" className="reel-rail-follow" aria-label={badge.label} disabled={badge.pending} onClick={badge.onClick}>
            Follow
          </button>
        ) : null}
      </div>
      <RailButton
        label={reel.viewerLiked ? "Unlike" : "Like"}
        count={reel.likeCount}
        active={reel.viewerLiked}
        onClick={onLike}
        icon={<Heart size={iconSize} className={reel.viewerLiked ? "fill-current" : ""} />}
        activeClass="is-liked"
      />
      {!reel.commentsDisabled ? (
        <RailButton label="Comments" count={reel.commentCount} onClick={onComments} icon={<MessageCircle size={iconSize} />} />
      ) : null}
      <RailButton
        label={reel.viewerSaved ? "Unsave" : "Save"}
        active={reel.viewerSaved}
        onClick={onSave}
        icon={<Bookmark size={iconSize} className={reel.viewerSaved ? "fill-current" : ""} />}
        activeClass="is-saved"
      />
      {!reel.shareHidden ? (
        <RailButton label="Share" count={reel.shareCount} onClick={onShare} icon={<Send size={iconSize} />} />
      ) : null}
      <div className="relative">
        <RailButton label="More" onClick={onMore} icon={<MoreHorizontal size={iconSize} />} />
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
