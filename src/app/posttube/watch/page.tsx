"use client";

import { useSearchParams } from "next/navigation";
import { WatchPage } from "@/features/posttube/components/WatchPage";

export default function PostTubeWatchRoute() {
  const searchParams = useSearchParams();
  const videoId = searchParams.get("v") ?? undefined;
  return <WatchPage videoId={videoId} />;
}
