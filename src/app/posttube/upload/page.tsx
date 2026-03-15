"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { UploadStudio, type ContentType } from "@/features/upload/UploadStudio";

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

  return <UploadStudio contentType={type} />;
}

export default function PosttubeUploadRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fcfaff]" />}>
      <UploadContent />
    </Suspense>
  );
}
