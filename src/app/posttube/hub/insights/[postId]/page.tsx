"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";

import { ContentInsightsPage } from "@/features/posttube/hub/components/InsightsPage";
import { HubSkeleton } from "@/features/posttube/hub/components/HubEmpty";

export default function HubContentInsightsRoute() {
  const params = useParams<{ postId: string }>();
  const postId = typeof params?.postId === "string" ? params.postId : "";
  return (
    <Suspense fallback={<HubSkeleton rows={4} height={64} />}>
      <ContentInsightsPage postId={postId} />
    </Suspense>
  );
}
