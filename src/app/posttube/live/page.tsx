import type { Metadata } from "next";

import { LivePage } from "@/features/posttube/discovery/components/LivePage";

export const metadata: Metadata = {
  title: "Live · PostTube",
  description: "Broadcasts happening now on PostTube, and what is coming up.",
};

/** Hero, Live now, Upcoming events, topic rails and Past streams (live-service-v2 discovery routes; see features/live/discovery.ts). */
export default function PostTubeLiveRoute() {
  return <LivePage />;
}
