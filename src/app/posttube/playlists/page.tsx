"use client";

import { CollectionsIndex } from "@/features/posttube/library";

/*
  /posttube/playlists — Collections. GET /v1/creators/<me>/playlists;
  POST /v1/playlists { title, description?, visibility }; DELETE /v1/playlists/:id.
*/
export default function PosttubePlaylistsPage() {
  return <CollectionsIndex />;
}
