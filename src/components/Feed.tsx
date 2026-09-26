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
  Loader2,
  WifiOff,
  X,
} from "lucide-react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";
import PostCard from "./PostCard";
import PeopleYouMayKnowStrip from "./PeopleYouMayKnowStrip";
import { useHomeFeed } from "@/hooks/useFeedPosts";
import { subscribeToPostUpdates } from "@/services/messageService";
import { useFeedDelta } from "@/hooks/useFeedDelta";
import { uniqueFeedPosts, type FeedPage } from "./feed/feedPresentation";
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

export default function Feed({
  onCreateClick,
  presentation = 'classic',
}: {
  onCreateClick?: () => void;
  presentation?: 'classic' | 'editorial';
}) {
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [newPostsDismissed, setNewPostsDismissed] = useState(false);

  // One home feed; retain the existing server-ranked query contract.
  const feed = useHomeFeed("ranked", {
    excludeSelf: false,
    circleOnly: false,
  });
  const posts = uniqueFeedPosts(feed.data?.pages);
  const { newCount, setAnchor, consumeNew } = useFeedDelta({
    feedType: "home",
    enabled: posts.length > 0,
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

  const newestId = posts[0]?.id;
  const newestCreatedAt = posts[0]?.created_at;
  useEffect(() => {
    if (newestCreatedAt) setAnchor(newestCreatedAt);
  }, [newestId, newestCreatedAt, setAnchor]);
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
    const queryKey = ['home-feed', 'ranked', false, false];
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

  return (
    <div className="home-feed">
      <div ref={scrollRef} className="scroll-mt-5" />
      {presentation === 'editorial' ? <h2 className="sr-only">Posts</h2> : <h1 className="sr-only">Home feed</h1>}
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
            {!feed.isError && posts.length === 0 && (
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
            {feed.hasNextPage && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  className="home-feed-action home-feed-secondary"
                  onClick={() => feed.fetchNextPage()}
                  disabled={feed.isFetching}
                >
                  {feed.isFetchingNextPage ? (
                    <Loader2
                      size={16}
                      className="motion-safe:animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <ArrowDown size={16} aria-hidden="true" />
                  )}
                  {feed.isFetchingNextPage
                    ? "Loading more…"
                    : feed.isFetchNextPageError
                      ? "Retry loading more"
                      : "Load more posts"}
                </button>
              </div>
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
