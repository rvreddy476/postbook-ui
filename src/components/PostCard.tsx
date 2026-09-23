'use client';

import RichTextRenderer from '@/components/studio/RichTextRenderer';
import { scrimFor } from '@/components/studio/postStyle';
import React, { useState, useRef, useEffect } from 'react';
import type { PostDetail } from '@/types/profile';
import { useToggleLike, useToggleReaction } from '@/hooks/usePostReaction';
import ReactionPicker from '@/components/ReactionPicker';
import Link from 'next/link';
import { useToggleBookmark, useTogglePin } from '@/hooks/usePostActions';
import { useMuteUser } from '@/hooks/useMuting';
import { useBlockUser } from '@/hooks/useBlocking';
import { usePoll, useCastVote } from '@/hooks/usePollVote';
import { useMyProfile, useUserProfile } from '@/hooks/useEditProfile';
import CommentSection from '@/components/CommentSection';
import CommentPreview from '@/components/CommentPreview';
import ShareDialog from '@/components/ShareDialog';
import VideoPlayer from '@/components/VideoPlayer';
import EmbedCard from '@/components/EmbedCard';
import { useDataSaver } from '@/hooks/useDataSaver';
import api from '@/lib/api';
import { resolveImageUrl } from '@/lib/imageUrl';
import PaywallPreview from '@/components/monetization/PaywallPreview';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  MessageCircle,
  MoreHorizontal,
  Smile,
  Music,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Pin,
  Check,
  Repeat2,
  Flag,
  EyeOff,
  Heart,
  UserMinus,
  UserX,
  Code,
} from 'lucide-react';

