"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Check } from "lucide-react";

import EmbedCard from "@/components/EmbedCard";
import PaywallPreview from "@/components/monetization/PaywallPreview";
import { useDataSaver } from "@/hooks/useDataSaver";
import { useUserProfile } from "@/hooks/useEditProfile";
import { useFeedReaction } from "@/hooks/useFeedReaction";
import { usePoll } from "@/hooks/usePollVote";
import { normalizeReaction } from "@/lib/reactions";
import { resolveImageUrl } from "@/lib/imageUrl";
import type { PostDetail } from "@/types/profile";
import { CarouselDots, StageCarousel, stagePhotoSrc } from "@/features/post-stage/components/StageCarousel";
import { StageCaption } from "@/features/post-stage/components/StageCaption";
import { PostRail } from "@/features/post-stage/components/PostRail";
import { WordsOnColour } from "@/features/post-stage/components/WordsOnColour";
import { useStageSave } from "@/features/post-stage/data/useStageSave";
import { useStageVote } from "@/features/post-stage/data/useStageVote";
import { frameAspect, stageWordsStyle, toStagePost } from "@/features/post-stage/model";

/*
  One post on the stage: the media frame (photos side by side, a video, or
  the words on a colour), the caption block at its bottom-left, and the
  rail beside it. The screen around it (the feed, or the post page) owns
  navigation, comments and share; this owns the post's own state.
*/

export interface PostStageProps {
  row: PostDetail;
  /** This page is the one on screen. */
  active: boolean;
  viewerId: string;
  /** undefined = unknown or own post: no Follow control. */
  following: boolean | undefined;
  followPending?: boolean;
  onFollow: (authorId: string, name: string) => void;
  onComments: () => void;
  onShare: () => void;
  /** Index of the photo shown; the screen keeps it so the arrow keys can move it. */
  slide?: number;
  onSlide?: (i: number) => void;
}

export function PostStage({ row, active, viewerId, following, followPending, onFollow, onComments, onShare, slide, onSlide }: PostStageProps) {
  const post = useMemo(() => toStagePost(row), [row]);
  const { effective: dataSaver } = useDataSaver();
  const [localSlide, setLocalSlide] = useState(0);
  const index = Math.min(slide ?? localSlide, Math.max(0, post.media.length - 1));
  const setIndex = onSlide ?? setLocalSlide;

  // The post read carries no author block; the profile fills the name, handle and avatar.
  const needProfile = !post.authorName || !post.authorHandle || !post.authorAvatar;
  const { data: profile } = useUserProfile(needProfile ? post.authorId : undefined);
  const authorName = post.authorName || profile?.display_name || profile?.username || "Someone";
  const handle = post.authorHandle || profile?.username || "";
  const rawAvatar = post.authorAvatar || (profile?.avatar_media_id ? `/v1/media/${profile.avatar_media_id}/serve` : "");
  const avatarSrc = resolveImageUrl(rawAvatar, { dataSaver, size: "small" });
  const profileHref = `/u/${handle || post.authorId}`;

  const like = useFeedReaction(post.id);
  const toggleLike = () => {
    if (like.busy) return;
    like.mutate({ next: post.viewerLiked ? null : "like", current: normalizeReaction(row.viewer_reaction) });
  };
  const save = useStageSave(post.id);

  const own = Boolean(viewerId) && viewerId === post.authorId;
  const canFollow = !own && following === false;

  const coverId = row.cover_media_id;
  const poster = coverId && !post.media.some((m) => m.mediaId === coverId && m.kind === "video") ? stagePhotoSrc(coverId, dataSaver) : undefined;

  return (
    <div className="ps-cluster">
      <div className="ps-cluster__spacer" aria-hidden="true" />
      <div className="ps-frame" style={{ "--ps-ar": String(frameAspect(post)) } as CSSProperties}>
        <div className="ps-frame__media">
          {post.kind === "media" ? (
            <StageCarousel media={post.media} index={index} onIndex={setIndex} active={active} dataSaver={dataSaver} poster={poster} />
          ) : post.kind === "words" ? (
            <WordsOnColour text={post.caption} rich={stageWordsStyle(post)} variant="stage">
              {post.hasPoll ? <StagePoll postId={post.id} initial={row.poll ?? null} /> : null}
            </WordsOnColour>
          ) : post.kind === "embed" ? (
            <div className="ps-frame__scroll"><EmbedCard post={row} /></div>
          ) : (
            <div className="ps-frame__scroll ps-frame__centre">
              <PaywallPreview creatorId={post.authorId} creatorName={authorName} tierRequiredId={row.tier_required_id ?? null} />
            </div>
          )}
        </div>
        <div className="ps-frame__top-shade" aria-hidden="true" />
        <div className="ps-frame__shade" aria-hidden="true" />
        <StageCaption
          post={post}
          authorName={authorName}
          handle={handle}
          profileHref={profileHref}
          showCaption={post.kind === "media"}
          above={post.kind === "media" ? <CarouselDots count={post.media.length} index={index} /> : null}
        />
      </div>
      <PostRail
        authorName={authorName}
        profileHref={profileHref}
        avatarSrc={avatarSrc}
        authorSeed={post.authorId}
        canFollow={canFollow}
        followPending={followPending}
        onFollow={() => onFollow(post.authorId, authorName)}
        counts={post.counts}
        liked={post.viewerLiked}
        saved={post.viewerSaved}
        likesOff={post.likesOff}
        commentsOff={post.commentsOff}
        shareHidden={post.shareHidden}
        likePending={like.busy}
        onLike={toggleLike}
        onComments={onComments}
        onSave={() => save.mutate(!post.viewerSaved)}
        onShare={onShare}
      />
    </div>
  );
}

function StagePoll({ postId, initial }: { postId: string; initial: PostDetail["poll"] }) {
  const { data: live } = usePoll(postId, true);
  const vote = useStageVote(postId);
  const poll = live ?? initial;
  if (!poll?.options?.length) return null;
  const voted = (poll.viewer_votes?.length ?? 0) > 0;
  const results = voted || poll.has_ended;
  return (
    <div className="ps-poll" onClick={(e) => e.stopPropagation()}>
      {poll.options.map((option) => {
        const mine = poll.viewer_votes?.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            className={`ps-poll__option${mine ? " is-mine" : ""}`}
            disabled={Boolean(results) || vote.isPending}
            onClick={() => vote.mutate(option.id)}
          >
            {results ? <span className="ps-poll__bar" style={{ width: `${option.percentage}%` }} aria-hidden="true" /> : null}
            <span className="ps-poll__label">
              {mine ? <Check size={14} aria-hidden="true" /> : null}
              {option.label}
            </span>
            {results ? <span className="ps-poll__pct">{option.percentage}%</span> : null}
          </button>
        );
      })}
      {results ? <p className="ps-poll__total">{poll.total_votes} vote{poll.total_votes === 1 ? "" : "s"}{poll.has_ended ? " · Poll ended" : ""}</p> : null}
    </div>
  );
}
