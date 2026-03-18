'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { usePostDetail } from '@/hooks/useFeedPosts';
import PostCard from '@/components/PostCard';
import CommentSection from '@/components/CommentSection';

interface NotificationPostPopupProps {
  postId: string;
  focusCommentId?: string;
  onClose: () => void;
}

const NotificationPostPopup: React.FC<NotificationPostPopupProps> = ({ postId, focusCommentId, onClose }) => {
  const { data: post, isLoading, isError } = usePostDetail(postId);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="bg-brand-card rounded-3xl shadow-2xl border border-brand-divider w-full max-w-5xl mx-4 max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-brand-divider flex-shrink-0">
            <h3 className="text-sm font-black uppercase tracking-widest text-brand-text">Post Details</h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-brand-secondary text-brand-text/60 hover:text-brand-highlight transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-brand-text/50 animate-spin" />
            </div>
          ) : isError || !post ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <p className="text-[11px] font-bold text-brand-text/60 uppercase tracking-widest">Post not found</p>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-brand-secondary">
              {/* Left: Post */}
              <div className="overflow-y-auto max-h-[80vh] p-4">
                <PostCard post={post} />
              </div>

              {/* Right: Comments */}
              <div className="overflow-y-auto max-h-[80vh] p-4">
                <div className="mb-3">
                  <h4 className="text-[10px] font-black text-brand-text/60 uppercase tracking-widest">Comments</h4>
                </div>
                <CommentSection
                  postId={postId}
                  postAuthorId={post.author_id}
                  commentsCount={post.counts?.comments ?? 0}
                  alwaysExpanded={true}
                  focusCommentId={focusCommentId}
                />
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default NotificationPostPopup;
