"use client";

import { useId, type ReactNode } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";

import { RailBookmark, RailBubble, RailHeart, RailShare } from "@/features/reels/components/ReelRailIcons";

import { Avatar } from "@/components/LetterAvatar";
import { authorAction } from "@/features/reels/menu";
import { formatCount, type ReelItem } from "@/features/reels/model";
import { liveRingLabel } from "@/features/reels/live/liveRing";

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
  /**
   * The author is live right now (live/liveRing.ts reelLiveHref): the avatar
   * wears the LIVE ring and opens their stream. "" or absent = no ring.
   */
  liveHref?: string;
}

/** Top to bottom; the rail reads Share, Save, Comments, Like, Avatar from the bottom, as TikTok's. */
export const RAIL_ORDER = ["follow", "like", "comments", "share", "save", "profile"] as const;

/*
  The action rail (founder, 19 Oct). On top, only while the viewer does not
  follow the author: the Follow ring — the author's picture inside a pink
  ring with FOLLOW along its top and a plus at its foot; it follows, or
  subscribes for a reel posted through a channel. Then Like, Comments,
  Share, Save. At the foot, always: the author's picture, a link to the
  profile (or their stream while live). Sound stays top-left on the frame.
  Colour only through the theme tokens.
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
  liveHref = "",
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
      {badge ? (
        <button type="button" className="reel-rail-follow" aria-label={badge.label} disabled={badge.pending} onClick={badge.onClick}>
          <span className="reel-rail-follow__face" aria-hidden="true">
            <Avatar src={reel.authorAvatarUrl ?? ""} name={reel.authorName} seed={reel.authorId} size="md" />
          </span>
          <FollowRingMark />
        </button>
      ) : null}
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
      {!reel.shareHidden ? (
        <RailButton label="Share" count={reel.shareCount} onClick={onShare} icon={<RailShare size={desktop ? 18 : 20} />} />
      ) : null}
      <RailButton
        label={reel.viewerSaved ? "Unsave" : "Save"}
        active={reel.viewerSaved}
        onClick={onSave}
        icon={<RailBookmark size={desktop ? 16 : 18} />}
        activeClass="is-saved"
        count={desktop ? (reel.saveCount ?? 0) : undefined}
      />
      {!desktop && onMore ? (
        <div className="relative">
          <RailButton label="More" onClick={onMore} icon={<MoreHorizontal size={iconSize} />} />
          {moreMenu}
        </div>
      ) : null}
      <div className="reel-rail-avatar-wrap">
        <Link
          href={liveHref || profileHref}
          className={`reel-rail-avatar${liveHref ? " is-live" : ""}`}
          aria-label={liveHref ? liveRingLabel(reel.authorName) : `${reel.authorName}'s profile`}
          data-live={liveHref ? "" : undefined}
        >
          <Avatar src={reel.authorAvatarUrl ?? ""} name={reel.authorName} seed={reel.authorId} size={desktop ? "lg" : "md"} />
        </Link>
        {liveHref ? <span className="reel-live-tag" aria-hidden="true">LIVE</span> : null}
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

/**
 * The Follow ring's lettering (founder, 19 Oct): the author's picture sits in
 * the middle of a pink ring, FOLLOW bent along the ring's top half and a
 * small plus at its foot. Drawn in a 60-unit box: the picture fills radius
 * 19, the letters ride an arc of radius 21.5 inside the 30-unit rim.
 */
function FollowRingMark() {
  // Every reel on the page draws its own rail, so each arc needs its own id.
  const arc = `reel-follow-arc${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg className="reel-rail-follow__mark" viewBox="0 0 60 60" aria-hidden="true" focusable="false">
      <defs>
        <path id={arc} d="M 8.5 30 A 21.5 21.5 0 0 1 51.5 30" />
      </defs>
      <text className="reel-rail-follow__word">
        <textPath href={`#${arc}`} startOffset="50%" textAnchor="middle">FOLLOW</textPath>
      </text>
      <path className="reel-rail-follow__plus" d="M30 51v6M27 54h6" />
    </svg>
  );
}
