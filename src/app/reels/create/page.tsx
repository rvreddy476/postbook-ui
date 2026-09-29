"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UploadStudio } from "@/features/upload/UploadStudio";
import { soundIdFromSearch } from "@/features/upload/studioSound";

// ?sound=<id> starts the studio with that sound chosen ("Use this sound").
function CreateReelContent() {
  const searchParams = useSearchParams();
  return <UploadStudio contentType="reel" soundId={soundIdFromSearch(searchParams.get("sound"))} />;
}

export default function CreateReelRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-bg" />}>
      <CreateReelContent />
    </Suspense>
  );
}
