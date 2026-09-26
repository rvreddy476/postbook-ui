"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Ban,
  Bookmark,
  ChevronDown,
  ChevronUp,
  EyeOff,
  Flag,
  Link2,
  ListPlus,
  ListVideo,
  Loader2,
  MoreHorizontal,
  Share2,
  ThumbsUp,
  UserX,
} from "lucide-react";

import { Avatar } from "@/components/LetterAvatar";
import CommentSection from "@/components/CommentSection";
import ShareDialog from "@/components/ShareDialog";
import { useToast } from "@/components/ui/toast";
import { useToggleBookmark } from "@/hooks/usePostActions";
import { useToggleLike } from "@/hooks/usePostReaction";
import { useSubmitReport, REPORT_REASONS } from "@/hooks/useReport";
import { useChannelByRef } from "@/hooks/useChannels";
import { useDataSaver } from "@/hooks/useDataSaver";
import { useVideoTracker } from "@/hooks/useVideoTracker";
import { useSeries, useWatchProgress } from "@/hooks/usePosttubeExtras";
import { useAuthUser } from "@/store/auth";

import { TubePlayer, type CaptionTrack } from "./TubePlayer";
import { SubscribeButton } from "./SubscribeButton";
import { ConfirmDialog } from "./ConfirmDialog";
import { SaveToPlaylistDialog } from "./SaveToPlaylistDialog";
import { useRelatedVideos } from "../hooks/usePosttubeHome";
import { useAutoplayNextPref, useTubePrefs } from "../hooks/useTubePrefs";
import {
  blockUser,
  channelAvatarUrl,
  getSubtitleTracks,
  getVideoDetail,
  getVideoPost,
  saveVideoWatchProgress,
  sendFeedFeedback,
} from "../data/posttubeApi";
import {
  AUTOPLAY_IDLE,
  autoplayReducer,
  COMPLETED_PERCENT,
  formatCount,
  formatDuration,
  hlsMasterUrl,
  mediaServeUrl,
  PROGRESS_SAVE_INTERVAL_MS,
  resumePositionMs,
  subtitleTrackUrl,
  timeAgo,
  type SeriesInfo,
} from "../model";
import type { PostTubeVideo } from "../types";

/* ── Related card ─────────────────────────────────────── */

