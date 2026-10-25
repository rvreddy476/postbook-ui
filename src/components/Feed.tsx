"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  Check,
  Compass,
  Hash,
  Loader2,
  WifiOff,
  X,
} from "lucide-react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";
import PostCard from "./PostCard";
import PeopleYouMayKnowStrip from "./PeopleYouMayKnowStrip";
import { homeFeedKey, useHomeFeed, type HomeFeedOptions } from "@/hooks/useFeedPosts";
import { FOLLOWED_HASHTAG_POSTS_KEY, useFollowedHashtagPosts } from "@/hooks/useHashtagFollow";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { subscribeToPostUpdates } from "@/services/messageService";
import { useFeedDelta } from "@/hooks/useFeedDelta";
import { useDataSaver } from "@/hooks/useDataSaver";
import { newestCreatedAtOf, uniqueFeedPosts, type FeedPage } from "./feed/feedPresentation";
import "./feed/home-feed.css";
import { installFeedReturnRefresh } from './feed/feedReturnRefresh';
import { editorialFormat } from './feed/editorialFormat';

function FeedSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading your feed"
      className="home-feed-stream"
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="home-feed-skeleton motion-safe:animate-pulse"
          aria-hidden="true"
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-brand-secondary" />
            <div className="flex-1 space-y-2">
              <div className="home-feed-skeleton-line w-32" />
              <div className="home-feed-skeleton-line w-20" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="home-feed-skeleton-line w-full" />
            <div className="home-feed-skeleton-line w-4/5" />
            <div className="home-feed-skeleton-line w-1/2" />
          </div>
          {i === 0 && (
            <div className="mt-5 h-48 rounded-xl bg-brand-secondary sm:h-64" />
          )}
        </div>
      ))}
    </div>
  );
}

type FeedTab = "for-you" | "following" | "hashtags";

const FEED_TABS: { key: FeedTab; label: string }[] = [
  { key: "for-you", label: "For You" },
  { key: "following", label: "Following" },
  // Posts carrying a hashtag the viewer follows (post-service
  // GET /v1/hashtags/followed/posts, 546eec063; not part of feed-service's timeline).
  { key: "hashtags", label: "Hashtags" },
];

