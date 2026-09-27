"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronUp, Clapperboard, Maximize, MoreHorizontal, RefreshCw, Undo2, UserRoundCheck, X } from "lucide-react";
import Link from "next/link";

import { VideoShell } from "@/features/video-shell";
import { connectToHub } from "@/services/messageService";
import { useReelLive } from "../hooks/useReelLive";
import "./reels-screen.css";

import { ShareSheet } from "@/features/reels/components/ShareSheet";
import { ReelVideo, type ReelVideoHandle } from "@/features/reels/components/ReelVideo";
import { ReelRail } from "@/features/reels/components/ReelRail";
import { ReelOverlay } from "@/features/reels/components/ReelOverlay";
import { ReelMoreMenu } from "@/features/reels/components/ReelMoreMenu";
import { ReelReportDialog } from "@/features/reels/components/ReelReportDialog";
import { ReelConfirmDialog } from "@/features/reels/components/ReelConfirmDialog";
import { ReelCommentsDrawer } from "@/features/reels/components/ReelCommentsDrawer";
import { ReelTheaterBar } from "@/features/reels/components/ReelTheaterBar";
import { ReelTheaterPanel } from "@/features/reels/components/ReelTheaterPanel";
import { fetchReel } from "@/features/reels/data/reelFeedApi";
import { feedFromSearch } from "@/features/reels/feed";
import { patchReelEverywhere, useReelFeed } from "@/features/reels/hooks/useReelFeed";
import {
  useBlockAuthor,
  useDeleteReel,
  useDontRecommendAuthor,
  useInterested,
  useLikeReel,
  useNotInterested,
  useRestoreReel,
  useSaveReel,
  useShareReel,
} from "@/features/reels/hooks/useReelEngagement";
import { DESKTOP_QUERY, useMediaQuery } from "@/features/reels/hooks/useMediaQuery";
import { useReelSubscription } from "@/features/reels/hooks/useReelSubscription";
import { usePlayerPrefs } from "@/features/reels/hooks/usePlayerPrefs";
import { CLEAR_SCREEN_HINT_MS, CLEAR_SCREEN_INITIAL, clearScreenReducer } from "@/features/reels/clearScreen";
import { reelPermalink, type ReelItem } from "@/features/reels/model";
import { readSessionUserId } from "@/features/reels/session";
import { COMMENTS_TRACK_WIDTH, STAGE_DEFAULT_ASPECT, stageAspect } from "@/features/reels/stage";
import { useBatchRelationships } from "@/hooks/useConnections";
import { useFollowUser, useUnfollowUser } from "@/hooks/useEditProfile";
import { useGlobalToast } from "@/contexts/ToastContext";

/*
  The reels stage — TikTok's desktop page, to the pixel (stage.ts holds
  the numbers): one reel at a time, the video framed at its own aspect
  ratio, 16px from the top and 100dvh − 32 tall; the action rail 15px to
  its right, bottom-aligned to the frame; a 117px empty zone after the
  rail; and that whole cluster centred in the stage area. The More and
  Cinema circles sit inside the frame's top-right; the arrows stand at
  the area's right edge. Comments open as a 352px card to the right and
  the cluster re-centres in what is left, the frame keeping its height.
  Prev/next by keyboard, wheel, swipe or the arrows. Only short-form ever
  reaches here: the model drops long video and feed posts before they are
  rendered.

  The page sits inside the shared video shell under its "sidebar" chrome:
  no header, search at the top of the collapsible left menu, Create /
  notifications / account floating over the top-right — TikTok's frame.
  Nothing competes with the video: the author name and the rail avatar are
  plain links to the profile, and following is the badge on that avatar.

  Theater (`f`, the Cinema circle): a fixed black layer over the workspace
  — the video with stacked arrows beside it, a right panel with the author,
  caption, counts and the thread, and a full-width control bar along the
  bottom. The browser's fullscreen is requested as well; if it refuses,
  the layer alone is the theater.

  Deep links: /reels/{id} → ?reelId= pins that reel above the feed, as the
  Android screen does, so a shared link opens on the reel and swiping down
  continues into the feed. ?feed=following switches to the Following feed.
*/

