"use client";

import Link from "next/link";
import { Bookmark, Heart, MessageCircle, Send } from "lucide-react";

import { Avatar } from "@/components/LetterAvatar";
import { ReelSoundLabel } from "@/features/reels/components/ReelSoundLabel";
import { authorAction } from "@/features/reels/menu";
import { formatCount, type ReelItem } from "@/features/reels/model";
import { liveRingLabel } from "@/features/reels/live/liveRing";

export interface ReelAuthorCardProps {
  reel: ReelItem;
  isOwn: boolean;
  /** undefined = relationship unknown (no pill yet) */
  following: boolean | undefined;
  followPending: boolean;
  onToggleFollow: () => void;
  /** Channel subscription for a reel posted through a channel; undefined = unknown. */
  subscribed?: boolean;
  subscribePending?: boolean;
  onToggleSubscribe?: () => void;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
  /** "Use this sound" for a reel that plays only its own audio; absent = no such line. */
  onUseOriginalSound?: () => void;
  useSoundPending?: boolean;
  /** The author is live right now: the avatar wears the LIVE ring and opens their stream. "" or absent = no ring. */
  liveHref?: string;
}

/*
  The "user profile panel" at the top of the comments column and of the
  theater panel — TikTok's card above the thread. Avatar 40, the display
  name (18/700, a link) and handle (14/500 muted) with the Follow pill at
  the right (Following outlined; Subscribe for a channel reel; nothing on
  an own reel); the full description and hashtags; the sound line (the
  overlay is hidden in theater, so this is where it is read there); then
  the counts row —
  Like, Comments, Save, Share with 16px icons and 12px/700 counts. Like
  and Save are the real toggles, Share opens the sheet. Card colours
  through the tokens, so it is white in the light theme and dark in dark.
*/
export function ReelAuthorCard({
  reel,
  isOwn,
  following,
  followPending,
  onToggleFollow,
  subscribed,
  subscribePending,
  onToggleSubscribe,
  onLike,
  onSave,
  onShare,
  onUseOriginalSound,
  useSoundPending,
  liveHref = "",
}: ReelAuthorCardProps) {
  const action = authorAction(reel, isOwn);
  const profileHref = `/u/${reel.authorUsername || reel.authorId}`;
  return (
    <div className="reel-author-card">
      <div className="reel-author-card__author">
        <Link
          href={liveHref || profileHref}
          aria-label={liveHref ? liveRingLabel(reel.authorName) : `${reel.authorName}'s profile`}
          className={`reel-author-card__avatar${liveHref ? " is-live" : ""}`}
          data-live={liveHref ? "" : undefined}
        >
          <Avatar src={reel.authorAvatarUrl ?? ""} name={reel.authorName} seed={reel.authorId} size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={profileHref} className="reel-author-card__name">
            {reel.authorName}
          </Link>
          {reel.authorUsername ? <p className="reel-author-card__handle">@{reel.authorUsername}</p> : null}
        </div>
        {action === "subscribe" && subscribed !== undefined ? (
          <button type="button" disabled={subscribePending} aria-pressed={subscribed} onClick={onToggleSubscribe} className={`reel-panel-follow ${subscribed ? "is-on" : ""}`}>
            {subscribed ? "Subscribed" : "Subscribe"}
          </button>
        ) : action === "follow" && following !== undefined ? (
          <button type="button" disabled={followPending} aria-pressed={following} onClick={onToggleFollow} className={`reel-panel-follow ${following ? "is-on" : ""}`}>
            {following ? "Following" : "Follow"}
          </button>
        ) : null}
      </div>

      {reel.title ? <h2 className="reel-author-card__title">{reel.title}</h2> : null}
      {reel.caption ? <p className="reel-author-card__caption">{reel.caption}</p> : null}
      {reel.hashtags.length > 0 ? (
        <p className="reel-author-card__tags">
          {reel.hashtags.map((tag) => (
            <Link key={tag} href={`/hashtag/${encodeURIComponent(tag)}`}>
              #{tag}
            </Link>
          ))}
        </p>
      ) : null}

      <ReelSoundLabel reel={reel} isOwn={isOwn} onUseOriginal={onUseOriginalSound} pending={useSoundPending} tone="card" />

      <div className="reel-author-card__counts" role="group" aria-label="Engagement">
        <button type="button" aria-label={reel.viewerLiked ? "Unlike" : "Like"} aria-pressed={reel.viewerLiked} onClick={onLike} className={`reel-panel-count ${reel.viewerLiked ? "is-liked" : ""}`}>
          <Heart size={16} className={reel.viewerLiked ? "fill-current" : ""} aria-hidden />
          {formatCount(reel.likeCount)}
        </button>
        <span className="reel-panel-count" aria-label={`${formatCount(reel.commentCount)} comments`}>
          <MessageCircle size={16} aria-hidden />
          {formatCount(reel.commentCount)}
        </span>
        <button type="button" aria-label={reel.viewerSaved ? "Unsave" : "Save"} aria-pressed={reel.viewerSaved} onClick={onSave} className={`reel-panel-count ${reel.viewerSaved ? "is-saved" : ""}`}>
          <Bookmark size={16} className={reel.viewerSaved ? "fill-current" : ""} aria-hidden />
          Save
        </button>
        {!reel.shareHidden ? (
          <button type="button" aria-label="Share" onClick={onShare} className="reel-panel-count">
            <Send size={16} aria-hidden />
            {formatCount(reel.shareCount)}
          </button>
        ) : null}
      </div>
    </div>
  );
}
