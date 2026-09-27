import type { Metadata } from "next";
import { Suspense } from "react";

import { ChannelScreen } from "@/features/posttube/channel/components/ChannelScreen";
import { LoadingState } from "@/features/posttube/discovery/components/DiscoveryState";

export const metadata: Metadata = {
  title: "Your channel · PostTube",
  description: "Your PostTube channel: videos, shorts, live recordings, collections and posts.",
};

/*
  /posttube/channel?tab= — the viewer's own channel. GET /v1/channels/me
  (404 NO_CHANNEL → the create card linking to /posttube/upload?type=long);
  the tabs read GET /v1/posts/by-author/<me>?type=long_video|flick|post and
  GET /v1/creators/<me>/playlists. useSearchParams needs the Suspense boundary.
*/
export default function MyChannelPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading channel…" />}>
      <ChannelScreen mode={{ kind: "own" }} />
    </Suspense>
  );
}
