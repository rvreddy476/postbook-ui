'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, ThumbsUp, ThumbsDown, MoreHorizontal, Trash2, Pencil } from 'lucide-react';
import { useComments, useAddComment, useToggleCommentLike, useToggleCommentDislike, useDeleteComment } from '@/hooks/usePostComments';
import { useMyProfile, useUserProfile } from '@/hooks/useEditProfile';
import type { CommentItem } from '@/types/profile';

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d`;
  return new Date(dateStr).toLocaleDateString();
}

const useCommentAuthor = (authorId: string) => {
  const { data: profile } = useUserProfile(authorId);
  const avatar = profile?.avatar_media_id
    ? `/v1/media/${profile.avatar_media_id}/serve`
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${authorId.slice(0, 8)}`;
  const name = profile?.display_name || `User ${authorId.slice(0, 6)}`;
  return { avatar, name };
};

const SheetComment: React.FC<{
  comment: CommentItem;
  postId: string;
  myId?: string;
}> = ({ comment, postId, myId }) => {
  const { avatar, name } = useCommentAuthor(comment.author_id);
  const likeMutation = useToggleCommentLike();
  const dislikeMutation = useToggleCommentDislike();
  const deleteMutation = useDeleteComment();
  const [localLikes, setLocalLikes] = useState(comment.like_count ?? 0);
  const [localLiked, setLocalLiked] = useState(false);
  const isOwn = myId === comment.author_id;
  const body = comment.body || comment.text || '';

  const handleLike = () => {
    setLocalLiked(!localLiked);
    setLocalLikes(c => localLiked ? Math.max(0, c - 1) : c + 1);
    likeMutation.mutate({ commentId: comment.id, postId });
  };

  return (
    <div className="flex gap-3 py-3 group">
      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-white/20">
        <img src={avatar} alt="" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-white">{name}</span>
          <span className="text-[11px] text-white/40">{timeAgo(comment.created_at)}</span>
        </div>
        <p className="text-[13px] text-white/80 mt-0.5 leading-relaxed">{body}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <button onClick={handleLike} className="flex items-center gap-1 group/like">
            <ThumbsUp className={`w-3.5 h-3.5 transition-colors ${localLiked ? 'fill-rose-500 text-rose-500' : 'text-white/40 group-hover/like:text-white/60'}`} />
            {localLikes > 0 && <span className="text-[11px] text-white/40">{localLikes}</span>}
          </button>
          {isOwn && (
            <button
              onClick={() => deleteMutation.mutate({ commentId: comment.id, postId })}
              className="text-white/30 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface ReelCommentSheetProps {
  postId: string;
  postAuthorId: string;
  commentsCount: number;
  isOpen: boolean;
  onClose: () => void;
}

const ReelCommentSheet: React.FC<ReelCommentSheetProps> = ({
  postId,
  postAuthorId,
  commentsCount,
  isOpen,
  onClose,
}) => {
  const [commentText, setCommentText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { data: profile } = useMyProfile();
  const { data: comments, isLoading } = useComments(postId, isOpen);
  const addComment = useAddComment();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || addComment.isPending) return;
    await addComment.mutateAsync({ postId, text: commentText.trim() });
    setCommentText('');
    // Scroll to bottom after adding
    setTimeout(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 z-30"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 z-40 bg-[#1a1a2e] rounded-t-3xl max-h-[60vh] flex flex-col"
          >
            {/* Handle + Header */}
            <div className="pt-3 pb-2 px-6">
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">
                  Comments {commentsCount > 0 && <span className="text-white/40 ml-1">{commentsCount}</span>}
                </h3>
                <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>
            </div>

            {/* Comments List */}
            <div ref={listRef} className="flex-1 overflow-y-auto px-6 scrollbar-hide">
              {isLoading && (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                </div>
              )}

              {!isLoading && (!comments || comments.length === 0) && (
                <div className="flex flex-col items-center py-10 gap-2">
                  <p className="text-white/30 text-sm">No comments yet</p>
                  <p className="text-white/20 text-xs">Be the first to comment</p>
                </div>
              )}

              {comments?.map((comment: CommentItem) => (
                <SheetComment
                  key={comment.id}
                  comment={comment}
                  postId={postId}
                  myId={profile?.id}
                />
              ))}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-white/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-white/20">
                <img
                  src={profile?.avatar_media_id ? `/v1/media/${profile.avatar_media_id}/serve` : 'https://api.dicebear.com/7.x/avataaars/svg?seed=User'}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-white/10 rounded-full px-4 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:bg-white/15 transition-colors"
              />
              <button
                type="submit"
                disabled={!commentText.trim() || addComment.isPending}
                className="p-2 rounded-full bg-fuchsia-600 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-fuchsia-500 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ReelCommentSheet;
