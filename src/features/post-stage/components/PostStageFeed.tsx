"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";
import { Compass, Loader2, WifiOff } from "lucide-react";

import { homeFeedKey, useHomeFeed, type FeedMode, type HomeFeedOptions } from "@/hooks/useFeedPosts";
import { newestCreatedAtOf, uniqueFeedPosts, type FeedPage } from "@/components/feed/feedPresentation";
import { ShareSheet } from "@/features/reels/components/ShareSheet";
import { reelPermalink } from "@/features/reels/model";
import { PostStage } from "@/features/post-stage/components/PostStage";
import { StagePortal } from "@/features/post-stage/components/StagePortal";
import { StageCommentsSheet } from "@/features/post-stage/components/StageCommentsSheet";
import { useAuthorFollow } from "@/features/post-stage/hooks/useAuthorFollow";
import { useFollowingDot } from "@/features/post-stage/hooks/useFollowingDot";
import { usePostCountUpdates } from "@/features/post-stage/hooks/usePostCountUpdates";
import { isFeedReselect } from "@/features/post-stage/model";
import "@/features/post-stage/post-stage.css";

/*
  /feed: one post per screen, scrolled vertically and snapping to each
  post — the wheel, a swipe, j/k and the arrow keys all move one post. On
  a desktop the media frame stands in a centred column with the rail
  beside its right edge; on a phone it fills the width and the rail floats
  over it. The global header stays (Messages, notifications and search are
  there), so this draws only the two feed tabs over the media.

  Refresh, as the Android app: no "N new posts" banner. Tapping Feed in the
  navigation while already here scrolls to the top and loads a fresh first
  page. The Following tab carries a small dot when the server reports new
  posts from people the viewer follows (useFollowingDot). Paging is
  endless: the next page loads when three posts or fewer remain. Nothing is
  inserted or reordered while the viewer is watching — likes, saves and
  live counts are written into the rows in place.
*/

type Tab = "for-you" | "following";

const FEEDS: Record<Tab, { mode: FeedMode; options: HomeFeedOptions }> = {
  "for-you": { mode: "ranked", options: { excludeSelf: false, circleOnly: false } },
  following: { mode: "chronological", options: { followingOnly: true } },
};

/** How many pages either side of the one on screen are drawn in full. */
const RENDER_WINDOW = 2;
const PREFETCH_REMAINING = 3;

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return Boolean(t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="dialog"], [role="menu"], [data-comments-drawer="true"]'));
}

