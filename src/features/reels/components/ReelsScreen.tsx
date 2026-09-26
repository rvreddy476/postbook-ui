"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Clapperboard, Maximize2, Minimize2, RefreshCw } from "lucide-react";
import Link from "next/link";

import { HeaderBar } from "@/features/reels/components/HeaderBar";
import Sidebar from "@/components/Sidebar";
import { ShareSheet } from "@/features/reels/components/ShareSheet";
import { ReelVideo, type ReelVideoHandle } from "@/features/reels/components/ReelVideo";
import { ReelRail } from "@/features/reels/components/ReelRail";
import { ReelOverlay } from "@/features/reels/components/ReelOverlay";
import { ReelSettingsMenu } from "@/features/reels/components/ReelSettingsMenu";
import { ReelMoreMenu } from "@/features/reels/components/ReelMoreMenu";
import { ReelReportDialog } from "@/features/reels/components/ReelReportDialog";
import { ReelCommentsDrawer } from "@/features/reels/components/ReelCommentsDrawer";
import { fetchReel } from "@/features/reels/data/reelFeedApi";
import { patchReelEverywhere, useReelFeed } from "@/features/reels/hooks/useReelFeed";
import {
  useDontRecommendAuthor,
  useLikeReel,
  useNotInterested,
  useSaveReel,
  useShareReel,
} from "@/features/reels/hooks/useReelEngagement";
import { usePlayerPrefs } from "@/features/reels/hooks/usePlayerPrefs";
import { reelPermalink, type ReelItem } from "@/features/reels/model";
import { readSessionUserId } from "@/features/reels/session";
import { useBatchRelationships } from "@/hooks/useConnections";
import { useFollowUser, useUnfollowUser } from "@/hooks/useEditProfile";
import { useGlobalToast } from "@/contexts/ToastContext";

/*
  The reels stage — one reel at a time, portrait, on a black stage; the
  action rail beside it; comments in a drawer; prev/next by keyboard, wheel,
  swipe or the arrow buttons. Only short-form ever reaches here: the model
  drops long video and feed posts before they are rendered.

  Deep links: /reels/{id} → ?reelId= pins that reel above the feed, as the
  Android screen does, so a shared link opens on the reel and swiping down
  continues into the feed.
*/

type Tab = "foryou" | "following";

const NAV_COOLDOWN_MS = 320;
const WHEEL_THRESHOLD = 24;
const SWIPE_THRESHOLD = 48;

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || t.isContentEditable || Boolean(t.closest('[data-comments-drawer="true"]'));
}

