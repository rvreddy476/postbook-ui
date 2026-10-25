"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Clapperboard, LogIn, RefreshCw, SearchX } from "lucide-react";

import { CategoryChips } from "@/features/reels/explore/CategoryChips";
import { ExploreGrid, ExploreGridSkeleton } from "@/features/reels/explore/ExploreGrid";
import {
  EXPLORE_ALL,
  exploreTiles,
  isInvalidCategoryError,
  normalizeExploreCategory,
} from "@/features/reels/explore/exploreApi";
import { useExploreFeed, useShortCategories } from "@/features/reels/explore/useExplore";
import { signInHref } from "@/features/reels/sounds";
import "./explore.css";

export interface ExploreReelsProps {
  /** The raw chip value (from the URL); "" is All. */
  category: string;
  onCategoryChange: (slug: string) => void;
  /** "unknown" until the client has read the session. */
  session: "unknown" | "in" | "out";
  /** Where sign-in returns to. */
  returnTo: string;
}

/**
 * Chips over the reel grid. One request per user action: a chip tap loads
 * the first page (walking past empty pages up to the cap); after that the
 * grid loads more as its end comes into view — but only while pages bring
 * reels. A page that came back empty with a cursor stops the automatic
 * loading and asks the viewer ("Keep looking"), so an empty category can
 * never spin through the timeline on its own.
 */
export function ExploreReels({ category, onCategoryChange, session, returnTo }: ExploreReelsProps) {
  const { slug, valid } = normalizeExploreCategory(category);
  const categories = useShortCategories();
  const feed = useExploreFeed(slug, session === "in" && valid);
  const pages = feed.data?.pages ?? [];
  const tiles = exploreTiles(pages);
  const lastPageEmpty = pages.length > 0 && pages[pages.length - 1].items.length === 0;
  const label = categories.data?.find((c) => c.slug === slug)?.label ?? slug;
  const invalid = !valid || (feed.isError && isInvalidCategoryError(feed.error));

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed;
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = moreRef.current;
    if (!el || !hasNextPage || lastPageEmpty || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, lastPageEmpty, tiles.length]);

  let body: React.ReactNode;
  if (session === "out") {
    body = (
      <div className="explore-state">
        <LogIn size={26} className="opacity-60" aria-hidden />
        <h3>Sign in to explore reels</h3>
        <p>Short videos by category, picked for you.</p>
        <Link href={signInHref(returnTo)} className="explore-state__action">
          Sign in
        </Link>
      </div>
    );
  } else if (invalid) {
    body = (
      <div className="explore-state" role="alert">
        <SearchX size={26} className="opacity-60" aria-hidden />
        <h3>This category isn&apos;t available</h3>
        <p>Pick another one above, or see everything.</p>
        <button type="button" className="explore-state__action" onClick={() => onCategoryChange(EXPLORE_ALL)}>
          Show all
        </button>
      </div>
    );
  } else if (session === "unknown" || feed.isPending) {
    body = <ExploreGridSkeleton />;
  } else if (feed.isError && tiles.length === 0) {
    body = (
      <div className="explore-state" role="alert">
        <h3>Couldn&apos;t load reels</h3>
        <p>Check your connection and try again.</p>
        <button type="button" className="explore-state__action" onClick={() => void feed.refetch()}>
          <RefreshCw size={14} aria-hidden /> Retry
        </button>
      </div>
    );
  } else if (tiles.length === 0 && hasNextPage) {
    body = (
      <div className="explore-state">
        <h3>Nothing here yet</h3>
        <p>There may be more further back.</p>
        <button type="button" className="explore-state__action" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
          {isFetchingNextPage ? "Looking…" : "Keep looking"}
        </button>
      </div>
    );
  } else if (tiles.length === 0) {
    body = (
      <div className="explore-state">
        <Clapperboard size={26} className="opacity-60" aria-hidden />
        <h3>{slug ? `No reels in ${label} yet` : "No reels yet"}</h3>
        {slug ? (
          <button type="button" className="explore-state__action" onClick={() => onCategoryChange(EXPLORE_ALL)}>
            Show all
          </button>
        ) : (
          <Link href="/reels/create" className="explore-state__action">
            Create a reel
          </Link>
        )}
      </div>
    );
  } else {
    body = (
      <>
        <ExploreGrid reels={tiles} />
        {hasNextPage ? (
          <div ref={moreRef} className="explore-more">
            <button type="button" className="explore-more__button" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
              {isFetchingNextPage ? "Loading…" : "Show more"}
            </button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <CategoryChips categories={categories.data ?? []} value={valid ? slug : ""} onChange={onCategoryChange} loading={categories.isPending} />
      {body}
    </div>
  );
}
