import type { Metadata } from "next";

import { TrendingPage } from "@/features/posttube/discovery/components/TrendingPage";

export const metadata: Metadata = {
  title: "Trending · PostTube",
  description: "The videos people are watching right now.",
};

/** `GET /v1/posts/trending?content_type=long_video` as a grid with a Today / Week / Month row. */
export default function PostTubeTrendingRoute() {
  return <TrendingPage />;
}
