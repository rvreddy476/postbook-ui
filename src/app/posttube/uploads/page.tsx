"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Video, Film, FileText, Trash2, Loader2, Heart, MessageCircle, Play, Upload } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { useMyVideos, useMyFlicks, useMyPosts, useUploadCounts, useDeleteUpload } from "@/hooks/useMyUploads";
import { ConfirmDialog } from "@/features/posttube/components/ConfirmDialog";
import { formatCount, formatDuration, timeAgo } from "@/features/posttube/model";
import type { UploadDetail } from "@/types/profile";

/*
  GET /v1/uploads/videos|flicks|posts?limit&cursor, GET /v1/uploads/counts,
  DELETE /v1/uploads/:postId (after a confirm).
*/

const TABS = [
  { id: "videos" as const, label: "Videos", icon: Video },
  { id: "flicks" as const, label: "Reels", icon: Film },
  { id: "posts" as const, label: "Posts", icon: FileText },
];

type TabId = (typeof TABS)[number]["id"];

function UploadCard({ item, onDelete, isDeleting, variant }: { item: UploadDetail; onDelete: () => void; isDeleting: boolean; variant: TabId }) {
  const thumbnailUrl = item.video_metadata?.thumbnail_url || (item.cover_media_id ? `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/v1/media/${item.cover_media_id}/serve` : "");
  const isVideo = variant === "videos" || variant === "flicks";
  const href = variant === "videos" ? `/posttube/watch/${item.id}` : variant === "flicks" ? `/reels?reelId=${item.id}` : `/post/${item.id}`;
  const status = item.video_metadata?.upload_status;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="group overflow-hidden rounded-xl border border-border bg-brand-card transition-shadow hover:shadow-md"
    >
      {isVideo && (
        <Link href={href} className={`relative block bg-brand-secondary ${variant === "flicks" ? "aspect-9/16" : "aspect-video"}`}>
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary-ink/80">
              <Play className="h-8 w-8 text-white/40" />
            </div>
          )}
          {item.video_metadata?.duration_seconds ? (
            <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">{formatDuration(item.video_metadata.duration_seconds)}</span>
          ) : null}
          {status && status !== "ready" && status !== "published" ? (
            <span className="absolute left-2 top-2 rounded bg-warning px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">{status}</span>
          ) : null}
        </Link>
      )}

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Link href={href} className="line-clamp-2 text-[13px] font-semibold text-brand-text hover:text-primary-ink">
              {item.title || item.text || "Untitled"}
            </Link>
            <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(item.created_at)}</p>
          </div>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            aria-label="Delete"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-brand-secondary hover:text-danger disabled:opacity-50"
          >
            {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          {item.counts ? (
            <>
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" /> {formatCount(item.counts.likes)}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" /> {formatCount(item.counts.comments)}
              </span>
            </>
          ) : null}
          {isVideo && item.video_metadata?.final_category ? (
            <span className="ml-auto rounded bg-brand-secondary px-1.5 py-0.5 text-[10px] font-medium text-brand-text">{item.video_metadata.final_category.replace("_", " ")}</span>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

type UploadsQuery = ReturnType<typeof useMyVideos>;

function VideosTab() {
  return <UploadsList tab="videos" query={useMyVideos(20)} />;
}
function FlicksTab() {
  return <UploadsList tab="flicks" query={useMyFlicks(20)} />;
}
function PostsTab() {
  return <UploadsList tab="posts" query={useMyPosts(20)} />;
}

function UploadsList({ tab, query }: { tab: TabId; query: UploadsQuery }) {
  const deleteMutation = useDeleteUpload();
  const { toast, ToastContainer } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [target, setTarget] = useState<UploadDetail | null>(null);

  const items = query.data?.pages.flatMap((p) => p.data) ?? [];
  const noun = tab === "videos" ? "video" : tab === "flicks" ? "reel" : "post";

  const confirmDelete = () => {
    if (!target) return;
    const id = target.id;
    setDeletingId(id);
    deleteMutation.mutate(
      { postId: id },
      {
        onSuccess: () => {
          toast({ type: "success", title: "Deleted", description: `The ${noun} was removed.` });
          setTarget(null);
        },
        onError: () => toast({ type: "error", title: "Could not delete", description: `The ${noun} is still there.` }),
        onSettled: () => setDeletingId(null),
      },
    );
  };

  if (query.isLoading) return <LoadingSkeleton />;
  if (!items.length) return <EmptyState label={`No ${noun}s yet`} tab={tab} />;

  const grid = tab === "flicks" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : tab === "posts" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <>
      <div className={`grid gap-4 ${grid}`}>
        <AnimatePresence>
          {items.map((item) => (
            <UploadCard key={item.id} item={item} variant={tab} onDelete={() => setTarget(item)} isDeleting={deletingId === item.id} />
          ))}
        </AnimatePresence>
      </div>
      {query.hasNextPage ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            className="rounded-full border border-border bg-brand-card px-5 py-2 text-[12px] font-semibold text-brand-text hover:bg-brand-secondary disabled:opacity-50"
          >
            {query.isFetchingNextPage ? "Loading..." : "Load more"}
          </button>
        </div>
      ) : null}
      <ConfirmDialog
        open={!!target}
        title={`Delete this ${noun}?`}
        body={
          <>
            <strong className="text-brand-text">&ldquo;{target?.title || target?.text || "Untitled"}&rdquo;</strong> is removed for everyone. This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        danger
        pending={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onClose={() => setTarget(null)}
      />
      <ToastContainer />
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-border bg-brand-card">
          <div className="aspect-video bg-brand-secondary" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-3/4 rounded bg-brand-secondary" />
            <div className="h-3 w-1/2 rounded bg-brand-secondary" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ label, tab }: { label: string; tab: TabId }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Video className="mb-3 h-10 w-10" />
      <p className="text-[14px] font-semibold text-brand-text">{label}</p>
      <p className="mt-1 text-[12px]">Your uploaded content will appear here.</p>
      {tab !== "posts" ? (
        <Link
          href={`/posttube/upload?type=${tab === "videos" ? "long" : "short"}`}
          className="mt-4 flex items-center gap-2 rounded-full bg-primary-ink px-5 py-2.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          <Upload className="h-3.5 w-3.5" /> Upload now
        </Link>
      ) : null}
    </div>
  );
}

export default function MyUploadsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("videos");
  const { data: counts } = useUploadCounts();

  const countMap: Record<TabId, number> = {
    videos: counts?.videos ?? 0,
    flicks: counts?.flicks ?? 0,
    posts: counts?.posts ?? 0,
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-brand-text">Your videos</h1>
          <p className="text-[12px] text-muted-foreground">Manage your videos, reels and posts.</p>
        </div>
        <Link
          href="/posttube/upload?type=long"
          className="flex items-center gap-1.5 rounded-full bg-primary-ink px-4 py-2 text-[13px] font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          <Upload className="h-4 w-4" /> Upload
        </Link>
      </div>

      <div className="mb-6 flex w-fit items-center gap-1 rounded-xl bg-brand-secondary p-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={isActive}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold transition-all ${isActive ? "bg-brand-card text-brand-text shadow-xs" : "text-muted-foreground hover:text-brand-text"}`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {countMap[tab.id] > 0 ? (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? "bg-brand-secondary text-brand-text" : "bg-brand-card text-muted-foreground"}`}>{formatCount(countMap[tab.id])}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
          {activeTab === "videos" ? <VideosTab /> : activeTab === "flicks" ? <FlicksTab /> : <PostsTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