export default function Feed({
  onCreateClick,
  presentation = 'classic',
}: {
  onCreateClick?: () => void;
  presentation?: 'classic' | 'editorial';
}) {
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const { effective: dataSaver } = useDataSaver();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [newPostsDismissed, setNewPostsDismissed] = useState(false);

  const [tab, setTab] = useState<FeedTab>("for-you");

  // For You is the server-ranked feed; Following is the people the viewer
  // follows, newest first (founder, 2026-10-19: the two tabs back on the bar
  // above the cards, as they were before the 2d0efb2 redesign).
  const forYouOptions: HomeFeedOptions = { excludeSelf: false, circleOnly: false, enabled: tab === "for-you" };
  const followingOptions: HomeFeedOptions = {
    excludeSelf: false,
    circleOnly: false,
    followingOnly: true,
    enabled: tab === "following",
  };
  const forYou = useHomeFeed("ranked", forYouOptions);
  const following = useHomeFeed("chronological", followingOptions);
  const hashtags = useFollowedHashtagPosts(tab === "hashtags");
  const feed = tab === "hashtags" ? hashtags : tab === "following" ? following : forYou;
  const activeKey: readonly unknown[] =
    tab === "hashtags"
      ? FOLLOWED_HASHTAG_POSTS_KEY
      : tab === "following"
        ? homeFeedKey("chronological", followingOptions)
        : homeFeedKey("ranked", forYouOptions);
  const posts = uniqueFeedPosts(feed.data?.pages);
  // The delta endpoint counts feed-service timelines; the Hashtags tab has none.
  const { newCount, setAnchor, consumeNew } = useFeedDelta({
    feedType: tab === "following" ? "following" : "home",
    enabled: posts.length > 0 && tab !== "hashtags",
  });

  useEffect(
    () =>
      subscribeToPostUpdates((update) => {
        const patch = (old: InfiniteData<FeedPage> | undefined) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: (page.data ?? []).map((post) =>
                post.id !== update.post_id
                  ? post
                  : {
                      ...post,
                      counts: {
                        ...post.counts,
                        likes: update.likes ?? post.counts?.likes ?? 0,
                        comments: update.comments ?? post.counts?.comments ?? 0,
                        shares: update.shares ?? post.counts?.shares ?? 0,
                      },
                    },
              ),
            })),
          };
        };
        queryClient.setQueriesData<InfiniteData<FeedPage>>(
          { queryKey: ["home-feed"] },
          patch,
        );
        queryClient.setQueriesData<InfiniteData<FeedPage>>(
          { queryKey: ["profile-posts"] },
          patch,
        );
        if (update.update_type === "comment")
          queryClient.invalidateQueries({
            queryKey: ["comments", update.post_id],
          });
      }),
    [queryClient],
  );

  /*
    Anchor the "N new posts" check on the NEWEST post shown, not on the
    first one. This feed is ranked, so posts[0] is the best-scoring post —
    often older than others on the page — and anchoring there counted posts
    the reader had already scrolled past as new.
  */
  const newestCreatedAt = newestCreatedAtOf(posts);
  useEffect(() => {
    if (newestCreatedAt) setAnchor(newestCreatedAt);
  }, [newestCreatedAt, setAnchor]);
  useEffect(() => {
    if (newCount > 0) setNewPostsDismissed(false);
  }, [newCount]);

  const scrollToTop = () =>
    scrollRef.current?.scrollIntoView({
      behavior: reduceMotion ? "instant" : "smooth",
      block: "start",
    });
  const loadNew = async () => {
    // Start again at the first cursor rather than refetching every old page.
    const queryKey = activeKey;
    await queryClient.cancelQueries({ queryKey, exact: true });
    queryClient.setQueryData<InfiniteData<FeedPage>>(queryKey, (old) => old && ({
      ...old, pages: old.pages.slice(0, 1), pageParams: old.pageParams.slice(0, 1),
    }));
    const result = await feed.refetch();
    if (!result.isError) {
      consumeNew();
      scrollToTop();
    }
  };
  const returnRefresh = useRef(loadNew);
  useEffect(() => { returnRefresh.current = loadNew; });
  useEffect(() => installFeedReturnRefresh(window, document, () => returnRefresh.current()), []);

  /*
    Load the next page as the end comes into view, the way IG, TikTok and
    FB feeds do. The button below the stream stays: it is the only way on
    when the reader asked for less data (data saver), after a failed page
    (so a bad connection does not loop), and where IntersectionObserver is
    missing. The stream is not virtualised — there is no list virtualiser
    in use anywhere in the repo yet, and the cards vary in height and carry
    video, so that is a separate piece of work.
  */
  const fetchNext = feed.fetchNextPage;
  const autoLoad =
    !!feed.hasNextPage && !feed.isFetchingNextPage && !feed.isFetchNextPageError && posts.length > 0 && !dataSaver;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !autoLoad || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void fetchNext();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [autoLoad, fetchNext, posts.length]);

  return (
    <div className="home-feed">
      <div ref={scrollRef} className="scroll-mt-5" />
      {presentation === 'editorial' ? <h2 className="sr-only">Posts</h2> : <h1 className="sr-only">Home feed</h1>}
      <div className="mb-5 flex items-center gap-4">
        <SegmentedControl
          layoutId="feedTabIndicator"
          aria-label="Feed"
          size="sm"
          value={tab}
          onChange={(id) => {
            setTab(id as FeedTab);
            setNewPostsDismissed(false);
            scrollToTop();
          }}
          segments={FEED_TABS.map((t) => ({ id: t.key, label: t.label }))}
        />
        <span aria-hidden className="h-px flex-1 bg-brand-divider" />
      </div>
      {newCount > 0 && !newPostsDismissed && (
        <div className="home-feed-notice">
          <p role="status">
            <strong>
              {newCount} new {newCount === 1 ? "post" : "posts"}
            </strong>{" "}
            to catch up on
          </p>
          <button
            type="button"
            className="home-feed-action"
            onClick={loadNew}
            disabled={feed.isFetching}
          >
            Show posts
            <ArrowRight size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Dismiss new posts"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            onClick={() => setNewPostsDismissed(true)}
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      )}

      <section
        id="feed-panel"
        aria-label="Feed posts"
        tabIndex={0}
        aria-busy={feed.isLoading}
      >
        {feed.isLoading ? (
          <FeedSkeleton />
        ) : (
          <>
            {feed.isError && (
              <div role="alert" className="home-feed-error mb-5">
                <WifiOff size={20} aria-hidden="true" />
                <p>
                  {posts.length
                    ? "We couldn’t load the latest posts. Your loaded posts are still here."
                    : "Your feed couldn’t load. Check your connection and try again."}
                </p>
                <button
                  type="button"
                  disabled={feed.isFetching}
                  className="home-feed-action home-feed-secondary"
                  onClick={() => feed.refetch()}
                >
                  {feed.isFetching ? "Retrying…" : "Try again"}
                </button>
              </div>
            )}
            {!feed.isError && posts.length === 0 && tab === "hashtags" && (
              <div className="home-feed-state">
                <div className="home-feed-state-icon">
                  <Hash size={28} aria-hidden="true" />
                </div>
                <h2>
                  No posts from your hashtags yet
                </h2>
                <p>
                  Follow a hashtag from its page, and its newest public posts show here.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Link href="/settings/followed-hashtags" className="home-feed-action">
                    Followed hashtags
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                  <Link href="/trending" className="home-feed-action home-feed-secondary">
                    Trending hashtags
                  </Link>
                </div>
              </div>
            )}
            {!feed.isError && posts.length === 0 && tab !== "hashtags" && (
              <div className="home-feed-state">
                <div className="home-feed-state-icon">
                  <Compass size={28} aria-hidden="true" />
                </div>
                <h2>
                  No posts yet
                </h2>
                <p>
                  Discover people or create your first post.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Link href="/discover" className="home-feed-action">
                    Discover people
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                  {onCreateClick && (
                    <button
                      type="button"
                      className="home-feed-action home-feed-secondary"
                      onClick={onCreateClick}
                    >
                      Write a post
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="home-feed-stream">
              {posts.map((post, index) => (
                <Fragment key={post.id}>
                  {presentation === 'editorial' ? (
                    <div className="editorial-entry" data-format={editorialFormat(post)}>
                      <PostCard post={post} />
                    </div>
                  ) : <PostCard post={post} />}
                  {index === Math.min(2, posts.length - 1) && (
                    <div className="xl:hidden">
                      <PeopleYouMayKnowStrip />
                    </div>
                  )}
                  {index === 14 && (
                    <div className="xl:hidden">
                      <PeopleYouMayKnowStrip offset={10} />
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
            {feed.hasNextPage && posts.length > 0 && (
              <>
                <div ref={sentinelRef} data-feed-sentinel aria-hidden="true" className="h-px" />
                <div className="mt-6 flex justify-center" aria-live="polite">
                  {feed.isFetchingNextPage ? (
                    <p role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden="true" />
                      Loading more…
                    </p>
                  ) : (
                    <button
                      type="button"
                      className="home-feed-action home-feed-secondary"
                      onClick={() => feed.fetchNextPage()}
                      disabled={feed.isFetching}
                    >
                      <ArrowDown size={16} aria-hidden="true" />
                      {feed.isFetchNextPageError ? "Retry loading more" : "Load more posts"}
                    </button>
                  )}
                </div>
              </>
            )}
            {!feed.hasNextPage && !feed.isError && posts.length > 0 && (
              <p className="home-feed-end">
                <Check size={15} aria-hidden="true" />
                You’re caught up on loaded posts.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
