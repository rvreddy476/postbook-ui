'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, MessageCircle, Share2, Bookmark, Music2,
  Volume2, VolumeX, Play, UserPlus, Sparkles,
  MoreHorizontal, Flag
} from 'lucide-react';
import { useToggleLike } from '@/hooks/usePostReaction';
import { useToggleBookmark, useSharePost } from '@/hooks/usePostActions';
import { useUserProfile } from '@/hooks/useEditProfile';
import { useVideoTracker } from '@/hooks/useVideoTracker';
import type { PostDetail } from '@/types/profile';
import ReelCommentSheet from './ReelCommentSheet';
import ShareDialog from './ShareDialog';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface ReelCardProps {
  post: PostDetail;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  index: number;
}

const ReelCard: React.FC<ReelCardProps> = ({ post, isActive, isMuted, onToggleMute, index }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [showPlayIcon, setShowPlayIcon] = useState(false);

  // Double-tap like state
  const [doubleTapLike, setDoubleTapLike] = useState(false);
  const lastTapRef = useRef(0);

  // Local engagement state (optimistic)
  const [localLiked, setLocalLiked] = useState(!!post.viewer_reaction);
  const [localLikes, setLocalLikes] = useState(post.counts?.likes ?? 0);
  const [localBookmarked, setLocalBookmarked] = useState(!!post.is_bookmarked);

  // Hooks
  const likeMutation = useToggleLike();
  const bookmarkMutation = useToggleBookmark();
  const { data: authorProfile } = useUserProfile(post.author_id);

  const avatar = authorProfile?.avatar_media_id
    ? `/v1/media/${authorProfile.avatar_media_id}/serve`
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author_id}`;
  const authorName = authorProfile?.display_name || 'Creator';

  // Video media URL
  const videoMediaId = post.media?.[0]?.media_id;
  const videoSrc = videoMediaId ? `/v1/media/${videoMediaId}/serve` : '';

  // Video tracker
  const tracker = useVideoTracker({
    contentId: post.id,
    creatorId: post.author_id,
    contentType: 'reel',
    contentDurationMs: videoDuration * 1000,
    surface: 'reels_feed',
    position: index,
    isAutoplay: true,
  });

  // Autoplay/pause based on visibility
  useEffect(() => {
    if (!videoRef.current) return;
    if (isActive) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      tracker.onPlayStart();
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      tracker.onPlayEnd('swipe_next');
    }
  }, [isActive]);

  // Mute sync
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Progress bar + analytics time updates
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
        tracker.onTimeUpdate(video.currentTime * 1000);
      }
    };

    const onLoadedMeta = () => {
      setVideoDuration(video.duration);
    };

    const onEnded = () => {
      tracker.onLoop();
      // Reels loop automatically via the loop attribute
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMeta);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMeta);
      video.removeEventListener('ended', onEnded);
    };
  }, []);

  // Toggle play/pause on single tap
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      setShowPlayIcon(true);
      setTimeout(() => setShowPlayIcon(false), 800);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying]);

  // Double-tap to like
  const handleTap = useCallback((e: React.MouseEvent) => {
    const now = Date.now();
    const diff = now - lastTapRef.current;
    lastTapRef.current = now;

    if (diff < 300) {
      // Double tap -> like
      if (!localLiked) {
        setLocalLiked(true);
        setLocalLikes(c => c + 1);
        likeMutation.mutate(post.id);
      }
      setDoubleTapLike(true);
      setTimeout(() => setDoubleTapLike(false), 1000);
    } else {
      // Single tap -> toggle play (with delay to check for double tap)
      setTimeout(() => {
        if (Date.now() - lastTapRef.current >= 280) {
          togglePlay();
        }
      }, 300);
    }
  }, [localLiked, post.id, togglePlay]);

  const handleLike = () => {
    setLocalLiked(!localLiked);
    setLocalLikes(c => localLiked ? Math.max(0, c - 1) : c + 1);
    likeMutation.mutate(post.id);
  };

  const handleBookmark = () => {
    setLocalBookmarked(!localBookmarked);
    bookmarkMutation.mutate(post.id);
  };

  return (
    <div className="relative w-full h-full snap-start snap-always bg-black flex items-center justify-center overflow-hidden">
      {/* Blurred background for non-portrait videos */}
      {videoSrc && (
        <div className="absolute inset-0 overflow-hidden">
          <video
            src={videoSrc}
            className="w-full h-full object-cover blur-3xl opacity-20 scale-125"
            muted
            loop
            playsInline
          />
        </div>
      )}

      {/* Main video container */}
      <div className="relative z-10 w-full max-w-[480px] h-full">
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            className="w-full h-full object-cover cursor-pointer"
            muted={isMuted}
            loop
            playsInline
            onClick={handleTap}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-fuchsia-900/20 to-black">
            <p className="text-white/40 text-sm">No video available</p>
          </div>
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 pointer-events-none" />

        {/* Double-tap like animation */}
        <AnimatePresence>
          {doubleTapLike && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
            >
              <Heart className="w-24 h-24 text-white fill-rose-500 drop-shadow-2xl" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pause icon */}
        <AnimatePresence>
          {showPlayIcon && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.8 }}
              exit={{ scale: 1.2, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
            >
              <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <Play className="w-8 h-8 text-white ml-1" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 z-20 h-[3px] bg-brand-card/10">
          <motion.div
            className="h-full bg-gradient-to-r from-fuchsia-500 to-rose-400"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>

        {/* Top bar: mute + more */}
        <div className="absolute top-4 left-0 right-0 z-20 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-white/80 text-xs font-bold tracking-widest uppercase">Reels</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleMute}
              className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/50 transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/50 transition-colors"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {showMoreMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -4 }}
                    className="absolute right-0 top-10 bg-[#1a1a2e] rounded-xl border border-white/10 py-1 min-w-[150px] shadow-xl z-30"
                  >
                    <button
                      onClick={() => setShowMoreMenu(false)}
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs text-white/70 hover:bg-brand-card/5 transition-colors"
                    >
                      <Flag className="w-3.5 h-3.5" /> Report
                    </button>
                    <button
                      onClick={() => setShowMoreMenu(false)}
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs text-white/70 hover:bg-brand-card/5 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Not interested
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Bottom section: creator info + description */}
        <div className="absolute bottom-0 left-0 right-16 z-20 p-4 pb-6">
          {/* Creator info */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-white/30 shadow-lg">
              <img src={avatar} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm truncate">{authorName}</p>
            </div>
            <button className="px-4 py-1.5 bg-brand-card/20 backdrop-blur-md rounded-full text-white text-[11px] font-bold uppercase tracking-wider hover:bg-brand-card/30 transition-colors border border-white/10">
              <UserPlus className="w-3.5 h-3.5 inline mr-1" />
              Follow
            </button>
          </div>

          {/* Description */}
          {post.text && (
            <ExpandableText text={post.text} />
          )}

          {/* Hashtags */}
          {post.hashtags && post.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {post.hashtags.slice(0, 5).map((tag) => (
                <span key={tag} className="text-[11px] text-fuchsia-300 font-semibold">#{tag}</span>
              ))}
            </div>
          )}

          {/* Audio ticker */}
          <div className="flex items-center gap-2 mt-3">
            <Music2 className="w-3 h-3 text-white/50" />
            <div className="overflow-hidden max-w-[200px]">
              <motion.p
                animate={{ x: ['0%', '-50%'] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                className="text-[11px] text-white/50 whitespace-nowrap"
              >
                Original audio &middot; {authorName} &middot; Original audio &middot; {authorName}
              </motion.p>
            </div>
          </div>
        </div>

        {/* Right sidebar: engagement actions */}
        <div className="absolute right-3 bottom-20 flex flex-col gap-5 z-20 items-center">
          {/* Like */}
          <div className="flex flex-col items-center gap-1">
            <motion.button
              whileTap={{ scale: 1.3 }}
              onClick={handleLike}
              className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-black/40 transition-colors"
            >
              <Heart className={`w-6 h-6 transition-colors ${localLiked ? 'fill-rose-500 text-rose-500' : 'text-white'}`} />
            </motion.button>
            <span className="text-white text-[10px] font-bold">{formatCount(localLikes)}</span>
          </div>

          {/* Comment */}
          <div className="flex flex-col items-center gap-1">
            <motion.button
              whileTap={{ scale: 1.2 }}
              onClick={() => setShowComments(true)}
              className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center border border-white/10 text-white hover:bg-black/40 transition-colors"
            >
              <MessageCircle className="w-6 h-6" />
            </motion.button>
            <span className="text-white text-[10px] font-bold">{formatCount(post.counts?.comments ?? 0)}</span>
          </div>

          {/* Share */}
          <div className="flex flex-col items-center gap-1">
            <motion.button
              whileTap={{ scale: 1.2 }}
              onClick={() => setShowShare(true)}
              className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center border border-white/10 text-white hover:bg-black/40 transition-colors"
            >
              <Share2 className="w-6 h-6" />
            </motion.button>
            <span className="text-white text-[10px] font-bold">{formatCount(post.counts?.shares ?? 0)}</span>
          </div>

          {/* Remix */}
          <div className="flex flex-col items-center gap-1">
            <motion.button
              whileTap={{ scale: 1.2 }}
              className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center border border-white/10 text-white hover:bg-black/40 transition-colors"
            >
              <Sparkles className="w-6 h-6" />
            </motion.button>
            <span className="text-white text-[10px] font-bold">Remix</span>
          </div>

          {/* Bookmark */}
          <motion.button
            whileTap={{ scale: 1.3 }}
            onClick={handleBookmark}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-black/40 transition-colors"
          >
            <Bookmark className={`w-6 h-6 transition-colors ${localBookmarked ? 'fill-amber-400 text-amber-400' : 'text-white'}`} />
          </motion.button>

          {/* Spinning album cover */}
          <motion.div
            animate={isPlaying ? { rotate: 360 } : {}}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            className="w-10 h-10 rounded-lg overflow-hidden border-2 border-white/20 shadow-lg mt-2"
          >
            <img src={avatar} alt="" className="w-full h-full object-cover" />
          </motion.div>
        </div>

        {/* Comment Sheet */}
        <ReelCommentSheet
          postId={post.id}
          postAuthorId={post.author_id}
          commentsCount={post.counts?.comments ?? 0}
          isOpen={showComments}
          onClose={() => setShowComments(false)}
        />

        {/* Share Dialog */}
        <ShareDialog
          postId={post.id}
          isOpen={showShare}
          onClose={() => setShowShare(false)}
        />
      </div>
    </div>
  );
};

// Expandable text component for descriptions
const ExpandableText: React.FC<{ text: string }> = ({ text }) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 80;

  if (!isLong) {
    return <p className="text-white/90 text-[13px] leading-relaxed">{text}</p>;
  }

  return (
    <div>
      <p className="text-white/90 text-[13px] leading-relaxed">
        {expanded ? text : `${text.slice(0, 80)}...`}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-white/50 font-semibold ml-1 hover:text-white/70 transition-colors"
        >
          {expanded ? 'less' : 'more'}
        </button>
      </p>
    </div>
  );
};

export default ReelCard;
