"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Settings, Trash2, Upload } from "lucide-react";

import { useAuthUser } from "@/store/auth";
import { useMyChannel } from "@/hooks/useChannels";
import { useMyProfile } from "@/hooks/useEditProfile";
import { useDeletePost } from "@/hooks/useProfilePosts";
import { useToast } from "@/components/ui/toast";
import { ChannelEmpty, ChannelHeader } from "@/features/posttube/components/ChannelHeader";
import { ConfirmDialog } from "@/features/posttube/components/ConfirmDialog";
import { VideoCard } from "@/features/posttube/components/VideoCard";
import { useLoadMoreSentinel, VideoGridSkeleton } from "@/features/posttube/components/HomePage";
import { useAuthorVideos } from "@/features/posttube/hooks/usePosttubeHome";
import { mediaServeUrl } from "@/features/posttube/model";
import type { PostTubeVideo } from "@/features/posttube/types";

/*
  GET /v1/channels/me (404 NO_CHANNEL → create prompt),
  GET /v1/posts/by-author/<me>?type=long_video&limit&cursor,
  DELETE /v1/uploads/:postId (confirm first).
*/
export default function MyChannelPage() {
  const user = useAuthUser();
  const channelQuery = useMyChannel();
  const profileQuery = useMyProfile({ enabled: !!user });
  const videosQuery = useAuthorVideos(user?.id, "long_video", 20);
  const deleteMutation = useDeletePost();
  const { toast, ToastContainer } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<PostTubeVideo | null>(null);

  const channel = channelQuery.data ?? null;
  const profile = profileQuery.data ?? null;
  const videos = videosQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const sentinelRef = useLoadMoreSentinel(!!videosQuery.hasNextPage && !videosQuery.isFetchingNextPage, () => void videosQuery.fetchNextPage());

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-brand-text">Your channel</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">Sign in to manage your channel.</p>
      </div>
    );
  }

  if (channelQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        toast({ type: "success", title: "Deleted", description: "The video was removed." });
        void videosQuery.refetch();
      },
      onError: () => toast({ type: "error", title: "Could not delete" }),
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-4 sm:px-6">
      <ChannelHeader
        channel={channel}
        fallbackName={profile?.display_name || "Your channel"}
        fallbackHandle={profile?.username}
        fallbackAvatarUrl={profile?.avatar_media_id ? mediaServeUrl(profile.avatar_media_id) : undefined}
        subscriberCount={channel?.subscriber_count ?? 0}
        videoCount={channel?.video_count ?? videos.length}
        actions={
          <>
            <Link
              href="/posttube/upload?type=long"
              className="flex items-center gap-1.5 rounded-full bg-primary-ink px-4 py-2 text-[12px] font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              <Upload className="h-3.5 w-3.5" /> Upload
            </Link>
            <Link
              href="/settings/channel"
              aria-label="Channel settings"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-brand-text hover:bg-brand-secondary"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </>
        }
      />

      {!channel ? (
        <div className="mt-6 rounded-2xl border border-border bg-brand-card p-5 text-[13px] text-brand-text">
          You don&apos;t have a channel yet. Your videos are still listed below;{" "}
          <Link href="/settings/channel" className="font-semibold text-primary-ink hover:underline">
            set up a channel
          </Link>{" "}
          to get a handle, banner and subscribers.
        </div>
      ) : null}

      <div className="mt-6 border-b border-border pb-2">
        <h2 className="text-[15px] font-bold text-brand-text">Videos</h2>
      </div>

      <div className="py-6">
        {videosQuery.isLoading ? (
          <VideoGridSkeleton count={6} />
        ) : videos.length === 0 ? (
          <ChannelEmpty title="No videos yet" hint="Upload your first video to get started." cta={{ href: "/posttube/upload?type=long", label: "Upload now" }} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((v) => (
                <div key={v.id} className="group relative">
                  <VideoCard video={v} />
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(v)}
                    aria-label={`Delete ${v.title}`}
                    className="absolute right-5 top-5 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-danger group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div ref={sentinelRef} className="h-px" />
            {videosQuery.hasNextPage ? (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => videosQuery.fetchNextPage()}
                  disabled={videosQuery.isFetchingNextPage}
                  className="rounded-full border border-border bg-brand-card px-5 py-2 text-[12px] font-semibold text-brand-text hover:bg-brand-secondary disabled:opacity-50"
                >
                  {videosQuery.isFetchingNextPage ? "Loading..." : "Load more"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete video"
        body={
          <>
            Are you sure you want to delete <strong className="text-brand-text">&ldquo;{deleteTarget?.title}&rdquo;</strong>? This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        danger
        pending={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
      <ToastContainer />
    </div>
  );
}
