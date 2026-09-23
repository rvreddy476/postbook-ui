'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Smile, Hash, Loader2 } from 'lucide-react'; // ImageIcon/Smile/Hash are used by the commented-out composer below
import PostCard from './PostCard';
import PeopleYouMayKnowStrip from './PeopleYouMayKnowStrip';
import StoriesRow from './StoriesRow';
import Link from 'next/link';
import { useHomeFeed } from '@/hooks/useFeedPosts';
import { useMyProfile } from '@/hooks/useEditProfile';
import { subscribeToPostUpdates } from '@/services/messageService';
import { useFeedDelta } from '@/hooks/useFeedDelta';
import { getSession } from '@/services/authService';
import { useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';
import type { PostDetail } from '@/types/profile';

type FeedTab = 'for-you' | 'following';

interface FeedProps {
  onCreateClick?: () => void;
}

const Feed: React.FC<FeedProps> = ({ onCreateClick }) => {
  const currentUserId = getSession()?.id;
  const { data: profile } = useMyProfile();
  const avatarSrc = profile?.avatar_media_id
    ? `/v1/media/${profile.avatar_media_id}/serve`
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserId ?? 'me'}`;

  const [activeTab, setActiveTab] = useState<FeedTab>('for-you');
  const reduceMotion = useReducedMotion();

  // "For You" = ranked algorithm feed; "Following" = chronological from people you follow
  const forYouFeed = useHomeFeed('ranked', {
    excludeSelf: false,
    circleOnly: false,
    enabled: activeTab === 'for-you',
  });

  const followingFeed = useHomeFeed('chronological', {
    excludeSelf: true,
    circleOnly: false,
    enabled: activeTab === 'following',
  });

  const feed = activeTab === 'following' ? followingFeed : forYouFeed;
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = feed;

  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  /*
    "N new posts", from a signal that actually arrives.

    This banner used to count WebSocket frames of type "new_post". post-service
    still publishes those to the Redis channel feed:new_post, but ws-gateway
    was deliberately unsubscribed from global channels as a privacy fix — a
    global fan-out channel shows every author's activity to every connected
    socket. Nothing has delivered the frame to a browser since, so the counter
    could never leave 0 and the banner could never appear.

    useFeedDelta polls GET /v1/feed/delta instead: per-viewer, server-filtered,
    and carrying an anchor so the count and the refetch agree on which posts
    were counted. It was already written and had no call sites.
  */
  /*
    Dismissing the banner hides THIS batch, not the feature. The count keeps
    rising in the background and the next poll — ten minutes later — brings it
    back with the newer number, which is the behaviour the X in the reference
    implies: "not now", not "never".
  */
  const [newPostsDismissed, setNewPostsDismissed] = useState(false);
  const deltaFeedType = activeTab === 'following' ? 'following' : 'home';
  const { newCount: newPostCount, setAnchor, consumeNew } = useFeedDelta({
    feedType: deltaFeedType,
  });

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
      queryClient.setQueriesData({ queryKey: ['profile-posts'] }, updatePost);

      if (update.update_type === 'comment') {
        queryClient.invalidateQueries({ queryKey: ['comments', update.post_id] });
      }
    });
  }, [queryClient]);

  /*
    Anchor on the newest post we have actually rendered. Without this the
    banner had nothing to count FROM: it reported a number and then refetched,
    with no guarantee the refetch contained the posts it had counted.
  */
  useEffect(() => {
    const newest = posts[0];
    if (newest?.created_at) setAnchor(newest.created_at);
    // Only the newest post matters; re-anchoring on every list change would
    // reset the count the moment anything below the fold shifted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts[0]?.id, deltaFeedType, setAnchor]);

  // A newer count is a new batch, so an earlier dismissal no longer applies.
  useEffect(() => {
    if (newPostCount > 0) setNewPostsDismissed(false);
    // Only when the number itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newPostCount]);

  const handleLoadNewPosts = () => {
    // Advance the anchor and clear the count together, so the next poll
    // measures from what the user is about to see.
    consumeNew();
    queryClient.invalidateQueries({ queryKey: ['home-feed'] });
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleTabSwitch = (tab: FeedTab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    // No manual reset: the effect above re-anchors on the new tab's newest
    // post, which clears the count as a consequence rather than by hand.
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Two tabs only. Hashtags are a way IN to content, not a third kind of
  // feed, so they belong with the other discovery entry points in the
  // Trending card rather than sitting beside "For You" and "Following".
  const tabs: { key: FeedTab; label: string }[] = [
    { key: 'for-you', label: 'For You' },
    { key: 'following', label: 'Following' },
  ];

  return (
    <div className="mx-auto w-full animate-fadeIn pb-32">
      <div ref={scrollRef} />

      {/*
        Moments — COMMENTED OUT at the founder's request (22 Sep). There is no
        story content yet, so the rail rendered as a heading and a lone "Add"
        tile: a section that announces emptiness. Restore this block when
        stories have something to show; the component and its import are left
        in place so that is one step.

        <div className="mb-5">
          <StoriesRow onCreateClick={onCreateClick} />
        </div>
      */}

      {/*
        Feed tabs, underlined rather than a pill, after the reference the
        founder shared. The rule runs the width of the column and the active
        tab sits on it, so the tabs read as part of the page rather than as a
        control dropped onto it.

        The reference also carries topic tabs — Tech, Design, Product, Life —
        and a Customize control. They are not here: there is no topic feed
        behind them (feed-service takes ranked or chronological, and topics
        exist only as hashtags), so they would be four buttons that change
        nothing.
      */}
      <div className="mb-5 flex items-center gap-6 border-b border-brand-divider" role="tablist" aria-label="Feed">
        {tabs.map((t) => {
          const selected = t.key === activeTab;
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => handleTabSwitch(t.key)}
              className={`relative -mb-px pb-3 text-[15px] transition-colors ${
                selected
                  ? 'font-semibold text-primary-ink'
                  : 'font-medium text-brand-text/55 hover:text-brand-text'
              }`}
            >
              {t.label}
              {selected && (
                <motion.span
                  layoutId="feedTabIndicator"
                  className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-primary-ink"
                  transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.9 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/*
        Inline composer — COMMENTED OUT at the founder's request (19 Sep).

        It duplicated the create action already in the header rail, and it
        pushed the first real post below the fold on a laptop. Left in place
        rather than deleted so it can be restored in one step; `onCreateClick`
        is still threaded through this component for the same reason.

        <div
          className="bg-brand-card border border-brand-divider rounded-3xl p-4 sm:p-5 shadow-xs mb-6 sm:mb-8 cursor-pointer hover:shadow-md transition-shadow"
          onClick={onCreateClick}
        >
          <div className="flex gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden shrink-0 border border-brand-divider">
              <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 space-y-3 sm:space-y-4">
              <p className="text-brand-text/40 text-base sm:text-lg font-light pt-1.5 sm:pt-2">What&apos;s on your mind?</p>
              <div className="flex items-center justify-between pt-2 border-t border-brand-divider">
                <div className="flex gap-4">
                  <span className="text-brand-text/60"><ImageIcon className="w-5 h-5" /></span>
                  <span className="text-brand-text/60"><Smile className="w-5 h-5" /></span>
                  <span className="text-brand-text/60"><Hash className="w-5 h-5" /></span>
                </div>
                <span className="px-6 py-2 bg-primary-ink text-brand-bg text-xs rounded-full">Post</span>
              </div>
            </div>
          </div>
        </div>
      */}

      <AnimatePresence>
        {newPostCount > 0 && !newPostsDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="mb-4 flex items-center gap-3 rounded-2xl border border-brand-outline bg-primary-tint px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-brand-text">
                {newPostCount} fresh {newPostCount === 1 ? 'post' : 'posts'} waiting
              </p>
              <p className="truncate text-[12px] text-brand-text/60">
                Catch up on what&apos;s new since you last looked
              </p>
            </div>
            <button
              type="button"
              onClick={handleLoadNewPosts}
              className="bg-primary-grad flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
            >
              Tap to load
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              onClick={() => setNewPostsDismissed(true)}
              aria-label="Dismiss"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-brand-text/45 transition-colors hover:bg-brand-text/[0.06] hover:text-brand-text"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </motion.div>
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
            <>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-brand-text/20 mb-4">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
                </svg>
                <h3 className="text-base font-semibold text-brand-text/60">
                  {activeTab === 'following' ? 'No posts from people you follow' : 'Your feed is quiet'}
                </h3>
                <p className="mt-1 text-sm text-brand-text/40">
                  {activeTab === 'following'
                    ? 'Follow more people to see their posts here'
                    : 'Follow people and creators to see their posts here'}
                </p>
                <Link href="/discover" className="mt-4 px-6 py-2.5 bg-primary-ink text-brand-bg text-xs font-black tracking-widest rounded-full hover:opacity-90 transition-opacity">
                  Discover People
                </Link>
            </>
          </div>
        )}

        {posts.map((post, i) => (
          <React.Fragment key={post.id}>
            {/* Each post eases in as it mounts: staggered across the first
                screenful, immediate for later pages (which mount off-screen
                anyway), and a plain fade when reduced motion is on. */}
            <motion.div
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion
                ? { duration: 0.15 }
                : { type: "spring", stiffness: 360, damping: 34, delay: i < 6 ? i * 0.04 : 0 }}
            >
              <PostCard post={post} />
            </motion.div>
            {/* People-you-may-know strips woven into the feed (FB-style):
                one after the 3rd post (or after the last post on short
                feeds), another deeper down showing different people. */}
            {i === Math.min(2, posts.length - 1) && <div className="lg:hidden"><PeopleYouMayKnowStrip /></div>}
            {i === 14 && <div className="lg:hidden"><PeopleYouMayKnowStrip offset={10} /></div>}
          </React.Fragment>
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
