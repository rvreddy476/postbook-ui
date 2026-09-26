"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";

import { RailBookmark, RailBubble, RailHeart, RailPlus, RailShare } from "@/features/reels/components/ReelRailIcons";

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
  /** Spins the sound disc at the bottom of the desktop rail. */
  playing?: boolean;
  onSave: () => void;
  /** Phone only: the rail carries More there. The desktop rail has none — More is on the frame. */
  onMore?: () => void;
  /** The more-menu popover is rendered by the parent inside this slot (phone). */
  moreMenu?: ReactNode;
  /**
   * "desktop" (default) stands beside the stage, bottom-aligned to the
   * frame: the avatar with the plus badge, then Like, Comments, Save, Share
   * as 48px circles with counts under them (78px per item). "phone" floats
   * over the video and keeps its More button.
   */
  variant?: "desktop" | "phone";
}

/** Top to bottom; the rail reads Share, Save, Comments, Like, Avatar from the bottom, as TikTok's. */
export const RAIL_ORDER = ["avatar", "like", "comments", "save", "share"] as const;

/*
  The action rail. The author's avatar on top (a link to the profile) with
  the Follow badge — a 24px accent circle with a white plus — centred on
  its bottom edge, where TikTok puts its "+"; it follows, or subscribes for
  a reel posted through a channel, and disappears once the viewer follows.
  Then Like, Comments, Save, Share; counts under the icons. Liked is the
  danger colour, saved the accent. Colour only through the theme tokens.
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
  playing = false,
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
  const desktop = variant === "desktop";
  const iconSize = desktop ? 24 : 18;

  return (
    <div className={`reel-action-rail is-${variant}`} onClick={(e) => e.stopPropagation()}>
      <div className="reel-rail-avatar-wrap">
        <Link href={profileHref} className="reel-rail-avatar" aria-label={`${reel.authorName}'s profile`}>
          <Avatar src={reel.authorAvatarUrl ?? ""} name={reel.authorName} seed={reel.authorId} size={desktop ? "lg" : "md"} />
        </Link>
        {badge ? (
          <button type="button" className="reel-rail-follow" aria-label={badge.label} disabled={badge.pending} onClick={badge.onClick}>
            <RailPlus size={desktop ? 11 : 12} />
          </button>
        ) : null}
      </div>
      <RailButton
        label={reel.viewerLiked ? "Unlike" : "Like"}
        count={reel.likeCount}
        active={reel.viewerLiked}
        onClick={onLike}
        icon={<RailHeart size={desktop ? 16 : 18} />}
        activeClass="is-liked"
      />
      {!reel.commentsDisabled ? (
        <RailButton label="Comments" count={reel.commentCount} onClick={onComments} icon={<RailBubble size={desktop ? 18 : 20} />} />
      ) : null}
      <RailButton
        label={reel.viewerSaved ? "Unsave" : "Save"}
        active={reel.viewerSaved}
        onClick={onSave}
        icon={<RailBookmark size={desktop ? 16 : 18} />}
        activeClass="is-saved"
        count={desktop ? (reel.saveCount ?? 0) : undefined}
      />
      {!reel.shareHidden ? (
        <RailButton label="Share" count={reel.shareCount} onClick={onShare} icon={<RailShare size={desktop ? 18 : 20} />} />
      ) : null}
      {!desktop && onMore ? (
        <div className="relative">
          <RailButton label="More" onClick={onMore} icon={<MoreHorizontal size={iconSize} />} />
          {moreMenu}
        </div>
      ) : null}
      {desktop ? (
        // TikTok's sound disc: 44px in a 52px slot at the very bottom, turning while the reel plays.
        <Link href={profileHref} className="reel-rail-disc" aria-label={`More from ${reel.authorName}`} data-playing={playing ? "" : undefined}>
          <Avatar src={reel.authorAvatarUrl ?? ""} name={reel.authorName} seed={reel.authorId} size="md" />
        </Link>
      ) : null}
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
