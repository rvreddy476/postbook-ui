import type { Metadata } from "next";
import { Suspense } from "react";

import { ChannelScreen } from "@/features/posttube/channel/components/ChannelScreen";
import { LoadingState } from "@/features/posttube/discovery/components/DiscoveryState";
import { channelFeedPath, channelPath, channelRefFromSegment, isFeedRef } from "@/features/posttube/feed/feedUrl";

type Props = { params: Promise<{ handle: string }> };

/*
  The RSS autodiscovery link: <link rel="alternate" type="application/rss+xml">
  pointing at this channel's feed.xml, so a feed reader given the channel
  page finds the feed. Relative here; the root layout's metadataBase makes
  it absolute.
*/
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const ref = channelRefFromSegment(handle);
  const base: Metadata = {
    title: "Channel · PostTube",
    description: "A PostTube channel: videos, shorts, live recordings, collections and posts.",
  };
  if (!isFeedRef(ref)) return base;
  return {
    ...base,
    alternates: {
      canonical: channelPath(ref),
      types: { "application/rss+xml": [{ url: channelFeedPath(ref), title: "RSS feed" }] },
    },
  };
}

/*
  /posttube/channel/[handle]?tab= — a public channel. [handle] is a handle
  or a user id (the watch page links by author id when there is no
  handle). GET /v1/channels/:ref, then the tabs' by-author and collections
  reads; Follow + bell through SubscribeButton.
*/
export default async function PublicChannelPage({ params }: Props) {
  const { handle } = await params;
  return (
    <Suspense fallback={<LoadingState label="Loading channel…" />}>
      <ChannelScreen mode={{ kind: "public", ref: channelRefFromSegment(handle) }} />
    </Suspense>
  );
}
