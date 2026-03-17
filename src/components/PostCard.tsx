'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { PostDetail } from '@/types/profile';
import { useToggleLike, useToggleReaction } from '@/hooks/usePostReaction';
import ReactionPicker from '@/components/ReactionPicker';
import Link from 'next/link';
import { useToggleBookmark, useTogglePin } from '@/hooks/usePostActions';
import { usePoll, useCastVote } from '@/hooks/usePollVote';
import { useMyProfile, useUserProfile } from '@/hooks/useEditProfile';
import CommentSection from '@/components/CommentSection';
import ShareDialog from '@/components/ShareDialog';
import VideoPlayer from '@/components/VideoPlayer';
import EmbedCard from '@/components/EmbedCard';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Smile,
  Music,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Pin,
  Check,
  Link2,
  Repeat2,
  Upload,
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
  const likesCount = post.counts?.likes ?? 0;
  const commentsCount = post.counts?.comments ?? 0;
  const sharesCount = post.counts?.shares ?? 0;

  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [bookmarked, setBookmarked] = useState(!!post.is_bookmarked);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const { data: profile } = useMyProfile();
  const likeMutation = useToggleLike();
  const reactionMutation = useToggleReaction();
  const bookmarkMutation = useToggleBookmark();
  const togglePinMutation = useTogglePin();
  const castVoteMutation = useCastVote();

  const { data: authorProfile } = useUserProfile(post.author_id);

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

  const handleCopyLink = () => {
    const url = `${window.location.origin}/post/${post.id}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setIsMoreOpen(false);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleShare = () => {
    setShowShareDialog(true);
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
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author_id}`;
  const name = resolvedProfile?.display_name || 'User';

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
      className="bg-brand-card rounded-xl shadow-sm border border-gray-100 overflow-hidden group/card"
    >
      {/* Pin indicator */}
      {post.is_pinned && (
        <div className="px-4 pt-2.5 flex items-center gap-1.5 text-blue-500">
          <Pin className="w-3.5 h-3.5 fill-current" />
          <span className="text-xs font-medium">Pinned post</span>
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-gray-100 hover:ring-blue-100 transition-all flex-shrink-0">
              <img src={avatar} alt="" className="w-full h-full object-cover" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-[14px] font-bold text-gray-900 hover:text-blue-600 cursor-pointer transition-colors">{name}</h4>
              {post.feeling && (
                <span className="text-xs text-gray-500">
                  — feeling {post.feeling} <Smile className="w-3 h-3 inline text-amber-400" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-0.5">
              <span>{timeAgo(post.created_at)}</span>
              {post.location && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="flex items-center gap-0.5 text-gray-400">
                    <MapPin className="w-3 h-3" />
                    {post.location}
                  </span>
                </>
              )}
              {post.activity && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="flex items-center gap-0.5 text-gray-400">
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
            className={`p-2 rounded-full transition-all ${isMoreOpen ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
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
                className="absolute right-0 mt-1 w-56 bg-brand-card rounded-xl shadow-xl border border-gray-100 py-1.5 z-[100]"
              >
                <button onClick={handleBookmark} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                  <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-amber-500 text-amber-500' : 'text-gray-400'}`} />
                  <span className="text-sm text-gray-700 font-medium">
                    {bookmarked ? 'Remove bookmark' : 'Save post'}
                  </span>
                </button>

                {isOwnPost && (
                  <button onClick={handlePin} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                    <Pin className={`w-4 h-4 ${post.is_pinned ? 'fill-blue-500 text-blue-500' : 'text-gray-400'}`} />
                    <span className="text-sm text-gray-700 font-medium">
                      {post.is_pinned ? 'Unpin post' : 'Pin post'}
                    </span>
                  </button>
                )}

                <button onClick={handleCopyLink} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                  <Link2 className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700 font-medium">Copy link</span>
                </button>

                {isOwnPost && (
                  <>
                    <div className="h-px bg-gray-100 my-1 mx-3" />
                    <button
                      onClick={() => {
                        setIsMoreOpen(false);
                        alert('Delete is not available yet.');
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 transition-colors text-left text-red-500"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      <span className="text-sm font-medium">Delete post</span>
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Post Text with clickable hashtags and @mentions */}
      {post.text && (
        <div className={`px-4 pb-3 ${isReel ? 'pr-16' : ''}`}>
          <p className="text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap">
            {post.text.split(/(#\w+|@\w+)/g).map((part, i) => {
              if (part.startsWith('#')) {
                const tag = part.slice(1);
                return (
                  <Link key={i} href={`/hashtag/${tag}`} className="text-blue-500 hover:text-blue-700 font-medium">
                    {part}
                  </Link>
                );
              }
              if (part.startsWith('@')) {
                const username = part.slice(1);
                return (
                  <Link key={i} href={`/u/${username}`} className="text-blue-500 hover:text-blue-700 font-medium">
                    {part}
                  </Link>
                );
              }
              return part;
            })}
          </p>
        </div>
      )}

      {/* Location name */}
      {post.location_name && !post.location && (
        <div className="px-4 pb-2 flex items-center gap-1 text-xs text-gray-400">
          <MapPin className="w-3 h-3" />
          <span>{post.location_name}</span>
        </div>
      )}

      {/* Poll Section */}
      {pollData && (
        <div className="px-4 pb-3 space-y-2.5">
          <h5 className="text-sm font-semibold text-gray-900">{pollData.question}</h5>
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
                    ? 'border-blue-400 bg-blue-50/80'
                    : showResults
                      ? 'border-gray-100 bg-gray-50/50 cursor-default'
                      : 'border-gray-200 hover:border-blue-200 hover:bg-blue-50/30 cursor-pointer'
                    }`}
                >
                  {showResults && (
                    <div
                      className={`absolute inset-y-0 left-0 transition-all duration-700 rounded-xl ${isVoted ? 'bg-blue-100/70' : 'bg-gray-100/70'}`}
                      style={{ width: `${option.percentage}%` }}
                    />
                  )}
                  <div className="relative z-10 flex justify-between items-center">
                    <span className={`text-sm ${isVoted ? 'font-semibold text-blue-700' : 'text-gray-700'}`}>
                      {option.label}
                    </span>
                    <div className="flex items-center gap-2">
                      {showResults && (
                        <span className={`text-xs font-bold ${isVoted ? 'text-blue-600' : 'text-gray-400'}`}>
                          {option.percentage}%
                        </span>
                      )}
                      {isVoted && (
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
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
            <p className="text-xs text-gray-400 font-medium">
              {pollData.total_votes} vote{pollData.total_votes !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Content & Actions Layout */}
      <div className="relative">
        {/* Media Display */}
        {hasMedia && (
          <div className={`relative overflow-hidden bg-gray-50 ${isReel ? 'aspect-[9/16] max-h-[700px]' : 'max-h-[70vh]'}`}>
            <div className="h-full w-full flex items-center justify-center">
              {post.media![activeMediaIndex].kind === 'video' ? (
                <div className="relative w-full h-full">
                  {isReel ? (
                    <>
                      <video
                        src={`/v1/media/${post.media![activeMediaIndex].media_id}/serve`}
                        className="w-full h-full object-cover"
                        autoPlay
                        loop
                        muted
                        preload="metadata"
                      />
                      <div className="absolute inset-0 pointer-events-none flex flex-col justify-end p-6 bg-gradient-to-t from-black/60 via-transparent to-transparent">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/50">
                            <img src={avatar} className="w-full h-full object-cover" alt="" />
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
                      className="w-full h-full border-b border-gray-100"
                    />
                  )}
                </div>
              ) : (
                <img
                  key={post.media![activeMediaIndex].media_id}
                  src={`/v1/media/${post.media![activeMediaIndex].media_id}/serve`}
                  alt=""
                  className={`w-full h-full cursor-zoom-in ${isReel ? 'object-cover' : 'object-contain'} border-b border-gray-100`}
                />
              )}
            </div>

            {/* Gallery Navigation */}
            {hasMultipleMedia && (
              <>
                <button
                  onClick={() => setActiveMediaIndex((prev) => (prev > 0 ? prev - 1 : post.media!.length - 1))}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-brand-card/90 backdrop-blur-sm text-gray-700 shadow-lg hover:bg-brand-card transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setActiveMediaIndex((prev) => (prev < post.media!.length - 1 ? prev + 1 : 0))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-brand-card/90 backdrop-blur-sm text-gray-700 shadow-lg hover:bg-brand-card transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/20 backdrop-blur-sm px-2 py-1 rounded-full">
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
              <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white text-xs font-medium">
                {activeMediaIndex + 1}/{post.media!.length}
              </div>
            )}
          </div>
        )}

        {/* Action Bar (Pillar for Reels, Horizontal row for others) */}
        {isReel ? (
          <div className="absolute bottom-4 right-3 flex flex-col gap-3 z-10">
            {!post.no_likes && (
              <button
                onClick={toggleLike}
                className="flex flex-col items-center gap-1 group"
              >
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg ${liked
                  ? 'bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-rose-500/30'
                  : 'bg-brand-card/90 backdrop-blur-sm text-gray-700 hover:bg-brand-card border border-gray-100 shadow-black/5'
                  }`}>
                  <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
                </div>
                {likesCount > 0 && (
                  <span className={`text-[11px] font-bold drop-shadow-md ${liked ? 'text-rose-600' : 'text-gray-600'}`}>
                    {likesCount}
                  </span>
                )}
              </button>
            )}

            {!post.no_comments && (
              <button
                onClick={() => setShowComments(!showComments)}
                className="flex flex-col items-center gap-1 group"
              >
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all ${showComments
                  ? 'bg-blue-600 text-white shadow-blue-600/30'
                  : 'bg-brand-card/90 backdrop-blur-sm text-gray-700 hover:bg-brand-card border border-gray-100 shadow-black/5'
                  }`}>
                  <MessageCircle className={`w-5 h-5 ${showComments ? 'fill-current' : ''}`} />
                </div>
                {commentsCount > 0 && (
                  <span className={`text-[11px] font-bold drop-shadow-md ${showComments ? 'text-blue-600' : 'text-gray-600'}`}>
                    {commentsCount}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={handleShare}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg bg-brand-card/90 backdrop-blur-sm text-gray-700 hover:bg-brand-card border border-gray-100 shadow-black/5 transition-all">
                {linkCopied ? (
                  <Check className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Share2 className="w-5 h-5" />
                )}
              </div>
              {sharesCount > 0 && (
                <span className="text-[11px] font-bold text-gray-600 drop-shadow-md">
                  {sharesCount}
                </span>
              )}
            </button>
          </div>
        ) : (
          <div className={`px-4 py-2 flex items-center justify-between border-t border-brand-divider ${hasMedia && !isReel ? '' : ''}`}>
            {/* Comment */}
            {!post.no_comments && (
              <button
                onClick={() => setShowComments(!showComments)}
                className={`flex items-center gap-1.5 transition-all ${showComments ? 'text-brand-accent' : 'text-brand-text/60 hover:text-brand-accent'}`}
              >
                <MessageCircle className={`w-[18px] h-[18px] ${showComments ? 'fill-current' : ''}`} />
                {commentsCount > 0 && <span className="text-[10px] font-black tracking-widest">{commentsCount}</span>}
              </button>
            )}

            {/* Repost */}
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-brand-text/60 hover:text-brand-accent transition-all"
            >
              <Repeat2 className="w-[18px] h-[18px]" />
              {sharesCount > 0 && <span className="text-[10px] font-black tracking-widest">{sharesCount}</span>}
            </button>

            {/* Like */}
            {!post.no_likes && (
              <button
                onClick={toggleLike}
                className={`flex items-center gap-1.5 transition-all ${liked ? 'text-brand-accent scale-110' : 'text-brand-text/60 hover:text-brand-accent'}`}
              >
                <Heart className={`w-[18px] h-[18px] ${liked ? 'fill-current' : ''}`} />
                {likesCount > 0 && <span className="text-[10px] font-black tracking-widest">{likesCount}</span>}
              </button>
            )}

            {/* Bookmark */}
            <button
              onClick={handleBookmark}
              className={`transition-all ${bookmarked ? 'text-brand-accent scale-110' : 'text-brand-text/60 hover:text-brand-accent'}`}
            >
              <Bookmark className={`w-[18px] h-[18px] ${bookmarked ? 'fill-current' : ''}`} />
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              className="text-brand-text/60 hover:text-brand-accent transition-all"
            >
              {linkCopied ? <Check className="w-[18px] h-[18px] text-emerald-500" /> : <Upload className="w-[18px] h-[18px]" />}
            </button>
          </div>
        )}
      </div>

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
