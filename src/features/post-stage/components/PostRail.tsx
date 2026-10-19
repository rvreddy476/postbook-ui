"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Bookmark, Heart, MessageCircle, Plus, Share2 } from "lucide-react";

import { LetterAvatar } from "@/components/LetterAvatar";
import { onImageError } from "@/lib/imageUrl";
import { railAriaLabel, railCountText, type StageCounts } from "@/features/post-stage/model";

/*
  The post rail: the author's avatar, then Like, Comments, Save and Share,
  each with its count under it.

  Under the avatar, when the viewer can follow: a pink circle with a white
  plus AND the word "Follow" — a bare plus means nothing to anyone
  (founder). The word is always "Follow", also where the tap subscribes
  to a channel (a subscription includes the follow); the caller decides
  what the tap does. A count the row carries shows as a number, and 0
  shows "0"; a count the row does not carry shows the control's name. No
  spinning disc anywhere: the founder removed it.

  Beside the frame on a desktop, over the media on a phone; the CSS places
  it (post-stage.css). Colours only through tokens.
*/

export interface PostRailProps {
  authorName: string;
  profileHref: string;
  /** A resolved avatar URL, or "" for the letter avatar. */
  avatarSrc: string;
  authorSeed: string;
  /** The viewer can follow (or subscribe to) the author: the badge and the word "Follow" show. */
  canFollow?: boolean;
  followPending?: boolean;
  onFollow?: () => void;
  counts: StageCounts;
  liked: boolean;
  saved: boolean;
  likesOff?: boolean;
  commentsOff?: boolean;
  shareHidden?: boolean;
  likePending?: boolean;
  onLike: () => void;
  onComments: () => void;
  onSave: () => void;
  onShare: () => void;
}

export function PostRail({
  authorName,
  profileHref,
  avatarSrc,
  authorSeed,
  canFollow = false,
  followPending = false,
  onFollow,
  counts,
  liked,
  saved,
  likesOff = false,
  commentsOff = false,
  shareHidden = false,
  likePending = false,
  onLike,
  onComments,
  onSave,
  onShare,
}: PostRailProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  return (
    <div className="ps-rail" onClick={(e) => e.stopPropagation()}>
      <div className="ps-rail__author">
        <Link href={profileHref} className="ps-rail__avatar" aria-label={`${authorName}'s profile`}>
          {avatarSrc && !avatarFailed ? (
            <img
              src={avatarSrc}
              alt=""
              onError={(e) => {
                const img = e.currentTarget;
                const before = img.getAttribute("src");
                onImageError(e);
                if (img.getAttribute("src") === before) setAvatarFailed(true);
              }}
            />
          ) : (
            <LetterAvatar name={authorName} seed={authorSeed} size="lg" className="h-full w-full" />
          )}
        </Link>
        {canFollow && onFollow ? (
          // Its accessible name is its visible word, "Follow"; the plus is decoration.
          <button
            type="button"
            className="ps-rail__follow"
            disabled={followPending}
            onClick={onFollow}
          >
            <span className="ps-rail__follow-badge" aria-hidden="true">
              <Plus size={12} strokeWidth={3.25} />
            </span>
            <span className="ps-rail__follow-label">Follow</span>
          </button>
        ) : null}
      </div>
      {!likesOff ? (
        <RailButton name="Like" value={counts.likes} active={liked} activeClass="is-liked" disabled={likePending} onClick={onLike}>
          <Heart size={26} fill={liked ? "currentColor" : "none"} />
        </RailButton>
      ) : null}
      {!commentsOff ? (
        <RailButton name="Comments" value={counts.comments} onClick={onComments}>
          <MessageCircle size={26} />
        </RailButton>
      ) : null}
      <RailButton name="Save" value={counts.saves} active={saved} activeClass="is-saved" onClick={onSave}>
        <Bookmark size={26} fill={saved ? "currentColor" : "none"} />
      </RailButton>
      {!shareHidden ? (
        <RailButton name="Share" value={counts.shares} onClick={onShare}>
          <Share2 size={26} />
        </RailButton>
      ) : null}
    </div>
  );
}

function RailButton({
  name,
  value,
  active,
  activeClass = "",
  disabled,
  onClick,
  children,
}: {
  name: string;
  value: number | undefined;
  active?: boolean;
  activeClass?: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`ps-rail__button ${active ? activeClass : ""}`}
      aria-label={railAriaLabel(name, value)}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onClick={onClick}
      data-rail={name.toLowerCase()}
    >
      <span className="ps-rail__icon" aria-hidden="true">{children}</span>
      <span className="ps-rail__count" aria-hidden="true">{railCountText(name, value)}</span>
    </button>
  );
}
