"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bookmark,
  ChevronUp,
  ListFilter,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Share2,
  Heart,
} from "lucide-react";
import Link from "next/link";

import { PostTubeShell } from "./PostTubeShell";
import { Avatar } from "@/components/LetterAvatar";
import CommentSection from "@/components/CommentSection";
import ShareDialog from "@/components/ShareDialog";
import { useToggleBookmark, useToggleTune, useTuneState } from "@/hooks/usePostActions";
import { useToggleLike } from "@/hooks/usePostReaction";
import { useSubmitReport, REPORT_REASONS } from "@/hooks/useReport";
import { useChannelSubscription, useToggleChannelSubscription } from "@/hooks/useChannels";
import { useDataSaver } from "@/hooks/useDataSaver";
import { useVideoTracker } from "@/hooks/useVideoTracker";
import api from "@/lib/api";
import type { PostDetail } from "@/types/profile";
import {
  deleteVideoWatchProgress,
  getCategoryFeed,
  getSubtitleTracks,
  getVideoDetail,
  getWatchProgressForVideo,
  postDetailToVideo,
  resolveAuthor,
  saveVideoWatchProgress,
} from "../data/posttubeApi";
import type { PostTubeVideo } from "../types";

function fmtCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDuration(sec: number) {
  if (sec <= 0) return "";
  const h = Math.floor(sec / 3600);
  const mm = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  if (h > 0) return `${h}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function timeAgo(dateStr: string) {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function SidebarCard({ video }: { video: PostTubeVideo }) {
  return (
    <Link href={`/posttube/watch/${video.id}`} className="group flex gap-2">
      <div className="relative w-[168px] shrink-0 overflow-hidden rounded-lg bg-brand-secondary aspect-video">
        {video.thumbnail_url ? (
          <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100" />
        )}
        {video.duration_seconds > 0 ? (
          <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-medium text-white">
            {fmtDuration(video.duration_seconds)}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <h4 className="line-clamp-2 text-[13px] font-semibold leading-tight text-brand-text">{video.title}</h4>
        <p className="mt-1 text-[11px] text-brand-highlight">{video.channel_name}</p>
        <p className="text-[11px] text-brand-text/60">
          {fmtCount(video.view_count)} views · {timeAgo(video.published_at)}
        </p>
      </div>
    </Link>
  );
}

interface WatchPageProps {
  videoId?: string;
}

function WatchPageContent({ videoId }: WatchPageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const initialSeekAppliedRef = useRef(false);
  const playbackStartedRef = useRef(false);
  const playbackEndedRef = useRef(false);
  const lastSavedPositionRef = useRef(0);
  const latestPlaybackRef = useRef({ positionMs: 0, durationMs: 0 });
  const { effective: dataSaver } = useDataSaver();
  // Data-saver: don't autoplay and don't kick off the HLS preload
  // until the viewer clicks the poster. We use a manual "user
  // tapped" flag rather than `autoPlay={false}` so the existing
  // controls + tracker effects keep working.
  const [userTappedPlay, setUserTappedPlay] = useState(false);
  useEffect(() => {
    setUserTappedPlay(false);
  }, [videoId]);

  const videoQuery = useQuery({
    queryKey: ["posttube", "video", videoId],
    queryFn: async () => {
      const res = await api.get<{ data: PostDetail }>(`/v1/posts/${videoId}`);
      const post = res.data.data;
      const author = await resolveAuthor(post.author_id);
      return postDetailToVideo(post, author);
    },
    enabled: !!videoId,
    staleTime: 60_000,
  });

  const videoMetadataQuery = useQuery({
    queryKey: ["posttube", "video-metadata", videoId],
    queryFn: () => getVideoDetail(videoId!),
    enabled: !!videoId,
    staleTime: 60_000,
  });

  const relatedQuery = useQuery({
    queryKey: ["posttube", "related", videoId],
    queryFn: () => getCategoryFeed("recommended", { limit: 16 }),
    staleTime: 2 * 60_000,
  });

  const progressQuery = useQuery({
    queryKey: ["posttube", "watch-progress", videoId],
    queryFn: () => getWatchProgressForVideo(videoId!),
    enabled: !!videoId,
    staleTime: 30_000,
  });

  const video: PostTubeVideo | null = videoQuery.data ?? null;
  const relatedVideos = (relatedQuery.data?.items ?? []).filter((item) => item.id !== videoId);
  const trimStartMs = videoMetadataQuery.data?.trim_start_ms ?? 0;
  const trimEndMs = videoMetadataQuery.data?.trim_end_ms ?? undefined;
  const mediaAssetId = videoMetadataQuery.data?.media_asset_id;

  const subtitleQuery = useQuery({
    queryKey: ["posttube", "subtitles", mediaAssetId],
    queryFn: () => getSubtitleTracks(mediaAssetId!),
    enabled: !!mediaAssetId,
    staleTime: 60_000,
  });

  const subscriptionQuery = useChannelSubscription(video?.subscription_channel_id);
  const tuneQuery = useTuneState(videoId);
  const toggleSubscription = useToggleChannelSubscription();
  const likeMutation = useToggleLike();
  const bookmarkMutation = useToggleBookmark();
  const tuneMutation = useToggleTune();
  const reportMutation = useSubmitReport();

  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const trackingDurationMs = Math.max(0, Math.round((video?.duration_seconds ?? 0) * 1000));
  const tracker = useVideoTracker({
    contentId: video?.id ?? "",
    creatorId: video?.author_id ?? "",
    contentType: "long_video",
    contentDurationMs: trackingDurationMs,
    surface: "posttube_watch",
    position: 0,
    isAutoplay: true,
  });

  useEffect(() => {
    if (!video) return;
    setLiked(video.viewer_has_liked);
    setDisliked(video.viewer_has_disliked);
    setSaved(video.viewer_has_saved);
    setSubscribed(video.viewer_has_subscribed);
    setLikeCount(video.like_count);
    setSubscriberCount(video.channel_subscriber_count);
    setDescExpanded(false);
    setCommentsOpen(false);
    setShareOpen(false);
    setReportOpen(false);
    setReportSubmitted(false);
    setReportReason("");
    initialSeekAppliedRef.current = false;
    playbackStartedRef.current = false;
    playbackEndedRef.current = false;
    lastSavedPositionRef.current = 0;
    latestPlaybackRef.current = { positionMs: 0, durationMs: trackingDurationMs };
  }, [trackingDurationMs, video?.id]);

  useEffect(() => {
    if (typeof tuneQuery.data === "boolean") {
      setDisliked(tuneQuery.data);
    }
  }, [tuneQuery.data, video?.id]);

  useEffect(() => {
    if (!video?.subscription_channel_id) {
      setSubscribed(false);
      return;
    }
    if (typeof subscriptionQuery.data?.subscribed === "boolean") {
      setSubscribed(subscriptionQuery.data.subscribed);
    }
  }, [subscriptionQuery.data?.subscribed, video?.id, video?.subscription_channel_id]);

  const getDurationMs = useCallback(() => {
    if (trimEndMs && trimEndMs > 0) return trimEndMs;
    const actual = videoRef.current?.duration ? Math.round(videoRef.current.duration * 1000) : 0;
    return actual || trackingDurationMs;
  }, [trackingDurationMs, trimEndMs]);

  const persistProgress = useCallback((positionMs: number, force = false) => {
    if (!video?.id) return;
    const durationMs = getDurationMs();
    if (durationMs <= 0) return;
    const clampedPosition = Math.max(0, Math.min(positionMs, durationMs));
    latestPlaybackRef.current = { positionMs: clampedPosition, durationMs };

    if (force && clampedPosition >= durationMs * 0.9) {
      void deleteVideoWatchProgress(video.id).catch(() => {});
      return;
    }
    if (!force && Math.abs(clampedPosition - lastSavedPositionRef.current) < 5_000) {
      return;
    }
    lastSavedPositionRef.current = clampedPosition;
    void saveVideoWatchProgress(video.id, { positionMs: clampedPosition, durationMs }).catch(() => {});
  }, [getDurationMs, video?.id]);

  const completePlayback = useCallback((reason: string) => {
    if (!video?.id || !playbackStartedRef.current || playbackEndedRef.current) return;
    playbackEndedRef.current = true;
    tracker.onPlayEnd(reason);
    void deleteVideoWatchProgress(video.id).catch(() => {});
  }, [tracker, video?.id]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !video) return;

    const applyInitialPosition = () => {
      if (initialSeekAppliedRef.current || progressQuery.isLoading || videoMetadataQuery.isLoading) return;
      const resumeMs = progressQuery.data?.position_ms ?? 0;
      let targetMs = Math.max(trimStartMs, resumeMs);
      if (trimEndMs && targetMs >= trimEndMs) targetMs = trimStartMs;
      if (targetMs > 0) {
        element.currentTime = targetMs / 1000;
      }
      initialSeekAppliedRef.current = true;
      lastSavedPositionRef.current = targetMs;
      latestPlaybackRef.current.positionMs = targetMs;
    };

    const onLoadedMetadata = () => {
      latestPlaybackRef.current.durationMs = getDurationMs();
      applyInitialPosition();
    };

    const onPlay = () => {
      playbackStartedRef.current = true;
      playbackEndedRef.current = false;
      tracker.onPlayStart();
    };

    const onTimeUpdate = () => {
      const positionMs = Math.round(element.currentTime * 1000);
      latestPlaybackRef.current = { positionMs, durationMs: getDurationMs() };
      tracker.onTimeUpdate(positionMs);
      if (trimEndMs && positionMs >= trimEndMs) {
        element.pause();
        element.currentTime = trimEndMs / 1000;
        latestPlaybackRef.current.positionMs = trimEndMs;
        completePlayback("trim_end");
        return;
      }
      persistProgress(positionMs);
    };

    const onPause = () => {
      if (playbackEndedRef.current || element.ended) return;
      persistProgress(Math.round(element.currentTime * 1000), true);
    };

    const onEnded = () => {
      latestPlaybackRef.current.positionMs = Math.round(element.currentTime * 1000);
      completePlayback("ended");
    };

    if (element.readyState >= 1) onLoadedMetadata();
    element.addEventListener("loadedmetadata", onLoadedMetadata);
    element.addEventListener("play", onPlay);
    element.addEventListener("timeupdate", onTimeUpdate);
    element.addEventListener("pause", onPause);
    element.addEventListener("ended", onEnded);
    return () => {
      element.removeEventListener("loadedmetadata", onLoadedMetadata);
      element.removeEventListener("play", onPlay);
      element.removeEventListener("timeupdate", onTimeUpdate);
      element.removeEventListener("pause", onPause);
      element.removeEventListener("ended", onEnded);
    };
  }, [completePlayback, getDurationMs, persistProgress, progressQuery.data?.position_ms, progressQuery.isLoading, tracker, trimEndMs, trimStartMs, video, videoMetadataQuery.isLoading]);

  useEffect(() => {
    return () => {
      if (!playbackStartedRef.current || playbackEndedRef.current) return;
      persistProgress(latestPlaybackRef.current.positionMs, true);
      tracker.onPlayEnd("navigate_away");
    };
  }, [persistProgress, tracker]);

  const handleLike = useCallback(() => {
    if (!video) return;
    const prevLiked = liked;
    const prevDisliked = disliked;
    const prevCount = likeCount;
    const nextLiked = !prevLiked;
    setLiked(nextLiked);
    setDisliked(false);
    setLikeCount(Math.max(0, prevCount + (nextLiked ? 1 : -1)));
    likeMutation.mutate(video.id, {
      onSuccess: (result) => {
        setLiked(result.liked);
        setLikeCount(result.count);
      },
      onError: () => {
        setLiked(prevLiked);
        setDisliked(prevDisliked);
        setLikeCount(prevCount);
      },
    });
  }, [disliked, likeCount, likeMutation, liked, video]);

  const handleSave = useCallback(() => {
    if (!video) return;
    const prevSaved = saved;
    setSaved(!prevSaved);
    bookmarkMutation.mutate(video.id, {
      onSuccess: (result) => setSaved(result.bookmarked),
      onError: () => setSaved(prevSaved),
    });
  }, [bookmarkMutation, saved, video]);

  const handleDislike = useCallback(() => {
    if (!video) return;

    const prevDisliked = disliked;
    const prevLiked = liked;
    const prevLikeCount = likeCount;
    const nextDisliked = !prevDisliked;

    setDisliked(nextDisliked);
    if (nextDisliked && prevLiked) {
      setLiked(false);
      setLikeCount(Math.max(0, prevLikeCount - 1));
      likeMutation.mutate(video.id, {
        onSuccess: (result) => {
          setLiked(result.liked);
          setLikeCount(result.count);
        },
        onError: () => {
          setLiked(prevLiked);
          setLikeCount(prevLikeCount);
        },
      });
    }

    tuneMutation.mutate(
      { postId: video.id, tuned: nextDisliked },
      {
        onError: () => {
          setDisliked(prevDisliked);
          setLiked(prevLiked);
          setLikeCount(prevLikeCount);
        },
      },
    );
  }, [disliked, likeCount, likeMutation, liked, tuneMutation, video]);

  const handleSubscription = useCallback(() => {
    if (!video?.subscription_channel_id) return;
    const prevSubscribed = subscribed;
    const prevCount = subscriberCount;
    const nextSubscribed = !prevSubscribed;
    setSubscribed(nextSubscribed);
    setSubscriberCount(Math.max(0, prevCount + (nextSubscribed ? 1 : -1)));
    toggleSubscription.mutate(
      { channelId: video.subscription_channel_id, subscribe: nextSubscribed },
      {
        onSuccess: ({ subscribed: serverSubscribed }) => setSubscribed(serverSubscribed),
        onError: () => {
          setSubscribed(prevSubscribed);
          setSubscriberCount(prevCount);
        },
      },
    );
  }, [subscribed, subscriberCount, toggleSubscription, video?.subscription_channel_id]);

  if (videoId && videoQuery.isLoading) {
    return (
      <PostTubeShell>
        <div className="h-full min-h-0 overflow-y-auto">
          <div className="mx-auto max-w-[1280px] px-6 py-4">
            <div className="relative overflow-hidden rounded-xl bg-black aspect-video">
              <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-white/60" />
              </div>
            </div>
          </div>
        </div>
      </PostTubeShell>
    );
  }

  if (!video) {
    return (
      <PostTubeShell>
        <div className="flex h-full flex-col items-center justify-center text-center">
          <h2 className="text-[18px] font-bold text-brand-text">{videoId ? "Video not found" : "No video selected"}</h2>
          <p className="mt-2 text-[13px] text-brand-highlight">
            {videoId ? "This video may still be processing or has been removed." : "Browse PostTube to find videos to watch."}
          </p>
          <Link href="/posttube" className="mt-5 rounded-full bg-slate-900 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-brand-text transition-colors">
            Back to PostTube
          </Link>
        </div>
      </PostTubeShell>
    );
  }

  const descLines = video.description.split("\n");
  const isLongDesc = descLines.length > 3 || video.description.length > 200;
  const displayDesc = descExpanded || !isLongDesc ? video.description : `${descLines.slice(0, 3).join("\n").slice(0, 200)}...`;
  const channelHref = video.channel_handle ? `/posttube/channel/${video.channel_handle}` : null;
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/posttube/watch/${video.id}` : undefined;
  const subscribePending = subscriptionQuery.isLoading || toggleSubscription.isPending;

  // Data-saver: bias the playback URL toward the lowest rendition
  // and gate the `<video src>` until the viewer clicks the poster.
  const rawPlaybackUrl = videoMetadataQuery.data?.playback_url || video.video_url || "";
  const playbackUrl = (() => {
    if (!rawPlaybackUrl) return undefined;
    if (!dataSaver) return rawPlaybackUrl;
    const sep = rawPlaybackUrl.includes("?") ? "&" : "?";
    return `${rawPlaybackUrl}${sep}quality=240p`;
  })();
  const showPoster = dataSaver && !userTappedPlay;

  return (
    <PostTubeShell>
      <div className="h-full min-h-0 overflow-y-auto">
        <div className="mx-auto flex max-w-[1280px] gap-6 px-6 py-4">
          <div className="flex-1 min-w-0">
            <div className="relative overflow-hidden rounded-xl bg-black aspect-video">
              <video
                ref={videoRef}
                src={showPoster ? undefined : playbackUrl}
                poster={video.thumbnail_url || undefined}
                className="h-full w-full object-contain"
                controls
                autoPlay={!dataSaver}
                playsInline
                preload={dataSaver ? "none" : "auto"}
              >
                {(subtitleQuery.data ?? []).map((track, index) => (
                  <track
                    key={track.id}
                    kind="subtitles"
                    src={track.content_url}
                    srcLang={track.language}
                    label={track.language.toUpperCase()}
                    default={index === 0}
                  />
                ))}
              </video>
              {showPoster ? (
                <button
                  type="button"
                  onClick={() => {
                    setUserTappedPlay(true);
                    // Kick playback once React has attached the new
                    // `src`. The microtask queue is fine here — by
                    // the time it runs the next render has flushed.
                    queueMicrotask(() => {
                      videoRef.current?.play().catch(() => undefined);
                    });
                  }}
                  className="absolute inset-0 z-10 flex items-center justify-center bg-black/40"
                  aria-label="Play video"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/60 bg-black/60 backdrop-blur-sm">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="white"
                      aria-hidden="true"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </button>
              ) : null}
            </div>

            <h1 className="mt-3 text-[20px] font-bold leading-snug text-brand-text">{video.title}</h1>

            <div className="mt-2 flex items-center gap-3 flex-wrap">
              {channelHref ? (
                <Link href={channelHref} className="flex items-center gap-3 min-w-0">
                  <Avatar src={video.channel_avatar_url} name={video.channel_name} seed={video.channel_id || video.channel_name} size="sm" />
                  <div className="min-w-0 mr-1">
                    <p className="truncate text-[14px] font-bold text-brand-text leading-tight">{video.channel_name}</p>
                    <p className="text-[12px] text-brand-text/60">{fmtCount(subscriberCount)} subscribers</p>
                  </div>
                </Link>
              ) : (
                <>
                  <Avatar src={video.channel_avatar_url} name={video.channel_name} seed={video.channel_id || video.channel_name} size="sm" />
                  <div className="min-w-0 mr-1">
                    <p className="truncate text-[14px] font-bold text-brand-text leading-tight">{video.channel_name}</p>
                    <p className="text-[12px] text-brand-text/60">{fmtCount(subscriberCount)} subscribers</p>
                  </div>
                </>
              )}

              {video.subscription_channel_id ? (
                <button
                  type="button"
                  onClick={handleSubscription}
                  disabled={subscribePending}
                  className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-bold transition-colors disabled:opacity-50 ${
                    subscribed ? "bg-brand-secondary text-brand-text" : "bg-slate-900 text-white hover:bg-brand-text"
                  }`}
                >
                  {subscribePending ? "..." : subscribed ? "Subscribed" : "Subscribe"}
                </button>
              ) : null}

              <div className="flex-1" />

              <button
                type="button"
                onClick={handleLike}
                aria-pressed={liked}
                aria-label={liked ? "Loved" : "Love"}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
                  liked ? "bg-rose-500/15 text-rose-500" : "bg-brand-secondary text-brand-text"
                }`}
              >
                <Heart className={`h-[18px] w-[18px] ${liked ? "fill-rose-500 text-rose-500" : ""}`} />
                {fmtCount(likeCount)}
              </button>

              <button type="button" onClick={() => setShareOpen(true)} className="flex items-center gap-1.5 rounded-full bg-brand-secondary px-4 py-2 text-[13px] font-semibold text-brand-text">
                <Share2 className="h-[18px] w-[18px]" />
                Share
              </button>

              <button type="button" onClick={handleSave} className="flex items-center gap-1.5 rounded-full bg-brand-secondary px-4 py-2 text-[13px] font-semibold text-brand-text">
                <Bookmark className={`h-[18px] w-[18px] ${saved ? "fill-current" : ""}`} />
                {saved ? "Saved" : "Save"}
              </button>

              <button type="button" onClick={() => { setReportOpen(true); setReportSubmitted(false); setReportReason(""); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-secondary text-brand-text">
                <MoreHorizontal className="h-[18px] w-[18px]" />
              </button>
            </div>

            <div className="mt-3 rounded-xl bg-brand-secondary px-4 py-3 cursor-pointer hover:bg-brand-secondary/70 transition-colors" onClick={() => !descExpanded && setDescExpanded(true)}>
              <div className="flex items-center gap-2 text-[13px] font-semibold text-brand-text">
                <span>{fmtCount(video.view_count)} views</span>
                <span className="text-brand-text/60">·</span>
                <span>{timeAgo(video.published_at)}</span>
                {progressQuery.data?.position_ms ? (
                  <>
                    <span className="text-brand-text/60">·</span>
                    <span>Resume at {fmtDuration(Math.floor(progressQuery.data.position_ms / 1000))}</span>
                  </>
                ) : null}
              </div>
              {video.description ? <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-brand-text">{displayDesc}</p> : null}
              {isLongDesc ? (
                <button type="button" onClick={(event) => { event.stopPropagation(); setDescExpanded((current) => !current); }} className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-brand-highlight hover:text-brand-text transition-colors">
                  {descExpanded ? <>Show less <ChevronUp className="h-3.5 w-3.5" /></> : <>...more</>}
                </button>
              ) : null}
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setCommentsOpen((current) => !current)}
                className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold transition-colors ${
                  commentsOpen ? "bg-slate-900 text-white" : "bg-brand-secondary text-brand-text"
                }`}
              >
                <MessageCircle className="h-[18px] w-[18px]" />
                {fmtCount(video.comment_count)} Comments
              </button>
            </div>

            {commentsOpen ? (
              <div className="mt-4 mb-8">
                <div className="flex items-center gap-6 mb-4">
                  <h3 className="text-[16px] font-bold text-brand-text">{fmtCount(video.comment_count)} Comments</h3>
                  <button type="button" className="flex items-center gap-1.5 text-[13px] font-semibold text-brand-highlight">
                    <ListFilter className="h-4 w-4" />
                    Sort by
                  </button>
                </div>
                <CommentSection postId={video.id} postAuthorId={video.author_id} commentsCount={video.comment_count} alwaysExpanded />
              </div>
            ) : null}
          </div>

          <aside className="w-[402px] shrink-0 hidden xl:block">
            <div className="space-y-3">
              {relatedQuery.isLoading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="w-[168px] shrink-0 aspect-video animate-pulse rounded-lg bg-brand-secondary" />
                    <div className="flex-1 space-y-1.5 py-0.5">
                      <div className="h-3.5 w-full animate-pulse rounded bg-brand-secondary" />
                      <div className="h-3.5 w-3/4 animate-pulse rounded bg-brand-secondary" />
                    </div>
                  </div>
                ))
              ) : relatedVideos.length > 0 ? (
                relatedVideos.map((item) => <SidebarCard key={item.id} video={item} />)
              ) : (
                <p className="text-[13px] text-brand-text/60 py-4">No related videos</p>
              )}
            </div>
          </aside>
        </div>
      </div>

      <ShareDialog postId={video.id} isOpen={shareOpen} onClose={() => setShareOpen(false)} shareUrl={shareUrl} />

      {reportOpen ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-[380px] rounded-2xl bg-brand-card shadow-2xl overflow-hidden">
            {reportSubmitted ? (
              <div className="p-6 text-center">
                <h3 className="text-[15px] font-bold text-brand-text">Report Submitted</h3>
                <p className="mt-1 text-[13px] text-brand-highlight">Our team will review this content shortly.</p>
                <button onClick={() => setReportOpen(false)} className="mt-4 w-full rounded-full bg-slate-900 py-2.5 text-[13px] font-semibold text-white">Done</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-brand-divider px-5 py-3.5">
                  <h3 className="text-[14px] font-bold text-brand-text">Report Content</h3>
                  <button onClick={() => setReportOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-full text-brand-text/60">×</button>
                </div>
                <div className="px-5 py-4">
                  <p className="text-[12px] text-brand-highlight mb-3">Why are you reporting this?</p>
                  <div className="space-y-1.5">
                    {REPORT_REASONS.map((reason) => (
                      <button key={reason.value} onClick={() => setReportReason(reason.value)} className={`w-full rounded-xl px-3.5 py-2.5 text-left text-[13px] transition ${
                        reportReason === reason.value ? "bg-slate-900 text-white font-medium" : "bg-brand-secondary text-brand-text"
                      }`}>
                        {reason.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-brand-divider px-5 py-3">
                  <button
                    onClick={async () => {
                      if (!reportReason) return;
                      await reportMutation.mutateAsync({ targetType: "video", targetId: video.id, reason: reportReason as Parameters<typeof reportMutation.mutateAsync>[0]["reason"] });
                      setReportSubmitted(true);
                    }}
                    disabled={!reportReason || reportMutation.isPending}
                    className="w-full rounded-full bg-red-600 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
                  >
                    {reportMutation.isPending ? "Submitting..." : "Submit Report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </PostTubeShell>
  );
}

export function WatchPage({ videoId }: WatchPageProps) {
  return <WatchPageContent key={videoId ?? "posttube-watch"} videoId={videoId} />;
}
