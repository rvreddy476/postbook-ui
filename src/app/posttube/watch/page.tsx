"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { WatchPage } from "@/features/posttube/components/WatchPage";

function WatchContent() {
  const searchParams = useSearchParams();
  const videoId = searchParams.get("v") ?? undefined;
  return <WatchPage videoId={videoId} />;
}

export default function PostTubeWatchRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-bg" />}>
      <WatchContent />
    </Suspense>
  );
}