function RelatedCard({ video }: { video: PostTubeVideo }) {
  return (
    <Link href={`/posttube/watch/${video.id}`} className="group flex gap-2">
      <div className="relative aspect-video w-[168px] shrink-0 overflow-hidden rounded-lg bg-brand-secondary">
        {video.thumbnail_url ? (
          <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full bg-primary-ink/80" />
        )}
        {video.duration_seconds > 0 ? (
          <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-medium text-white">
            {formatDuration(video.duration_seconds)}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <h4 className="line-clamp-2 text-[13px] font-semibold leading-tight text-brand-text group-hover:text-primary-ink">{video.title}</h4>
        <p className="mt-1 text-[11px] text-muted-foreground">{video.channel_name}</p>
        <p className="text-[11px] text-muted-foreground">
          {formatCount(video.view_count)} views · {timeAgo(video.published_at)}
        </p>
      </div>
    </Link>
  );
}

/* ── Series list ──────────────────────────────────────── */

function SeriesPanel({ series, currentId }: { series: SeriesInfo; currentId: string }) {
  const [open, setOpen] = useState(true);
  const title = series.series?.title?.trim() || "This series";
  const currentNum = series.current?.episode_num;
  return (
    <section className="rounded-xl border border-border bg-brand-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
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
}

function WatchPageContent({ videoId }: WatchPageProps) {
  const router = useRouter();
  const user = useAuthUser();
  const { effective: dataSaver } = useDataSaver();
  const { toast, ToastContainer } = useToast();
  const { prefs, update: updatePrefs } = useTubePrefs();
  const { on: autoplayNextOn, update: setAutoplayNextOn } = useAutoplayNextPref();

  /* ── data ──────────────────────────────────────────── */
  const videoQuery = useQuery({
    queryKey: ["posttube", "video", videoId],
    queryFn: () => getVideoPost(videoId!),
    enabled: !!videoId,
    staleTime: 60_000,
  });
  const video = videoQuery.data ?? null;

  const videoMetadataQuery = useQuery({
    queryKey: ["posttube", "video-metadata", videoId],
    queryFn: () => getVideoDetail(videoId!),
    enabled: !!videoId,
    staleTime: 60_000,
    retry: false,
  });
  const mediaAssetId = videoMetadataQuery.data?.media_asset_id;
  const trimStartMs = videoMetadataQuery.data?.trim_start_ms ?? 0;
  const trimEndMs = videoMetadataQuery.data?.trim_end_ms ?? undefined;

  const channelQuery = useChannelByRef(video?.author_id);
  const channel = channelQuery.data ?? null;
  const progressQuery = useWatchProgress(user ? videoId : undefined);
  const seriesQuery = useSeries(videoId);
  const series = seriesQuery.data ?? null;
  const relatedQuery = useRelatedVideos(videoId, 16);
  const related = relatedQuery.data?.pages.flatMap((p) => p.items) ?? [];

  const subtitleQuery = useQuery({
    queryKey: ["posttube", "subtitles", mediaAssetId],
    queryFn: () => getSubtitleTracks(mediaAssetId!),
    enabled: !!mediaAssetId,
    staleTime: 60_000,
  });
  const captions = useMemo<CaptionTrack[]>(
    () =>
      (subtitleQuery.data ?? []).map((t) => ({
        lang: t.language || "en",
        label: (t.language || "en").toUpperCase(),
        src: t.content_url && t.format?.toLowerCase() === "vtt" ? t.content_url : subtitleTrackUrl(mediaAssetId!, t.language || "en"),
      })),
    [subtitleQuery.data, mediaAssetId],
  );

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
  // useVideoTracker returns a fresh object each render; read it through a ref
  // so the player callbacks (and its listener effect) stay stable.
  const trackerRef = useRef(tracker);
  trackerRef.current = tracker;

  const persist = useCallback(
    (opts?: { completed?: boolean; force?: boolean }) => {
      if (!video?.id || !user) return;
      const { positionMs, durationMs } = latestRef.current;
      if (durationMs <= 0 || positionMs <= 0) return;
      if (!opts?.force && Math.abs(positionMs - lastSavedRef.current) < 1000) return;
      lastSavedRef.current = positionMs;
      const completed = opts?.completed ?? positionMs / durationMs >= COMPLETED_PERCENT / 100;
      void saveVideoWatchProgress(video.id, { positionMs, durationMs, completed }).catch(() => undefined);
    },
    [user, video?.id],
  );

  // Every 10 s while playing.
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => persist(), PROGRESS_SAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPlaying, persist]);

  // On unmount (navigation to the next video, closing the page).
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

  const onTimeUpdate = useCallback(
    (positionMs: number, durationMs: number) => {
      latestRef.current = { positionMs, durationMs };
      trackerRef.current.onTimeUpdate(positionMs);
    },
    [],
  );

  /* ── autoplay next episode ─────────────────────────── */
  const [autoplay, dispatch] = useReducer(autoplayReducer, AUTOPLAY_IDLE);
  const nextEpisodeId = series?.next?.post_id ?? null;
  const nextEpisode = useMemo(
    () => (series && series.next ? series.episodes.find((e) => e.post_id === series.next!.post_id) ?? null : null),
    [series],
  );

  const onEnded = useCallback(
    (positionMs: number, durationMs: number) => {
      setIsPlaying(false);
      latestRef.current = { positionMs, durationMs };
      if (startedRef.current && !finishedRef.current) {
        finishedRef.current = true;
        trackerRef.current.onPlayEnd("ended");
      }
      persist({ completed: true, force: true });
      if (nextEpisodeId && autoplayNextOn) dispatch({ type: "start" });
    },
    [autoplayNextOn, nextEpisodeId, persist],
  );

  useEffect(() => {
    if (autoplay.status !== "counting") return;
    const id = setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => clearInterval(id);
  }, [autoplay.status]);

  useEffect(() => {
    if (autoplay.status === "fired" && nextEpisodeId) {
      router.push(`/posttube/watch/${nextEpisodeId}`);
    }
  }, [autoplay.status, nextEpisodeId, router]);

  const onEndedChange = useCallback((next: boolean) => {
    setEnded(next);
    if (!next) dispatch({ type: "reset" });
  }, []);

  /* ── engagement ────────────────────────────────────── */
  const likeMutation = useToggleLike();
  const bookmarkMutation = useToggleBookmark();
  const reportMutation = useSubmitReport();

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockPending, setBlockPending] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitted, setReportSubmitted] = useState(false);

  useEffect(() => {
    if (!video) return;
    setLiked(video.viewer_has_liked);
    setLikeCount(video.like_count);
    setSaved(video.viewer_has_saved);
    setSubscriberCount(video.channel_subscriber_count);
  }, [video]);

  useEffect(() => {
    if (channel) setSubscriberCount(channel.subscriber_count ?? 0);
  }, [channel]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("[data-more-menu]")) return;
      setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

  const requireUser = useCallback(() => {
    if (user) return true;
    toast({ type: "info", title: "Sign in", description: "Sign in to do that." });
    return false;
  }, [toast, user]);

  const handleLike = () => {
    if (!video || !requireUser()) return;
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount(Math.max(0, prevCount + (prevLiked ? -1 : 1)));
    likeMutation.mutate(video.id, {
      onSuccess: (r) => {
        setLiked(r.liked);
        setLikeCount(r.count);
      },
      onError: () => {
        setLiked(prevLiked);
        setLikeCount(prevCount);
      },
    });
  };

  const handleSave = () => {
    if (!video || !requireUser()) return;
    const prev = saved;
    setSaved(!prev);
    bookmarkMutation.mutate(video.id, {
      onSuccess: (r) => setSaved(r.bookmarked),
      onError: () => setSaved(prev),
    });
  };

  const copyLink = async () => {
    setMoreOpen(false);
    const url = `${window.location.origin}/posttube/watch/${video?.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ type: "success", title: "Link copied" });
    } catch {
      toast({ type: "error", title: "Could not copy", description: url });
    }
  };

  const notInterested = async () => {
    setMoreOpen(false);
    if (!video || !requireUser()) return;
    try {
      await sendFeedFeedback({ post_id: video.id, signal: "not_interested" });
      toast({ type: "success", title: "Got it", description: "We'll show fewer videos like this." });
    } catch {
      toast({ type: "error", title: "Could not save that" });
    }
  };

  const dontRecommend = async () => {
    setMoreOpen(false);
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

  /* ── render ────────────────────────────────────────── */
  if (videoId && videoQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1720px] px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-6 xl:flex-row">
          <div className="min-w-0 flex-1 xl:max-w-[1280px]">
            <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-black">
              <Loader2 className="h-10 w-10 animate-spin text-white/60" />
            </div>
            <div className="mt-4 h-6 w-2/3 animate-pulse rounded bg-brand-secondary" />
            <div className="mt-3 h-12 w-full animate-pulse rounded bg-brand-secondary" />
          </div>
          <aside className="w-full xl:w-[400px] xl:shrink-0">
            <RelatedSkeleton />
          </aside>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h2 className="text-[18px] font-bold text-brand-text">{videoId ? "Video not found" : "No video selected"}</h2>
        <p className="mt-2 text-[13px] text-muted-foreground">
          {videoId ? "This video may still be processing or has been removed." : "Browse PostTube to find videos to watch."}
        </p>
        <Link href="/posttube" className="mt-5 rounded-full bg-primary-ink px-5 py-2.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary-hover">
          Back to PostTube
        </Link>
      </div>
    );
  }

  const isOwnChannel = !!user && user.id === video.author_id;
  const channelName = channel?.name || video.channel_name;
  const channelHandle = channel?.handle || video.channel_handle;
  const channelAvatar = channelAvatarUrl(channel) || video.channel_avatar_url;
  const channelHref = channelHandle ? `/posttube/channel/${encodeURIComponent(channelHandle)}` : `/posttube/channel/${video.author_id}`;
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/posttube/watch/${video.id}` : undefined;
  const description = video.description ?? "";
  const descriptionLong = description.split(/\r?\n/).length > 3 || description.length > 220;

  const countdownActive = ended && autoplay.status === "counting" && !!nextEpisode;
  const endScreen = (
    <div className="w-full text-center text-white">
      {countdownActive && nextEpisode ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-[12px] uppercase tracking-wider text-white/70">Up next in {autoplay.remaining}s</p>
          <p className="text-[16px] font-bold">
            Episode {nextEpisode.episode_num}
            {nextEpisode.title ? ` · ${nextEpisode.title}` : ""}
          </p>
          <div className="h-1 w-56 overflow-hidden rounded-full bg-white/25">
            <div className="h-full bg-brand-accent transition-all duration-1000" style={{ width: `${((10 - autoplay.remaining) / 10) * 100}%` }} />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: "cancel" })}
              className="rounded-full border border-white/50 px-4 py-2 text-[13px] font-semibold text-white hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "playNow" })}
              className="rounded-full bg-brand-accent px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90"
            >
              Play now
            </button>
          </div>
        </div>
      ) : nextEpisode && autoplay.status === "cancelled" ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-[12px] uppercase tracking-wider text-white/70">Next episode</p>
          <Link href={`/posttube/watch/${nextEpisode.post_id}`} className="rounded-full bg-brand-accent px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90">
            Play episode {nextEpisode.episode_num}
          </Link>
        </div>
      ) : related.length > 0 ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-[12px] uppercase tracking-wider text-white/70">Up next</p>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
            {related.slice(0, 3).map((r) => (
              <Link key={r.id} href={`/posttube/watch/${r.id}`} className="group text-left">
                <div className="relative aspect-video overflow-hidden rounded-lg bg-white/10">
                  {r.thumbnail_url ? <img src={r.thumbnail_url} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <p className="mt-1 line-clamp-2 text-[12px] font-semibold leading-tight text-white group-hover:underline">{r.title}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1720px] px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-6 xl:flex-row">
        {/* Main column */}
        <div className="min-w-0 flex-1 xl:max-w-[1280px]">
          <TubePlayer
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
            autoplayNext={series ? { on: autoplayNextOn, onChange: setAutoplayNextOn } : null}
            onPlay={onPlay}
            onPause={onPause}
            onTimeUpdate={onTimeUpdate}
            onEnded={onEnded}
            endScreen={endScreen}
            ended={ended}
            onEndedChange={onEndedChange}
          />

          {/* Title */}
          <h1 className="mt-3 text-[20px] font-bold leading-snug text-brand-text">{video.title}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {formatCount(video.view_count)} views · {timeAgo(video.published_at)}
            {startPositionMs > 0 ? ` · Resumed at ${formatDuration(startPositionMs / 1000)}` : ""}
          </p>

          {/* Channel row + actions */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link href={channelHref} className="flex min-w-0 items-center gap-3">
              <Avatar src={channelAvatar} name={channelName} seed={video.author_id} size="md" />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-bold leading-tight text-brand-text">{channelName}</p>
                <p className="text-[12px] text-muted-foreground">{formatCount(subscriberCount)} subscribers</p>
              </div>
            </Link>
            <SubscribeButton
              channelRef={video.author_id}
              initialSubscribed={channel?.is_subscribed ?? video.viewer_has_subscribed}
              initialNotifyOn={channel?.notify_on ?? null}
              hidden={isOwnChannel || !user}
              onSubscribedChange={(s) => setSubscriberCount((c) => Math.max(0, c + (s ? 1 : -1)))}
            />

            <div className="flex-1" />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleLike}
                aria-pressed={liked}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
                  liked ? "bg-primary-tint text-primary-ink" : "bg-brand-secondary text-brand-text hover:bg-brand-divider"
                }`}
              >
                <ThumbsUp className={`h-[18px] w-[18px] ${liked ? "fill-current" : ""}`} />
                {formatCount(likeCount)}
              </button>
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="flex items-center gap-1.5 rounded-full bg-brand-secondary px-4 py-2 text-[13px] font-semibold text-brand-text hover:bg-brand-divider"
              >
                <Share2 className="h-[18px] w-[18px]" /> Share
              </button>
              <button
                type="button"
                onClick={handleSave}
                aria-pressed={saved}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
                  saved ? "bg-primary-tint text-primary-ink" : "bg-brand-secondary text-brand-text hover:bg-brand-divider"
                }`}
              >
                <Bookmark className={`h-[18px] w-[18px] ${saved ? "fill-current" : ""}`} />
                {saved ? "Saved" : "Save"}
              </button>
              <div className="relative" data-more-menu>
                <button
                  type="button"
                  onClick={() => setMoreOpen((o) => !o)}
                  aria-label="More"
                  aria-expanded={moreOpen}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-secondary text-brand-text hover:bg-brand-divider"
                >
                  <MoreHorizontal className="h-[18px] w-[18px]" />
                </button>
                {moreOpen ? (
                  <div role="menu" className="absolute right-0 top-11 z-30 w-[240px] overflow-hidden rounded-xl border border-border bg-brand-card py-1 shadow-xl">
                    <MenuItem icon={<Link2 className="h-4 w-4" />} label="Copy link" onClick={copyLink} />
                    <MenuItem
                      icon={<ListPlus className="h-4 w-4" />}
                      label="Save to playlist"
                      onClick={() => {
                        setMoreOpen(false);
                        if (requireUser()) setPlaylistOpen(true);
                      }}
                    />
                    <MenuItem icon={<EyeOff className="h-4 w-4" />} label="Not interested" onClick={notInterested} />
                    {!isOwnChannel ? (
                      <>
                        <MenuItem icon={<UserX className="h-4 w-4" />} label={`Don't recommend ${channelName}`} onClick={dontRecommend} />
                        <MenuItem
                          icon={<Ban className="h-4 w-4" />}
                          label={`Block ${channelName}`}
                          danger
                          onClick={() => {
                            setMoreOpen(false);
                            if (requireUser()) setBlockOpen(true);
                          }}
                        />
                      </>
                    ) : null}
                    <MenuItem
                      icon={<Flag className="h-4 w-4" />}
                      label="Report"
                      onClick={() => {
                        setMoreOpen(false);
                        if (!requireUser()) return;
                        setReportOpen(true);
                        setReportSubmitted(false);
                        setReportReason("");
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Description */}
          {description ? (
            <div
              className="mt-3 cursor-pointer rounded-xl bg-brand-secondary px-4 py-3 transition-colors hover:bg-brand-secondary/70"
              onClick={() => !descExpanded && setDescExpanded(true)}
            >
              <p className={`whitespace-pre-line text-[13px] leading-relaxed text-brand-text ${descExpanded ? "" : "line-clamp-3"}`}>{description}</p>
              {video.hashtags.length > 0 && descExpanded ? (
                <p className="mt-2 text-[12px] font-semibold text-primary-ink">{video.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}</p>
              ) : null}
              {descriptionLong ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDescExpanded((c) => !c);
                  }}
                  className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-brand-text hover:underline"
                >
                  {descExpanded ? (
                    <>
                      Show less <ChevronUp className="h-3.5 w-3.5" />
                    </>
                  ) : (
                    "...more"
                  )}
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Series */}
          {series && series.episodes.length > 0 ? (
            <div className="mt-4">
              <SeriesPanel series={series} currentId={video.id} />
            </div>
          ) : null}

          {/* Comments */}
          <div className="mt-6 mb-8">
            <h3 className="mb-3 text-[16px] font-bold text-brand-text">{formatCount(video.comment_count)} Comments</h3>
            <CommentSection postId={video.id} postAuthorId={video.author_id} commentsCount={video.comment_count} alwaysExpanded />
          </div>
        </div>

        {/* Up next */}
        <aside className="w-full xl:w-[400px] xl:shrink-0">
          <h3 className="mb-3 text-[14px] font-bold text-brand-text">Up next</h3>
          <div className="space-y-3">
            {relatedQuery.isLoading ? (
              <RelatedSkeleton />
            ) : related.length > 0 ? (
              related.map((item) => <RelatedCard key={item.id} video={item} />)
            ) : (
              <p className="py-4 text-[13px] text-muted-foreground">No related videos</p>
            )}
            {relatedQuery.hasNextPage ? (
              <button
                type="button"
                onClick={() => relatedQuery.fetchNextPage()}
                disabled={relatedQuery.isFetchingNextPage}
                className="w-full rounded-full border border-border bg-brand-card py-2 text-[12px] font-semibold text-brand-text hover:bg-brand-secondary disabled:opacity-50"
              >
                {relatedQuery.isFetchingNextPage ? "Loading..." : "Show more"}
              </button>
            ) : null}
          </div>
        </aside>
      </div>

      <ShareDialog postId={video.id} isOpen={shareOpen} onClose={() => setShareOpen(false)} shareUrl={shareUrl} />
      <SaveToPlaylistDialog open={playlistOpen} postId={video.id} onClose={() => setPlaylistOpen(false)} />
      <ConfirmDialog
        open={blockOpen}
        title={`Block ${channelName}?`}
        body={
          <>
            They won&apos;t be able to message you, comment on your posts, or see your content. You won&apos;t see their videos any more.
          </>
        }
        confirmLabel="Block"
        danger
        pending={blockPending}
        onConfirm={confirmBlock}
        onClose={() => setBlockOpen(false)}
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

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] font-medium hover:bg-brand-secondary ${danger ? "text-danger" : "text-brand-text"}`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function RelatedSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-2">
          <div className="aspect-video w-[168px] shrink-0 animate-pulse rounded-lg bg-brand-secondary" />
          <div className="flex-1 space-y-1.5 py-0.5">
            <div className="h-3.5 w-full animate-pulse rounded-sm bg-brand-secondary" />
            <div className="h-3.5 w-3/4 animate-pulse rounded-sm bg-brand-secondary" />
          </div>
        </div>
      ))}
    </>
  );
}

export function WatchPage({ videoId }: WatchPageProps) {
  return <WatchPageContent key={videoId ?? "posttube-watch"} videoId={videoId} />;
}