export function ReelsScreen() {
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const toast = useGlobalToast();
  const deepLinkId = searchParams.get("reelId") || searchParams.get("reel") || searchParams.get("postId");
  const focusCommentId = searchParams.get("focusCommentId") || undefined;

  const [tab, setTab] = useState<Tab>("foryou");
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [commentsOpen, setCommentsOpen] = useState(Boolean(focusCommentId));
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [qualityHeights, setQualityHeights] = useState<number[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [viewerId, setViewerId] = useState("");

  const { prefs, update: updatePrefs } = usePlayerPrefs();
  const playerRef = useRef<ReelVideoHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const navAtRef = useRef(0);
  const wheelAccRef = useRef(0);
  const touchStartRef = useRef<number | null>(null);

  useEffect(() => {
    setViewerId(readSessionUserId());
  }, []);

  /* ── data ──────────────────────────────────────────────── */
  const feed = useReelFeed(tab === "following");
  const pinned = useQuery({
    queryKey: ["reels", "pinned", deepLinkId],
    queryFn: () => fetchReel(deepLinkId!),
    enabled: Boolean(deepLinkId),
    staleTime: Infinity,
  });

  const reels = useMemo<ReelItem[]>(() => {
    const fromFeed = feed.data?.pages.flatMap((p) => p.items) ?? [];
    const pin = pinned.data;
    if (!pin) return fromFeed;
    const rest = fromFeed.filter((r) => r.id !== pin.id);
    // The feed copy wins once it arrives: it carries viewer flags and counts.
    const feedCopy = fromFeed.find((r) => r.id === pin.id);
    return [feedCopy ?? pin, ...rest];
  }, [feed.data, pinned.data]);

  const active = reels[index];
  const isOwn = Boolean(active && viewerId && active.authorId === viewerId);

  // Load ahead so the last swipe never lands on a spinner.
  useEffect(() => {
    if (reels.length - index <= 3 && feed.hasNextPage && !feed.isFetchingNextPage) {
      void feed.fetchNextPage();
    }
  }, [index, reels.length, feed]);

  // Keep the index valid when items disappear (not-interested).
  useEffect(() => {
    if (reels.length > 0 && index > reels.length - 1) setIndex(reels.length - 1);
  }, [reels.length, index]);

  // Reflect the active reel in the URL for sharing/reloading.
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("reelId", active.id);
    url.searchParams.delete("reel");
    url.searchParams.delete("postId");
    window.history.replaceState(window.history.state, "", url.toString());
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── relationship / follow ─────────────────────────────── */
  const authorIds = useMemo(() => Array.from(new Set(reels.map((r) => r.authorId))), [reels]);
  const relationships = useBatchRelationships(viewerId, authorIds);
  const followMut = useFollowUser();
  const unfollowMut = useUnfollowUser();
  const following = active ? relationships.data?.get(active.authorId)?.following : undefined;
  const toggleFollow = async () => {
    if (!active?.authorUsername) return;
    try {
      if (following) await unfollowMut.mutateAsync(active.authorUsername);
      else await followMut.mutateAsync(active.authorUsername);
      qc.invalidateQueries({ queryKey: ["relationships", "batch"] });
    } catch {
      toast({ type: "error", title: following ? "Could not unfollow" : "Could not follow" });
    }
  };

  /* ── engagement ────────────────────────────────────────── */
  const like = useLikeReel();
  const save = useSaveReel();
  const share = useShareReel();
  const notInterested = useNotInterested();
  const dontRecommend = useDontRecommendAuthor();

  const onLike = () => active && like.mutate({ reel: active, liked: !active.viewerLiked });
  const onDoubleTapLike = () => active && !active.viewerLiked && like.mutate({ reel: active, liked: true });
  const onSave = () => {
    if (!active) return;
    save.mutate({ reel: active, saved: !active.viewerSaved });
    toast({ type: "success", title: active.viewerSaved ? "Removed from saved" : "Saved" });
  };
  const onShare = () => {
    if (!active) return;
    setShareOpen(true);
    share.mutate(active);
  };
  const onCopyLink = async () => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(reelPermalink(active.id));
      toast({ type: "success", title: "Link copied" });
    } catch {
      toast({ type: "error", title: "Could not copy the link" });
    }
  };
  const onNotInterested = () => {
    if (!active) return;
    const target = active;
    notInterested.mutate(target, {
      onError: () => toast({ type: "error", title: "Could not hide this reel" }),
    });
    toast({ type: "info", title: "You'll see fewer reels like this" });
  };
  const onDontRecommend = () => {
    if (!active) return;
    dontRecommend.mutate(active, {
      onSuccess: () => toast({ type: "info", title: `You'll see fewer reels from ${active.authorUsername ? `@${active.authorUsername}` : "this creator"}` }),
      onError: () => toast({ type: "error", title: "Could not save that preference" }),
    });
  };

  /* ── navigation ────────────────────────────────────────── */
  const go = useCallback(
    (delta: 1 | -1) => {
      const now = Date.now();
      if (now - navAtRef.current < NAV_COOLDOWN_MS) return;
      setIndex((i) => {
        const next = i + delta;
        if (next < 0 || next > reels.length - 1) return i;
        navAtRef.current = now;
        setDirection(delta);
        setMoreOpen(false);
        setSettingsOpen(false);
        return next;
      });
    },
    [reels.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "ArrowDown":
        case "j":
          e.preventDefault();
          go(1);
          break;
        case "ArrowUp":
        case "k":
          e.preventDefault();
          go(-1);
          break;
        case " ":
          e.preventDefault();
          playerRef.current?.togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          playerRef.current?.seekBy(-5);
          break;
        case "ArrowRight":
          e.preventDefault();
          playerRef.current?.seekBy(5);
          break;
        case "m":
          updatePrefs({ sound: !prefs.sound });
          break;
        case "l":
          onLike();
          break;
        case "c":
          setCommentsOpen((v) => !v);
          break;
        case "f":
          void toggleFullscreen();
          break;
        case "Escape":
          setCommentsOpen(false);
          setMoreOpen(false);
          setSettingsOpen(false);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go, prefs.sound, active?.id, active?.viewerLiked]);

  const onWheel = (e: React.WheelEvent) => {
    if (isTypingTarget(e.target)) return;
    wheelAccRef.current += e.deltaY;
    if (Math.abs(wheelAccRef.current) >= WHEEL_THRESHOLD) {
      go(wheelAccRef.current > 0 ? 1 : -1);
      wheelAccRef.current = 0;
    }
  };
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0]?.clientY ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (start === null) return;
    const dy = (e.changedTouches[0]?.clientY ?? start) - start;
    if (Math.abs(dy) >= SWIPE_THRESHOLD) go(dy < 0 ? 1 : -1);
  };

  const toggleFullscreen = async () => {
    const el = stageRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      /* unsupported */
    }
  };
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const onEnded = useCallback(() => {
    if (prefs.onEnd === "next") go(1);
  }, [prefs.onEnd, go]);

  const onProgress = useCallback(() => {}, []);

  /* ── states ────────────────────────────────────────────── */
  const loading = (feed.isLoading || (Boolean(deepLinkId) && pinned.isLoading)) && reels.length === 0;
  const errored = feed.isError && reels.length === 0;
  const empty = !loading && !errored && reels.length === 0;

  return (
    <div className="flex h-dvh flex-col bg-canvas text-brand-text">
      <HeaderBar sectionLabel="Reels" />
      <div className="flex min-h-0 flex-1">
        <div className="hidden md:block">
          <Sidebar inFlow activeTab="Reels" setActiveTab={() => {}} />
        </div>

        <main
          className="relative flex min-h-0 min-w-0 flex-1 items-stretch justify-center overflow-hidden md:px-6 md:py-4"
          onWheel={onWheel}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* tabs */}
          <div className="pointer-events-auto absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/45 p-1 text-[12px] font-semibold text-white backdrop-blur md:left-6 md:top-6 md:translate-x-0 md:bg-brand-card md:text-brand-text md:shadow md:backdrop-blur-none">
            {(["foryou", "following"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTab(t);
                  setIndex(0);
                }}
                className={`rounded-full px-3.5 py-1.5 transition ${
                  tab === t ? "bg-white text-black md:bg-brand-accent md:text-on-primary" : "hover:bg-white/10 md:hover:bg-brand-secondary"
                }`}
              >
                {t === "foryou" ? "For you" : "Following"}
              </button>
            ))}
          </div>

          {loading ? (
            <StageFrame stageRef={stageRef}>
              <div className="flex h-full items-center justify-center text-white/70">Loading reels…</div>
            </StageFrame>
          ) : errored ? (
            <StageFrame stageRef={stageRef}>
              <StateCard
                title="Couldn't load reels"
                hint={(feed.error as { message?: string })?.message || "Check your connection and try again."}
                action={
                  <button type="button" onClick={() => feed.refetch()} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black">
                    <RefreshCw className="h-4 w-4" /> Retry
                  </button>
                }
              />
            </StageFrame>
          ) : empty ? (
            <StageFrame stageRef={stageRef}>
              <StateCard
                title={tab === "following" ? "Nothing from people you follow yet" : "No reels yet"}
                hint={tab === "following" ? "Reels from creators you follow will show up here." : "Be the first — reels are short videos up to 5 minutes."}
                action={
                  <Link href="/reels/create" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black">
                    <Clapperboard className="h-4 w-4" /> Create a reel
                  </Link>
                }
              />
            </StageFrame>
          ) : active ? (
            <div className="flex h-full w-full min-w-0 items-center gap-4 md:w-auto">
              <StageFrame stageRef={stageRef}>
                <AnimatePresence initial={false} custom={direction} mode="popLayout">
                  <motion.div
                    key={active.id}
                    custom={direction}
                    initial={{ y: direction * 60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: direction * -60, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="absolute inset-0"
                  >
                    <ReelVideo
                      ref={playerRef}
                      reel={active}
                      active
                      position={index}
                      prefs={prefs}
                      onPrefsChange={updatePrefs}
                      onEnded={onEnded}
                      onDoubleTap={onDoubleTapLike}
                      onQualityLevels={setQualityHeights}
                      onProgress={onProgress}
                    />
                    <ReelOverlay
                      reel={active}
                      isOwn={isOwn}
                      following={following}
                      followPending={followMut.isPending || unfollowMut.isPending}
                      onToggleFollow={toggleFollow}
                      sound={prefs.sound}
                      onToggleSound={() => updatePrefs({ sound: !prefs.sound })}
                      onOpenSettings={() => setSettingsOpen((v) => !v)}
                      settingsMenu={
                        <ReelSettingsMenu
                          open={settingsOpen}
                          onClose={() => setSettingsOpen(false)}
                          prefs={prefs}
                          onChange={updatePrefs}
                          qualityHeights={qualityHeights}
                          captionsAvailable="unknown"
                        />
                      }
                    />
                    {/* phone rail: floats over the stage */}
                    <div className="absolute bottom-24 right-2 z-20 md:hidden">
                      <ReelRail
                        reel={active}
                        onLike={onLike}
                        onComments={() => setCommentsOpen(true)}
                        onShare={onShare}
                        onSave={onSave}
                        onMore={() => setMoreOpen((v) => !v)}
                        moreMenu={<MoreMenu />}
                      />
                    </div>
                  </motion.div>
                </AnimatePresence>
                {/* fullscreen toggle (desktop) */}
                <button
                  type="button"
                  aria-label={fullscreen ? "Exit full screen" : "Full screen"}
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleFullscreen();
                  }}
                  className="absolute bottom-8 right-3 z-20 hidden h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/60 md:flex"
                >
                  {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
              </StageFrame>

              {/* desktop rail */}
              <div className="hidden self-end pb-2 md:block">
                <ReelRail
                  reel={active}
                  onLike={onLike}
                  onComments={() => setCommentsOpen((v) => !v)}
                  onShare={onShare}
                  onSave={onSave}
                  onMore={() => setMoreOpen((v) => !v)}
                  moreMenu={<MoreMenu />}
                />
              </div>

              <ReelCommentsDrawer
                open={commentsOpen}
                reelId={active.id}
                reelAuthorId={active.authorId}
                commentCount={active.commentCount}
                focusCommentId={focusCommentId}
                onClose={() => setCommentsOpen(false)}
              />
            </div>
          ) : null}

          {/* prev / next */}
          {reels.length > 1 ? (
            <div className="absolute right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 md:flex">
              <NavButton label="Previous reel" disabled={index === 0} onClick={() => go(-1)} icon={<ChevronUp className="h-5 w-5" />} />
              <NavButton label="Next reel" disabled={index >= reels.length - 1 && !feed.hasNextPage} onClick={() => go(1)} icon={<ChevronDown className="h-5 w-5" />} />
            </div>
          ) : null}
        </main>
      </div>

      {active ? (
        <>
          <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} url={reelPermalink(active.id)} title={active.caption || `Reel by ${active.authorName}`} />
          <ReelReportDialog open={reportOpen} reelId={active.id} onClose={() => setReportOpen(false)} />
          <AnimatePresence>
            {descriptionOpen ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 md:items-center md:p-4"
                onClick={() => setDescriptionOpen(false)}
              >
                <motion.div
                  initial={{ y: 24 }}
                  animate={{ y: 0 }}
                  exit={{ y: 24 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-md rounded-t-2xl border border-border bg-brand-card p-5 text-brand-text md:rounded-2xl"
                >
                  <h2 className="mb-2 text-[14px] font-bold">Description</h2>
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{active.caption || "No description."}</p>
                  {active.hashtags.length ? (
                    <p className="mt-2 flex flex-wrap gap-x-2 text-[12px] font-semibold text-brand-accent">
                      {active.hashtags.map((t) => (
                        <Link key={t} href={`/hashtag/${encodeURIComponent(t)}`}>
                          #{t}
                        </Link>
                      ))}
                    </p>
                  ) : null}
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </>
      ) : null}
    </div>
  );

  function MoreMenu() {
    if (!active) return null;
    return (
      <ReelMoreMenu
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        reel={active}
        isOwn={isOwn}
        onCopyLink={onCopyLink}
        onDescription={() => setDescriptionOpen(true)}
        onNotInterested={onNotInterested}
        onDontRecommend={onDontRecommend}
        onReport={() => setReportOpen(true)}
      />
    );
  }
}

/* ── layout pieces ─────────────────────────────────────────── */

function StageFrame({ stageRef, children }: { stageRef: React.RefObject<HTMLDivElement | null>; children: React.ReactNode }) {
  return (
    <div
      ref={stageRef}
      // Width from the viewport height, not from h-full: a row flex item's
      // width is resolved before its stretched height, so aspect-ratio on a
      // percentage height collapses to 0. 7.5rem = header + stage padding.
      className="relative h-full w-full overflow-hidden bg-black md:h-auto md:w-[calc((100dvh-7.5rem)*9/16)] md:max-w-full md:aspect-[9/16] md:rounded-2xl md:shadow-2xl [&:fullscreen]:h-full [&:fullscreen]:w-full [&:fullscreen]:rounded-none"
    >
      {children}
    </div>
  );
}

function StateCard({ title, hint, action }: { title: string; hint: string; action?: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-white">
      <Clapperboard className="h-10 w-10 text-white/60" />
      <h2 className="text-[16px] font-bold">{title}</h2>
      <p className="max-w-xs text-[13px] text-white/70">{hint}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

function NavButton({ label, disabled, onClick, icon }: { label: string; disabled?: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-secondary text-brand-text shadow transition hover:bg-brand-divider disabled:opacity-30"
    >
      {icon}
    </button>
  );
}

// Used by the phone rail wrapper above; kept for symmetry with the desktop one.
export { patchReelEverywhere };
