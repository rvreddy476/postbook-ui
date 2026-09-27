import { WatchPage } from "@/features/posttube/components/WatchPage";

interface Props {
  params: Promise<{ videoId: string }>;
  searchParams: Promise<{ list?: string | string[] }>;
}

/** `/posttube/watch/<id>?list=<playlistId>` — `list` plays through that collection. */
export default async function PostTubeWatchByIdRoute({ params, searchParams }: Props) {
  const { videoId } = await params;
  const { list } = await searchParams;
  const listId = Array.isArray(list) ? list[0] : list;
  return <WatchPage videoId={videoId} listId={listId || null} />;
}
