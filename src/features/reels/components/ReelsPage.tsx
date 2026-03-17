"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";

import { HeaderBar } from "@/features/reels/components/HeaderBar";
import { ReelIconSideNav } from "@/features/reels/components/ReelIconSideNav";
import { ReelChannelInfo } from "@/features/reels/components/ReelChannelInfo";
import { ReelStage } from "@/features/reels/components/ReelStage";
import { ReelActionsPanel } from "@/features/reels/components/ReelActionsPanel";
import { ReelCommentsPanel } from "@/features/reels/components/ReelCommentsPanel";
import { ExpandedVideoOverlay } from "@/features/reels/components/ExpandedVideoOverlay";
import { useSubmitReport, REPORT_REASONS } from "@/hooks/useReport";
import {
  getCommentsAroundByCommentId,
  getReelById,
  toggleLike,
  toggleBookmark,
  sharePost,
  trackView,
} from "@/features/reels/data/reelsApi";
import { useReelsFeed } from "@/features/reels/hooks/useReelsFeed";
import { useBatchProfiles } from "@/hooks/useProfile";
import type { Reel } from "@/features/reels/types";

/* ── helpers ─────────────────────────────────────────────── */

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || target.isContentEditable;
}

function isInsideCommentsDrawer(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('[data-comments-drawer="true"]'));
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(length - 1, index));
}

/* ── main component ──────────────────────────────────────── */

