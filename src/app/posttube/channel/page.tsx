"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Video, Film, Settings, Play, Eye, Heart, Upload, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar } from "@/components/LetterAvatar";
import { useMyProfile } from "@/hooks/useEditProfile";
import { useProfilePosts, useDeletePost } from "@/hooks/useProfilePosts";
import { AppShell } from "@/features/reels/components/AppShell";
import type { PostDetail } from "@/types/profile";

type Tab = "videos" | "flicks";

function fmtCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDuration(sec: number) {
  if (sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function mediaUrl(mediaId: string) {
  return `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/v1/media/${mediaId}/serve`;
}

function PostCard({ post, onDelete }: { post: PostDetail; onDelete: (id: string) => void }) {
  const isFlick = post.content_type === "reel" || post.content_type === "flick";
  const href = isFlick
    ? `/reels?reelId=${post.id}`
    : `/posttube/watch/${post.id}`;

  const thumbMedia = post.media?.find((m) => m.kind === "thumbnail" || m.kind === "cover");
  const coverUrl = post.cover_media_id ? mediaUrl(post.cover_media_id) : null;
  const thumbUrl = thumbMedia ? mediaUrl(thumbMedia.media_id) : coverUrl;

  return (
    <div className="group relative">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-brand-secondary">
        <Link href={href} className="block h-full">
          {thumbUrl ? (
            <img src={thumbUrl} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Play className="h-8 w-8 text-brand-text/30" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
            <Play className="h-10 w-10 text-white opacity-0 transition-opacity group-hover:opacity-100" fill="white" />
          </div>
        </Link>

        {/* Trash icon — always visible, bottom-right of thumbnail */}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(post.id); }}
          className="absolute bottom-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white hover:bg-rose-600 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-2 px-0.5">
        <Link href={href}>
          <p className="truncate text-[13px] font-semibold text-brand-text hover:text-brand-text transition-colors">
            {post.text || "Untitled"}
          </p>
        </Link>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-brand-text/60">
          <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{fmtCount(post.counts?.likes ?? 0)}</span>
          <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{fmtCount(post.counts?.comments ?? 0)}</span>
        </div>
      </div>
    </div>
  );
}

export default function MyChannelPage() {
  const { data: profile } = useMyProfile();
  const [tab, setTab] = useState<Tab>("videos");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const deleteMutation = useDeletePost();

  // Fetch all user posts, then filter client-side by content type
  const allQuery = useProfilePosts(profile?.id, "all");
  const allPosts = allQuery.data?.pages.flatMap((p) => p.data) ?? [];

  const flickTypes = new Set(["reel", "flick", "short"]);
  const flicks = allPosts.filter((p) => flickTypes.has(p.content_type));
  // Videos = everything that isn't a flick/reel (includes video, long_video, post with media, etc.)
  const videos = allPosts.filter((p) => !flickTypes.has(p.content_type));
  const items = tab === "videos" ? videos : flicks;
  const query = allQuery;

  const handleDeleteRequest = useCallback((postId: string) => {
    const post = allPosts.find((p) => p.id === postId);
    setDeleteTarget({ id: postId, title: post?.text || "Untitled" });
  }, [allPosts]);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  }, [deleteTarget, deleteMutation]);

  const avatarUrl = profile?.avatar_media_id ? mediaUrl(profile.avatar_media_id) : undefined;
  const bannerUrl = profile?.cover_media_id ? mediaUrl(profile.cover_media_id) : undefined;

  return (
    <AppShell sectionLabel="PostTube">
      <div className="min-h-screen bg-brand-card">
        {/* Banner */}
        <div className="relative h-40 bg-gradient-to-br from-brand-text via-brand-text/50 to-purple-400">
          {bannerUrl && (
            <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>

        {/* Profile info */}
        <div className="mx-auto max-w-[960px] px-6">
          <div className="relative -mt-12 flex items-end gap-5">
            <Avatar
              src={avatarUrl}
              name={profile?.display_name || "User"}
              seed={profile?.id}
              size="xl"
              className="h-24 w-24 rounded-full border-4 border-white shadow-lg"
            />
            <div className="flex-1 min-w-0 pb-2">
              <h1 className="text-[22px] font-bold text-brand-text">
                {profile?.display_name || "My Channel"}
              </h1>
              {profile?.username && (
                <p className="text-[13px] text-brand-text/60">@{profile.username}</p>
              )}
              <div className="mt-1 flex items-center gap-4 text-[12px] text-brand-highlight">
                <span><strong className="text-brand-text">{videos.length}</strong> videos</span>
                <span><strong className="text-brand-text">{flicks.length}</strong> flicks</span>
              </div>
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Link
                href="/posttube/upload?type=long"
                className="flex items-center gap-1.5 rounded-xl bg-brand-text px-4 py-2 text-[12px] font-semibold text-white hover:bg-brand-text transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload
              </Link>
              <Link
                href="/settings/channel"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand-divider text-brand-text/60 hover:bg-brand-secondary hover:text-brand-highlight transition-colors"
              >
                <Settings className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex items-center gap-1 border-b border-brand-divider">
            {([
              { id: "videos" as Tab, label: "Videos", icon: Video, count: videos.length },
              { id: "flicks" as Tab, label: "Flicks", icon: Film, count: flicks.length },
            ]).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative flex items-center gap-1.5 px-4 py-3 text-[13px] font-semibold transition-colors ${
                  tab === t.id ? "text-brand-text" : "text-brand-text/60 hover:text-brand-highlight"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
                {t.count > 0 && (
                  <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    tab === t.id ? "bg-brand-text/10 text-brand-text" : "bg-brand-secondary text-brand-text/60"
                  }`}>
                    {t.count}
                  </span>
                )}
                {tab === t.id && (
                  <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-brand-text" />
                )}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="py-6">
            {items.length === 0 && !query.isLoading ? (
              <div className="flex flex-col items-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-secondary">
                  {tab === "videos" ? <Video className="h-7 w-7 text-brand-text/30" /> : <Film className="h-7 w-7 text-brand-text/30" />}
                </div>
                <p className="mt-4 text-[14px] font-semibold text-brand-highlight">No {tab} yet</p>
                <p className="mt-1 text-[12px] text-brand-text/60">Upload your first {tab === "videos" ? "video" : "flick"} to get started</p>
                <Link
                  href={`/posttube/upload?type=${tab === "videos" ? "long" : "short"}`}
                  className="mt-4 rounded-xl bg-brand-text px-5 py-2.5 text-[12px] font-semibold text-white hover:bg-brand-text transition-colors"
                >
                  Upload Now
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
                {items.map((item) => (
                  <PostCard key={item.id} post={item} onDelete={handleDeleteRequest} />
                ))}
              </div>
            )}

            {query.hasNextPage && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => query.fetchNextPage()}
                  disabled={query.isFetchingNextPage}
                  className="rounded-xl border border-brand-divider px-5 py-2 text-[12px] font-semibold text-brand-highlight hover:bg-brand-secondary disabled:opacity-40 transition-colors"
                >
                  {query.isFetchingNextPage ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-[400px] rounded-2xl bg-brand-card shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-brand-divider px-6 py-4">
                <h3 className="text-[15px] font-bold text-brand-text">Delete Video</h3>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-brand-text/60 hover:bg-brand-secondary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-6 py-5">
                <p className="text-[13px] text-brand-highlight">
                  Are you sure you want to delete <strong className="text-brand-text">&ldquo;{deleteTarget.title}&rdquo;</strong>? This action cannot be undone.
                </p>
              </div>
              <div className="border-t border-brand-divider px-6 py-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-brand-highlight hover:bg-brand-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleteMutation.isPending}
                  className="rounded-xl bg-rose-500 px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-rose-600 disabled:opacity-50 transition-colors"
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
