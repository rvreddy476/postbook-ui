import type { Metadata } from "next";
import { Suspense } from "react";

import { ChannelScreen } from "@/features/posttube/channel/components/ChannelScreen";
import { LoadingState } from "@/features/posttube/discovery/components/DiscoveryState";

export const metadata: Metadata = {
  title: "Channel · PostTube",
  description: "A PostTube channel: videos, shorts, live recordings, collections and posts.",
};

/*
  /posttube/channel/[handle]?tab= — a public channel. [handle] is a handle
  or a user id (the watch page links by author id when there is no
  handle). GET /v1/channels/:ref, then the tabs' by-author and collections
  reads; Follow + bell through SubscribeButton.
*/
export default async function PublicChannelPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  let ref = handle;
  try {
    ref = decodeURIComponent(handle);
  } catch {
    // a malformed escape: use the segment as it came
  }
  return (
    <Suspense fallback={<LoadingState label="Loading channel…" />}>
      <ChannelScreen mode={{ kind: "public", ref: ref.replace(/^@/, "") }} />
    </Suspense>
  );
}
