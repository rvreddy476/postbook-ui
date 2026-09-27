import type { Metadata } from "next";
import { Suspense } from "react";

import { SearchPage } from "@/features/posttube/discovery/components/SearchPage";
import { LoadingState } from "@/features/posttube/discovery/components/DiscoveryState";

export const metadata: Metadata = {
  title: "Search · PostTube",
  description: "Find videos, channels and collections on PostTube.",
};

/**
 * `/posttube/search?q=&tab=&len=&when=&sort=`. The query and every filter
 * live in the URL; useSearchParams needs the Suspense boundary.
 */
export default function PostTubeSearchRoute() {
  return (
    <Suspense fallback={<LoadingState label="Loading search…" />}>
      <SearchPage />
    </Suspense>
  );
}