const NAV_COOLDOWN_MS = 320;
const WHEEL_THRESHOLD = 24;
const SWIPE_THRESHOLD = 48;

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || t.isContentEditable || Boolean(t.closest('[data-comments-drawer="true"], [data-reel-side-panel]'));
}

export function ReelsScreen() {
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const qc = useQueryClient();
  const toast = useGlobalToast();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const deepLinkId = searchParams.get("reelId") || searchParams.get("reel") || searchParams.get("postId");
  const focusCommentId = searchParams.get("focusCommentId") || undefined;
  const feedKind = feedFromSearch(searchParams);

  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [commentsOpen, setCommentsOpen] = useState(Boolean(focusCommentId));
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [qualityHeights, setQualityHeights] = useState<number[]>([]);
  // The element's measured ratio per reel; wins over the stored dimensions.
  const [measuredAspect, setMeasuredAspect] = useState<Record<string, number>>({});
  const [captionsAvailable, setCaptionsAvailable] = useState<"unknown" | "yes" | "no">("unknown");
  const [theater, setTheater] = useState(false);
  const [paused, setPaused] = useState(false);
  const [clock, setClock] = useState({ currentMs: 0, durationMs: 0, bufferedMs: 0 });
  const [viewerId, setViewerId] = useState("");
  const [clear, dispatchClear] = useReducer(clearScreenReducer, CLEAR_SCREEN_INITIAL);

  const { prefs, update: updatePrefs } = usePlayerPrefs();
  const playerRef = useRef<ReelVideoHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const theaterRef = useRef(false);
  theaterRef.current = theater;
  const navAtRef = useRef(0);
  const wheelAccRef = useRef(0);
  const touchStartRef = useRef<number | null>(null);

  useEffect(() => {
    setViewerId(readSessionUserId());
    // The shared socket used to be bootstrapped by AppShell; the stage keeps it alive.
    void connectToHub(() => {});
  }, []);

  /* ── data ──────────────────────────────────────────────── */
  const feed = useReelFeed(feedKind === "following");
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
  const showComments = theater || (commentsOpen && Boolean(active) && !active.commentsDisabled);
  useReelLive(active?.id, showComments);
  const isOwn = Boolean(active && viewerId && active.authorId === viewerId);

  // Switching feeds starts from the top of the new one.
  useEffect(() => {
    setIndex(0);
    setDirection(1);
  }, [feedKind]);

  // Load ahead so the last swipe never lands on a spinner.
  useEffect(() => {
    if (reels.length - index <= 3 && feed.hasNextPage && !feed.isFetchingNextPage) {
      void feed.fetchNextPage();
    }
  }, [index, reels.length, feed]);

  // Keep the index valid when items disappear (not-interested, block, delete).
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

  // Captions availability is per reel; the player reports it once asked.
  useEffect(() => {
    setCaptionsAvailable("unknown");
    setClock({ currentMs: 0, durationMs: 0, bufferedMs: 0 });
  }, [active?.id]);

  /* ── relationship / follow / subscribe ─────────────────── */
  const authorIds = useMemo(() => Array.from(new Set(reels.map((r) => r.authorId))), [reels]);
  const relationships = useBatchRelationships(viewerId, authorIds);
  const followMut = useFollowUser();
  const unfollowMut = useUnfollowUser();
  const relationship = active ? relationships.data?.get(active.authorId) : undefined;
  const following = relationship?.following;
  const followPending = followMut.isPending || unfollowMut.isPending;
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
  const subscription = useReelSubscription(active?.channelHandle, Boolean(active?.channelHandle) && !isOwn);
  const toggleSubscribe = async () => {
    try {
      await subscription.toggle();
    } catch {
      toast({ type: "error", title: subscription.subscribed ? "Could not unsubscribe" : "Could not subscribe" });
    }
  };

  /* ── engagement ────────────────────────────────────────── */
  const like = useLikeReel();
  const save = useSaveReel();
  const share = useShareReel();
  const notInterested = useNotInterested();
  const dontRecommend = useDontRecommendAuthor();
  const interested = useInterested();
  const block = useBlockAuthor();
  const remove = useDeleteReel();
  const restore = useRestoreReel();

  const onLike = () => active && !like.isPending && like.mutate({ reel: active, liked: !active.viewerLiked });
  const onDoubleTapLike = () => active && !like.isPending && !active.viewerLiked && like.mutate({ reel: active, liked: true });
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
  const onInterested = () => {
    if (!active) return;
    interested.mutate(active, {
      onSuccess: () => toast({ type: "success", title: "We'll show more like this" }),
      onError: () => toast({ type: "error", title: "Could not save that preference" }),
    });
  };

  /** Blocked: every reel by the author leaves the cache; the next one takes the slot. */
  const confirmBlock = async () => {
    if (!active) return;
    const target = active;
    try {
      await block.mutateAsync(target);
      if (pinned.data?.authorId === target.authorId) qc.setQueryData(["reels", "pinned", deepLinkId], null);
      setBlockOpen(false);
      setDirection(1);
      toast({ type: "success", title: `${target.authorUsername ? `@${target.authorUsername}` : target.authorName} blocked` });
    } catch {
      toast({ type: "error", title: "Could not block", description: "Please try again." });
    }
  };

  /** Deleted: gone at once, with an Undo that restores it to the same spot. */
  const confirmDelete = () => {
    if (!active || !isOwn) return;
    const target = active;
    const at = index;
    setDeleteOpen(false);
    setDirection(1);
    if (pinned.data?.id === target.id) qc.setQueryData(["reels", "pinned", deepLinkId], null);
    remove.mutate(
      { reel: target, at },
      {
        onSuccess: () => {
          toast({
            type: "info",
            title: "Reel deleted",
            customContent: (
              <ReelUndoToast
                onUndo={async () => {
                  await restore.mutateAsync({ reel: target, at });
                  setIndex(at);
                }}
                onFailed={() => toast({ type: "error", title: "Could not restore the reel" })}
              />
            ),
          });
        },
        onError: () => toast({ type: "error", title: "Could not delete the reel" }),
      },
    );
  };

  /* ── clear screen (not in theater: the bar is the UI there) ── */
  useEffect(() => {
    if (!clear.hint) return;
    const t = setTimeout(() => dispatchClear({ type: "hint-expired" }), CLEAR_SCREEN_HINT_MS);
    return () => clearTimeout(t);
  }, [clear.hint]);

  const enterClearScreen = () => {
    if (theater) return;
    setMoreOpen(false);
    dispatchClear({ type: "enter" });
  };

  /* ── theater ───────────────────────────────────────────── */
  const enterTheater = useCallback(async () => {
    setTheater(true);
    setMoreOpen(false);
    dispatchClear({ type: "tap" });
    const el = workspaceRef.current;
    if (!el || document.fullscreenElement) return;
    try {
      await el.requestFullscreen();
    } catch {
      /* refused: the fixed layer alone is the theater */
    }
  }, []);
  const exitTheater = useCallback(async () => {
    setTheater(false);
    setMoreOpen(false);
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        /* ignore */
      }
    }
  }, []);
  const toggleTheater = useCallback(() => {
    if (theaterRef.current) void exitTheater();
    else void enterTheater();
  }, [enterTheater, exitTheater]);
  // Leaving the browser's fullscreen (its own Escape, the OS) leaves the theater too.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setTheater(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

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
        return next;
      });
    },
    [reels.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (blockOpen || deleteOpen) return;
      // Clear screen: any key brings the controls back and is consumed.
      if (clear.on) {
        e.preventDefault();
        dispatchClear({ type: "key" });
        return;
      }
      if (e.key === "Escape" && theater) {
        void exitTheater();
        setCommentsOpen(false);
        return;
      }
      if (e.target instanceof HTMLElement && e.target.closest('button, a, [role="dialog"], [role="alertdialog"], [role="toolbar"], [role="slider"]')) return;
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
          toggleTheater();
          break;
        case "h":
          enterClearScreen();
          break;
        case "Escape":
          setCommentsOpen(false);
          setMoreOpen(false);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go, prefs.sound, active?.id, active?.viewerLiked, clear.on, blockOpen, deleteOpen, theater]);

  const onWheel = (e: React.WheelEvent) => {
    if (isTypingTarget(e.target)) return;
    // A portal (the emoji picker, a menu) bubbles through React but is not
    // inside the stage in the DOM: scrolling it must never advance the reel.
    // Neither must scrolling a menu, dialog or the comments panel.
    const target = e.target as Node | null;
    if (!target || !e.currentTarget.contains(target)) return;
    if (target instanceof HTMLElement && target.closest('[role="menu"], [role="dialog"], [role="listbox"], .reel-comments-panel, em-emoji-picker')) return;
    wheelAccRef.current += e.deltaY;
    if (Math.abs(wheelAccRef.current) >= WHEEL_THRESHOLD) {
      go(wheelAccRef.current > 0 ? 1 : -1);
      wheelAccRef.current = 0;
    }
  };
  const onTouchStart = (e: React.TouchEvent) => {
    if (isTypingTarget(e.target) || (e.target instanceof HTMLElement && e.target.closest('button, a, [role="slider"]'))) {
      touchStartRef.current = null;
      return;
    }
    touchStartRef.current = e.touches[0]?.clientY ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (start === null) return;
    const dy = (e.changedTouches[0]?.clientY ?? start) - start;
    if (Math.abs(dy) >= SWIPE_THRESHOLD) go(dy < 0 ? 1 : -1);
  };

  const onEnded = useCallback(() => {
    if (prefs.onEnd === "next") go(1);
  }, [prefs.onEnd, go]);

  const onProgress = useCallback(() => {}, []);
  const onCaptionsAvailable = useCallback((available: boolean) => setCaptionsAvailable(available ? "yes" : "no"), []);
  // The bar's clock: only worth a render while the bar is on screen.
  const onTime = useCallback((currentMs: number, durationMs: number, bufferedMs: number) => {
    if (theaterRef.current) setClock({ currentMs, durationMs, bufferedMs });
  }, []);
  const onVolumeChange = (volume: number) => {
    playerRef.current?.setVolume(volume);
    updatePrefs({ volume, sound: volume > 0 });
  };
  const onToggleSound = () => {
    const sound = !prefs.sound;
    const volume = prefs.volume || 1;
    playerRef.current?.setVolume(sound ? volume : 0);
    updatePrefs({ sound, volume });
  };

  /* ── states ────────────────────────────────────────────── */
  const loading = (feed.isLoading || (Boolean(deepLinkId) && pinned.isLoading)) && reels.length === 0;
  const errored = (feed.isError || pinned.isError) && reels.length === 0;
  const empty = !loading && !errored && reels.length === 0;

  // One menu, one open state; where it is drawn depends on which trigger holds it.
  // The playback rows (speed, quality, auto scroll, captions) live in it too.
  const moreMenuFor = (anchor: "beside" | "below") => active ? (
    <ReelMoreMenu
      anchor={anchor}
      open={moreOpen}
      onClose={() => setMoreOpen(false)}
      reel={active}
      isOwn={isOwn}
      following={following}
      followPending={followPending}
      prefs={prefs}
      onPrefsChange={updatePrefs}
      qualityHeights={qualityHeights}
      captionsAvailable={captionsAvailable}
      onCopyLink={onCopyLink}
      onDescription={() => setDescriptionOpen(true)}
      onInterested={onInterested}
      onToggleFollow={() => void toggleFollow()}
      onBlock={() => setBlockOpen(true)}
      onDelete={() => setDeleteOpen(true)}
      onClearScreen={enterClearScreen}
      onNotInterested={onNotInterested}
      onDontRecommend={onDontRecommend}
      onReport={() => setReportOpen(true)}
    />
  ) : null;

  const arrows = (extraClass: string) =>
    reels.length > 1 ? (
      <div className={`reels-navigation ${extraClass}`} data-clear-screen={clear.on ? "" : undefined}>
        <NavButton label="Previous reel" disabled={index === 0} onClick={() => go(-1)} icon={<ChevronUp className="h-5 w-5" />} />
        <NavButton label="Next reel" disabled={index >= reels.length - 1 && !feed.hasNextPage} onClick={() => go(1)} icon={<ChevronDown className="h-5 w-5" />} />
      </div>
    ) : null;

  const layoutTransition = { duration: reduceMotion ? 0 : 0.28, ease: "easeOut" as const };

  // The rail's Follow badge follows, or subscribes for a reel posted through a channel.
  const railFollow = {
    isOwn,
    following,
    followPending,
    onToggleFollow: () => void toggleFollow(),
    subscribed: subscription.subscribed,
    subscribePending: subscription.pending,
    onToggleSubscribe: () => void toggleSubscribe(),
  };
  // The author card (comments column and theater panel): the same relationship plus the live toggles.
  const authorCard = { ...railFollow, onLike, onSave, onShare };

  return (
    <VideoShell app="reels" chrome="sidebar" immersive compactSearch={showComments && desktop && !theater}>
      <div ref={workspaceRef} className="reels-workspace" style={{ "--reel-comments-w": `${COMMENTS_TRACK_WIDTH}px` } as CSSProperties}>
        <main className="reels-main" onWheel={onWheel} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {loading ? (
            <StateLayout stageRef={stageRef}>
              <div className="flex h-full items-center justify-center text-[13px] text-[rgb(var(--reel-on-stage)/.7)]">Loading reels…</div>
            </StateLayout>
          ) : errored ? (
            <StateLayout stageRef={stageRef}>
              <StateCard
                title="Couldn't load reels"
                hint={(feed.error as { message?: string })?.message || "Check your connection and try again."}
                action={
                  <button
                    type="button"
                    onClick={() => {
                      void feed.refetch();
                      if (deepLinkId) void pinned.refetch();
                    }}
                    className="reel-state-action"
                  >
                    <RefreshCw className="h-4 w-4" /> Retry
                  </button>
                }
              />
            </StateLayout>
          ) : empty ? (
            <StateLayout stageRef={stageRef}>
              {feedKind === "following" ? (
                <StateCard
                  icon={<UserRoundCheck className="h-10 w-10 opacity-60" />}
                  title="Nothing from people you follow yet"
                  hint="Reels from creators you follow land here. Until then, For You has plenty."
                  action={
                    <Link href="/reels" className="reel-state-action">
                      <Clapperboard className="h-4 w-4" /> Go to For You
                    </Link>
                  }
                />
              ) : (
                <StateCard
                  title="No reels yet"
                  hint="Be the first — reels are short videos up to 5 minutes."
                  action={
                    <Link href="/reels/create" className="reel-state-action">
                      <Clapperboard className="h-4 w-4" /> Create a reel
                    </Link>
                  }
                />
              )}
            </StateLayout>
          ) : active ? (
            <div
              className="reels-content"
              data-comments-open={showComments}
              data-clear-screen={clear.on ? "" : undefined}
              data-theater={theater ? "" : undefined}
            >
              {/* stage area: the [frame | rail | reserved] cluster centred, arrows at the right edge */}
              <motion.div layout transition={layoutTransition} className="reel-stage-area">
                {theater ? (
                  <button type="button" aria-label="Exit theater" onClick={() => void exitTheater()} className="reel-theater-close">
                    <X className="h-5 w-5" />
                  </button>
                ) : null}
                <div
                  className="reel-stage-cluster"
                  onClickCapture={(e) => {
                    // A tap anywhere on the stage brings the controls back and does nothing else.
                    if (!clear.on) return;
                    e.preventDefault();
                    e.stopPropagation();
                    dispatchClear({ type: "tap" });
                  }}
                >
                  <StageFrame stageRef={stageRef} aspect={measuredAspect[active.id] ?? stageAspect(active.media.width, active.media.height)} layoutTransition={layoutTransition}>
                    <AnimatePresence initial={false} custom={direction} mode="popLayout">
                      <motion.div
                        key={active.id}
                        custom={direction}
                        initial={{ y: reduceMotion ? 0 : direction * 30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: reduceMotion ? 0 : direction * -30, opacity: 0 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        className="reel-portrait-content"
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
                          onCaptionsAvailable={onCaptionsAvailable}
                          onTime={onTime}
                          onPlayState={setPaused}
                          onDimensions={(w, h) => {
                            const id = active.id;
                            const ar = stageAspect(w, h);
                            setMeasuredAspect((m) => (m[id] === ar ? m : { ...m, [id]: ar }));
                          }}
                          chromeless={theater}
                        />
                        {theater ? null : (
                          <ReelOverlay
                            reel={active}
                            sound={prefs.sound}
                            volume={prefs.volume}
                            onVolumeChange={onVolumeChange}
                            onToggleSound={onToggleSound}
                          />
                        )}
                        {/* phone / tablet rail: floats over the stage */}
                        {theater ? null : (
                          <div className="reel-mobile-rail">
                            <ReelRail
                              variant="phone"
                              reel={active}
                              {...railFollow}
                              onLike={onLike}
                              onComments={() => setCommentsOpen(true)}
                              onShare={onShare}
                              onSave={onSave}
                              onMore={() => setMoreOpen((v) => !v)}
                              moreMenu={desktop ? undefined : moreMenuFor("beside")}
                            />
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                    {/* frame top-right: the three dots, on hover only (the phone rail has its own More).
                        The one menu — playback rows and the mapped rows — hangs from this corner. */}
                    {theater ? null : (
                      <div className="reel-frame-actions" onClick={(e) => e.stopPropagation()}>
                        <div className="reel-frame-action-wrap is-more">
                          <button type="button" aria-label="More" aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)} className="reel-frame-action">
                            <MoreHorizontal size={24} aria-hidden />
                          </button>
                          {desktop ? moreMenuFor("below") : null}
                        </div>
                        <button type="button" aria-label="Theater mode" onClick={() => void enterTheater()} className="reel-frame-action">
                          <Maximize size={24} aria-hidden />
                        </button>
                      </div>
                    )}
                    <AnimatePresence>
                      {clear.hint ? (
                        <motion.div key="clear-hint" role="status" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="reel-clear-hint">
                          Tap to show controls
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </StageFrame>

                  {theater ? (
                    /* theater: the arrows stand where the rail was, right beside the video */
                    <div className="reel-desktop-rail is-arrows">{arrows("is-beside")}</div>
                  ) : (
                    <div className="reel-desktop-rail">
                      <ReelRail
                        playing={!paused}
                        reel={active}
                        {...railFollow}
                        onLike={onLike}
                        onComments={() => setCommentsOpen((v) => !v)}
                        onShare={onShare}
                        onSave={onSave}
                      />
                    </div>
                  )}
                  {/* TikTok's empty zone right of the rail; part of what gets centred */}
                  <div className="reel-stage-reserve" aria-hidden="true" />
                </div>

                {theater ? null : arrows("is-edge")}
              </motion.div>

              {/* right column: the theater panel, the comments column, or the phone sheet */}
              {theater ? (
                <ReelTheaterPanel reel={active} {...authorCard} focusCommentId={focusCommentId} />
              ) : desktop ? (
                <div className="reel-comments-column" data-reel-side-panel>
                  <ReelCommentsDrawer variant="column" open={showComments} reel={active} author={authorCard} focusCommentId={focusCommentId} onClose={() => setCommentsOpen(false)} />
                </div>
              ) : (
                <div className="reel-comments-sheet">
                  <ReelCommentsDrawer variant="sheet" open={showComments} reel={active} focusCommentId={focusCommentId} onClose={() => setCommentsOpen(false)} />
                </div>
              )}

              {theater ? (
                <ReelTheaterBar
                  player={playerRef}
                  paused={paused}
                  currentMs={clock.currentMs}
                  durationMs={clock.durationMs || active.media.durationMs}
                  bufferedMs={clock.bufferedMs}
                  prefs={prefs}
                  onPrefsChange={updatePrefs}
                  onVolumeChange={onVolumeChange}
                  onToggleSound={onToggleSound}
                  onMore={() => setMoreOpen((v) => !v)}
                  moreMenu={moreMenuFor("beside")}
                />
              ) : null}
            </div>
          ) : null}
        </main>

        {active ? (
          <>
            <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} url={reelPermalink(active.id)} title={active.title || `Reel by ${active.authorName}`} />
            <ReelReportDialog open={reportOpen} reelId={active.id} onClose={() => setReportOpen(false)} />
            <ReelConfirmDialog
              open={blockOpen}
              title={`Block ${active.authorUsername ? `@${active.authorUsername}` : active.authorName}?`}
              description="They won't be able to see your posts, follow you or message you, and their reels will stop appearing here. They are not told."
              confirmLabel="Block"
              danger
              pending={block.isPending}
              onConfirm={() => void confirmBlock()}
              onCancel={() => setBlockOpen(false)}
            />
            <ReelConfirmDialog
              open={deleteOpen}
              title="Delete this reel?"
              description="It goes to Recently deleted. You can undo right away."
              confirmLabel="Delete"
              danger
              pending={remove.isPending}
              onConfirm={confirmDelete}
              onCancel={() => setDeleteOpen(false)}
            />
            <AnimatePresence>
              {descriptionOpen ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="reel-confirm-scrim" onClick={() => setDescriptionOpen(false)}>
                  <motion.div
                    role="dialog"
                    aria-modal
                    aria-label="Description"
                    initial={{ y: 24 }}
                    animate={{ y: 0 }}
                    exit={{ y: 24 }}
                    onClick={(e) => e.stopPropagation()}
                    className="reel-confirm-card"
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
    </VideoShell>
  );
}

/* ── layout pieces ─────────────────────────────────────────── */

function StageFrame({
  stageRef,
  aspect,
  layoutTransition,
  children,
}: {
  stageRef: React.RefObject<HTMLDivElement | null>;
  aspect: number;
  layoutTransition?: { duration: number; ease: "easeOut" };
  children: React.ReactNode;
}) {
  return (
    <motion.div
      ref={stageRef}
      layout
      transition={layoutTransition}
      // The frame takes the media's own ratio (--reel-ar): tall for a
      // portrait reel, wide for a landscape one. Its width is the smaller of
      // what the stage height allows (height × ratio) and what the area
      // leaves beside the rail and the reserved zone; the CSS in
      // reels-screen.css does the arithmetic. --reel-height is what the
      // viewport leaves after the 16px stage padding (no header here).
      className="reel-stage"
      style={{ "--reel-ar": aspect } as CSSProperties}
    >
      {children}
    </motion.div>
  );
}

/** Loading / error / empty: a stage-sized frame in the stage's place. */
function StateLayout({ stageRef, children }: { stageRef: React.RefObject<HTMLDivElement | null>; children: React.ReactNode }) {
  return (
    <div className="reels-content" data-single-column="">
      <div className="reel-stage-area">
        <div className="reel-stage-cluster">
          <StageFrame stageRef={stageRef} aspect={STAGE_DEFAULT_ASPECT}>
            {children}
          </StageFrame>
          <div className="reel-desktop-rail" aria-hidden="true" />
          <div className="reel-stage-reserve" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

function StateCard({ title, hint, action, icon }: { title: string; hint: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="reel-state-card">
      {icon ?? <Clapperboard className="h-10 w-10 opacity-60" />}
      <h2 className="text-[16px] font-bold">{title}</h2>
      <p className="max-w-xs text-[13px] opacity-70">{hint}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

function NavButton({ label, disabled, onClick, icon }: { label: string; disabled?: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="reel-nav-button">
      {icon}
    </button>
  );
}

/** The body of the "Reel deleted" toast: the title and an Undo that restores it. */
function ReelUndoToast({ onUndo, onFailed }: { onUndo: () => Promise<void>; onFailed: () => void }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  return (
    <div className="flex items-center gap-3 py-3 pl-4 pr-9">
      <p className="min-w-0 flex-1 text-sm font-semibold text-brand-text">{state === "done" ? "Reel restored" : "Reel deleted"}</p>
      {state !== "done" ? (
        <button
          type="button"
          disabled={state === "busy"}
          onClick={async () => {
            setState("busy");
            try {
              await onUndo();
              setState("done");
            } catch {
              setState("idle");
              onFailed();
            }
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-secondary px-3 py-1.5 text-[12px] font-semibold text-brand-text transition hover:bg-brand-divider disabled:opacity-60"
        >
          <Undo2 className="h-3.5 w-3.5" /> {state === "busy" ? "Restoring…" : "Undo"}
        </button>
      ) : null}
    </div>
  );
}

// Used by the phone rail wrapper above; kept for symmetry with the desktop one.
export { patchReelEverywhere };
