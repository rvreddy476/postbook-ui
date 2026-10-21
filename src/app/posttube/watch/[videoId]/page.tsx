import { WatchPage } from "@/features/posttube/components/WatchPage";
import { parseStartSeconds } from "@/features/posttube/watch/startAt";

interface Props {
  params: Promise<{ videoId: string }>;
  searchParams: Promise<{ list?: string | string[]; t?: string | string[] }>;
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
