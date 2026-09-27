"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { UploadStudio, type ContentType } from "@/features/upload/UploadStudio";
import { ChannelGate } from "@/features/posttube/channelGate/ChannelGate";

const VALID_TYPES = new Set(["long", "short", "reel", "flick", "podcast"]);

function UploadContent() {
  const searchParams = useSearchParams();
  const raw = searchParams.get("type") ?? "long";

  let type: ContentType;
  if (raw === "flick") {
    type = "short";
  } else if (VALID_TYPES.has(raw)) {
    type = (raw === "short" || raw === "reel" || raw === "podcast") ? raw : "long";
  } else {
    type = "long";
  }

  // A long video or podcast needs a channel: ask for it before step one, not at publish.
  return (
    <ChannelGate contentType={type}>
      <UploadStudio contentType={type} />
    </ChannelGate>
  );
}

export default function PosttubeUploadRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-bg" />}>
      <UploadContent />
    </Suspense>
  );
}
