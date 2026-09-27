"use client";

import { use } from "react";

import { CollectionScreen } from "@/features/posttube/library";

/*
  /posttube/playlists/[id] — one user collection. GET /v1/playlists/:id,
  GET /v1/playlists/:id/items, PATCH /v1/playlists/:id, DELETE /v1/playlists/:id,
  PATCH|DELETE /v1/playlists/:id/items/:postId.
*/
export default function PlaylistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CollectionScreen source={{ kind: "user", id }} backHref="/posttube/playlists" backLabel="Collections" />;
}
