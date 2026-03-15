'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import PostCard from './PostCard';
import StoriesRow from './StoriesRow';
import { useHomeFeed, useSaveFeedPreference } from '@/hooks/useFeedPosts';
import type { FeedMode } from '@/hooks/useFeedPosts';
import { subscribeToFeedUpdates, subscribeToPostUpdates } from '@/services/messageService';
import { getSession } from '@/services/authService';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import type { PostDetail } from '@/types/profile';

const FEED_MODE_KEY = 'postbook_feed_mode';

type FeedTab = 'for_you' | 'my_circle' | 'following';

interface FeedProps {
  onCreateClick?: () => void;
}

const Feed: React.FC<FeedProps> = ({ onCreateClick }) => {
  const [activeTab, setActiveTab] = useState<FeedTab>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(FEED_MODE_KEY);
      // if (saved === 'for_you') return 'for_you'; // TODO: enable when user base is heavy
      if (saved === 'my_circle') return 'my_circle';
      if (saved === 'following') return 'following';
    }
    return 'following';
  });

  const currentUserId = getSession()?.id;
  const feedMode: FeedMode = activeTab === 'for_you' ? 'ranked' : 'chronological';
  const circleOnly = activeTab === 'my_circle';

  const homeFeed = useHomeFeed(feedMode, {
    excludeSelf: true,
    circleOnly,
  });

  const activeData = homeFeed;
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = activeData;

  const queryClient = useQueryClient();
  const savePref = useSaveFeedPreference();
  const [newPostCount, setNewPostCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const posts: PostDetail[] = data?.pages.flatMap((page) => page.data) ?? [];

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

  const handleTabChange = useCallback(
    (tab: FeedTab) => {
      setActiveTab(tab);
      setNewPostCount(0);
      localStorage.setItem(FEED_MODE_KEY, tab);
      const mode: FeedMode = tab === 'for_you' ? 'ranked' : 'chronological';
      savePref.mutate(mode);
    },
    [savePref],
  );

  const tabs: { key: FeedTab; label: string }[] = [
    // { key: 'for_you', label: 'For You' }, // TODO: enable when user base is heavy
    { key: 'my_circle', label: 'My Circle' },
    { key: 'following', label: 'Following' },
  ];

  return (
    <div className="mx-auto w-full animate-fadeIn pb-32">
      <div ref={scrollRef} />

      {/* TODO: enable Stories + Tabs when user base is heavy
      <div className="sticky top-0 z-20 space-y-1.5 pb-1 bg-slate-50/95 backdrop-blur-xl">
        <StoriesRow onCreateClick={onCreateClick} />

        <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-2 shadow-sm">
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-50 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`relative rounded-lg px-3 py-2.5 text-[12px] font-semibold transition ${
                  activeTab === tab.key
                    ? 'bg-white text-[#D8103F] shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <motion.div
                    layoutId="feed-tab-indicator"
                    className="absolute inset-x-4 -bottom-0.5 h-[2px] rounded-full bg-[#D8103F]"
                    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      */}

      <AnimatePresence>
        {newPostCount > 0 && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            onClick={handleLoadNewPosts}
            className="mb-4 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99]"
          >
            {newPostCount} new {newPostCount === 1 ? 'post' : 'posts'} - tap to refresh
          </motion.button>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-blue-100 border-t-blue-600" />
          </div>
        )}

        {!isLoading && posts.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center">
            <h3 className="text-base font-semibold text-slate-400">No posts yet</h3>
            <p className="mt-1 text-sm text-slate-400">
              Follow people to see their posts here.
            </p>
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
              className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
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
