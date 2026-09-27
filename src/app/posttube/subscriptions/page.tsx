"use client";

import Link from "next/link";
import { Loader2, Users } from "lucide-react";

import { useAuthUser } from "@/store/auth";
import { useMyChannelSubscriptions } from "@/hooks/usePosttubeExtras";
import { Avatar } from "@/components/LetterAvatar";
import { channelAvatarUrl, channelUserId } from "@/features/posttube/data/posttubeApi";
import { VideoCard } from "@/features/posttube/components/VideoCard";
import { useLoadMoreSentinel, VideoGridSkeleton } from "@/features/posttube/components/HomePage";
import { useLongVideosFeed } from "@/features/posttube/hooks/usePosttubeHome";
import { CHIP_SUBSCRIPTIONS, formatCount } from "@/features/posttube/model";

/*
  Channels: GET /v1/channels/subscriptions?limit&cursor.
  Feed:     GET /v1/feed/videos?subscribed_only=true&limit&cursor.
*/
export default function PosttubeSubscriptionsPage() {
  const user = useAuthUser();
  const subs = useMyChannelSubscriptions(30);
  const feed = useLongVideosFeed(CHIP_SUBSCRIPTIONS, 20, !!user);

  const channels = subs.data?.pages.flatMap((p) => p.items) ?? [];
  const videos = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const sentinelRef = useLoadMoreSentinel(!!feed.hasNextPage && !feed.isFetchingNextPage, () => void feed.fetchNextPage());

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-semibold text-brand-text">Following</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">Sign in to see the channels you follow.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-secondary text-brand-text">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-brand-text">Following</h1>
          <p className="text-[12px] text-muted-foreground">New videos from the channels you follow.</p>
        </div>
      </div>

      {/* Channel strip */}
      <section className="mb-7">
        {subs.isLoading ? (
          <div className="flex gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex w-[88px] flex-col items-center gap-2">
                <div className="h-16 w-16 animate-pulse rounded-full bg-brand-secondary" />
                <div className="h-3 w-14 animate-pulse rounded bg-brand-secondary" />
              </div>
            ))}
          </div>
        ) : channels.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">You have not subscribed to any channels yet.</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {channels.map((row) => {
              const c = row.channel;
              const ref = c.handle || channelUserId(c) || "";
              return (
                <Link key={ref || c.name} href={`/posttube/channel/${encodeURIComponent(ref)}`} className="flex w-[88px] shrink-0 flex-col items-center gap-2 text-center">
                  <Avatar src={channelAvatarUrl(c)} name={c.name} seed={channelUserId(c) ?? c.name} size="xl" className="ring-1 ring-border" />
                  <span className="line-clamp-2 text-[12px] font-semibold leading-tight text-brand-text">{c.name}</span>
                  <span className="-mt-1 text-[10px] text-muted-foreground">{formatCount(c.subscriber_count ?? 0)} subs</span>
                </Link>
              );
            })}
            {subs.hasNextPage ? (
              <button
                type="button"
                onClick={() => subs.fetchNextPage()}
                disabled={subs.isFetchingNextPage}
                className="flex h-16 w-16 shrink-0 items-center justify-center self-start rounded-full border border-border text-[11px] font-semibold text-brand-text hover:bg-brand-secondary"
              >
                {subs.isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : "More"}
              </button>
            ) : null}
          </div>
        )}
      </section>

      {/* Feed */}
      {feed.isLoading ? (
        <VideoGridSkeleton />
      ) : videos.length === 0 ? (
        <div className="py-16 text-center text-[13px] text-muted-foreground">
          {channels.length === 0 ? (
            <>
              Find channels on the{" "}
              <Link href="/posttube" className="font-semibold text-primary-ink hover:underline">
                home page
              </Link>{" "}
              and subscribe to build your feed.
            </>
          ) : (
            "No new videos from your subscriptions yet."
          )}
        </div>
      ) : (
        <section>
          <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
          <div ref={sentinelRef} className="h-px" />
          {feed.hasNextPage ? (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => feed.fetchNextPage()}
                disabled={feed.isFetchingNextPage}
                className="rounded-full border border-border bg-brand-card px-6 py-2.5 text-[13px] font-semibold text-brand-text hover:bg-brand-secondary disabled:opacity-50"
              >
                {feed.isFetchingNextPage ? "Loading..." : "Load more"}
              </button>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
