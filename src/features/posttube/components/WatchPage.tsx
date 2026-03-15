"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Bookmark,
  MoreHorizontal,
  ChevronUp,
  MessageCircle,
  ListFilter,
} from "lucide-react";
import Link from "next/link";

import { PostTubeShell } from "./PostTubeShell";
import { Avatar } from "@/components/LetterAvatar";
import CommentSection from "@/components/CommentSection";
import { useSubmitReport, REPORT_REASONS } from "@/hooks/useReport";
import { postDetailToVideo, getCategoryFeed, resolveAuthor } from "../data/posttubeApi";
import type { PostTubeVideo } from "../types";
import api from "@/lib/api";
import type { PostDetail } from "@/types/profile";

/* ── Helpers ─────────────────────────────────────────────── */

function fmtCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
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

function fmtDuration(sec: number) {
  if (sec <= 0) return "";
  const h = Math.floor(sec / 3600);
  const mm = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  if (h > 0) return `${h}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

/* ── Sidebar Video Card ──────────────────────────────────── */

function SidebarCard({ video }: { video: PostTubeVideo }) {
  return (
    <Link href={`/posttube/watch/${video.id}`} className="group flex gap-2">
      <div className="relative w-[168px] shrink-0 overflow-hidden rounded-lg bg-slate-100 aspect-video">
        {video.thumbnail_url ? (
          <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100">
            <svg className="h-6 w-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
          </div>
        )}
        {video.duration_seconds > 0 && (
          <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-medium text-white">
            {fmtDuration(video.duration_seconds)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <h4 className="line-clamp-2 text-[13px] font-semibold leading-tight text-slate-900 group-hover:text-slate-700">
          {video.title}
        </h4>
        <p className="mt-1 text-[11px] text-slate-500">{video.channel_name}</p>
        <p className="text-[11px] text-slate-400">
          {fmtCount(video.view_count)} views · {timeAgo(video.published_at)}
        </p>
      </div>
    </Link>
  );
}

/* ── Main Component ──────────────────────────────────────── */

interface WatchPageProps {
  videoId?: string;
}

export function WatchPage({ videoId }: WatchPageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const videoQuery = useQuery({
    queryKey: ["posttube", "video", videoId],
    queryFn: async () => {
      const res = await api.get<{ data: PostDetail & { video_metadata?: { trim_start_ms?: number; trim_end_ms?: number; duration_seconds?: number } } }>(`/v1/posts/${videoId}`);
      const postData = res.data.data;
      const authorInfo = await resolveAuthor(postData.author_id);
      const mapped = postDetailToVideo(postData, authorInfo);
      // Attach trim data for playback
      return {
        ...mapped,
        _trimStartMs: postData.video_metadata?.trim_start_ms ?? 0,
        _trimEndMs: postData.video_metadata?.trim_end_ms ?? undefined,
      };
    },
    enabled: !!videoId,
    staleTime: 60_000,
  });

  // Related videos for right sidebar
  const relatedQuery = useQuery({
    queryKey: ["posttube", "related", videoId],
    queryFn: () => getCategoryFeed("recommended", { limit: 16 }),
    staleTime: 2 * 60_000,
  });

  const video: PostTubeVideo | null = videoQuery.data ?? null;
  const relatedVideos = (relatedQuery.data?.items ?? []).filter((v) => v.id !== videoId);

  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const reportMutation = useSubmitReport();

  useEffect(() => {
    if (video) {
      setLiked(video.viewer_has_liked);
      setDisliked(video.viewer_has_disliked);
      setSaved(video.viewer_has_saved);
      setSubscribed(video.viewer_has_subscribed);
    }
  }, [video]);

  // Trim-aware playback: seek to trim start and stop at trim end
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !video) return;
    const trimStart = (video as unknown as Record<string, unknown>)._trimStartMs as number | undefined;
    const trimEnd = (video as unknown as Record<string, unknown>)._trimEndMs as number | undefined;

    if (trimStart && trimStart > 0) {
      el.currentTime = trimStart / 1000;
    }

    if (trimEnd) {
      const endSec = trimEnd / 1000;
      const handleTimeUpdate = () => {
        if (el.currentTime >= endSec) {
          el.pause();
          el.removeEventListener("timeupdate", handleTimeUpdate);
        }
      };
      el.addEventListener("timeupdate", handleTimeUpdate);
      return () => el.removeEventListener("timeupdate", handleTimeUpdate);
    }
  }, [video]);

  const toggleLike = useCallback(() => {
    setLiked((p) => !p);
    if (disliked) setDisliked(false);
  }, [disliked]);

  const toggleDislike = useCallback(() => {
    setDisliked((p) => !p);
    if (liked) setLiked(false);
  }, [liked]);

  if (videoId && videoQuery.isLoading) {
    return (
      <PostTubeShell>
        <div className="h-full min-h-0 overflow-y-auto">
          <div className="mx-auto max-w-[1280px] px-6 py-4">
            {/* Show cover poster while loading if available via URL search param */}
            <div className="relative overflow-hidden rounded-xl bg-black aspect-video">
              <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-white/60" />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div className="h-6 w-3/4 animate-pulse rounded bg-slate-100" />
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-slate-100" />
                <div className="space-y-1.5">
                  <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                </div>
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
          <h2 className="text-[18px] font-bold text-slate-900">
            {videoId ? "Video not found" : "No video selected"}
          </h2>
          <p className="mt-2 text-[13px] text-slate-500">
            {videoId
              ? "This video may still be processing or has been removed."
              : "Browse PostTube to find videos to watch."}
          </p>
          <Link href="/posttube" className="mt-5 rounded-full bg-slate-900 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-slate-800 transition-colors">
            Back to PostTube
          </Link>
        </div>
      </PostTubeShell>
    );
  }

  const descLines = video.description.split("\n");
  const isLongDesc = descLines.length > 3 || video.description.length > 200;
  const displayDesc = descExpanded || !isLongDesc
    ? video.description
    : (descLines.slice(0, 3).join("\n").slice(0, 200) + "...");

  return (
    <PostTubeShell>
      <div className="h-full min-h-0 overflow-y-auto">
        <div className="mx-auto flex max-w-[1280px] gap-6 px-6 py-4">

          {/* ═══ LEFT — Player + Channel + Description + Comments ═══ */}
          <div className="flex-1 min-w-0">

            {/* Video Player (16:9) */}
            <div className="relative overflow-hidden rounded-xl bg-black aspect-video">
              <video
                ref={videoRef}
                src={video.video_url || undefined}
                poster={video.thumbnail_url || undefined}
                className="h-full w-full object-contain"
                controls
                autoPlay
                playsInline
                preload="auto"
              />
            </div>

            {/* Title */}
            <h1 className="mt-3 text-[20px] font-bold leading-snug text-slate-900">
              {video.title}
            </h1>

            {/* Channel row + Actions (single line like YouTube) */}
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <Avatar
                src={video.channel_avatar_url}
                name={video.channel_name}
                seed={video.channel_id || video.channel_name}
                size="sm"
              />
              <div className="min-w-0 mr-1">
                <p className="truncate text-[14px] font-bold text-slate-900 leading-tight">
                  {video.channel_name}
                </p>
                <p className="text-[12px] text-slate-400">
                  {fmtCount(video.channel_subscriber_count)} subscribers
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubscribed((p) => !p)}
                className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-bold transition-colors ${
                  subscribed
                    ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                {subscribed ? "Subscribed" : "Subscribe"}
              </button>

              <div className="flex-1" />

              {/* Like/Dislike joined pill */}
              <div className="flex items-center rounded-full bg-slate-100 overflow-hidden">
                <button
                  type="button"
                  onClick={toggleLike}
                  className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold border-r border-slate-200 transition-colors ${
                    liked ? "bg-slate-200" : "hover:bg-slate-200"
                  }`}
                >
                  <ThumbsUp className={`h-[18px] w-[18px] ${liked ? "fill-current" : ""}`} />
                  {fmtCount(video.like_count + (liked ? 1 : 0))}
                </button>
                <button
                  type="button"
                  onClick={toggleDislike}
                  className={`flex items-center px-3 py-2 transition-colors ${
                    disliked ? "bg-slate-200" : "hover:bg-slate-200"
                  }`}
                >
                  <ThumbsDown className={`h-[18px] w-[18px] ${disliked ? "fill-current" : ""}`} />
                </button>
              </div>

              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <Share2 className="h-[18px] w-[18px]" />
                Share
              </button>

              <button
                type="button"
                onClick={() => setSaved((p) => !p)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
                  saved ? "bg-slate-200 text-slate-900" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Bookmark className={`h-[18px] w-[18px] ${saved ? "fill-current" : ""}`} />
                Save
              </button>

              <button
                type="button"
                onClick={() => { setReportOpen(true); setReportSubmitted(false); setReportReason(""); }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <MoreHorizontal className="h-[18px] w-[18px]" />
              </button>
            </div>

            {/* Description card (clickable to expand like YouTube) */}
            <div
              className="mt-3 rounded-xl bg-slate-100 px-4 py-3 cursor-pointer hover:bg-slate-200/70 transition-colors"
              onClick={() => !descExpanded && setDescExpanded(true)}
            >
              <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-900">
                <span>{fmtCount(video.view_count)} views</span>
                <span className="text-slate-400">·</span>
                <span>{timeAgo(video.published_at)}</span>
                {video.hashtags.length > 0 && (
                  <span className="flex gap-1.5 ml-1">
                    {video.hashtags.slice(0, 3).map((tag) => (
                      <Link
                        key={tag}
                        href={`/hashtag/${tag}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[13px] font-semibold text-blue-600 hover:text-blue-700"
                      >
                        #{tag}
                      </Link>
                    ))}
                  </span>
                )}
              </div>
              {video.description && (
                <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-slate-700">
                  {displayDesc}
                </p>
              )}
              {isLongDesc && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDescExpanded((p) => !p); }}
                  className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-slate-600 hover:text-slate-800 transition-colors"
                >
                  {descExpanded ? (
                    <>Show less <ChevronUp className="h-3.5 w-3.5" /></>
                  ) : (
                    <>...more</>
                  )}
                </button>
              )}
            </div>

            {/* Comments toggle button */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setCommentsOpen((p) => !p)}
                className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold transition-colors ${
                  commentsOpen
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <MessageCircle className="h-[18px] w-[18px]" />
                {fmtCount(video.comment_count)} Comments
              </button>
            </div>

            {/* Comments section (collapsed by default) */}
            {commentsOpen && (
              <div className="mt-4 mb-8">
                <div className="flex items-center gap-6 mb-4">
                  <h3 className="text-[16px] font-bold text-slate-900">
                    {fmtCount(video.comment_count)} Comments
                  </h3>
                  <button type="button" className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 hover:text-slate-800 transition-colors">
                    <ListFilter className="h-4 w-4" />
                    Sort by
                  </button>
                </div>
                <CommentSection
                  postId={video.id}
                  postAuthorId={video.channel_id}
                  commentsCount={video.comment_count}
                  alwaysExpanded
                />
              </div>
            )}
          </div>

          {/* ═══ RIGHT SIDEBAR — Related Videos ═══ */}
          <aside className="w-[402px] shrink-0 hidden xl:block">
            <div className="space-y-3">
              {relatedQuery.isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="w-[168px] shrink-0 aspect-video animate-pulse rounded-lg bg-slate-100" />
                    <div className="flex-1 space-y-1.5 py-0.5">
                      <div className="h-3.5 w-full animate-pulse rounded bg-slate-100" />
                      <div className="h-3.5 w-3/4 animate-pulse rounded bg-slate-100" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                    </div>
                  </div>
                ))
              ) : relatedVideos.length > 0 ? (
                relatedVideos.map((v) => <SidebarCard key={v.id} video={v} />)
              ) : (
                <p className="text-[13px] text-slate-400 py-4">No related videos</p>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Report dialog */}
      {reportOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-[380px] rounded-2xl bg-white shadow-2xl overflow-hidden">
            {reportSubmitted ? (
              <div className="p-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-slate-900">Report Submitted</h3>
                <p className="mt-1 text-[13px] text-slate-500">Our team will review this content shortly.</p>
                <button onClick={() => setReportOpen(false)}
                  className="mt-4 w-full rounded-full bg-slate-900 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-800">Done</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                  <h3 className="text-[14px] font-bold text-slate-900">Report Content</h3>
                  <button onClick={() => setReportOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="px-5 py-4">
                  <p className="text-[12px] text-slate-500 mb-3">Why are you reporting this?</p>
                  <div className="space-y-1.5">
                    {REPORT_REASONS.map((r) => (
                      <button key={r.value} onClick={() => setReportReason(r.value)}
                        className={`w-full rounded-xl px-3.5 py-2.5 text-left text-[13px] transition ${
                          reportReason === r.value ? 'bg-slate-900 text-white font-medium' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}>{r.label}</button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-slate-100 px-5 py-3">
                  <button
                    onClick={async () => {
                      if (!reportReason) return;
                      await reportMutation.mutateAsync({ targetType: "video", targetId: video.id, reason: reportReason as Parameters<typeof reportMutation.mutateAsync>[0]["reason"] });
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
    </PostTubeShell>
  );
}
