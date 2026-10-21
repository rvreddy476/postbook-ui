import type { Metadata } from "next";

import { WatchPage } from "@/features/posttube/components/WatchPage";
import { parseStartSeconds } from "@/features/posttube/watch/startAt";
import { postPageMetadata } from "@/features/share/routeMetadata";

interface Props {
  params: Promise<{ videoId: string }>;
  searchParams: Promise<{ list?: string | string[]; t?: string | string[] }>;
}

/*
  The link preview (OpenGraph video.other + Twitter card): GET /v1/posts/:id
  read signed out — title, description, cover, and og:video pointing at the
  public 720p MP4 on the API host when FEED_MEDIA_BASE_URL (or
  NEXT_PUBLIC_API_BASE_URL) names it. A video a stranger may not see gets
  the neutral card.
*/
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { videoId } = await params;
  return postPageMetadata(videoId, `/posttube/watch/${encodeURIComponent(videoId)}`);
}

/**
 * `/posttube/watch/<id>?list=<playlistId>` — `list` plays through that collection.
 * `?t=<seconds>` starts at that moment (the player's "Copy link at current time").
 */
export default async function PostTubeWatchByIdRoute({ params, searchParams }: Props) {
  const { videoId } = await params;
  const { list, t } = await searchParams;
  const listId = Array.isArray(list) ? list[0] : list;
  return <WatchPage videoId={videoId} listId={listId || null} startSeconds={parseStartSeconds(t)} />;
}
