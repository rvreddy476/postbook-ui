'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import PostCard from './PostCard';
import StoriesRow from './StoriesRow';
import { useHomeFeed, useSaveFeedPreference } from '@/hooks/useFeedPosts';
import { useProfilePosts } from '@/hooks/useProfilePosts';
import type { FeedMode } from '@/hooks/useFeedPosts';
import { subscribeToFeedUpdates, subscribeToPostUpdates } from '@/services/messageService';
import { getSession } from '@/services/authService';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import type { PostDetail } from '@/types/profile';

const FEED_MODE_KEY = 'postbook_feed_mode';

type FeedTab = 'for_you' | 'my_circle' | 'my_posts';

const TAB_TO_FEED_MODE: Record<string, FeedMode> = {
  for_you: 'ranked',
  my_circle: 'chronological',
};

interface FeedProps {
  onCreateClick?: () => void;
}

const Feed: React.FC<FeedProps> = ({ onCreateClick }) => {
  const [activeTab, setActiveTab] = useState<FeedTab>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(FEED_MODE_KEY);
      if (saved === 'ranked') return 'for_you';
      if (saved === 'chronological') return 'my_circle';
    }
    return 'my_circle';
  });

  const currentUserId = getSession()?.id;
  const isMyPostsTab = activeTab === 'my_posts';
  const feedMode = TAB_TO_FEED_MODE[activeTab] ?? 'chronological';

  // Only fetch home feed when NOT on My Posts tab — backend filters out own posts via exclude_self
  const homeFeed = useHomeFeed(feedMode, {
    excludeSelf: true,
    enabled: !isMyPostsTab,
  });

  // Only fetch profile posts when ON My Posts tab
  const myPostsFeed = useProfilePosts(
    isMyPostsTab ? currentUserId : undefined,
    'all',
  );

  const activeData = isMyPostsTab ? myPostsFeed : homeFeed;
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
      if (tab !== 'my_posts') {
        const mode = TAB_TO_FEED_MODE[tab];
        localStorage.setItem(FEED_MODE_KEY, mode);
        savePref.mutate(mode);
      }
    },
    [savePref],
  );

  const tabs: { key: FeedTab; label: string }[] = [
    { key: 'for_you', label: 'For You' },
    { key: 'my_circle', label: 'My Circle' },
    { key: 'my_posts', label: 'My Posts' },
  ];

  return (
    <div className="space-y-3 w-full animate-fadeIn max-w-[680px] mx-auto pb-32 px-4 sm:px-0">
      <div ref={scrollRef} />

      {/* Stories Row */}
      <StoriesRow onCreateClick={onCreateClick} />

      {/* Feed Tab Toggle */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex-1 py-3.5 text-[13px] font-semibold text-center transition-all relative ${
                activeTab === tab.key
                  ? 'text-blue-600'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50/50'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <motion.div
                  layoutId="feed-tab-indicator"
                  className="absolute bottom-0 left-3 right-3 h-[3px] bg-blue-600 rounded-t-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* New Posts Banner */}
      <AnimatePresence>
        {newPostCount > 0 && !isMyPostsTab && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            onClick={handleLoadNewPosts}
            className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 active:scale-[0.99] transition-all cursor-pointer shadow-sm shadow-blue-500/20"
          >
            {newPostCount} new {newPostCount === 1 ? 'post' : 'posts'} — tap to see
          </motion.button>
        )}
      </AnimatePresence>

      {/* Post Stream */}
      <div className="space-y-3">
        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="w-9 h-9 border-[3px] border-blue-100 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && posts.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 text-center py-20 space-y-2">
            <h3 className="text-base font-semibold text-gray-300">
              {isMyPostsTab ? 'You haven\'t posted anything yet' : 'No posts yet'}
            </h3>
            <p className="text-sm text-gray-400">
              {isMyPostsTab ? 'Share something with your circle!' : 'Follow people to see their posts here'}
            </p>
          </div>
        )}

        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}

        {hasNextPage && (
          <div className="flex justify-center py-4">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="px-6 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-xl transition-colors disabled:opacity-50"
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
