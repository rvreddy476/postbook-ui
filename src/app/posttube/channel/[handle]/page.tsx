"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuthUser } from "@/store/auth";
import { useChannelByRef } from "@/hooks/useChannels";
import { ChannelEmpty, ChannelHeader } from "@/features/posttube/components/ChannelHeader";
import { SubscribeButton } from "@/features/posttube/components/SubscribeButton";
import { VideoCard } from "@/features/posttube/components/VideoCard";
import { useLoadMoreSentinel, VideoGridSkeleton } from "@/features/posttube/components/HomePage";
import { useAuthorVideos } from "@/features/posttube/hooks/usePosttubeHome";
import { channelUserId } from "@/features/posttube/data/posttubeApi";

/*
  GET /v1/channels/:ref (handle or user id) → subscriber_count, is_subscribed, notify_on;
  GET /v1/posts/by-author/<user_id>?type=long_video&limit&cursor;
  Subscribe/bell through SubscribeButton.
*/
export default function PublicChannelPage() {
  const params = useParams();
  const ref = decodeURIComponent(String(params.handle ?? ""));
  const user = useAuthUser();

  const channelQuery = useChannelByRef(ref || undefined);
  const channel = channelQuery.data ?? null;
  // `ref` may already be a user id (watch page links by author id when there is no handle).
  const authorId = channelUserId(channel) ?? (channelQuery.isFetched && !channel && /^[0-9a-f-]{20,}$/i.test(ref) ? ref : undefined);
  const videosQuery = useAuthorVideos(authorId, "long_video", 20);
  const videos = videosQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const sentinelRef = useLoadMoreSentinel(!!videosQuery.hasNextPage && !videosQuery.isFetchingNextPage, () => void videosQuery.fetchNextPage());

  const [subscriberCount, setSubscriberCount] = useState(0);
  useEffect(() => {
    setSubscriberCount(channel?.subscriber_count ?? 0);
  }, [channel?.subscriber_count]);

  if (channelQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!channel && !authorId) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
        <h2 className="text-xl font-bold text-brand-text">Channel not found</h2>
        <p className="mt-2 text-[13px] text-muted-foreground">The channel you are looking for does not exist or has been removed.</p>
      </div>
    );
  }

  const isOwn = !!user && !!authorId && user.id === authorId;
  const fallbackName = videos[0]?.channel_name;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-4 sm:px-6">
      <ChannelHeader
        channel={channel}
        fallbackName={fallbackName || ref}
        fallbackAvatarUrl={videos[0]?.channel_avatar_url}
        subscriberCount={subscriberCount}
        videoCount={channel?.video_count}
        actions={
          <SubscribeButton
            channelRef={ref}
            initialSubscribed={channel?.is_subscribed ?? false}
            initialNotifyOn={channel?.notify_on ?? null}
            hidden={isOwn || !user}
            onSubscribedChange={(s) => setSubscriberCount((c) => Math.max(0, c + (s ? 1 : -1)))}
          />
        }
      />

      <div className="mt-6 border-b border-border pb-2">
        <h2 className="text-[15px] font-bold text-brand-text">Videos</h2>
      </div>

      <div className="py-6">
        {videosQuery.isLoading || (!authorId && channelQuery.isFetching) ? (
          <VideoGridSkeleton count={6} />
        ) : videos.length === 0 ? (
          <ChannelEmpty title="No videos yet" />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((v) => (
                <VideoCard key={v.id} video={v} />
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
    </div>
  );
}
