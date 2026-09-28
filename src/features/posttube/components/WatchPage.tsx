"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronUp, ListVideo, Loader2 } from "lucide-react";

import ShareDialog from "@/components/ShareDialog";
import { useToast } from "@/components/ui/toast";
import { useDeletePost } from "@/hooks/usePostActions";
import { useToggleLike } from "@/hooks/usePostReaction";
import { useSubmitReport, REPORT_REASONS } from "@/hooks/useReport";
import { useChannelByRef } from "@/hooks/useChannels";
import { useDataSaver } from "@/hooks/useDataSaver";
import { useEntitlement } from "@/hooks/useMonetization";
import { useVideoTracker } from "@/hooks/useVideoTracker";
import { useSeries, useWatchProgress } from "@/hooks/usePosttubeExtras";
import { useAuthUser } from "@/store/auth";
import type { CommentSort } from "@/hooks/usePostComments";

import { ReelAudioTracksDialog } from "@/features/reels/components/ReelAudioTracksDialog";
import { ReelConfirmDialog } from "@/features/reels/components/ReelConfirmDialog";
import { useAudioTracks } from "@/features/reels/hooks/useAudioTracks";
import { mediaHref } from "@/features/reels/model";
import { audioTrackOptions, languageForChoice, ORIGINAL_TRACK_ID, pickAudioTrack } from "@/features/reels/playback/audioTracks";
import { isHistoryPaused, useLovedIds, useQueue } from "@/features/posttube/library";

import { type CaptionTrack, type TubePlayerHandle } from "./TubePlayer";
import { SubscribeButton } from "./SubscribeButton";
import { SaveToPlaylistDialog } from "./SaveToPlaylistDialog";
import { useVideoCategories } from "../hooks/usePosttubeHome";
import { useAutoplayNextPref, useTubePrefs } from "../hooks/useTubePrefs";
import { blockUser, channelAvatarUrl, getSubtitleTracks, getVideoDetail, saveVideoWatchProgress, sendFeedFeedback } from "../data/posttubeApi";
import {
  AUTOPLAY_COUNTDOWN_SECONDS,
  AUTOPLAY_IDLE,
  autoplayReducer,
  COMPLETED_PERCENT,
  formatDuration,
  hlsMasterUrl,
  mediaServeUrl,
  PROGRESS_SAVE_INTERVAL_MS,
  resumePositionMs,
  rowToVideo,
  subtitleTrackUrl,
  type SeriesInfo,
} from "../model";
import { ambientAllowed } from "../watch/ambient";
import { chapterIndexAt } from "../watch/chapters";
import { collectionNeighbours, collectionWatchHref } from "../watch/collectionNav";
import { useCollectionPlayback, useCreatorSupport, useReducedMotion, useStoryboard, useUpNext, useWatchDetail, useWatchPrefs } from "../watch/hooks/useWatch";
import { TubeStage } from "../watch/miniPlayer";
import { RAIL_IDLE, railReducer } from "../watch/railState";
import { showThanks } from "../watch/thanks";
import { upNextPills, type UpNextChip } from "../watch/upNext";
import { downloadHref, sendThanks, setCommentHeart, setCommentPin, setPass, thanksErrorMessage, viewerSubtitleTracks } from "../watch/watchApi";
import { ThanksSheet } from "../watch/components/ThanksSheet";
import { UpNext, type UpNextRow } from "../watch/components/UpNext";
import { WatchComments } from "../watch/components/WatchComments";
import { MembershipCard, WatchDetails } from "../watch/components/WatchDetails";
import { WatchMoreMenu } from "../watch/components/WatchMoreMenu";
import { WatchActions } from "../watch/components/WatchActions";
import "@/features/reels/components/reels-screen.css";
import "./tube.css";
import "../watch/watch.css";

/*
  The watch page in the RUTUBE layout: on the left the player, the title,
  the creator row (Subscribe + bell, Thanks), the action row (Like |
  Dislike, Watch later, Add to collection, ⋯), the about card, the series and the
  comments inline; on the right the Up next list. Theater widens the
  player across both columns. See watch.css for the geometry and
  watchApi.ts for every request.
*/

const UP_NEXT_COUNTDOWN_SECONDS = 5;

/* ── Series list ──────────────────────────────────────── */