interface PostCardProps {
  post: PostDetail;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d`;
  return new Date(dateStr).toLocaleDateString();
}

const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const liked = !!post.viewer_reaction;
  const reduceMotion = useReducedMotion();
  const likesCount = post.counts?.likes ?? 0;
  const commentsCount = post.counts?.comments ?? 0;
  const sharesCount = post.counts?.shares ?? 0;
  const { effective: dataSaver } = useDataSaver();

  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [bookmarked, setBookmarked] = useState(!!post.is_bookmarked);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const { data: profile } = useMyProfile();
  const likeMutation = useToggleLike();
  const reactionMutation = useToggleReaction();
  const bookmarkMutation = useToggleBookmark();
  const togglePinMutation = useTogglePin();
  const muteMutation = useMuteUser();
  const blockMutation = useBlockUser();
  const castVoteMutation = useCastVote();

  const { data: authorProfile } = useUserProfile(post.author_id);
  const { data: reposterProfile } = useUserProfile(post.is_repost ? post.reposted_by : undefined);

  const hasPoll = !!post.poll || post.content_type === 'poll';
  const { data: livePoll } = usePoll(post.id, hasPoll);
  const pollData = livePoll ?? post.poll;

  const isOwnPost = profile?.id === post.author_id;

  const toggleLike = () => {
    // The optimistic UI is now handled centrally by useToggleLike's onMutate
    likeMutation.mutate(post.id);
  };

  const handleReaction = (reactionType: string) => {
    reactionMutation.mutate({ postId: post.id, reactionType });
  };

  const handleBookmark = () => {
    const wasBookmarked = bookmarked;
    setBookmarked(!wasBookmarked);
    bookmarkMutation.mutate(post.id, {
      onError: () => setBookmarked(wasBookmarked),
    });
    setIsMoreOpen(false);
  };

  const handlePin = () => {
    togglePinMutation.mutate({ postId: post.id, pinned: !post.is_pinned });
    setIsMoreOpen(false);
  };

  const handleShare = () => {
    setShowShareDialog(true);
  };

  const handleReport = () => {
    setIsMoreOpen(false);
    const reason = prompt('Why are you reporting this post? (spam, abuse, hate, other)');
    if (!reason) return;
    void api
      .post(`/v1/posts/${post.id}/report`, { reason })
      .then(() => alert('Thanks — our team will review this post.'))
      .catch(() => alert('Sorry — we could not submit your report. Try again later.'));
  };

  const handleNotInterested = () => {
    setIsMoreOpen(false);
    void api
      .post(`/v1/feed/not-interested`, { post_id: post.id })
      .then(() => alert("Got it — we'll show you less like this."))
      .catch(() => alert("We couldn't apply that preference right now."));
  };

  const handleMuteAuthor = () => {
    setIsMoreOpen(false);
    if (!confirm(`Hide all posts from ${name}?`)) return;
    muteMutation.mutate(
      { muted_id: post.author_id },
      {
        onSuccess: () =>
          alert(`Muted. You won't see posts from ${name} anymore.`),
      },
    );
  };

  const handleBlockAuthor = () => {
    setIsMoreOpen(false);
    const username = authorProfile?.username;
    if (!username) {
      alert("Can't block — author info is still loading. Try again.");
      return;
    }
    if (!confirm(`Block @${username}? You won't see each other's content.`))
      return;
    blockMutation.mutate(username, {
      onSuccess: () => alert(`Blocked @${username}.`),
    });
  };

  const handleEmbed = () => {
    setIsMoreOpen(false);
    const iframe = `<iframe src="${window.location.origin}/post/${post.id}/embed" width="550" height="420" frameborder="0" allowfullscreen></iframe>`;
    navigator.clipboard
      .writeText(iframe)
      .then(() => alert("Embed code copied to clipboard."))
      .catch(() => alert("Could not copy embed code."));
  };

  const handleVote = (optionId: string) => {
    if (castVoteMutation.isPending) return;
    castVoteMutation.mutate({ postId: post.id, optionId });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    if (isMoreOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMoreOpen]);

  const resolvedProfile = isOwnPost ? profile : authorProfile;
  const avatar = resolvedProfile?.avatar_media_id
    ? `/v1/media/${resolvedProfile.avatar_media_id}/serve`
    : null;
  const name = resolvedProfile?.display_name || 'User';
  const avatarInitial = (name).charAt(0).toUpperCase();

  const isReel = post.content_type === 'short';
  const hasMultipleMedia = post.media && post.media.length > 1;
  const hasMedia = post.media && post.media.length > 0;
  const hasVoted = pollData?.viewer_votes && pollData.viewer_votes.length > 0;
  const pollEnded = pollData?.has_ended;
  const showResults = hasVoted || pollEnded;
  const isEmbed = post.content_type === 'video_embed' || post.content_type === 'flick_embed';

  if (isEmbed) {
    return <EmbedCard post={post} />;
  }

  return (
    <article
      // Rounder, with a shadow that exists and a card that answers the
      // pointer. shadow-xs on a hairline border read as a grey box drawn on a
      // grey page — correct colours, no depth, which is what "dull" was.
      className="group/card rounded-2xl border border-brand-divider bg-brand-card shadow-[0_1px_2px_rgba(15,20,25,0.04),0_8px_24px_-12px_rgba(15,20,25,0.10)] transition-shadow duration-200 hover:shadow-[0_1px_2px_rgba(15,20,25,0.05),0_12px_32px_-12px_rgba(15,20,25,0.16)]"
    >
      {/* Repost indicator */}
      {post.is_repost && (
        <div className="px-4 pt-2.5 flex items-center gap-1.5 text-muted-foreground">
          <Repeat2 className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold">
            {reposterProfile?.display_name || 'Someone'} reposted
          </span>
        </div>
      )}

      {/* Pin indicator */}
      {post.is_pinned && (
        <div className="px-4 pt-2.5 flex items-center gap-1.5 text-primary-ink">
          <Pin className="w-3.5 h-3.5 fill-current" />
          <span className="text-xs font-medium">Pinned post</span>
        </div>
      )}

      {/* Header */}
      <div className="px-3 sm:px-4 pt-2.5 sm:pt-3 pb-1.5 sm:pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-brand-divider hover:ring-primary-outline transition-all shrink-0">
              {avatar ? (
                <img
                  src={resolveImageUrl(avatar, { dataSaver, size: "small" })}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-brand-secondary text-brand-text/55 font-bold text-base">
                  {avatarInitial}
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-[14px] font-bold text-brand-text hover:text-primary-ink cursor-pointer transition-colors">{name}</h4>
              {post.feeling && (
                <span className="text-xs text-brand-text/60">
                  — feeling {post.feeling} <Smile className="w-3 h-3 inline text-warning" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-brand-text/40 mt-0.5">
              <span>{timeAgo(post.created_at)}</span>
              {post.location && (
                <>
                  <span className="text-brand-text/30">·</span>
                  <span className="flex items-center gap-0.5 text-brand-text/40">
                    <MapPin className="w-3 h-3" />
                    {post.location}
                  </span>
                </>
              )}
              {post.activity && (
                <>
                  <span className="text-brand-text/30">·</span>
                  <span className="flex items-center gap-0.5 text-brand-text/40">
                    <Music className="w-3 h-3" />
                    {post.activity}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="relative" ref={moreMenuRef}>
          <button
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className={`p-2 rounded-full transition-all ${isMoreOpen ? 'bg-brand-divider text-brand-text' : 'text-brand-text/40 hover:bg-brand-divider hover:text-brand-text/80'}`}
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          <AnimatePresence>
            {isMoreOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                transition={{ duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="absolute right-0 mt-1 w-64 bg-brand-card rounded-xl shadow-xl border border-brand-divider py-1.5 z-100"
              >
                {!isOwnPost && (
                  <>
                    <button onClick={handleNotInterested} className="w-full flex items-start gap-2.5 px-3 py-2 hover:bg-brand-secondary transition-colors text-left">
                      <EyeOff className="w-4 h-4 text-brand-text/60 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-[13px] text-brand-text font-medium">Not interested</div>
                        <div className="text-[11px] text-brand-text/50">Less of these posts.</div>
                      </div>
                    </button>

                    <button onClick={handleMuteAuthor} className="w-full flex items-start gap-2.5 px-3 py-2 hover:bg-brand-secondary transition-colors text-left">
                      <UserMinus className="w-4 h-4 text-brand-text/60 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-[13px] text-brand-text font-medium">Hide all from {name}</div>
                        <div className="text-[11px] text-brand-text/50">Stop seeing their posts.</div>
                      </div>
                    </button>

                    <div className="h-px bg-brand-divider my-0.5 mx-2.5" />

                    <button onClick={handleEmbed} className="w-full flex items-start gap-2.5 px-3 py-2 hover:bg-brand-secondary transition-colors text-left">
                      <Code className="w-4 h-4 text-brand-text/60 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-[13px] text-brand-text font-medium">Embed</div>
                        <div className="text-[11px] text-brand-text/50">Copy iframe code.</div>
                      </div>
                    </button>

                    <div className="h-px bg-brand-divider my-0.5 mx-2.5" />

                    <button onClick={handleReport} className="w-full flex items-start gap-2.5 px-3 py-2 hover:bg-danger/5 transition-colors text-left">
                      <Flag className="w-4 h-4 text-danger mt-0.5" />
                      <div className="flex-1">
                        <div className="text-[13px] text-danger font-medium">Report</div>
                        <div className="text-[11px] text-danger/60">We won't tell {name}.</div>
                      </div>
                    </button>

                    <button onClick={handleBlockAuthor} className="w-full flex items-start gap-2.5 px-3 py-2 hover:bg-danger/5 transition-colors text-left">
                      <UserX className="w-4 h-4 text-danger mt-0.5" />
                      <div className="flex-1">
                        <div className="text-[13px] text-danger font-medium">Block {name}</div>
                        <div className="text-[11px] text-danger/60">No more contact, either way.</div>
                      </div>
                    </button>
                  </>
                )}

                {isOwnPost && (
                  <button onClick={handlePin} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-brand-secondary transition-colors text-left">
                    <Pin className={`w-4 h-4 ${post.is_pinned ? 'fill-primary-ink text-primary-ink' : 'text-brand-text/40'}`} />
                    <span className="text-[13px] text-brand-text font-medium">
                      {post.is_pinned ? 'Unpin' : 'Pin'}
                    </span>
                  </button>
                )}

                {isOwnPost && (
                  <>
                    <div className="h-px bg-brand-divider my-0.5 mx-2.5" />
                    <button
                      onClick={() => {
                        setIsMoreOpen(false);
                        alert('Delete is not available yet.');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-red-50 transition-colors text-left text-red-500"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      <span className="text-[13px] font-medium">Delete</span>
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Tier 3c — Paywall preview if backend redacted the body. */}
      {post.body_redacted && (
        <div className="px-3 sm:px-4">
          <PaywallPreview
            creatorId={post.author_id}
            tierRequiredId={post.tier_required_id ?? null}
          />
        </div>
      )}

      {/* Post Text with clickable hashtags and @mentions */}
      {!post.body_redacted && post.text && (() => {
        /*
          A styled post renders exactly as its author composed it.

          Everything here comes from the post's own rich_text, which
          post-service stores as arbitrary JSON: the template's colours, the
          alignment, where the body sits, how large it is, and an uploaded
          background image. The values are stored ON THE POST rather than read
          from the theme, so the post looks the same to every reader in either
          theme — which is the point of choosing a template.

          Media wins over styling: a background behind a photo grid is noise,
          so a style that arrives alongside media is ignored rather than
          honoured.
        */
        const rich = post.rich_text;
        const hasMedia = Boolean(post.media?.length);
        const bg = rich?.background;
        const bgImage = rich?.background_media_id;
        const textColor = rich?.text_color;
        const hasStyledBg = Boolean(bg || bgImage) && !hasMedia;
        const align = rich?.align ?? 'center';
        const valign = rich?.valign ?? 'middle';
        const scale = Math.min(Math.max(rich?.scale ?? 1, 1), 2);
        const richDoc = rich?.format === 'tiptap' ? rich.doc : undefined;

        /*
          A Journal post carries a document. It is rendered through
          RichTextRenderer's whitelist rather than as HTML: the body was
          written by somebody else, and nothing stops a modified client
          putting markup in rich_text, so no part of it may reach the DOM as
          markup. The plain `text` column is still what search, previews and
          notifications read — this only changes what the card shows.
        */
        if (richDoc) {
          /*
            The entry's heading. It is typed in its own field above the
            editor, so it is NOT in the document — it rode only in the post's
            plain `text`, which search and previews read but the card does
            not draw. That is why a Journal post showed its body and no title.
            It is plain text from rich_text, rendered as text, never markup.
          */
          const heading = typeof rich?.title === 'string' ? rich.title.trim() : '';
          const body = (
            <RichTextRenderer
              doc={richDoc}
              className={`${hasStyledBg ? 'font-semibold' : 'text-brand-text'} ${align === 'center' ? 'text-center' : 'text-left'}`}
            />
          );
          if (!hasStyledBg) {
            return (
              <div className="px-3 pb-3 text-[15px] leading-relaxed sm:px-4">
                {heading && (
                  <h2 className="mb-2 text-[19px] font-semibold -tracking-[0.018em] text-brand-text">
                    {heading}
                  </h2>
                )}
                {body}
              </div>
            );
          }
          return (
            <div
              className={`relative mx-3 mb-3 overflow-hidden rounded-xl p-6 sm:mx-4 ${valign === 'middle' ? 'flex min-h-[200px] flex-col justify-center' : 'min-h-[160px]'}`}
              style={{
                background: bg || '#101828',
                backgroundImage: bgImage ? `url(/v1/media/${bgImage}/serve)` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: textColor || '#ffffff',
                fontSize: `${scale}em`,
              }}
            >
              {bgImage && (
                <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: scrimFor(textColor) }} />
              )}
              <div className="relative">
                {heading && <h2 className="mb-2 text-[1.15em] font-bold">{heading}</h2>}
                {body}
              </div>
            </div>
          );
        }

        const textContent = (
          <p
            className={`leading-relaxed whitespace-pre-wrap ${hasStyledBg ? `font-semibold ${align === 'center' ? 'text-center' : 'text-left'}` : 'text-[15px] text-brand-text'}`}
            style={hasStyledBg ? { color: textColor || '#ffffff', fontSize: `${scale * 1.25}rem` } : undefined}
          >
            {post.text.split(/(#[\p{L}\p{M}\p{N}_]+|@\w+)/gu).map((part, i) => {
              if (part.startsWith('#')) {
                const tag = part.slice(1);
                return (
                  <Link key={i} href={`/hashtag/${tag}`} className={hasStyledBg ? 'underline underline-offset-2' : 'text-brand-text hover:text-brand-text/80 font-medium'} style={hasStyledBg ? { color: textColor || '#ffffff' } : undefined}>
                    {part}
                  </Link>
                );
              }
              if (part.startsWith('@')) {
                const username = part.slice(1);
                return (
                  <Link key={i} href={`/u/${username}`} className={hasStyledBg ? 'underline underline-offset-2' : 'text-brand-text hover:text-brand-text/80 font-medium'} style={hasStyledBg ? { color: textColor || '#ffffff' } : undefined}>
                    {part}
                  </Link>
                );
              }
              return part;
            })}
          </p>
        );

        if (hasStyledBg) {
          return (
            <div
              className={`relative mx-3 mb-3 overflow-hidden rounded-xl p-6 sm:mx-4 ${
                valign === 'middle' ? 'flex min-h-[160px] flex-col justify-center' : 'min-h-[160px]'
              }`}
              style={{
                background: bg || '#101828',
                backgroundImage: bgImage ? `url(/v1/media/${bgImage}/serve)` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              {bgImage && (
                <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: scrimFor(textColor) }} />
              )}
              <div className="relative">{textContent}</div>
            </div>
          );
        }

        return (
          <div className={`px-3 sm:px-4 pb-3 ${isReel ? 'pr-16' : ''}`}>
            {textContent}
          </div>
        );
      })()}

      {/* Location name */}
      {post.location_name && !post.location && (
        <div className="px-4 pb-2 flex items-center gap-1 text-xs text-brand-text/40">
          <MapPin className="w-3 h-3" />
          <span>{post.location_name}</span>
        </div>
      )}

      {/* Poll Section */}
      {pollData && (
        <div className="px-4 pb-3 space-y-2.5">
          {pollData.question && pollData.question.trim() !== (post.text ?? '').trim() && (
            <h5 className="text-sm font-semibold text-brand-text">{pollData.question}</h5>
          )}
          {pollEnded && (
            <p className="text-xs text-red-500 font-medium">Poll ended</p>
          )}
          <div className="space-y-2">
            {pollData.options.map((option) => {
              const isVoted = hasVoted && pollData.viewer_votes?.includes(option.id);
              return (
                <button
                  key={option.id}
                  onClick={() => !showResults && handleVote(option.id)}
                  disabled={!!showResults || castVoteMutation.isPending}
                  className={`w-full relative py-3 px-4 rounded-xl border text-left transition-all overflow-hidden ${isVoted
                    ? 'border-primary bg-primary-tint/80'
                    : showResults
                      ? 'border-brand-divider bg-brand-secondary/50 cursor-default'
                      : 'border-brand-divider hover:border-primary-outline hover:bg-primary-tint/30 cursor-pointer'
                    }`}
                >
                  {showResults && (
                    <div
                      className={`absolute inset-y-0 left-0 transition-all duration-700 rounded-xl ${isVoted ? 'bg-primary-tint/70' : 'bg-brand-divider/70'}`}
                      style={{ width: `${option.percentage}%` }}
                    />
                  )}
                  <div className="relative z-10 flex justify-between items-center">
                    <span className={`text-sm ${isVoted ? 'font-semibold text-primary-ink' : 'text-brand-text'}`}>
                      {option.label}
                    </span>
                    <div className="flex items-center gap-2">
                      {showResults && (
                        <span className={`text-xs font-bold ${isVoted ? 'text-primary-ink' : 'text-brand-text/40'}`}>
                          {option.percentage}%
                        </span>
                      )}
                      {isVoted && (
                        <div className="w-5 h-5 rounded-full bg-primary-ink flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {showResults && (
            <p className="text-xs text-brand-text/40 font-medium">
              {pollData.total_votes} vote{pollData.total_votes !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Content & Actions Layout */}
      <div className="relative">
        {/* Media Display */}
        {hasMedia && (
          // For carousels we lock the box to the first image's height so the
          // card doesn't shrink/grow on "next" clicks (object-contain made it
          // resize when images had different aspect ratios). Single-image
          // posts keep the original natural sizing.
          <div className={`relative overflow-hidden bg-brand-secondary ${isReel ? 'aspect-9/16 max-h-[700px]' : hasMultipleMedia ? 'h-[600px] max-h-[70vh]' : 'max-h-[70vh]'}`}>
            <div className="h-full w-full flex items-center justify-center">
              {post.media![activeMediaIndex].kind === 'video' ? (
                <div className="relative w-full h-full">
                  {isReel ? (
                    <>
                      <video
                        src={`/v1/media/${post.media![activeMediaIndex].media_id}/serve${dataSaver ? "?quality=240p" : ""}`}
                        className="w-full h-full object-cover"
                        autoPlay={!dataSaver}
                        loop
                        muted
                        preload={dataSaver ? "none" : "metadata"}
                      />
                      <div className="absolute inset-0 pointer-events-none flex flex-col justify-end p-6 bg-linear-to-t from-black/60 via-transparent to-transparent">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/50">
                            {avatar ? (
                              <img
                                src={resolveImageUrl(avatar, { dataSaver, size: "small" })}
                                className="w-full h-full object-cover"
                                alt=""
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-brand-secondary text-brand-text/55 font-bold text-sm">
                                {avatarInitial}
                              </div>
                            )}
                          </div>
                          <div className="text-white">
                            <p className="text-sm font-semibold">{name} · Reel</p>
                            <p className="text-[11px] text-white/60 flex items-center gap-1">
                              <Music className="w-3 h-3" /> Original Audio
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <VideoPlayer
                      mediaId={post.media![activeMediaIndex].media_id}
                      className="w-full h-full border-b border-brand-divider"
                    />
                  )}
                </div>
              ) : (
                <img
                  key={post.media![activeMediaIndex].media_id}
                  src={resolveImageUrl(
                    `/v1/media/${post.media![activeMediaIndex].media_id}/serve`,
                    { dataSaver, size: "large" },
                  )}
                  alt=""
                  className={`w-full h-full cursor-zoom-in ${isReel ? 'object-cover' : 'object-contain'} border-b border-brand-divider`}
                />
              )}
            </div>

            {/* Gallery Navigation */}
            {hasMultipleMedia && (
              <>
                <button
                  onClick={() => setActiveMediaIndex((prev) => (prev > 0 ? prev - 1 : post.media!.length - 1))}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-brand-card/90 backdrop-blur-xs text-brand-text shadow-lg hover:bg-brand-card transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setActiveMediaIndex((prev) => (prev < post.media!.length - 1 ? prev + 1 : 0))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-brand-card/90 backdrop-blur-xs text-brand-text shadow-lg hover:bg-brand-card transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/20 backdrop-blur-xs px-2 py-1 rounded-full">
                  {post.media!.map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-full transition-all duration-300 ${i === activeMediaIndex ? 'w-5 h-1.5 bg-brand-card' : 'w-1.5 h-1.5 bg-brand-card/50'}`}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Gallery Counter */}
            {hasMultipleMedia && (
              <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/40 backdrop-blur-xs text-white text-xs font-medium">
                {activeMediaIndex + 1}/{post.media!.length}
              </div>
            )}
          </div>
        )}

        {/* Action Bar (Pillar for Reels, Horizontal row for others) */}
        {isReel ? (
          <div className="absolute bottom-4 right-2 sm:right-3 flex flex-col gap-3 z-10">
            {/* Spark (was Heart) */}
            {!post.no_likes && (
              <button
                onClick={toggleLike}
                aria-label="Spark"
                className="flex flex-col items-center gap-1 group"
              >
                <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shadow-lg ${liked
                  ? 'bg-danger text-white shadow-danger/30'
                  : 'bg-brand-card/90 backdrop-blur-xs text-brand-text hover:bg-brand-card border border-brand-divider shadow-black/5'
                  }`}>
                  <svg viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={liked ? 0 : 2} className="w-5 h-5">
                    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
                  </svg>
                </div>
                {likesCount > 0 && (
                  <span className={`text-[10px] sm:text-[11px] font-bold drop-shadow-md ${liked ? 'text-danger' : 'text-brand-text/80'}`}>
                    {likesCount}
                  </span>
                )}
              </button>
            )}

            {/* Comment */}
            {!post.no_comments && (
              <button
                onClick={() => setShowComments(!showComments)}
                aria-label="Comment"
                className="flex flex-col items-center gap-1 group"
              >
                <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shadow-lg transition-all ${showComments
                  ? 'bg-brand-text text-brand-bg shadow-black/10'
                  : 'bg-brand-card/90 backdrop-blur-xs text-brand-text hover:bg-brand-card border border-brand-divider shadow-black/5'
                  }`}>
                  <MessageCircle className={`w-5 h-5 ${showComments ? 'fill-current' : ''}`} />
                </div>
                {commentsCount > 0 && (
                  <span className={`text-[10px] sm:text-[11px] font-bold drop-shadow-md ${showComments ? 'text-brand-text' : 'text-brand-text/80'}`}>
                    {commentsCount}
                  </span>
                )}
              </button>
            )}

            {/* Echo (was Share) */}
            <button
              onClick={handleShare}
              aria-label="Echo"
              className="flex flex-col items-center gap-1 group"
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shadow-lg bg-brand-card/90 backdrop-blur-xs text-brand-text hover:bg-brand-card border border-brand-divider shadow-black/5 transition-all">
                <Repeat2 className="w-5 h-5" />
              </div>
              {sharesCount > 0 && (
                <span className="text-[10px] sm:text-[11px] font-bold text-brand-text/80 drop-shadow-md">
                  {sharesCount}
                </span>
              )}
            </button>

            {/* Stash (Bookmark) */}
            <button
              onClick={handleBookmark}
              aria-label="Stash"
              className="flex flex-col items-center gap-1 group"
            >
              <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shadow-lg transition-all ${bookmarked
                ? 'bg-brand-text text-brand-bg shadow-brand-text/30'
                : 'bg-brand-card/90 backdrop-blur-xs text-brand-text hover:bg-brand-card border border-brand-divider shadow-black/5'
                }`}>
                <Bookmark className={`w-5 h-5 ${bookmarked ? 'fill-current' : ''}`} />
              </div>
            </button>
          </div>
        ) : (
          <div className="px-3 sm:px-4 py-2 flex items-center justify-around border-t border-brand-divider">
            {/* Like / Love */}
            {!post.no_likes && (
              <button onClick={toggleLike} aria-label={liked ? 'Unlike' : 'Like'} aria-pressed={liked}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors duration-200 active:scale-95 ${liked ? 'text-danger bg-danger/10' : 'text-brand-text/60 hover:text-danger hover:bg-danger/5'}`}>
                {/* The pop: the heart swells and settles only when it BECOMES
                    liked. initial={false} stops it firing for posts that load
                    already liked, and it is skipped under reduced motion. */}
                <motion.span
                  className="inline-flex"
                  initial={false}
                  animate={liked && !reduceMotion ? { scale: [1, 1.35, 0.92, 1] } : { scale: 1 }}
                  transition={{ duration: 0.38, times: [0, 0.35, 0.7, 1], ease: 'easeOut' }}
                >
                  <Heart className={`w-[18px] h-[18px] ${liked ? 'fill-current' : ''}`} />
                </motion.span>
                <span className="text-[12px] font-semibold tabular-nums">{likesCount > 0 ? likesCount : 'Like'}</span>
              </button>
            )}

            {/* Comment */}
            {!post.no_comments && (
              <button onClick={() => setShowComments(!showComments)} aria-label="Comment" aria-expanded={showComments}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors duration-200 active:scale-95 ${showComments ? 'text-primary-ink bg-primary-tint' : 'text-brand-text/60 hover:text-primary-ink hover:bg-primary-tint/60'}`}>
                <MessageCircle className={`w-[18px] h-[18px] ${showComments ? 'fill-current' : ''}`} />
                <span className="text-[12px] font-semibold tabular-nums">{commentsCount > 0 ? commentsCount : 'Comment'}</span>
              </button>
            )}

            {/* Repost — opens ShareDialog with quote + media support */}
            <button onClick={handleShare} aria-label="Repost"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-brand-text/60 hover:text-success hover:bg-success/5 transition-colors duration-200 active:scale-95">
              <Repeat2 className="w-[18px] h-[18px]" />
              <span className="text-[12px] font-semibold tabular-nums">{sharesCount > 0 ? sharesCount : 'Repost'}</span>
            </button>

            {/* Save (Bookmark) */}
            <button onClick={handleBookmark} aria-label={bookmarked ? 'Saved' : 'Save'} aria-pressed={bookmarked}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors duration-200 active:scale-95 ${bookmarked ? 'text-primary-ink bg-primary-tint' : 'text-brand-text/60 hover:text-primary-ink hover:bg-primary-tint/60'}`}>
              <Bookmark className={`w-[18px] h-[18px] ${bookmarked ? 'fill-current' : ''}`} />
              <span className="text-[12px] font-semibold">{bookmarked ? 'Saved' : 'Save'}</span>
            </button>
          </div>
        )}
      </div>

      {/* A comment under the post, so the feed shows people talking. Only
          when there ARE comments and the full section is closed. */}
      {!isReel && !post.no_comments && !showComments && commentsCount > 0 && (
        <CommentPreview postId={post.id} count={commentsCount} onOpen={() => setShowComments(true)} />
      )}

      {/* Comment Section */}
      <AnimatePresence>
        {showComments && !post.no_comments && (
          <CommentSection postId={post.id} postAuthorId={post.author_id} commentsCount={commentsCount} alwaysExpanded />
        )}
      </AnimatePresence>

      {/* Share Dialog */}
      <ShareDialog postId={post.id} isOpen={showShareDialog} onClose={() => setShowShareDialog(false)} />
    </article>
  );
};

export default PostCard;
