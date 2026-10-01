"use client";

import { useState } from "react";
import { ImageOff, Play } from "lucide-react";
import { mediaHref } from "@/features/reels/model";
import { formatDuration } from "@/features/posttube/model";
import type { HubLibraryRow } from "../hubApi";

export function hubThumbnailSources(row: Pick<HubLibraryRow, "cover_media_id" | "thumbnail_url">): string[] {
  // Stable, authorized delivery first; old cached signed URLs can expire.
  return [...new Set([
    row.cover_media_id ? mediaHref(`/v1/media/${row.cover_media_id}/serve`) : "",
    row.thumbnail_url ? mediaHref(row.thumbnail_url) : "",
  ].filter(Boolean))];
}

export function HubThumbnail({ row }: { row: HubLibraryRow }) {
  const sources = hubThumbnailSources(row);
  // A changed source set remounts the fallback state; no stale broken image.
  return <ThumbnailImage key={sources.join("|")} sources={sources} duration={row.duration_seconds} />;
}

function ThumbnailImage({ sources, duration }: { sources: string[]; duration: number }) {
  const [index, setIndex] = useState(0);
  const src = sources[index];
  return <>
    {src ? <img src={src} alt="" onError={() => setIndex(i => i + 1)} /> : <span className="hub-poster-fallback"><ImageOff aria-hidden="true" /><span>Preview unavailable</span></span>}
    <span className="hub-poster-play"><Play aria-hidden="true" /></span>
    {duration > 0 ? <span className="hub-thumb-dur">{formatDuration(duration)}</span> : null}
  </>;
}