function SeriesPanel({ series, currentId }: { series: SeriesInfo; currentId: string }) {
  const [open, setOpen] = useState(true);
  const title = series.series?.title?.trim() || "This series";
  const currentNum = series.current?.episode_num;
  return (
    <section className="mt-4 rounded-xl border border-border bg-brand-card">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3 text-left" aria-expanded={open}>
        <span className="flex items-center gap-2">
          <ListVideo className="h-4 w-4 text-brand-text" />
          <span className="text-[13px] font-bold text-brand-text">In this series · {title}</span>
          {typeof currentNum === "number" ? (
            <span className="text-[12px] text-muted-foreground">
              Episode {currentNum} of {series.episodes.length}
            </span>
          ) : null}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open ? (
        <ol className="max-h-[320px] overflow-y-auto border-t border-border">
          {series.episodes.map((ep) => {
            const isCurrent = ep.post_id === currentId;
            const thumb = ep.thumbnail_url || (ep.cover_media_id ? mediaServeUrl(ep.cover_media_id) : null);
            return (
              <li key={ep.post_id}>
                <Link
                  href={`/posttube/watch/${ep.post_id}`}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`flex items-center gap-3 px-3 py-2 hover:bg-brand-secondary ${isCurrent ? "bg-brand-secondary" : ""}`}
                >
                  <span className="w-6 shrink-0 text-center text-[12px] font-semibold tabular-nums text-muted-foreground">{ep.episode_num}</span>
                  <span className="relative aspect-video w-[96px] shrink-0 overflow-hidden rounded-md bg-brand-secondary">
                    {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`line-clamp-2 text-[13px] leading-tight ${isCurrent ? "font-bold text-primary-ink" : "font-medium text-brand-text"}`}>
                      {ep.title?.trim() || `Episode ${ep.episode_num}`}
                    </span>
                    {typeof ep.duration_ms === "number" && ep.duration_ms > 0 ? (
                      <span className="block text-[11px] text-muted-foreground">{formatDuration(ep.duration_ms / 1000)}</span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}

/* ── Watch page ───────────────────────────────────────── */

interface WatchPageProps {
  videoId?: string;
  /** `?list=<playlistId>`: play through that collection. */
  listId?: string | null;
}

function WatchPageContent({ videoId, listId = null }: WatchPageProps) {
  const router = useRouter();
  const user = useAuthUser();
  const { effective: dataSaver } = useDataSaver();
  const { toast, ToastContainer } = useToast();
  const { prefs, update: updatePrefs } = useTubePrefs();
  const { prefs: watchPrefs, update: updateWatchPrefs } = useWatchPrefs();
  const { on: autoplayNextOn, update: setAutoplayNextOn } = useAutoplayNextPref();
  const reducedMotion = useReducedMotion();

  /* ── data ──────────────────────────────────────────── */
  const detailQuery = useWatchDetail(videoId);
  const detail = detailQuery.data ?? null;
  const video = detail?.video ?? null;

  const videoMetadataQuery = useQuery({
    queryKey: ["posttube", "video-metadata", videoId],
    queryFn: () => getVideoDetail(videoId!),
    enabled: !!videoId,
    staleTime: 60_000,
    retry: false,
  });
  const mediaAssetId = videoMetadataQuery.data?.media_asset_id || detail?.mediaId || undefined;
  const trimStartMs = videoMetadataQuery.data?.trim_start_ms ?? 0;
  const trimEndMs = videoMetadataQuery.data?.trim_end_ms ?? undefined;

  const channelQuery = useChannelByRef(video?.author_id);
  const channel = channelQuery.data ?? null;
  const progressQuery = useWatchProgress(user ? videoId : undefined);
  const seriesQuery = useSeries(videoId);
  const series = seriesQuery.data ?? null;
  const categories = useVideoCategories();
  const collectionQuery = useCollectionPlayback(listId);
  const collection = collectionQuery.data ?? null;

  const [chip, setChip] = useState<UpNextChip>("all");
  const upNextQuery = useUpNext(videoId, chip, detail?.topicSlug ?? null, 16);
  const related = useMemo(() => upNextQuery.data?.pages.flatMap((p) => p.items) ?? [], [upNextQuery.data]);

  const subtitleQuery = useQuery({
    queryKey: ["posttube", "subtitles", mediaAssetId],
    queryFn: () => getSubtitleTracks(mediaAssetId!),
    enabled: !!mediaAssetId,
    staleTime: 60_000,
  });
  const captions = useMemo<CaptionTrack[]>(
    () =>
      viewerSubtitleTracks(subtitleQuery.data).map((t) => ({
        lang: t.language || "en",
        label: (t.language || "en").toUpperCase(),
        src: t.content_url && t.format?.toLowerCase() === "vtt" ? t.content_url : subtitleTrackUrl(mediaAssetId!, t.language || "en"),
      })),
    [subtitleQuery.data, mediaAssetId],
  );

  const storyboardQuery = useStoryboard(mediaAssetId);
  const audioTracksQuery = useAudioTracks(mediaAssetId);
  const audioTracks = useMemo(() => audioTracksQuery.data ?? [], [audioTracksQuery.data]);
  const activeAudioTrack = pickAudioTrack(audioTracks, watchPrefs.audioLanguage);

  const isOwner = !!user && !!video && user.id === video.author_id;
  const gateCreator = detail?.tierRequiredId && !isOwner ? video?.author_id : null;
  const entitlement = useEntitlement(gateCreator, detail?.tierRequiredId ?? null);
  const gated = !!gateCreator && (!user || (entitlement.data ? !entitlement.data.allowed : false));

  const queue = useQueue();
  const lovedIds = useLovedIds();

  /* Thanks: only for a creator with tips on, never on your own video (the read is skipped then). */
  const supportQuery = useCreatorSupport(video && !isOwner ? video.author_id : null);
  const support = supportQuery.data ?? null;
  const thanksVisible = showThanks(support, user?.id ?? null, video?.author_id ?? null);

  /* ── playback urls ─────────────────────────────────── */
  const hlsUrl = mediaAssetId ? hlsMasterUrl(mediaAssetId) : null;
  const fileUrl = videoMetadataQuery.data?.playback_url || video?.video_url || (mediaAssetId ? mediaServeUrl(mediaAssetId) : "");
  const startPositionMs = resumePositionMs(progressQuery.data);
  const startReady = !user || !progressQuery.isLoading;

  /* ── progress + telemetry ──────────────────────────── */
  const latestRef = useRef({ positionMs: 0, durationMs: 0 });
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const lastSavedRef = useRef(-1);
  const [ended, setEnded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [chapterIndex, setChapterIndex] = useState(-1);
  const chaptersRef = useRef(detail?.chapters ?? []);
  chaptersRef.current = detail?.chapters ?? [];

  const trackingDurationMs = Math.max(0, Math.round((video?.duration_seconds ?? 0) * 1000));
  const tracker = useVideoTracker({
    contentId: video?.id ?? "",
    creatorId: video?.author_id ?? "",
    contentType: "long_video",
    contentDurationMs: trackingDurationMs,
    surface: "posttube_watch",
    position: 0,
    isAutoplay: !dataSaver,
  });
  const trackerRef = useRef(tracker);
  trackerRef.current = tracker;

  const persist = useCallback(
    (opts?: { completed?: boolean; force?: boolean }) => {
      if (!video?.id || !user) return;
      if (isHistoryPaused()) return;
      const { positionMs, durationMs } = latestRef.current;
      if (durationMs <= 0 || positionMs <= 0) return;
      if (!opts?.force && Math.abs(positionMs - lastSavedRef.current) < 1000) return;
      lastSavedRef.current = positionMs;
      const completed = opts?.completed ?? positionMs / durationMs >= COMPLETED_PERCENT / 100;
      void saveVideoWatchProgress(video.id, { positionMs, durationMs, completed }).catch(() => undefined);
    },
    [user, video?.id],
  );

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => persist(), PROGRESS_SAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPlaying, persist]);

  useEffect(() => {
    return () => {
      if (!startedRef.current || finishedRef.current) return;
      persist({ force: true });
      trackerRef.current.onPlayEnd("navigate_away");
    };
  }, [persist]);

  const onPlay = useCallback(() => {
    setIsPlaying(true);
    if (!startedRef.current) {
      startedRef.current = true;
      finishedRef.current = false;
      trackerRef.current.onPlayStart();
    }
  }, []);

  const onPause = useCallback(
    (positionMs: number, durationMs: number) => {
      setIsPlaying(false);
      latestRef.current = { positionMs, durationMs };
      persist({ force: true });
    },
    [persist],
  );

  const onTimeUpdate = useCallback((positionMs: number, durationMs: number) => {
    latestRef.current = { positionMs, durationMs };
    trackerRef.current.onTimeUpdate(positionMs);
    const idx = chapterIndexAt(chaptersRef.current, positionMs);
    setChapterIndex((cur) => (cur === idx ? cur : idx));
  }, []);

  /* ── what "next" is ────────────────────────────────── */
  const neighbours = useMemo(() => collectionNeighbours(collection?.ids ?? [], video?.id ?? ""), [collection, video?.id]);
  const collectionRows = useMemo<UpNextRow[]>(
    () =>
      (collection?.items ?? [])
        .filter((it) => !!it.post)
        .map((it, i) => ({
          video: rowToVideo(it.post!),
          href: collectionWatchHref(it.postId, collection!.collection.id),
          position: i + 1,
          current: it.postId === video?.id,
        })),
    [collection, video?.id],
  );
  const nextTarget = useMemo(() => {
    if (collection && neighbours.next && neighbours.next !== video?.id) {
      const row = collectionRows.find((r) => r.video.id === neighbours.next);
      return { href: collectionWatchHref(neighbours.next, collection.collection.id), label: row?.video.title ?? "Next in collection", kind: "collection" as const };
    }
    if (series?.next) {
      const ep = series.episodes.find((e) => e.post_id === series.next!.post_id);
      return { href: `/posttube/watch/${series.next.post_id}`, label: `Episode ${series.next.episode_num}${ep?.title ? ` · ${ep.title}` : ""}`, kind: "series" as const };
    }
    const first = related[0];
    if (first) return { href: `/posttube/watch/${first.id}`, label: first.title, kind: "related" as const };
    return null;
  }, [collection, neighbours.next, video?.id, collectionRows, series, related]);
  const nextTargetRef = useRef(nextTarget);
  nextTargetRef.current = nextTarget;

  const goNext = useCallback(() => {
    const t = nextTargetRef.current;
    if (t) router.push(t.href);
  }, [router]);

  /* ── autoplay next ─────────────────────────────────── */
  const [autoplay, dispatch] = useReducer(autoplayReducer, AUTOPLAY_IDLE);
  const sleepFiredRef = useRef(false);

  const onEnded = useCallback(
    (positionMs: number, durationMs: number) => {
      setIsPlaying(false);
      latestRef.current = { positionMs, durationMs };
      if (startedRef.current && !finishedRef.current) {
        finishedRef.current = true;
        trackerRef.current.onPlayEnd("ended");
      }
      persist({ completed: true, force: true });
      const t = nextTargetRef.current;
      if (t && autoplayNextOn && !sleepFiredRef.current) {
        dispatch({ type: "start", seconds: t.kind === "series" ? AUTOPLAY_COUNTDOWN_SECONDS : UP_NEXT_COUNTDOWN_SECONDS });
      }
    },
    [autoplayNextOn, persist],
  );

  const onSleep = useCallback(() => {
    sleepFiredRef.current = true;
    dispatch({ type: "cancel" });
    toast({ type: "info", title: "Sleep timer", description: "Playback paused." });
  }, [toast]);

  useEffect(() => {
    if (autoplay.status !== "counting") return;
    const id = setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => clearInterval(id);
  }, [autoplay.status]);

  useEffect(() => {
    if (autoplay.status === "fired") goNext();
  }, [autoplay.status, goNext]);

  const onEndedChange = useCallback((next: boolean) => {
    setEnded(next);
    if (!next) {
      dispatch({ type: "reset" });
      sleepFiredRef.current = false;
    }
  }, []);

  /* ── rail state (love / pass exclusive) ────────────── */
  const [rail, railDispatch] = useReducer(railReducer, RAIL_IDLE);
  const railRef = useRef(rail);
  railRef.current = rail;
  useEffect(() => {
    if (!detail) return;
    railDispatch({ type: "sync", loved: detail.video.viewer_has_liked, passed: detail.viewerDisliked, likeCount: detail.likeCount });
  }, [detail]);

  const likeMutation = useToggleLike();
  const reportMutation = useSubmitReport();
  const deleteMutation = useDeletePost();

  const [followerCount, setFollowerCount] = useState(0);
  useEffect(() => {
    if (video) setFollowerCount(video.channel_subscriber_count);
  }, [video]);
  useEffect(() => {
    if (channel) setFollowerCount(channel.subscriber_count ?? 0);
  }, [channel]);

  const [theater, setTheater] = useState(false);
  const [miniOn, setMiniOn] = useState(false);
  const [commentSort, setCommentSort] = useState<CommentSort>("top");
  const [shareOpen, setShareOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockPending, setBlockPending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [audioDialogOpen, setAudioDialogOpen] = useState(false);
  const [thanksOpen, setThanksOpen] = useState(false);
  const [thanksPending, setThanksPending] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const playerRef = useRef<TubePlayerHandle | null>(null);

  const toggleTheater = useCallback(() => setTheater((t) => !t), []);
  const toggleMini = useCallback(() => setMiniOn((m) => !m), []);

  const requireUser = useCallback(() => {
    if (user) return true;
    toast({ type: "info", title: "Sign in", description: "Sign in to do that." });
    return false;
  }, [toast, user]);

  const handleLove = () => {
    if (!video || !requireUser()) return;
    const prev = railRef.current;
    railDispatch({ type: "love" });
    likeMutation.mutate(video.id, {
      onSuccess: (r) => {
        railDispatch({ type: "settle-love", loved: r.liked, likeCount: r.count });
        lovedIds.invalidate();
      },
      onError: () => railDispatch({ type: "revert", state: prev }),
    });
  };

  const handlePass = () => {
    if (!video || !requireUser()) return;
    const prev = railRef.current;
    railDispatch({ type: "pass" });
    setPass(video.id, !prev.passed)
      .then(() => {
        if (prev.loved) lovedIds.invalidate();
      })
      .catch(() => {
        railDispatch({ type: "revert", state: prev });
        toast({ type: "error", title: "Could not save that" });
      });
  };

  const handleQueue = async () => {
    if (!video || !requireUser()) return;
    const ok = await queue.toggle(video.id, detail?.viewerQueued);
    if (!ok) toast({ type: "error", title: "Could not update Watch later" });
  };

  const notInterested = async () => {
    if (!video || !requireUser()) return;
    try {
      await sendFeedFeedback({ post_id: video.id, signal: "not_interested" });
      toast({ type: "success", title: "Got it", description: "We'll show fewer videos like this." });
    } catch {
      toast({ type: "error", title: "Could not save that" });
    }
  };

  const dontRecommend = async () => {
    if (!video || !requireUser()) return;
    try {
      await sendFeedFeedback({ author_id: video.author_id, signal: "not_interested" });
      toast({ type: "success", title: "Got it", description: `We won't recommend ${video.channel_name} any more.` });
    } catch {
      toast({ type: "error", title: "Could not save that" });
    }
  };

  const confirmBlock = async () => {
    if (!video) return;
    setBlockPending(true);
    try {
      await blockUser(video.author_id);
      setBlockOpen(false);
      toast({ type: "success", title: "Blocked", description: `${video.channel_name} can no longer reach you.` });
      router.push("/posttube");
    } catch {
      toast({ type: "error", title: "Could not block" });
    } finally {
      setBlockPending(false);
    }
  };

  const confirmDelete = async () => {
    if (!video) return;
    try {
      await deleteMutation.mutateAsync(video.id);
      setDeleteOpen(false);
      toast({ type: "success", title: "Deleted" });
      router.push("/posttube/hub/library");
    } catch {
      toast({ type: "error", title: "Could not delete" });
    }
  };

  const closeThanks = useCallback(() => setThanksOpen(false), []);
  const submitThanks = async ({ amountPaise, message }: { amountPaise: number; message: string }) => {
    if (!video || thanksPending) return;
    setThanksPending(true);
    try {
      await sendThanks({ creatorId: video.author_id, postId: video.id, amountPaise, message });
      setThanksOpen(false);
      toast({ type: "success", title: "Thanks sent" });
    } catch (err) {
      toast({ type: "error", title: "Could not send", description: thanksErrorMessage(err) });
    } finally {
      setThanksPending(false);
    }
  };

  const creatorTools = useMemo(() => ({ onHeart: setCommentHeart, onPin: setCommentPin }), []);

  /* ── render ────────────────────────────────────────── */
  if (videoId && detailQuery.isLoading) {
    return (
      <div className="tube-watch">
        <div className="tube-watch__grid">
          <div className="tube-watch__player">
            <div className="tube-stage flex items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-white/60" />
            </div>
          </div>
          <div className="tube-watch__primary">
            <div className="h-6 w-2/3 animate-pulse rounded bg-brand-secondary" />
            <div className="mt-3 h-10 w-full animate-pulse rounded bg-brand-secondary" />
          </div>
        </div>
      </div>
    );
  }

  if (!video || !detail) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h2 className="text-[18px] font-bold text-brand-text">{videoId ? "Video not found" : "No video selected"}</h2>
        <p className="mt-2 text-[13px] text-muted-foreground">
          {videoId ? "This video may still be processing or has been removed." : "Browse PostTube to find videos to watch."}
        </p>
        <Link href="/posttube" className="mt-5 rounded-full bg-primary-ink px-5 py-2.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary-hover">
          Back to Watch
        </Link>
      </div>
    );
  }

  const channelName = channel?.name || video.channel_name;
  const channelHandle = channel?.handle || video.channel_handle;
  const channelAvatar = channelAvatarUrl(channel) || video.channel_avatar_url;
  const channelHref = channelHandle ? `/posttube/channel/${encodeURIComponent(channelHandle)}` : `/posttube/channel/${video.author_id}`;
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/posttube/watch/${video.id}` : undefined;
  const topic = detail.topicSlug
    ? { slug: detail.topicSlug, label: categories.data?.find((c) => c.slug === detail.topicSlug)?.label ?? detail.topicSlug }
    : null;
  const keepHref = mediaAssetId && (detail.allowDownload || isOwner) ? downloadHref(mediaAssetId) : null;
  const queued = queue.queued(video.id, detail.viewerQueued);
  const ambient = ambientAllowed({ pref: watchPrefs.ambient, reducedMotion, theater, fullscreen: false });
  const audioOptions = audioTrackOptions(audioTracks);
  const sourceOverride = activeAudioTrack?.playback_url ? mediaHref(activeAudioTrack.playback_url) : null;

  const countdownActive = ended && autoplay.status === "counting" && !!nextTarget;
  const countdownTotal = nextTarget?.kind === "series" ? AUTOPLAY_COUNTDOWN_SECONDS : UP_NEXT_COUNTDOWN_SECONDS;
  const endScreen = (
    <div className="w-full text-center">
      {countdownActive && nextTarget ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-[12px] uppercase tracking-wider opacity-70">Up next in {autoplay.remaining}s</p>
          <p className="text-[15px] font-semibold">{nextTarget.label}</p>
          <div className="h-1 w-56 overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full bg-brand-accent transition-all duration-1000"
              style={{ width: `${((countdownTotal - autoplay.remaining) / countdownTotal) * 100}%` }}
            />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => dispatch({ type: "cancel" })} className="rounded-full border border-white/50 px-4 py-2 text-[13px] font-semibold hover:bg-white/10">
              Cancel
            </button>
            <button type="button" onClick={() => dispatch({ type: "playNow" })} className="rounded-full bg-brand-accent px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90">
              Play now
            </button>
          </div>
        </div>
      ) : nextTarget ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-[12px] uppercase tracking-wider opacity-70">Up next</p>
          <Link href={nextTarget.href} className="rounded-full bg-brand-accent px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90">
            {nextTarget.label}
          </Link>
        </div>
      ) : null}
    </div>
  );

  const upNextNode = collection ? (
    <UpNext
      rows={collectionRows}
      loading={collectionQuery.isLoading}
      collection={{ id: collection.collection.id, title: collection.collection.title, index: neighbours.index, count: neighbours.count, prev: neighbours.prev, next: neighbours.next }}
    />
  ) : (
    <UpNext
      rows={related.map((v) => ({ video: v, href: `/posttube/watch/${v.id}` }))}
      loading={upNextQuery.isLoading}
      hasMore={!!upNextQuery.hasNextPage}
      fetchingMore={upNextQuery.isFetchingNextPage}
      onMore={() => void upNextQuery.fetchNextPage()}
      pills={upNextPills(topic)}
      chip={chip}
      onChip={setChip}
    />
  );

  const moreMenu = (
    <WatchMoreMenu
      open={moreOpen}
      onClose={() => setMoreOpen(false)}
      isOwner={isOwner}
      channelName={channelName}
      onShare={detail.shareHidden ? undefined : () => setShareOpen(true)}
      onKeep={keepHref ? () => window.open(keepHref, "_blank", "noopener") : undefined}
      onNotInterested={() => void notInterested()}
      onDontRecommend={() => void dontRecommend()}
      onReport={() => {
        if (!requireUser()) return;
        setReportOpen(true);
        setReportSubmitted(false);
        setReportReason("");
      }}
      onBlock={() => requireUser() && setBlockOpen(true)}
      onEdit={() => router.push(`/posttube/hub/library?edit=${encodeURIComponent(video.id)}`)}
      onAudioTracks={() => setAudioDialogOpen(true)}
      onDelete={() => setDeleteOpen(true)}
    />
  );

  const actions = (
    <WatchActions
      loved={rail.loved}
      likeCount={rail.likeCount}
      passed={rail.passed}
      queued={queued}
      onLove={handleLove}
      onPass={handlePass}
      onQueue={() => void handleQueue()}
      onAdd={() => requireUser() && setPlaylistOpen(true)}
      onMore={() => setMoreOpen((o) => !o)}
      moreOpen={moreOpen}
      moreMenu={moreMenu}
    />
  );

  return (
    <div className="tube-watch" data-theater={theater ? "" : undefined}>
      <div className="tube-watch__grid">
        <div className="tube-watch__player">
          {gated ? (
            <MembershipCard channelName={channelName} poster={video.thumbnail_url || undefined} />
          ) : (
            <TubeStage
              miniplayerOn={miniOn}
              returnHref={collectionWatchHref(video.id, listId)}
              videoId={video.id}
              hlsUrl={hlsUrl}
              fileUrl={fileUrl}
              poster={video.thumbnail_url || undefined}
              captions={captions}
              startPositionMs={startPositionMs}
              startReady={startReady}
              autoPlay={!dataSaver}
              deferLoad={dataSaver}
              trimStartMs={trimStartMs}
              trimEndMs={trimEndMs}
              prefs={prefs}
              onPrefsChange={updatePrefs}
              autoplayNext={{ on: autoplayNextOn, onChange: setAutoplayNextOn }}
              onPlay={onPlay}
              onPause={onPause}
              onTimeUpdate={onTimeUpdate}
              onEnded={onEnded}
              endScreen={endScreen}
              ended={ended}
              onEndedChange={onEndedChange}
              onTheater={toggleTheater}
              theater={theater}
              onMiniplayer={toggleMini}
              miniplayer={miniOn}
              onNext={nextTarget ? goNext : undefined}
              chapters={detail.chapters}
              storyboard={storyboardQuery.data ?? null}
              ambient={ambient}
              onAmbientChange={(on) => updateWatchPrefs({ ambient: on })}
              stableVolume={watchPrefs.stableVolume}
              onStableVolumeChange={(on) => updateWatchPrefs({ stableVolume: on })}
              audioTracks={{
                options: audioOptions,
                current: activeAudioTrack?.id ?? ORIGINAL_TRACK_ID,
                onChange: (id) => updateWatchPrefs({ audioLanguage: languageForChoice(audioTracks, id) }),
                onManage: isOwner && mediaAssetId ? () => setAudioDialogOpen(true) : undefined,
              }}
              sourceOverride={sourceOverride}
              onSleep={onSleep}
              controller={playerRef}
            />
          )}
        </div>

        <div className="tube-watch__primary">
          <WatchDetails
            title={video.title}
            authorId={video.author_id}
            channelName={channelName}
            channelAvatar={channelAvatar}
            channelHref={channelHref}
            followerCount={followerCount}
            onThanks={thanksVisible ? () => requireUser() && setThanksOpen(true) : undefined}
            actions={actions}
            follow={
              <SubscribeButton
                channelRef={video.author_id}
                initialSubscribed={channel?.is_subscribed ?? video.viewer_has_subscribed}
                initialNotifyOn={channel?.notify_on ?? null}
                hidden={isOwner || !user}
                size="md"
                labels={{ off: "Subscribe", on: "Subscribed" }}
                onSubscribedChange={(s) => setFollowerCount((c) => Math.max(0, c + (s ? 1 : -1)))}
              />
            }
            topic={topic}
            viewCount={video.view_count}
            publishedAt={video.published_at}
            source={detail.source}
            resumedAtMs={startPositionMs}
            chapters={detail.chapters}
            currentChapter={chapterIndex}
            onSeek={(ms) => playerRef.current?.seekTo(ms)}
            description={video.description}
            hashtags={video.hashtags}
          />

          {series && series.episodes.length > 0 ? <SeriesPanel series={series} currentId={video.id} /> : null}

          <WatchComments
            postId={video.id}
            authorId={video.author_id}
            count={video.comment_count}
            commentsOff={detail.commentsOff}
            sort={commentSort}
            onSort={setCommentSort}
            creatorTools={creatorTools}
          />
        </div>

        <aside className="tube-watch__side" aria-label="Up next">
          {upNextNode}
        </aside>
      </div>

      <ShareDialog postId={video.id} isOpen={shareOpen} onClose={() => setShareOpen(false)} shareUrl={shareUrl} />
      <SaveToPlaylistDialog open={playlistOpen} postId={video.id} onClose={() => setPlaylistOpen(false)} />
      {support && thanksVisible ? (
        <ThanksSheet open={thanksOpen} channelName={channelName} support={support} pending={thanksPending} onSend={(input) => void submitThanks(input)} onCancel={closeThanks} />
      ) : null}
      {mediaAssetId ? <ReelAudioTracksDialog open={audioDialogOpen} mediaId={mediaAssetId} onClose={() => setAudioDialogOpen(false)} /> : null}
      <ReelConfirmDialog
        open={blockOpen}
        title={`Block ${channelName}?`}
        description="They won't be able to message you, comment on your posts, or see your content. You won't see their videos any more."
        confirmLabel="Block"
        danger
        pending={blockPending}
        onConfirm={() => void confirmBlock()}
        onCancel={() => setBlockOpen(false)}
      />
      <ReelConfirmDialog
        open={deleteOpen}
        title="Delete this video?"
        description="It disappears from your channel, every collection and every feed. This cannot be undone."
        confirmLabel="Delete"
        danger
        pending={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteOpen(false)}
      />

      {reportOpen ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs" onClick={() => setReportOpen(false)} role="presentation">
          <div className="w-full max-w-[380px] overflow-hidden rounded-2xl border border-border bg-brand-card shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            {reportSubmitted ? (
              <div className="p-6 text-center">
                <h3 className="text-[15px] font-bold text-brand-text">Report submitted</h3>
                <p className="mt-1 text-[13px] text-muted-foreground">Our team will review this content shortly.</p>
                <button type="button" onClick={() => setReportOpen(false)} className="mt-4 w-full rounded-full bg-primary-ink py-2.5 text-[13px] font-semibold text-primary-foreground">
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                  <h3 className="text-[14px] font-bold text-brand-text">Report video</h3>
                  <button type="button" onClick={() => setReportOpen(false)} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-brand-secondary">
                    ×
                  </button>
                </div>
                <div className="px-5 py-4">
                  <p className="mb-3 text-[12px] text-muted-foreground">Why are you reporting this?</p>
                  <div className="space-y-1.5">
                    {REPORT_REASONS.map((reason) => (
                      <button
                        key={reason.value}
                        type="button"
                        onClick={() => setReportReason(reason.value)}
                        className={`w-full rounded-xl px-3.5 py-2.5 text-left text-[13px] transition ${
                          reportReason === reason.value ? "bg-primary-ink font-medium text-primary-foreground" : "bg-brand-secondary text-brand-text hover:bg-brand-divider"
                        }`}
                      >
                        {reason.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-border px-5 py-3">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!reportReason) return;
                      await reportMutation.mutateAsync({
                        targetType: "video",
                        targetId: video.id,
                        reason: reportReason as Parameters<typeof reportMutation.mutateAsync>[0]["reason"],
                      });
                      setReportSubmitted(true);
                    }}
                    disabled={!reportReason || reportMutation.isPending}
                    className="w-full rounded-full bg-danger py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-40"
                  >
                    {reportMutation.isPending ? "Submitting..." : "Submit report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      <ToastContainer />
    </div>
  );
}

export function WatchPage({ videoId, listId }: WatchPageProps) {
  return <WatchPageContent key={`${videoId ?? "posttube-watch"}:${listId ?? ""}`} videoId={videoId} listId={listId ?? null} />;
}
