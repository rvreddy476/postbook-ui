"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { CollectionsIndex, wantsNewCollection } from "@/features/posttube/library";

/*
  /posttube/playlists — Collections. GET /v1/creators/<me>/playlists;
  POST /v1/playlists { title, description?, visibility }; DELETE /v1/playlists/:id.
  `?new=1` (the header Create menu) lands with the create sheet open;
  useSearchParams needs the Suspense boundary.
*/
function PlaylistsContent() {
  const searchParams = useSearchParams();
  return <CollectionsIndex openNew={wantsNewCollection(searchParams)} />;
}

export default function PosttubePlaylistsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-bg" />}>
      <PlaylistsContent />
    </Suspense>
  );
}
