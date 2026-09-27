import type { Metadata } from "next";

import { LivePage } from "@/features/posttube/discovery/components/LivePage";

export const metadata: Metadata = {
  title: "Live · PostTube",
  description: "Broadcasts happening now on PostTube, and what is coming up.",
};

/** Live now + Upcoming from live-service-v2 (`GET /v1/livestream/streams`). Past streams wait on the VOD route. */
export default function PostTubeLiveRoute() {
  return <LivePage />;
}
