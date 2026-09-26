"use client";

import Link from "next/link";
import { Bookmark, Heart, MessageCircle, Send } from "lucide-react";

import CommentSection from "@/components/CommentSection";
import { Avatar } from "@/components/LetterAvatar";
import { authorAction } from "@/features/reels/menu";
import { formatCount, type ReelItem } from "@/features/reels/model";

export interface ReelTheaterPanelProps {
  reel: ReelItem;
  isOwn: boolean;
  following: boolean | undefined;
  followPending: boolean;
  onToggleFollow: () => void;
  subscribed?: boolean;
  subscribePending?: boolean;
  onToggleSubscribe?: () => void;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
  focusCommentId?: string;
}

/*
  The theater's right panel: everything the overlay used to draw on the
  video, plus the thread. Author row with the Follow pill, the full
  caption with hashtag links, the four counts (like and save are the real
  toggles, share opens the sheet), then "Comments · N" and CommentSection
  with its composer pinned at the bottom. Card colours through the tokens,
  so it is white in the light theme and the dark card in dark.
*/
export function ReelTheaterPanel({
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
  focusCommentId,
}: ReelTheaterPanelProps) {
  const action = authorAction(reel, isOwn);
  const profileHref = `/u/${reel.authorUsername || reel.authorId}`;
  return (
    <aside className="reel-theater-panel" aria-label="About this reel" data-reel-side-panel onClick={(e) => e.stopPropagation()}>
      <div className="reel-theater-panel__top">
        <div className="reel-theater-panel__author">
          <Link href={profileHref} aria-label={`${reel.authorName}'s profile`} className="shrink-0">
            <Avatar src={reel.authorAvatarUrl ?? ""} name={reel.authorName} seed={reel.authorId} size="md" />
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={profileHref} className="reel-theater-panel__name">
              {reel.authorName}
            </Link>
            {reel.authorUsername ? <p className="reel-theater-panel__handle">@{reel.authorUsername}</p> : null}
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

        {reel.title ? <h2 className="reel-theater-panel__title">{reel.title}</h2> : null}
        {reel.caption ? <p className="reel-theater-panel__caption">{reel.caption}</p> : null}
        {reel.hashtags.length > 0 ? (
          <p className="reel-theater-panel__tags">
            {reel.hashtags.map((tag) => (
              <Link key={tag} href={`/hashtag/${encodeURIComponent(tag)}`}>
                #{tag}
              </Link>
            ))}
          </p>
        ) : null}

        <div className="reel-theater-panel__counts" role="group" aria-label="Engagement">
          <button type="button" aria-label={reel.viewerLiked ? "Unlike" : "Like"} aria-pressed={reel.viewerLiked} onClick={onLike} className={`reel-panel-count ${reel.viewerLiked ? "is-liked" : ""}`}>
            <span className="reel-panel-count__icon">
              <Heart size={18} className={reel.viewerLiked ? "fill-current" : ""} />
            </span>
            {formatCount(reel.likeCount)}
          </button>
          <span className="reel-panel-count" aria-label="Comments">
            <span className="reel-panel-count__icon">
              <MessageCircle size={18} />
            </span>
            {formatCount(reel.commentCount)}
          </span>
          <button type="button" aria-label={reel.viewerSaved ? "Unsave" : "Save"} aria-pressed={reel.viewerSaved} onClick={onSave} className={`reel-panel-count ${reel.viewerSaved ? "is-saved" : ""}`}>
            <span className="reel-panel-count__icon">
              <Bookmark size={18} className={reel.viewerSaved ? "fill-current" : ""} />
            </span>
            Save
          </button>
          {!reel.shareHidden ? (
            <button type="button" aria-label="Share" onClick={onShare} className="reel-panel-count">
              <span className="reel-panel-count__icon">
                <Send size={18} />
              </span>
              {formatCount(reel.shareCount)}
            </button>
          ) : null}
        </div>
      </div>

      {!reel.commentsDisabled ? (
        <>
          <h3 className="reel-theater-panel__comments-head">Comments · {formatCount(reel.commentCount)}</h3>
          <div className="min-h-0 flex-1 overflow-hidden" data-comments-drawer="true">
            <CommentSection key={reel.id} postId={reel.id} postAuthorId={reel.authorId} commentsCount={reel.commentCount} alwaysExpanded focusCommentId={focusCommentId} />
          </div>
        </>
      ) : (
        <p className="reel-theater-panel__comments-off">Comments are off for this reel.</p>
      )}
    </aside>
  );
}
