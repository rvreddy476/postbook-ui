'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Smile, Hash } from 'lucide-react';
import PostCard from './PostCard';
import StoriesRow from './StoriesRow';
import Link from 'next/link';
import { useHomeFeed } from '@/hooks/useFeedPosts';
import { useMyProfile } from '@/hooks/useEditProfile';
import { subscribeToFeedUpdates, subscribeToPostUpdates } from '@/services/messageService';
import { getSession } from '@/services/authService';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import type { PostDetail } from '@/types/profile';

interface FeedProps {
  onCreateClick?: () => void;
}

const Feed: React.FC<FeedProps> = ({ onCreateClick }) => {
  const currentUserId = getSession()?.id;
  const { data: profile } = useMyProfile();
  const avatarSrc = profile?.avatar_media_id
    ? `/v1/media/${profile.avatar_media_id}/serve`
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserId ?? 'me'}`;

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useHomeFeed('ranked', {
    excludeSelf: false,
    circleOnly: false,
  });

  const queryClient = useQueryClient();
  const [newPostCount, setNewPostCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const posts: PostDetail[] = (() => {
    const all = data?.pages.flatMap((page: any) => page.data) ?? [];
    const seen = new Set<string>();
    return all.filter((p: PostDetail) => {
      if (!p.id || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  })();

  useEffect(() => {
    return subscribeToFeedUpdates((update) => {
      if (update.author_id !== currentUserId) {
        setNewPostCount((prev) => prev + 1);
      }
    });
  }, [currentUserId]);

  useEffect(() => {
    return subscribeToPostUpdates((update) => {
      const updatePost = (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((post: PostDetail) => {
              if (post.id !== update.post_id) return post;
              return {
                ...post,
                counts: {
                  ...post.counts,
                  likes: update.likes ?? post.counts?.likes ?? 0,
                  comments: update.comments ?? post.counts?.comments ?? 0,
                  shares: update.shares ?? post.counts?.shares ?? 0,
                },
              };
            }),
          })),
        };
      };
      queryClient.setQueriesData({ queryKey: ['home-feed'] }, updatePost);
      queryClient.setQueriesData({ queryKey: ['feed-posts'] }, updatePost);
      queryClient.setQueriesData({ queryKey: ['profile-posts'] }, updatePost);

      if (update.update_type === 'comment') {
        queryClient.invalidateQueries({ queryKey: ['comments', update.post_id] });
      }
    });
  }, [queryClient]);

  const handleLoadNewPosts = () => {
    setNewPostCount(0);
    queryClient.invalidateQueries({ queryKey: ['home-feed'] });
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="mx-auto w-full animate-fadeIn pb-32">
      <div ref={scrollRef} />

      <StoriesRow onCreateClick={onCreateClick} />

      <div className="h-px w-full bg-brand-text/15 dark:bg-brand-text/20 mt-0 mb-4" />

      {/* Inline Create Post */}
      <div
        className="bg-brand-card border border-brand-divider rounded-3xl p-5 shadow-sm mb-8 cursor-pointer hover:shadow-md transition-shadow"
        onClick={onCreateClick}
      >
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border border-brand-divider">
            <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 space-y-4">
            <p className="text-brand-text/40 text-lg font-light pt-2">What&apos;s on your mind?</p>
            <div className="flex items-center justify-between pt-2 border-t border-brand-divider">
              <div className="flex gap-4">
                <span className="text-brand-text/60 hover:text-brand-accent transition-colors"><ImageIcon size={20} strokeWidth={2.2} /></span>
                <span className="text-brand-text/60 hover:text-brand-accent transition-colors"><Smile size={20} strokeWidth={2.2} /></span>
                <span className="text-brand-text/60 hover:text-brand-accent transition-colors"><Hash size={20} strokeWidth={2.2} /></span>
              </div>
              <span className="px-6 py-2 bg-brand-accent text-brand-bg text-xs font-black tracking-widest uppercase rounded-full">
                Post
              </span>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {newPostCount > 0 && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            onClick={handleLoadNewPosts}
            className="mb-4 w-full rounded-2xl bg-brand-accent py-3 text-sm font-black uppercase tracking-widest text-brand-bg shadow-sm transition hover:shadow-md active:scale-[0.99]"
          >
            {newPostCount} new {newPostCount === 1 ? 'post' : 'posts'} - tap to refresh
          </motion.button>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-brand-secondary border-t-brand-accent" />
          </div>
        )}

        {!isLoading && posts.length === 0 && (
          <div className="rounded-2xl border border-brand-divider py-20 text-center flex flex-col items-center">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-brand-text/20 mb-4">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
            </svg>
            <h3 className="text-base font-semibold text-brand-text/60">Your feed is quiet</h3>
            <p className="mt-1 text-sm text-brand-text/40">
              Follow people and creators to see their posts here
            </p>
            <Link href="/discover" className="mt-4 px-6 py-2.5 bg-brand-accent text-brand-bg text-xs font-black tracking-widest uppercase rounded-full hover:opacity-90 transition-opacity">
              Discover People
            </Link>
          </div>
        )}

        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}

        {hasNextPage && (
          <div className="flex justify-center py-2">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="rounded-xl border border-brand-divider px-6 py-2.5 text-sm font-semibold text-brand-text transition hover:bg-brand-secondary disabled:opacity-50"
            >
              {isFetchingNextPage ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Feed;