export function ReelsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const reelIdFromQuery = searchParams.get("reelId");
  const focusCommentIdFromQuery = searchParams.get("focusCommentId");

  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [focusedCommentId, setFocusedCommentId] = useState<string | undefined>(undefined);
  const [boostOverrides, setBoostOverrides] = useState<Record<string, boolean>>({});
  const [saveOverrides, setSaveOverrides] = useState<Record<string, boolean>>({});
  const [likeDeltas, setLikeDeltas] = useState<Record<string, number>>({});
  const [commentDeltas] = useState<Record<string, number>>({});
  const [subscribeOverrides, setSubscribeOverrides] = useState<Record<string, boolean>>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const reportMutation = useSubmitReport();

  const [initialized, setInitialized] = useState(false);
  const wheelCooldownRef = useRef(0);
  const navCooldownRef = useRef(0);
  const handledFocusCommentIdRef = useRef<string | null>(null);

  /* ── data queries ────────────────────────────────── */

  const reelsQuery = useReelsFeed({ pageSize: 8 });
  const baseReels = useMemo(
    () => reelsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [reelsQuery.data]
  );

  const focusCommentQuery = useQuery({
    queryKey: ["reels-focus-comment", focusCommentIdFromQuery, reelIdFromQuery],
    queryFn: () =>
      getCommentsAroundByCommentId({
        comment_id: focusCommentIdFromQuery ?? "",
        reel_id: reelIdFromQuery ?? "",
      }),
    enabled: Boolean(focusCommentIdFromQuery) && Boolean(reelIdFromQuery),
    retry: false,
  });

  const focusReelId = focusCommentQuery.data?.reel_id ?? reelIdFromQuery;

  const reelByIdQuery = useQuery({
    queryKey: ["reels-reel-id", reelIdFromQuery],
    queryFn: () => getReelById(reelIdFromQuery ?? ""),
    enabled: Boolean(reelIdFromQuery) && !initialized,
  });

  const focusReelQuery = useQuery({
    queryKey: ["reels-focus-reel-id", focusReelId],
    queryFn: () => getReelById(focusReelId ?? ""),
    enabled: Boolean(focusReelId) && !initialized,
  });

  /* ── author profile hydration ─────────────────── */

  const authorIds = useMemo(
    () => [...new Set(baseReels.map((r) => r.author_id))],
    [baseReels]
  );
  const profilesQuery = useBatchProfiles(authorIds);

  /* ── merged reels list ─────────────────────────── */

  const reels = useMemo<Reel[]>(() => {
    // Only prepend deep-linked reels before initialization to avoid
    // index-shifting loops: replaceState → searchParams → query → reorder → replaceState
    const deepLinkReels = initialized
      ? []
      : [focusReelQuery.data, reelByIdQuery.data].filter(Boolean);
    const ordered = [...deepLinkReels, ...baseReels].filter(
      (item): item is Reel => Boolean(item)
    );
    const unique = new Map<string, Reel>();
    ordered.forEach((reel) => {
      if (unique.has(reel.reel_id)) return;
      unique.set(reel.reel_id, reel);
    });

    const profiles = profilesQuery.data;

    return Array.from(unique.values()).map((reel) => {
      const likeDelta = likeDeltas[reel.reel_id] ?? 0;
      const commentDelta = commentDeltas[reel.reel_id] ?? 0;
      const profile = profiles?.get(reel.author_id);
      return {
        ...reel,
        author_name: profile?.display_name ?? profile?.username ?? reel.author_name,
        author_avatar_url: profile?.avatar_media_id
          ? `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/v1/media/${profile.avatar_media_id}/serve`
          : reel.author_avatar_url,
        viewer_has_boosted: boostOverrides[reel.reel_id] ?? reel.viewer_has_boosted,
        viewer_has_saved: saveOverrides[reel.reel_id] ?? reel.viewer_has_saved,
        like_count: Math.max(0, reel.like_count + likeDelta),
        comment_count: Math.max(0, reel.comment_count + commentDelta),
      };
    });
  }, [baseReels, boostOverrides, commentDeltas, focusReelQuery.data, initialized, likeDeltas, profilesQuery.data, reelByIdQuery.data, saveOverrides]);

  const activeReel = reels[activeIndex];

  /* ── initialise active index from query params ── */

  useEffect(() => {
    if (initialized) return;
    if (reels.length === 0) return;

    const targetReelId = focusReelId ?? reelIdFromQuery;
    if (!targetReelId) {
      setActiveIndex(0);
      setInitialized(true);
      return;
    }

    const targetIndex = reels.findIndex((reel) => reel.reel_id === targetReelId);
    if (targetIndex >= 0) {
      setActiveIndex(targetIndex);
      setInitialized(true);
      return;
    }

    const targetLookupFinished =
      (focusReelId ? focusReelQuery.isFetched : true) &&
      (reelIdFromQuery ? reelByIdQuery.isFetched : true);

    if (targetLookupFinished) {
      setActiveIndex(0);
      setInitialized(true);
    }
  }, [focusReelId, focusReelQuery.isFetched, initialized, reelByIdQuery.isFetched, reelIdFromQuery, reels]);

  /* ── focus-comment deep-link handling ──────────── */

  useEffect(() => {
    if (!focusCommentQuery.data) return;
    if (handledFocusCommentIdRef.current === focusCommentQuery.data.focus_comment_id) return;

    setFocusedCommentId(focusCommentQuery.data.focus_comment_id);
    setIsCommentsOpen(true);

    const reelIndex = reels.findIndex((reel) => reel.reel_id === focusCommentQuery.data.reel_id);
    if (reelIndex >= 0) {
      setActiveIndex(reelIndex);
    }

    handledFocusCommentIdRef.current = focusCommentQuery.data.focus_comment_id;
  }, [focusCommentQuery.data, reels]);

  /* ── sync URL with active reel (debounced to avoid Next.js router churn) ── */

  const urlSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activeReel || typeof window === "undefined") return;

    if (urlSyncTimerRef.current) clearTimeout(urlSyncTimerRef.current);
    urlSyncTimerRef.current = setTimeout(() => {
      const url = new URL(window.location.href);
      if (url.searchParams.get("reelId") === activeReel.reel_id) return;
      url.searchParams.set("reelId", activeReel.reel_id);
      url.searchParams.delete("focusCommentId");
      url.searchParams.delete("v");
      window.history.replaceState({}, "", url.toString());
    }, 400);

    return () => {
      if (urlSyncTimerRef.current) clearTimeout(urlSyncTimerRef.current);
    };
  }, [activeReel?.reel_id]);

  /* ── actions ───────────────────────────────────── */

  const goToIndex = useCallback(
    (nextIndex: number) => {
      const now = Date.now();
      if (now - navCooldownRef.current < 300) return;
      navCooldownRef.current = now;
      setActiveIndex(clampIndex(nextIndex, reels.length));
      setFocusedCommentId(undefined);
    },
    [reels.length]
  );

  const toggleComments = useCallback(() => {
    setIsCommentsOpen((prev) => !prev);
  }, []);

  const closeComments = useCallback(() => setIsCommentsOpen(false), []);

  const toggleBoostForReel = useCallback((reel: Reel, forceOn?: boolean) => {
    const current = reel.viewer_has_boosted;
    const nextValue = forceOn ?? !current;
    if (nextValue === current) return;
    setBoostOverrides((prev) => ({ ...prev, [reel.reel_id]: nextValue }));
    setLikeDeltas((prev) => ({
      ...prev,
      [reel.reel_id]: (prev[reel.reel_id] ?? 0) + (nextValue ? 1 : -1),
    }));
    void toggleLike(reel.reel_id).catch(() => {
      setBoostOverrides((prev) => ({ ...prev, [reel.reel_id]: current }));
      setLikeDeltas((prev) => ({
        ...prev,
        [reel.reel_id]: (prev[reel.reel_id] ?? 0) + (nextValue ? -1 : 1),
      }));
    });
  }, []);

  const toggleSaveForReel = useCallback((reel: Reel) => {
    const current = reel.viewer_has_saved;
    setSaveOverrides((prev) => ({ ...prev, [reel.reel_id]: !current }));
    void toggleBookmark(reel.reel_id).catch(() => {
      setSaveOverrides((prev) => ({ ...prev, [reel.reel_id]: current }));
    });
  }, []);

  const handleShareForReel = useCallback(async (reelId: string) => {
    if (typeof window === "undefined") return;
    const shareUrl = `${window.location.origin}/reels?reelId=${reelId}`;

    void sharePost(reelId, "external").catch(() => {});

    if (navigator.share) {
      try {
        await navigator.share({ title: "PostBoek Reel", url: shareUrl });
        return;
      } catch {
        return;
      }
    }
    await navigator.clipboard.writeText(shareUrl);
  }, []);

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const query = searchValue.trim();
      if (!query) {
        router.push("/search");
        return;
      }
      router.push(`/search?q=${encodeURIComponent(query)}`);
    },
    [router, searchValue]
  );

  /* ── keyboard navigation ───────────────────────── */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isInteractiveTarget(event.target)) return;

      if (event.key === "ArrowDown" || event.key.toLowerCase() === "j") {
        event.preventDefault();
        goToIndex(activeIndex + 1);
        return;
      }
      if (event.key === "ArrowUp" || event.key.toLowerCase() === "k") {
        event.preventDefault();
        goToIndex(activeIndex - 1);
        return;
      }
      if (event.key.toLowerCase() === "m") {
        setIsMuted((prev) => !prev);
        return;
      }
      if (event.key.toLowerCase() === "c") {
        toggleComments();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, goToIndex, toggleComments]);

  /* ── wheel navigation ──────────────────────────── */

  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      if (isInsideCommentsDrawer(event.target)) return;
      if (isInteractiveTarget(event.target)) return;
      if (Math.abs(event.deltaY) < 22) return;

      const now = Date.now();
      if (now - wheelCooldownRef.current < 320) return;
      wheelCooldownRef.current = now;

      event.preventDefault();
      goToIndex(activeIndex + (event.deltaY > 0 ? 1 : -1));
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [activeIndex, goToIndex]);

  /* ── prefetch next page ────────────────────────── */

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = reelsQuery;

  useEffect(() => {
    if (activeIndex >= reels.length - 3 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [activeIndex, reels.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  /* ── view tracking ──────────────────────────────── */

  const viewStartRef = useRef<{ reelId: string; startTime: number } | null>(null);

  useEffect(() => {
    if (viewStartRef.current) {
      const { reelId, startTime } = viewStartRef.current;
      const watchedMs = Date.now() - startTime;
      if (watchedMs > 1000) {
        const reel = reels.find((r) => r.reel_id === reelId);
        const durationMs = (reel?.duration_seconds ?? 30) * 1000;
        void trackView({
          reel_id: reelId,
          source: "feed",
          watched_ms: watchedMs,
          duration_ms: durationMs,
          completed: watchedMs >= durationMs * 0.95,
        });
      }
    }
    if (activeReel) {
      viewStartRef.current = { reelId: activeReel.reel_id, startTime: Date.now() };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReel?.reel_id]);

  useEffect(() => {
    return () => {
      if (viewStartRef.current) {
        const { reelId, startTime } = viewStartRef.current;
        const watchedMs = Date.now() - startTime;
        if (watchedMs > 1000) {
          void trackView({
            reel_id: reelId,
            source: "feed",
            watched_ms: watchedMs,
            duration_ms: 30000,
            completed: false,
          });
        }
      }
    };
  }, []);

  /* ── loading state ─────────────────────────────── */

  if (reelsQuery.isLoading && reels.length === 0) {
    return (
      <div className="flex h-screen flex-col bg-brand-card">
        <HeaderBar
          searchValue={searchValue}
          onSearchValueChange={setSearchValue}
          onSearchSubmit={handleSearchSubmit}
        />
        <div className="flex flex-1">
          <ReelIconSideNav />
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-divider border-t-slate-500" />
              <p className="text-[13px] text-brand-text/60">Loading reels...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!activeReel) {
    return (
      <div className="flex h-screen flex-col bg-brand-card">
        <HeaderBar
          searchValue={searchValue}
          onSearchValueChange={setSearchValue}
          onSearchSubmit={handleSearchSubmit}
        />
        <div className="flex flex-1">
          <ReelIconSideNav />
          <div className="flex flex-1 items-center justify-center">
            <p className="text-[13px] text-brand-text/60">No reels available.</p>
          </div>
        </div>
      </div>
    );
  }

  /* ── main render ───────────────────────────────── */

  const isSubscribed = subscribeOverrides[activeReel.author_id] ?? false;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-brand-card">
      <HeaderBar
        searchValue={searchValue}
        onSearchValueChange={setSearchValue}
        onSearchSubmit={handleSearchSubmit}
      />

      <div className="flex flex-1 min-h-0">
        {/* Icon-only side nav */}
        <ReelIconSideNav />

        {/* Tight 3-section row: Info | Video | Actions — centered on page */}
        <main className="flex flex-1 min-w-0 items-center justify-center overflow-hidden py-1 pr-[400px]">
          <div className="flex h-full items-stretch gap-4">
            {/* Section 1: Channel + Reel Info */}
            <div className="flex w-[260px] shrink-0 min-h-0">
              <ReelChannelInfo
                reel={activeReel}
                subscribed={isSubscribed}
                onToggleSubscribe={() =>
                  setSubscribeOverrides((prev) => ({
                    ...prev,
                    [activeReel.author_id]: !isSubscribed,
                  }))
                }
                onPrev={() => goToIndex(activeIndex - 1)}
                onNext={() => goToIndex(activeIndex + 1)}
                hasPrev={activeIndex > 0}
                hasNext={activeIndex < reels.length - 1}
              />
            </div>

            {/* Section 2: Video Player — keyed by reel id so each reel gets a fresh video element */}
            <ReelStage
              key={activeReel.reel_id}
              reel={activeReel}
              active={!isExpanded}
              muted={isMuted}
              onToggleMuted={() => setIsMuted((prev) => !prev)}
              onBoost={() => toggleBoostForReel(activeReel, true)}
              onExpand={() => setIsExpanded(true)}
            />

            {/* Section 3: Action Rail + Comments side panel */}
            <div className="relative flex shrink-0 self-start pt-2">
              <ReelActionsPanel
                boosted={activeReel.viewer_has_boosted}
                saved={activeReel.viewer_has_saved}
                likeCount={activeReel.like_count}
                commentCount={activeReel.comment_count}
                shareCount={activeReel.share_count}
                commentsOpen={isCommentsOpen}
                onBoost={() => toggleBoostForReel(activeReel)}
                onComment={toggleComments}
                onShare={() => handleShareForReel(activeReel.reel_id)}
                onSave={() => toggleSaveForReel(activeReel)}
                onReport={() => { setReportOpen(true); setReportSubmitted(false); setReportReason(""); }}
                onFeedback={() => {}}
                onDontRecommend={() => {}}
              />

              {/* Comments — opens to the right of the rail, absolutely positioned */}
              <div className="absolute left-full top-0 ml-3">
                <ReelCommentsPanel
                  open={isCommentsOpen}
                  reelId={activeReel.reel_id}
                  reelAuthorId={activeReel.author_id}
                  commentCount={activeReel.comment_count}
                  focusCommentId={focusedCommentId}
                  onClose={closeComments}
                />
              </div>
            </div>
          </div>
        </main>
      </div>

      <ExpandedVideoOverlay
        open={isExpanded}
        videoUrl={activeReel.video_url}
        posterUrl={activeReel.thumbnail_url}
        muted={isMuted}
        onToggleMuted={() => setIsMuted((prev) => !prev)}
        onClose={() => setIsExpanded(false)}
        postId={activeReel.reel_id}
        postAuthorId={activeReel.author_id}
        commentCount={activeReel.comment_count}
      />

      {/* Report dialog for reel/video */}
      {reportOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-[380px] rounded-2xl bg-brand-card shadow-2xl overflow-hidden">
            {reportSubmitted ? (
              <div className="p-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-brand-text">Report Submitted</h3>
                <p className="mt-1 text-[13px] text-brand-highlight">Our team will review this content shortly.</p>
                <button onClick={() => setReportOpen(false)}
                  className="mt-4 w-full rounded-full bg-slate-900 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-800">Done</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-brand-divider px-5 py-3.5">
                  <h3 className="text-[14px] font-bold text-brand-text">Report Content</h3>
                  <button onClick={() => setReportOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-full text-brand-text/60 transition hover:bg-slate-100">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="px-5 py-4">
                  <p className="text-[12px] text-brand-highlight mb-3">Why are you reporting this?</p>
                  <div className="space-y-1.5">
                    {REPORT_REASONS.map((r) => (
                      <button key={r.value} onClick={() => setReportReason(r.value)}
                        className={`w-full rounded-xl px-3.5 py-2.5 text-left text-[13px] transition ${
                          reportReason === r.value ? 'bg-slate-900 text-white font-medium' : 'bg-brand-secondary text-slate-700 hover:bg-slate-100'
                        }`}>{r.label}</button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-brand-divider px-5 py-3">
                  <button
                    onClick={async () => {
                      if (!reportReason) return;
                      await reportMutation.mutateAsync({ targetType: "reel", targetId: activeReel.reel_id, reason: reportReason as Parameters<typeof reportMutation.mutateAsync>[0]["reason"] });
                      setReportSubmitted(true);
                    }}
                    disabled={!reportReason || reportMutation.isPending}
                    className="w-full rounded-full bg-red-600 py-2.5 text-[13px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-40">
                    {reportMutation.isPending ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