export function PostStageFeed() {
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>("for-you");
  const [followingOpened, setFollowingOpened] = useState(false);
  const [active, setActive] = useState(0);
  const [slides, setSlides] = useState<Record<string, number>>({});
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [shareFor, setShareFor] = useState<string | null>(null);

  usePostCountUpdates();

  const forYou = useHomeFeed(FEEDS["for-you"].mode, FEEDS["for-you"].options);
  const following = useHomeFeed(FEEDS.following.mode, { ...FEEDS.following.options, enabled: followingOpened });
  const feed = tab === "for-you" ? forYou : following;
  const posts = useMemo(() => uniqueFeedPosts(feed.data?.pages as FeedPage[] | undefined), [feed.data]);
  const followingPosts = useMemo(() => uniqueFeedPosts(following.data?.pages as FeedPage[] | undefined), [following.data]);

  const authorIds = useMemo(() => Array.from(new Set(posts.map((p) => p.author?.id || p.author_id))), [posts]);
  const { viewerId, followingOf, follow, pendingId } = useAuthorFollow(authorIds);
  const dot = useFollowingDot({ onFollowing: tab === "following", newestFollowing: newestCreatedAtOf(followingPosts), signedIn: Boolean(viewerId) });

  /* ── where the viewer is ───────────────────────────────── */
  const scrollToIndex = useCallback(
    (i: number, smooth = true) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      scroller.scrollTo({ top: i * scroller.clientHeight, behavior: smooth && !reduceMotion ? "smooth" : "auto" });
    },
    [reduceMotion],
  );

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            setActive(Number((entry.target as HTMLElement).dataset.index ?? 0));
          }
        }
      },
      { root: scroller, threshold: [0.6] },
    );
    scroller.querySelectorAll<HTMLElement>(".ps-page").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [posts.length, tab]);

  // A sheet belongs to the post it was opened on.
  useEffect(() => {
    setCommentsFor(null);
    setShareFor(null);
  }, [active, tab]);

  // Endless paging: the next page while three posts or fewer remain.
  useEffect(() => {
    if (posts.length > 0 && posts.length - 1 - active <= PREFETCH_REMAINING && feed.hasNextPage && !feed.isFetchingNextPage && !feed.isFetchNextPageError) {
      void feed.fetchNextPage();
    }
  }, [active, posts.length, feed]);

  // Keep the index valid when posts disappear (hidden, deleted, blocked).
  useEffect(() => {
    if (posts.length > 0 && active > posts.length - 1) setActive(posts.length - 1);
  }, [posts.length, active]);

  /* ── refresh ────────────────────────────────────────────── */
  const refresh = useCallback(
    async (which: Tab) => {
      const { mode, options } = FEEDS[which];
      const key = homeFeedKey(mode, options);
      scrollToIndex(0, false);
      setActive(0);
      await qc.cancelQueries({ queryKey: key, exact: true });
      // Start again at the first cursor rather than refetching every loaded page.
      qc.setQueryData<InfiniteData<FeedPage>>(key, (old) => old && { ...old, pages: old.pages.slice(0, 1), pageParams: old.pageParams.slice(0, 1) });
      await qc.refetchQueries({ queryKey: key, exact: true });
    },
    [qc, scrollToIndex],
  );

  // Tapping Feed in the navigation while already on /feed.
  const clearDot = dot.clear;
  const tabRef = useRef(tab);
  tabRef.current = tab;
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Not gated on defaultPrevented: next/link prevents the default itself (React handles it at the root first).
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]");
      if (!anchor || !isFeedReselect(anchor.getAttribute("href"), window.location.pathname, window.location.origin)) return;
      if (tabRef.current === "following") clearDot();
      void refresh(tabRef.current);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [refresh, clearDot]);

  const openTab = (next: Tab) => {
    if (next === tab) {
      void refresh(next);
      return;
    }
    const hadDot = dot.showDot;
    setTab(next);
    setActive(0);
    scrollerRef.current?.scrollTo({ top: 0 });
    if (next === "following") {
      dot.clear();
      if (!followingOpened) setFollowingOpened(true);
      else if (hadDot) void refresh("following");
    }
  };

  /* ── keyboard ───────────────────────────────────────────── */
  const activePost = posts[active];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target) || commentsFor || shareFor) return;
      switch (e.key) {
        case "ArrowDown":
        case "j":
          e.preventDefault();
          scrollToIndex(Math.min(active + 1, Math.max(0, posts.length - 1)));
          break;
        case "ArrowUp":
        case "k":
          e.preventDefault();
          scrollToIndex(Math.max(active - 1, 0));
          break;
        case "ArrowLeft":
        case "ArrowRight": {
          if (!activePost) return;
          const count = (activePost.media ?? []).length;
          if (count < 2) return;
          e.preventDefault();
          const current = slides[activePost.id] ?? 0;
          const next = Math.max(0, Math.min(count - 1, current + (e.key === "ArrowRight" ? 1 : -1)));
          setSlides((s) => ({ ...s, [activePost.id]: next }));
          break;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, posts.length, activePost, slides, commentsFor, shareFor, scrollToIndex]);

  const commentsPost = commentsFor ? posts.find((p) => p.id === commentsFor) : undefined;
  const followingLabel = dot.showDot ? "Following, new posts" : "Following";

  return (
    <div className="ps-feed" data-comments-open={commentsPost ? "true" : undefined}>
      <h1 className="sr-only">Feed</h1>
      <div className="ps-tabs" role="tablist" aria-label="Feeds">
        <button type="button" role="tab" aria-selected={tab === "for-you"} className="ps-tabs__tab" onClick={() => openTab("for-you")}>
          For You
        </button>
        <button type="button" role="tab" aria-selected={tab === "following"} aria-label={followingLabel} className="ps-tabs__tab" onClick={() => openTab("following")}>
          Following
          {dot.showDot ? <span className="ps-tabs__dot" aria-hidden="true" /> : null}
        </button>
      </div>

      <div ref={scrollerRef} className="ps-scroller" aria-busy={feed.isLoading} aria-label={tab === "for-you" ? "For You posts" : "Following posts"}>
        {feed.isLoading || (tab === "following" && !followingOpened) ? (
          <div className="ps-page ps-state" role="status" aria-label="Loading posts">
            <Loader2 size={28} className="motion-safe:animate-spin" aria-hidden="true" />
          </div>
        ) : feed.isError && posts.length === 0 ? (
          <div className="ps-page ps-state" role="alert">
            <WifiOff size={28} aria-hidden="true" />
            <p>Posts couldn’t load. Check your connection and try again.</p>
            <button type="button" className="ps-state__action" disabled={feed.isFetching} onClick={() => void feed.refetch()}>
              {feed.isFetching ? "Trying again…" : "Try again"}
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="ps-page ps-state">
            <Compass size={28} aria-hidden="true" />
            <p>{tab === "following" ? "Posts from people you follow show up here." : "No posts yet."}</p>
            <Link href="/discover" className="ps-state__action">Discover people</Link>
          </div>
        ) : (
          posts.map((row, i) => (
            <section key={row.id} className="ps-page" data-index={i} aria-label={`Post ${i + 1}`} aria-current={i === active ? "true" : undefined}>
              {Math.abs(i - active) <= RENDER_WINDOW ? (
                <PostStage
                  row={row}
                  active={i === active}
                  viewerId={viewerId}
                  following={followingOf(row.author?.id || row.author_id)}
                  followPending={pendingId === (row.author?.id || row.author_id)}
                  onFollow={(id, name) => void follow(id, name)}
                  onComments={() => setCommentsFor(row.id)}
                  onShare={() => setShareFor(row.id)}
                  slide={slides[row.id] ?? 0}
                  onSlide={(n) => setSlides((s) => ({ ...s, [row.id]: n }))}
                />
              ) : (
                <div className="ps-cluster" aria-hidden="true">
                  <div className="ps-frame is-placeholder" />
                </div>
              )}
            </section>
          ))
        )}
        {feed.isFetchingNextPage ? (
          <div className="ps-more" role="status" aria-label="Loading more posts">
            <Loader2 size={20} className="motion-safe:animate-spin" aria-hidden="true" />
          </div>
        ) : null}
      </div>

      <StageCommentsSheet
        open={Boolean(commentsPost) && !commentsPost?.no_comments}
        postId={commentsPost?.id ?? ""}
        authorId={commentsPost?.author_id ?? ""}
        count={commentsPost?.counts?.comments ?? 0}
        onClose={() => setCommentsFor(null)}
      />
      <StagePortal>
        <ShareSheet open={Boolean(shareFor)} onClose={() => setShareFor(null)} url={shareFor ? reelPermalink(shareFor) : ""} postId={shareFor ?? undefined} />
      </StagePortal>
    </div>
  );
}
